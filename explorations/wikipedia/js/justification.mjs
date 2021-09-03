/* jshint browser: true, devel: true, esversion: 9, laxcomma: true, laxbreak: true, unused: true */
import {getElementSizesInPx} from '../../calibrate/js/domTool.mjs';

/***
 * Justification
 * to port https://variablefonts.typenetwork.com/topics/spacing/justification
 *
 *
 *
 ***/
function* _deepTextGen(node, [skipSelector, skipClass]) {
    // console.log('_deepTextGen:', node);
    let continueWithNextSiblings = false;
    if(Array.isArray(node)){
        [node, continueWithNextSiblings] = node;
    }

    // console.log('_deepTextGen:', node, nextElementSiblings, '==>', node.nextSibling);

    if(node && skipSelector && node.nodeType === Node.ELEMENT_NODE && node.matches(skipSelector)){
        if(skipClass)
            node.classList.add(skipClass);
        return;
    }
    // Only if node is an element, otherwise, assert it's a text
    // node and continue with it and then it's nextSiblinds...
    // this way we can start the generator in the middle of an element.
    if(node.nodeType === Node.ELEMENT_NODE && !continueWithNextSiblings)
        // Only descent into the node but do not use node.nextSibling.
        node = node.firstChild;
    while(node !== null) {
        if(node.nodeType === Node.TEXT_NODE)
            yield node;
        else if(node.nodeType === Node.ELEMENT_NODE) {
            yield* _deepTextGen(node, [skipSelector, skipClass]);
        }
        // else: skip, is COMMENT_NODE or such
        node = node.nextSibling;
    }
}

/**
 * In https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace#whitespace_helper_functions
 * we find this regex that is not "\s" originally called "is_all_ws":
 *
 *
 * Throughout, whitespace is defined as one of the characters
 *  "\t" TAB \u0009
 *  "\n" LF  \u000A
 *  "\r" CR  \u000D
 *  " "  SPC \u0020
 *
 * This does not use Javascript's "\s" because that includes non-breaking
 * spaces (and also some other characters).
 */

/**
 * Determine whether a node's text content is entirely whitespace.
 *
 * @param nod  A node implementing the |CharacterData| interface (i.e.,
 *             a |Text|, |Comment|, or |CDATASection| node
 * @return     True if all of the text content of |nod| is whitespace,
 *             otherwise false.
 */
function _isWhiteSpaceTextNode(node) { // jshint ignore:line
  // Use ECMA-262 Edition 3 String and RegExp features
  return !(/[^\t\n\r ]/.test(node.data));
}
function _isWhiteSpaceText(text) { // jshint ignore:line
  // Use ECMA-262 Edition 3 String and RegExp features
  return !(/[^\t\n\r ]/.test(text));
}

function _hasNoSizeTextNode(node) {
    let rtest = new Range();
    rtest.setStart(node, 0);
    rtest.setEnd(node, node.data.length);
    let bounds = rtest.getBoundingClientRect();
    return bounds.width === 0 && bounds.height === 0;
}

const WHITESPACE = new Set([' ', '\t', '\r', '\n']);

class Line {
    constructor() {
        this.range = new Range();
        this.nodes =  [];
        // Collect the whitespace before the line separately.
        this.wsNodes = [];
        this.wsTextContent = '';
        this.wsRange = new Range();
        this._collectWhitespace = true;

        // set externally  at the moment.
        this.columnRect = null;
    }

    _addNodeIndex(range, nodes, node, index) {
        if(!nodes.length) {
            range.setStart(node, index);
        }
        range.setEnd(node, index);
        if(nodes[nodes.length-1] !== node) {
            nodes.push(node);
        }
    }

    setIndex(node, index) {
        if(this.collectWhitespace
                 // not a new node
                 && this.wsRange.endContainer === node
                 // This is important, seems like these double sometimes
                 // when coming from this.collectWhitespace.
                 && this.wsRange.endOffset < index
                 && !WHITESPACE.has(node.data[index-1])) {
            // first none-whitespace data
            this.collectWhitespace = false;
            this._addNodeIndex(this.range, this.nodes,
                    this.wsRange.endContainer, this.wsRange.endOffset);
        }


        if(this.collectWhitespace) {
            this._addNodeIndex(this.wsRange, this.wsNodes, node, index);
        }
        else {
            this._addNodeIndex(this.range, this.nodes, node, index);
        }
    }
    undoSetIndex(node, index) {
        // only done once at the end of the line, we know that node
        // must be in this.nodes
        let nodes, range;
        if(this.collectWhitespace) {
            nodes = this.wsNodes;
            range = this.wsRange;
        }
        else {
            nodes = this.nodes;
            range = this.range;
        }
        let forReporting = nodes.slice();
        while(node !== nodes[nodes.length-1]) {
            nodes.pop();
            if(!nodes.length) {
                console.warn('node:', node, ' not in nodes:', ...forReporting);
                throw new Error(`undoSetIndex: node not found "${node.data}"!`);
            }
        }
        this.setIndex(node, index);
    }
    set collectWhitespace(val) {
        if(val !== false)
            throw new Error('Line.collectWhitespace can only be set to false.');
        if(!this._collectWhitespace)
            return;
        this._collectWhitespace = false;
        // Preserving the textContent, as the nodes/selection will become
        // invalid.
        this.wsTextContent = this.wsRange.toString();
    }
    get collectWhitespace() {
        return this._collectWhitespace;
    }
    removeWhiteSpaceFromEndOfLine() {
        let endIndex = this.range.endOffset
          , endNode = this.range.endContainer
           // after this, the line ends without cleaning whitespace
           // so it's for now our a natural bound for the next line.
          , collected = [[endNode, endIndex]]
          ;

        if(endNode !== this.nodes[this.nodes.length-1]) {
            // I think this will never fire, but I may be mistaken, let's see!
            throw new Error('Assertion Failed: '
                    + 'this.range.endContainer !== last node of this.nodes.');
        }
        while(true) {
            if(endIndex === 0) {
                // we reached the start/boundary of endNode
                // remove that node, it now belongs wholly to whitespace
                this.nodes.pop();
                // set the start of endNode as a start for whitespace
                collected.push([endNode, 0]);
                endNode = this.nodes[this.nodes.length-1];
                if(!endNode) {
                    //  we are out of nodes! this is probably an empty line!!!
                    break;
                }
                endIndex = endNode.data.length;
                // Set the "end index" of the next node to start the search
                // for witespace.
                collected.push([endNode, endIndex]);
                continue;// re-evaluate the new endIndex
            }
            if(WHITESPACE.has(endNode.data[endIndex-1])) {
                endIndex -= 1;
                continue;
            }
            // else
            // after this: whitespace or emptiness
            // before this: no whitespace
            collected.push([endNode, endIndex]);
            break;
        }
        collected.reverse();
        this.setIndex(...collected[0]);
        return collected;
    }
}

function _getContainingRect(lineRangeOrNode) {
    let lineParent = getClosestBlockParent(
                // if it has a startContainer it's probably a Range
                // otherwise, assume it is a  Node
                lineRangeOrNode.startContainer || lineRangeOrNode);

    let parentRects = lineParent.getClientRects();
    // expect all of the line to be

    // Using this: firstNode.getClientRects()[0]
    // fails in firefox when we force .runion-line.r00-l-first::before
    // to break (what we do). The first rect is the breaking rect with a
    // width of zero. The lineRange.getClientRects() don't have this issue.
    let lineRect = lineRangeOrNode.getBoundingClientRect()
      , i=0
      , logs = []
      ;
    for(let rect of parentRects) {
        // If lineRect is contained in rect we got a hit.

        // FIXME: top and bottom tests failed with very small line-space
        // which is normal, now that the runion reduces line-space down
        // to 1, and now we get some overflow.
        // If left/right is a fit, we're at least in the correct column,
        // which is the main reason for this.
        // Would be nice to have this very accurate though, so we can
        // rely on it.
        if(     //   lineRect.top >= rect.top
                //   lineRect.bottom <= rect.bottom
                   (lineRect.left >= rect.left)
                   // On the right side we get cases where the browser
                   // takes the liberty to slightly be over/out of the
                   // parent bounding box, e.g. on the typography in
                   // Russian "Типографика" page under "История"
                   // for the line:
                   //     "нок. Отныне создавать книги стало го-"
                   // I got:
                   //      "rig 543.0333557128906 <= 542.3999938964844 false"
                   // which is a very small rule violation, but still breaks,
                   // hence, I add a second more forgiving rule:
                   //           rect.right - lineRect.right >= -2
                   // It's not quite clear to me how the browser decides
                   // which magnitude of rule breaking is OK, so this is
                   // so far a game of guessing.
                && (lineRect.right <= rect.right || rect.right - lineRect.right >= -2 )) {
            return [rect, lineParent];
        }
        // TODO: since this still sometimes goes wring, below
        // is very helpful debugging output, which I would uncomment when
        // needed. Once this heuristic stabilizes we may remove that stuff.
        logs.push(['did not fit', i++, 'lineRect', lineRect ,
            '\nrect', rect, '\n',
            parentRects, '\nclosest block parent:', lineParent,
            lineRangeOrNode.getClientRects()
            , 'lineRangeOrNode:', lineRangeOrNode]);
        logs.push(['top', lineRect.top, '>=', rect.top, lineRect.top >= rect.top]);
        logs.push(['bot', lineRect.bottom, '<=', rect.bottom, lineRect.bottom <= rect.bottom]);
        logs.push(['lef', lineRect.left, '>=', rect.left, lineRect.left >= rect.left]);
        logs.push(['rig', lineRect.right, '<=', rect.right, lineRect.right <= rect.right]);
    }
    for(let line of logs)
        console.log(...line);
    throw new Error(`_getContainingRect couldn't identify a containing rect`
                  + ` for: "${lineRangeOrNode.textContent || lineRangeOrNode.toString()}"`);
}

function _isOutOfFlowContext(elem) {
    return elem.offsetParent === null;
}


export const _DEBUG = Symbol('_DEBUG');
/**
 * Find lines that the browser has composed by using Range objects
 * and their getBoundingClientRect.
 *
 * FIXME: needs work for special cases etc.
 * TODO: we could search from back to front as that would make a better
 *       pipeline with the following transformations, if we keep doing
 *       those from back to front.
 */
function* findLines(deepTextElem, skip=false , debug=false) {
    var textNodesGen
      , container
      , skipUntil = null
      , skipUntilInclude = false
      , currentLine = null
      , last = null
      , initialEndNodeIndex = null
      ;
    if(skip === _DEBUG) {
        skip = false;
        debug = _DEBUG;
    }
    if(skip === false)
        // Also applies when skip was _DEBUG.
        skip=[null, null];

    if(Array.isArray(deepTextElem)) {
        [container, deepTextElem, skipUntil] = deepTextElem;
        if(skipUntil instanceof Line) {
            // In this case we expect that we reconsider a line that was
            // produced by this generator before, only intended for the
            // narrowing case, where the line can have more content after
            // adjusting the font spec.
            currentLine = skipUntil;
            skipUntil = currentLine.range.endContainer;
            skipUntilInclude = true;
            initialEndNodeIndex = currentLine.range.endOffset;
            last = [skipUntil, initialEndNodeIndex];
        }
    }
    else
        container = deepTextElem;

    textNodesGen = _deepTextGen(deepTextElem, skip);

    // NOTE: i/maxI is for development and debugging only to limit
    // the algorithm.
    let i=0
      , maxI = Infinity;//3000; --> this can be controlled by the caller
    for(let endNode of textNodesGen) {
        // TODO: the skipUntil stuff could be part of _deepTextGen
        if(skipUntil) {
            if(skipUntil === endNode) {
                skipUntil = null;
                if(!skipUntilInclude)
                    // the node after this node won't be skipped anymore
                    continue;
                // this node is not skipped anymore
            }
            else continue;
        }
        let endNodeIndex = 0;
        if(initialEndNodeIndex !== null) {
            endNodeIndex = initialEndNodeIndex;
            initialEndNodeIndex = null;
            if(endNode !== currentLine.range.endContainer) {
                throw new Error('Assertion failed, endNode must be '
                                     + 'currentLine.range.endContainer');
            }
        }

        // Seems necessary to keep/not filter some of these e.g.
        // keep ' ' when tuning word-space, also for detecting if
        // a line break was caused by white-space or hyphenation.
        // Skipping more nodes, especially before _hasNoSizeTextNode
        // could speed things up though!
        // if(_isWhiteSpaceTextNode(endNode)) {
        //     console.log('skipping empty:',  endNode);
        //     continue;
        // }

        // White space at the end of a line is very important
        // to have a heuristic to restore hyphenation, Firefox seems
        // to give those nodes a size, but Chromium doesn't. Also,
        // this improves the situation e.g. for single line (headline)
        // and paragraph end cases, but that could also just disguise
        // a missing heuristic.
        //
        // If parentNode.offsetParent === null it's likely in a
        // display:none context, we back up with _hasNoSizeTextNode
        if(_hasNoSizeTextNode(endNode) && endNode.parentNode.offsetParent === null)
            continue;
        // this is only done initialy once
        if(!currentLine) {
            currentLine = new Line();
        }

        // console.log('findLines, endNode:', endNode, endNode.data);
        while(i<maxI) {
            // TODO: This whole block is expensive, we should reduce the
            // repetitions needed using a binary search or something. There
            // should be a good starting point using e.g. columnWidth/
            // columnWidthEn (~glyphs per line) but the way we get those
            // values is not ideal either.
            // getClientRects() in a context of textNodes will give
            // a DOMRect per line a node covers.
            //
            // If endNode.data.length === endNodeIndex this is the ending
            // index of he node, i.e. after the last element.
            // if endNode.data.length > endNodeIndex this is an index that
            // adresses a char directly.
            if(endNode.data.length < endNodeIndex)
                // this should reliably prevent the IndexSizeError
                // when setting currentLine.range.setEnd(endNode, endNodeIndex);
                // Doing this so we don't have to handle the error, handling
                // the error is in the git history.
                break;
            i++;
            currentLine.setIndex(endNode, endNodeIndex);
            if(currentLine.collectWhitespace === true) {
                endNodeIndex += 1;
                continue;
            }

            // FIXME: current known glitches:
            //   * Chromium and Firefox
            //     ## Section: Citations
            //     all pretty bad, but it seems the reason is no longer
            //     how lines are detected.
            let rects = Array.from(currentLine.range.getClientRects())
              , firstRect =rects[0]
              , lastRect = rects[rects.length - 1]
              , withinHorizontalBounds = false
              , withinVerticalBounds = false
              , changed = false
              ;

            // This fix is only required for MacOS Safari.
            if(firstRect.width === 0) {
                for(let i=1,l=rects.length;i<l;i++) {
                    if(rects[i].width !== 0) {
                        firstRect = rects[i];
                        break;
                    }
                }
            }
            // get the column, each line has only one column, so, we
            // need tp get it only once.
            if(!currentLine.columnRect)
                [currentLine.columnRect, ] = _getContainingRect(currentLine.range, container);

            if(rects.length <= 1) {
                // Pass; line breaks and column breaks create new client
                // rects,  if there's only one rect, there's no line or
                // column break. Zero rects should never happen (in this
                // context?), but it would also mean neither line or
                // column break. Even an empty string node would produce
                // one rect.
            }
            else if(rects.length > 1) {
                // New heuristic, to overcome the :before/:after{content: 'abc'}
                // issue: as in justifyLine: use the parent box to
                // identify the correct column rect then only ensure that
                // the items are on the same "height".
                if(lastRect.left >= currentLine.columnRect.left && lastRect.right <= currentLine.columnRect.right) {
                    withinHorizontalBounds = true;
                }
                else if(lastRect.left >= currentLine.columnRect.left) {
                    // There's some amount of error that the browesr allows
                    // itself to make better lines. This means that
                    // `lastRect.right <= currentLine.columnRect.right`
                    // can be false, but still part of the line! It's
                    // hard to guess an appropriate error margin, but not
                    // doing so results in crippled hyphenation i.e. we
                    // are hyphenating a char to early.
                    if((lastRect.right - currentLine.columnRect.right) <= 2 /* CSS-px of error margin*/) {
                        withinHorizontalBounds = true;
                    }else{
                        console.log('out of horizontal bounds:\n',
                        `lastRect.left ${lastRect.left} >= currentLine.columnRect.left ${currentLine.columnRect.left} &&` + '\n',
                        `lastRect.right ${lastRect.right} <= currentLine.columnRect.right ${currentLine.columnRect.right}`
                        );
                    }
                }

                // NOTE: < 1 was bad as we had cases (on Mac Chromium) where
                // both results where exactly 1, so adding here a bit more
                // error tolerance
                if (Math.floor(lastRect.bottom - firstRect.bottom) < 3
                        // e.g. our <sup> tags are not touching on bottom
                        || Math.floor(lastRect.top - firstRect.top) < 3

                        // This prevents a fail in Firefox, if the line
                        // begins with <sup> elements and is then followed
                        // by regular text, logged:
                        //     3 == Math.floor(lastRect.bottom - firstRect.bottom)
                        //    15 == Math.floor(lastRect.top - firstRect.top)
                        // For some reason we get a lastRect without
                        // expansion (width/height):
                        //     DOMRect {
                        //        x: 276.3500061035156, y: 153.1999969482422,
                        //        width: 0, height: 0,
                        //        top: 153.1999969482422, right: 276.3500061035156,
                        //        bottom: 153.1999969482422, left: 276.3500061035156 }
                        //  Without a height and width it has no impact anyways.
                        || (lastRect.height === 0 && lastRect.width === 0)
                        ) {
                    withinVerticalBounds = true;
                }
                else if (debug === _DEBUG) {
                    let printRect = (rect)=>{
                        let result = ['rect\n    '];
                        for(let k in rect) {
                            if(typeof rect[k] === 'function')
                                continue;
                            result.push(`${k}: ${rect[k]}` +'\n    ');
                        }
                        return result;
                    };
                    console.log('not withinVerticalBounds\n',
                        Math.floor(lastRect.bottom - firstRect.bottom),
                        ' => Math.floor(lastRect.bottom - firstRect.bottom) < 3\n',
                        Math.floor(lastRect.top - firstRect.top),
                        ' => Math.floor(lastRect.top - firstRect.top) < 3\n',
                        ...printRect(lastRect), '=>lastRect\n',
                        ...printRect(firstRect), '=> firstRect\n'
                    );
                    console.log(currentLine.range.toString());
                    console.log(currentLine.range.getBoundingClientRect(), '=> getBoundingClientRect');
                }

                changed = !(withinHorizontalBounds && withinVerticalBounds);
            }
            let [lastEndNode, lastEndNodeIndex] = last || [null, null];
            last = [endNode, endNodeIndex];
            if(changed) {
                // We went one to far, hence using the last position.
                // this probably already clears most of the whitespace
                // we'd remove in the next step, but this is the first
                // obvious thing to do to undo the line breaking itself.
                currentLine.undoSetIndex(lastEndNode, lastEndNodeIndex);
                // from the end of the range remove selected whitespace
                // " ", "\t" "\r" "\n"
                let whiteSpaceNodeIndexes = currentLine.removeWhiteSpaceFromEndOfLine();
                yield currentLine;
                currentLine = new Line();
                for(let [wsNode, wsIndex] of whiteSpaceNodeIndexes) {
                    currentLine.setIndex(wsNode, wsIndex);
                }
                currentLine.setIndex(lastEndNode, lastEndNodeIndex);
                // Now, the next iteration will be: endNode, endNodeIndex
            }
            else {
                // If we start a new line we don't do this and try
                // this endNode + endNodeIndex again
                endNodeIndex += 1;
            }
        }
    }
    if(currentLine && currentLine.range.toString().length)
        yield currentLine;
}


// The check in here finds elements where the inline behavior is like
// a block, e.g. display: inline block would match as well.
function getClosestBlockParent(node) {
  // if node is a block it will be returned
  let elem;
  if(node.nodeType === Node.ELEMENT_NODE)
    elem = node;
  else
    elem = node.parentElement;

  while(elem){
      // Used to identify a block element, elem.clientWidth is 0 for inline
      // elements. To futher distinguish, elem.getBoundlingClientRect()
      // would return for an inline and a block element a width, that is
      // also for an inline element not 0 (unless is may be empty?).
      if(elem.clientWidth !== 0)
      // got a block
      return elem;
    elem = elem.parentNode;
  }
  return undefined;
}

// This tries to identify elements who have an outer block behavior,
// i.e. breaking line flow. I'm not sure if this and the heuristic
// getClosestBlockParent must be differentiated.
function _isBlock(elem) {
    let style = elem.ownerDocument.defaultView.getComputedStyle(elem)
      , display = style.getPropertyValue('display')
      ;
    // CAUTION: Yet we only do "display: block" and everything else
    // is considered "display: inline", but CSS has a much more complex
    // model nowadays.
    return display === 'block';
}

function* reverseArrayIterator(array) {
    for(let i=array.length-1;i>=0;i--)
        yield [array[i], i];
}

// FIXME: add all punctuation and "white-space" etc. that breaks lines.
// not too sure about ] and ) but I've seen a line-break after a ] in
// a foot note link (inside a <sup>.
// All elements on a page that end up with the class `r00-l-hyphen`
// should be inspected to see what belongs in here, at least for our
// example, this could be feasible. This heuristic is probably not
// ideal in the long run, yet simple.
const _LINE_BREAKERS = new Set([' ', '-', '–', '—', '.', ',', ']', ')', '\t', '\r', '\n']);
function _needsHyphen(nextLinePrecedingWhiteSpace, nextLineTextContent, currentLineLastChar) {
    // FIXME: there are other heuristics/reasons to not add a hyphen!
    //        but the error is not always in here.
    // If the last character is not a line breaking character,
    // e.g. in Firefox after sectioning headlines, I get hyphens.
    return (!nextLinePrecedingWhiteSpace.length
            && nextLineTextContent.length
               // next line first char
            && !_LINE_BREAKERS.has(nextLineTextContent[0])
               // current line last char
            && !_LINE_BREAKERS.has(currentLineLastChar)
    );
}

function _approachZero(min, max, value, control) {
    // More nextValue/value means control gets smaller, eventually it
    // becomes negative. If control is < 0 value must get smaller and if
    // control is > 0 value must grow.
    let nextValue = value;
    if (control < 0) {
        // in the middle between now and min
        nextValue = (value + min) / 2;
        if(value < max)
            // Otherwise, original max should be faster next round.
            max = value;
    }
    else if(control > 0) {
        // in the middle between now and max
        nextValue = (value + max) / 2;
        if(value > min)
            // Otherwise, original min should be faster next round.
            min = value;
    }
    return [min, max, nextValue];
}

/**
 * NOTE: this generator keeps internal state (and that's its sole purpose),
 * it should be called consecutively, not intermittently with other generators
 * that manipulate the same control/value.
 */
function* _approachZeroGenerator(originalMin, originalMax, initialValue) {
    let currentMin = originalMin
      , currentMax = originalMax
      , value = initialValue
      , control
      ;
    while (true) {
        // The intial yield is not that interesting, as we changed nothing yet, we use
        // it to aquire the inital value of control.
        control = yield value; // control === unusedWhiteSpace
        [currentMin, currentMax, value] = _approachZero(currentMin, currentMax, value, control);
    }
}

function* _justifyByGenerator(setVal, readVal, originalMin, originalMax, tries=10) {
    let control = yield true // control === unusedWhiteSpace
      , value = readVal() || 0 /*initial value*/
      , ctrlGen = _approachZeroGenerator(originalMin, originalMax, value)
      ;
    // The initial call is required to prime the generator
    // with the initial control value.
    ctrlGen.next(control);
    // assert ctrVal.value === value
    while(tries--) {
        // not god enough
        let ctrVal = ctrlGen.next(control);
        if(ctrVal.done)
            // The generator gave up. However, the current
            // generator implementation never does.
            break;

        if (Math.abs(value - ctrVal.value) / (originalMax - originalMin) < 0.005) {
            // Close enough. I think this is to end the control system,
            // once the size of the next change compared to the magnitude
            // of the overall change value range is getting very small.
            //
            // It reads something like this: If the ratio of the
            // difference between next and current value (cnew - cnow)
            // and the difference between the original max and min values
            // is smaller than 0.005.
            break;
        }
        value = ctrVal.value;
        setVal(ctrVal.value);
        // read from outside
        control = yield true;
    }
}

/**
 * from https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace#whitespace_helper_functions
 *
 * was called data_of(txt)
 * Version of |data| that doesn't include whitespace at the beginning
 * and end and normalizes all whitespace to a single space.  (Normally
 * |data| is a property of text nodes that gives the text of the node.)
 *
 * @param txt  The text node whose data should be returned
 * @return     A string giving the contents of the text node with
 *             whitespace collapsed.
 */
function _whiteSpaceNormalize( txt ) {
    // Use ECMA-262 Edition 3 String and RegExp features
    txt = txt.replace(/[\t\n\r ]+/g, " ");
    if (txt.charAt(0) === " ")
      txt = txt.substring(1, txt.length);
    if (txt.charAt(txt.length - 1) === " ")
      txt = txt.substring(0, txt.length - 1);
    return txt;
}

/* Keeping for now, we may use it as an option. */
function* _fullyJustifyByWordSpacingGenerator(setVal, lineWordSpaces) {
    let unusedSpace = yield true
     , wordSpacingPx = unusedSpace / lineWordSpaces
     ;
    // No control system again, also, this just expands to fully fit the line,
    // there's no min/max adherence.
    setVal(wordSpacingPx);
}

function justifyControlLoop(readUnusedWhiteSpace, generators) {
    let gen = generators.shift();
    while(gen) {
        let unusedWhiteSpace = readUnusedWhiteSpace();
        if (Math.abs(unusedWhiteSpace) < 1) {
            // all good, we have a perfect line
            return;
        }
        let result = gen.next(unusedWhiteSpace);
        if(result.done) {
            // generator exhausted
            gen = generators.shift();
            continue;
        }
    }
}


/**
 * The concept here is, that a column layout with growing number of columns
 * has big performance problems when justifying. With one column it's
 * much faster (but not fast) than with four columns. This element is
 * intended to make it simpler for the browser to calculate line length,
 * line breaks and hyphenation by removing a lot of the surrounding context
 * of the line from the equation, especially a possible column layout, but
 * also other sibling elements, that don't have influence on the line breaking.
 *
 * We want to keep though the CSS-inherited type-spec and CSS-properties
 * so we justify using the same settings as in the target document. Ideally
 * the isolated block is also removed from the parent flow (position: absolute)
 * and not rendering (visibility: hidden), so that we don't have the browser
 * do things that we are not interested in.
 *
 * This is experimental and a theory at the moment.
 */
function _createIsolatedBlockContextElement(notBlockNodes) {
    // What I don't like is the extensive, repeated copying of child
    // block elements.
    let block = notBlockNodes[0].parentElement
      , cloned = block.cloneNode(false/*deep*/)
        // In the standard box model, this would be equal to the
        // width or height property of the element + padding + border-width.
        // But if box-sizing: border-box is set for the element this
        // would be directly equal to its width or height.
      , fullWidth = block.getClientRects()[0].width
      , lineLengthAffectingSizes = getElementSizesInPx(block
                                      , 'padding-inline-start'
                                      , 'padding-inline-end'
                                      , 'border-inline-start-width'
                                      , 'border-inline-end-width')
      , lineLength = fullWidth - lineLengthAffectingSizes.reduce((x,y)=>x+y, 0)
      ;
    cloned.classList.add('justification-context-block');
    cloned.style.setProperty('width', `${lineLength}px`);
    cloned.style.setProperty('padding', '0');
    cloned.style.setProperty('border', '0');

    /**
     * MAYBE: Add some element.style to ensure we  have the same line
     * length and not a multi column layout!
     */

    for(let node of notBlockNodes){
        cloned.appendChild(node.cloneNode(true));
    }

    {
        // "text-indent" goes away if there's a previous sibling, if the
        // first notBlockNodes item is not the first child, e.g. in our
        // example document we have .thumbcaption elements with text but
        // before the text is a div with a class .magnify, in original
        // wikipedia, clicking that would open a larger version of the
        // thumbnail. The HTML is like this:
        //      <div class="thumbcaption">
        //          <div class="magnify"><!--...--></div>
        //          Here comes the text ...
        //      </div>
        // "text-indent" is applied/active on these .thumbcaption elements
        // (it would likely be turned of if it would show), but because of
        // the div.magnify, the indent is not applied to the text. BTW even
        // if "div.magnify" is display: none or position: absolute!
        //
        // In the element we create here (cloned) however, the first child
        // element is missing and hence we get a text-indent in justification,
        // but not in the result:
        //      <div class="thumbcaption">
        //          Here comes the text ...
        //      </div>
        // This means bad lines, that are e.g. narrowed but also noticeably
        // too short.
        let node = notBlockNodes[0];
        while(true) {
            if(!node.previousSibling)
                // no problem
                break;
            node = node.previousSibling;
            if(node.nodeType === Node.ELEMENT_NODE) {
                // found it
                cloned.insertBefore(node.cloneNode(false), cloned.firstChild);
                break;
            }
        }
    }

    // insert at the same position, so we get the same CSS-rules to apply
    // to the container. CAUTION: this can become problematic where we have
    // e.g. position related CSS selectors (first-child, ~ etc.)
    block.parentNode.insertBefore(cloned, block);
    return cloned;
}

function _getDirectChild(ancestorElement, descendantNode) {
    while(descendantNode.parentElement !== ancestorElement) {
        descendantNode = descendantNode.parentElement;
        if(!descendantNode)
            throw new Error(`Node ${descendantNode} appears not to be a `
                            + `descendant of ${ancestorElement}`);
    }
    return descendantNode;
}

function _packLine(addFinalClasses, tagName, nodes, startRange, endRange,
                                isInitialLine, addHyphen, isTerminalLine) {
    let elements = [];
    for(let [node, /*index*/] of reverseArrayIterator(nodes)) {
        if(node.data.length === 0)
            continue;
        let element = node.ownerDocument.createElement(tagName)
          , startIndex = node === startRange.startContainer
                    ? startRange.startOffset
                    : 0
          , endIndex = node === endRange.endContainer
                    ? endRange.endOffset
                    : node.data.length // -1???
          , r = new Range()
          ;
        r.setStart(node, startIndex);
        r.setEnd(node, endIndex);
        r.surroundContents(element);
        elements.unshift(element);
    }
    if(addFinalClasses) {
        for(let elem of elements)
            elem.classList.add('runion-line');
        elements[0].classList.add('r00-l-first');
        elements[elements.length-1].classList.add('r00-l-last');
    }
    else{
        // add in progress classes
        elements[0].classList.add('line-in-progress-first-elem');
    }
    if(isInitialLine || isTerminalLine) {
        for(let elem of elements) {
            if(isInitialLine)
                elem.classList.add('r00-first-line');
            if(isTerminalLine)
                elem.classList.add('r00-last-line');
        }
    }
    if(addHyphen)
        elements[elements.length-1].classList.add('r00-l-hyphen');
    return elements;
}


function _getInterpolationPosition(val, upper, lower) {
    let normalValue = val - lower
      , normalUpper = upper - lower
      ;
    return  normalValue/normalUpper;
}

function _interpolateValue(t, upperValue, lowerValue) {
    return (upperValue - lowerValue) * t + lowerValue;
}

function _interpolateArray(t, upperValues, lowerValues) {
    let result = [];
    for(let i=0, l = Math.min(upperValues.length, lowerValues.length);
                                                            i<l; i++) {
        result.push(_interpolateValue(t, upperValues[i], lowerValues[i]));
    }
    return result;
}


const FONT_SPEC_CONFIG_AMSTEL_VAR = {
    // weight
        // width
            // opsz
    900: {
        100: {

            144: {XTRA: [540, 562, 569], tracking: [-0.4 , 0, 0.9], wordspace: [120/144 - 1, 1 - 1/*144/144*/, 171/144 - 1]}
           , 14: {XTRA: [500, 562, 580], tracking: [-0.3 , 0, 0.15], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 22/14 - 1]}
           ,  8: {XTRA: [540, 562, 570], tracking: [-0.05 , 0, 0.15], wordspace: [6/8 - 1, 1 - 1/*8/8*/, 12/8 - 1]}
        }
    }
  , 400: {
        125: {
            // FIXME: PDF is not clear regarding tracking: also [-1, 0, 1]
            //          also suggest -1 instead of -0.1!
            //          Google Sheets "Amstelvar Justification saved" sugests [-1, 0, 0.8]
            144: {XTRA: [550, 562, 570], tracking: [-0.1, 0, 0.8], wordspace: [96/144 - 1, 1 - 1/*144/144*/, 180/144 - 1]}
            // FIXME: PDF is not clear regarding tracking: also [-0.3, 0, 0.2]
            //          Google Sheets "Amstelvar Justification saved" sugests [-.3, 0, 0.3]
            // FIXME: PDF is not clear regarding XTRA: also [540, 562, 575]
            //          Google Sheets "Amstelvar Justification saved" sugests [540, ?, 580]
           , 14: {XTRA: [540, 562, 580], tracking: [-0.3, 0, 0.3], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 18/14 - 1]}
           ,  8: {XTRA: [510, 562 ,571], tracking: [-0.1, 0, 0.2], wordspace: [7/8 - 1, 1 - 1/*8/8*/, 14/8 - 1]}
        }
        // default reading text spec:
      , 100: {
            144: {XTRA: [545, 562, 570], tracking:[-0.3, 0, 0.7],  wordspace: [120/144 - 1, 1 - 1/*144/144*/, 180/144 - 1]}
           , 14: {XTRA: [515, 562, 575], tracking:[-0.4, 0, 0.2],  wordspace: [8/14 - 1, 1 - 1/*14/14*/, 18/14 - 1]}
            // FIXME: PDF is not clear regarding tracking: also [-0.1, 0, 0.2]
            //          Google Sheets "Amstelvar Justification saved" sugests [-0.1, 0, 0.25]
           ,  8: {XTRA: [545, 562, 580], tracking:[-0.1, 0, 0.25], wordspace: [6/8 - 1, 1 - 1 /*8/8*/, 12/8 - 1]}
        }
      , 50: {
            144: {XTRA: [550, 562, 568], tracking: [-0.3, 0, 0.5], wordspace: [120/144 - 1, 1 - 1/*144/144*/, 180/144 - 1]}
            // FIXME: PDF is not clear regarding XTRA: also [562, 562, 575]
            //          Google Sheets "Amstelvar Justification saved" sugests: [540, ?, 575]
           , 14: {XTRA: [540, 562, 575], tracking: [0, 0, 0.2], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 18/14 - 1]}
           ,  8: {XTRA: [540, 562, 568], tracking: [-0.1, 0, 0.15], wordspace: [6/8 - 1, 1 - 1/*8/8*/, 12/8 - 1]}
        }
    }
  , 100: {
        100: {
            // FIXME: PDF is not clear regarding wordspace: also [126/144 - 1, 1 - 1/*144/144*/, 180/144 - 1]
            //          Google Sheets "Amstelvar Justification saved" sugests: [126/144 - 1, 1 - 1/*144/144*/, 192/144 - 1]
            144: {XTRA: [552, 562, 568], tracking: [-0.2, 0, 0.7], wordspace: [126/144 - 1, 1 - 1/*144/144*/, 192/144 - 1]}
            // FIXME: PDF is not clear regarding XTRA: also [515, 562, 575]
            //          Google Sheets "Amstelvar Justification saved" sugests: [535, ?, 575]
           , 14: {XTRA: [535, 562, 575], tracking: [-0.2 , 0, 0.2], wordspace: [8/14 - 1, 1 - 1/*14/14*/, 18/14 - 1]}
           ,  8: {XTRA: [545, 562, 570], tracking: [-0.01 , 0, 0.27], wordspace: [8/8 - 1, 1 - 1/*8/8*/, 12/8 - 1]}
        }
    }
};

const FONT_SPEC_CONFIG_ROBOTO_FLEX = {
    // weight
        // width
            // opsz
    1000: {
        100: {
            144: {XTRA: [458, 468, 473], tracking: [-0.8, 0, 0.5], wordspace: [96/144 - 1, 1 - 1/*144/144*/, 150/144 - 1]}
           , 14: {XTRA: [458, 468, 472], tracking: [-0.2, 0, 0.13], wordspace: [10/14 - 1, 1 - 1/*14/14*/, 18/14 - 1]}
            // FIXME: PDF is not clear regarding XTRA: also [462, 468, 475]
           ,  8: {XTRA: [444, 468, 475], tracking: [-0.06, 0, 0.2], wordspace: [6/8 - 1, 1 - 1/*8/8*/, 14/8 - 1]}
        }
    }
  , 400: {
        151: {
            144: {XTRA: [455, 468, 479], tracking: [-0.3, 0, 0.5], wordspace: [118/144 - 1, 1 - 1/*144/144*/, 180/144 - 1]}
            // FIXME: PDF is not clear regarding XTRA: also [450, 468, 471]
           , 14: {XTRA: [458, 468, 475], tracking: [-0.1, 0, 0.13], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 19/14 - 1]}
           ,  8: {XTRA: [462, 468, 475], tracking: [-0.06, 0, 0.2], wordspace: [7/8 - 1, 1 - 1/*8/8*/, 14/8 - 1]}
        }
        // default reading text spec:
      , 100: {
            144: {XTRA: [460, 468, 471], tracking:[-0.5, 0, 0.5],  wordspace: [114/144 - 1, 1 - 1/*144/144*/, 192/144 - 1]}
           , 14: {XTRA: [460, 468, 471], tracking:[-0.1, 0, 0.13],  wordspace: [12/14 - 1, 1 - 1/*14/14*/, 19/14 - 1]}
           ,  8: {XTRA: [462, 468, 475], tracking:[-0.06, 0, 0.2], wordspace: [7/8 - 1, 1 - 1 /*8/8*/,   14/8 - 1]}
        }
      , 25: {
            // FIXME: PDF is not clear regarding wordspace: also: [120/144 - 1, 1 - 1/*144/144*/, 192/144 - 1]}
            // FIXME: PDF is not clear regarding XTRA: also: [466, 468, 473]
            144: {XTRA: [468, 468, 473], tracking: [-0.07, 0, 0.15], wordspace: [120/144 - 1, 1 - 1/*144/144*/, 168/144 - 1]}
            // FIXME: PDF is not clear regarding wordspace: also: [12/14 - 1, 1 - 1/*14/14*/, 19/14 - 1]}
           , 14: {XTRA: [463, 468, 472], tracking: [-0.1, 0, 0.13], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 16/14 - 1]}
            // FIXME: PDF is not clear regarding tracking: also: [-0.06, 0, 0.2]
           ,  8: {XTRA: [464, 468, 475], tracking: [0, 0, 0.2], wordspace: [7/8 - 1, 1 - 1/*8/8*/, 10/8 - 1]}
        }
    }
  , 100: {
        100: {
            144: {XTRA: [460, 468, 473], tracking: [-0.3, 0, 0.65], wordspace: [126/144 - 1, 1 - 1/*144/144*/, 216/144 - 1]}
           // FIXME: PDF is not clear regarding XTRA, also: [458, 468, 471]
           , 14: {XTRA: [458, 468, 472], tracking: [-0.1, 0, 0.13], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 20/14 - 1]}
           // FIXME: PDF is not clear regarding tracking, also: [-0.04, 0, 0.2]
           ,  8: {XTRA: [460, 468, 471], tracking: [-0.03, 0, 0.16], wordspace: [8/8 - 1, 1 - 1/*8/8*/, 14/8 - 1]}
        }
    }
};


function _getFontSpec(referenceElement) {
    // TODO: fontSpecConfig etc. will be for more sizes and different
    // per font/family.
    let elemStyle = referenceElement.ownerDocument.defaultView.getComputedStyle(referenceElement)
      , fontSizePx = parseFloat(elemStyle.getPropertyValue('font-size'))
      , fontSizePt = fontSizePx * 0.75
      , fontFamily = elemStyle.getPropertyValue('--font-family').trim()
        // This is AmstelVar
        //   opsz 14 PT, 400 weight, 100 width:
        //          (min, default, max)
        //      XTRA: 515, 562, 580 || increment :1 range: 75
        //      Track: -.4, 0, .2 || increment: ? range: .6
        //      word-space: 8/14, 14/14, 18/14 || increment: ? range: 10/14
        //
        //   opsz 8, 400 weight, 100 width:
        //      XTRA: 545, 562, 580 || increment: 1 range 35
        //      Track: -.1, 0, .25 || increment: ? range .35
        //      word-space: 6/8, 8/8, 12/8 || increment: ? range: 4/8
      , fontSpecConfigAmstelVar = {

            14: {XTRA: [515, 562, 580], tracking:[-0.4, 0, 0.2],  wordspace: [8/14 - 1, 1 - 1/*14/14*/, 18/14 - 1]}
           , 8: {XTRA: [545, 562, 580], tracking:[-0.1, 0, 0.25], wordspace: [6/8 - 1, 1 - 1 /*8/8*/,   12/8 - 1]}
        }
        // This is RobotoFlex
        //   opsz 14 PT, 400 weight, 100 width:
        //          (min, default, max)
        //      XTRA: 460, 468, 471
        //      Track: -.1, 0, .13
        //      word-space: 12/14, 14/14, 19/14
        //
        //   opsz 8, 400 weight, 100 width:
        //      XTRA: 462, 468, 475
        //      Track: -.06, 0, .2
        //      word-space: 7/8, 8/8, 14/8

      , fontSpecConfigRobotoFlex = {
            14: {XTRA: [460, 468, 471], tracking:[-0.1, 0, 0.13],  wordspace: [12/14 - 1, 1 - 1/*14/14*/, 19/14 - 1]}
           , 8: {XTRA: [462, 468, 475], tracking:[-0.06, 0, 0.2], wordspace: [7/8 - 1, 1 - 1 /*8/8*/,   14/8 - 1]}
        }
      , fontSpecConfigs = {
            AmstelVar: fontSpecConfigAmstelVar
          , RobotoFlex: fontSpecConfigRobotoFlex
        }
      , fontSpecConfig = fontSpecConfigs[fontFamily]
      , spec = {}
      , upperFontSize = 14
      , lowerFontSize = 8
      , t = _getInterpolationPosition(fontSizePt, upperFontSize, lowerFontSize)
      ;
    for(let k of Object.keys(fontSpecConfig[upperFontSize]))
        spec[k] = _interpolateArray(t, fontSpecConfig[upperFontSize][k],
                                      fontSpecConfig[lowerFontSize][k]);
    console.log(`Font Spec for ${fontFamily} @ ${fontSizePt} pt:`, spec);
    return [spec, fontSizePx, fontSizePt];
}


function _getFontSpecKey(elem) {
    let elemStyle = elem.ownerDocument.defaultView.getComputedStyle(elem)
      , fontSizePx = parseFloat(elemStyle.getPropertyValue('font-size'))
      , fontSizePt = fontSizePx * 0.75
      , fontFamily = elemStyle.getPropertyValue('--font-family')
      ;
    return `${fontFamily}@${fontSizePt}pt`;
}

function* _findAndJustifyLineByNarrowing(findLinesArguments, stops, firstLine,
                                                secondLine, isInitialLine) {
    let spans = [], nodes
      , bothLinesTextContent
      , firstLineTextContent = firstLine.range.toString()
      ;
    {
        let range = new Range();
        range.setStart(firstLine.range.startContainer, firstLine.range.startOffset);
        range.setEnd(secondLine.range.endContainer, secondLine.range.endOffset);
        bothLinesTextContent = range.toString();
    }

    {
        let seen = new Set();
        nodes = [...firstLine.nodes,
                 ...secondLine.wsNodes,
                 ...secondLine.nodes
        ].filter(node=>{  // remove nodes overlapping between the ranges
            if(seen.has(node)) return false;
            seen.add(node);
            return true;
        });
    }

    spans = _packLine(false, 'span', nodes, firstLine.range, secondLine.range,
                                                isInitialLine, false, false);

    // Now reduce [--font-xtra, ...] until the line breaks later, i.e.
    // until something from the second line jumps onto the first line, OR,
    // until we run out of negative [--font-xtra, ...] adjustment potential.
    let adjust = (nodes, step, colorIntensity) => {
        for(let node of nodes) {
            if(colorIntensity !== undefined) {
                let hslColor = `hsl(180, 80%, ${30 + 70 * (1 - colorIntensity)}%)`;
                node.style.setProperty('--line-color-code', hslColor);
            }
            node.style.setProperty('--justification-step', step);
        }
    };

    // We know where the initial break happened, at least, we can get the
    // full contents of the initial line (from firstLine.range.toString());
    //
    // On the other hand, we can get from the current structure the first
    // line (assert it has the same content as firstLine.range.toString())
    // when endContainer changes or endOffset increases, we reached the
    // desired effect.
    //
    // For this, to be efficient, it would be ideal if we could just use
    // the range that we already found and see if we can extend it.
    //
    //
    // after each adjustment, we should see if we can move the cursor on
    // the first line further.

    // find the current first line:
    let getStartLineContent=(findLinesArguments, expectedLineContent=null)=> {
            for(let startLine of findLines(...findLinesArguments)) {
                let startLineContent = startLine.range.toString();
                // initial run
                if(expectedLineContent && startLineContent !== expectedLineContent) {
                    // run again with enabled debugging to print reporting to console
                    findLines(...findLinesArguments, _DEBUG).next();
                    console.log('startLine:', startLine);

                    // assert it has the same content as the initial firstLine
                    // FIXME: this finds legitimate issues!
                    throw new Error(
                    //console.warn(
                          `Assertion failed, expectedLineContent must equal `
                        + `startLineContent but it does not:\n"${expectedLineContent}"\n`
                        + `vesus "${startLineContent}"`);
                }
                return [startLineContent, startLine];
            }
            // We just put that line there, it must be there!
            throw new Error('Assertion failed, finding a line is mandatory.');
        }
      , [startLineContent, ] = getStartLineContent(findLinesArguments, firstLineTextContent)
      ;

    let resultLine = null
      , currentLine = null
      ;
    // CAUTION: there are many options to do this differently, and some
    // may be better for performance, i.e. because of less iterations,
    // and still produce similar results.
    function* genNarrowAdjustments(stops, startValue) {
        let step=startValue-1
          , l = -stops
          ;
        while(true) {
            // l can be a real number, not just integer
            yield Math.max(l, step);
            if(step<l)
                break;
            step--;
        }
    }

    let startValue = 0
      , step = null
      , adjustmens = genNarrowAdjustments(stops, startValue)
      ;
    while(true) {
        let adjustmentVal = adjustmens.next();
        yield 'adjusted next';
        if(adjustmentVal.done) {
            //console.log(`no more potential: step ${step} of ${stops} from ${startValue}`
            //          , '\n', startLineContent);
            // don't adjust this with negative width ->
            //          undo all adjustments and go to positive width
            resultLine = currentLine;
            step = null;
            break;
        }
        // if there's potential for adjustment

        step = adjustmentVal.value;
        adjust(spans, step);
        let currentLineContent;
        if(!currentLine)
            [currentLineContent, currentLine] = getStartLineContent(findLinesArguments);
        else {
            let [firstFindLinesArg, skip] = findLinesArguments
                // _deepTextGen must be initiated with the same arguments
                // so it produces the same list of TextNodes again, however
                // we can skip some of those to get quicker to the interesting
                // part, which is the position where currentLine had a line
                // break in the iteration before.
                //
                // firstFindLinesArg = [container, deepTextElem, skipUntil] = elem;
              , newFirstFindLinesArg = [
                      firstFindLinesArg[0] // i.e. container; carryOverElement,
                    , firstFindLinesArg[1] // deepTextElem = [node, continueWithNextSiblings]
                      // NOTE: this will modify currentLine.
                    , currentLine // skipUntil, to reconsider the line
                ]
              , newFindLinesArguments = [newFirstFindLinesArg, skip]
              ;
            [currentLineContent, currentLine] = getStartLineContent(newFindLinesArguments);
        }
        if(startLineContent !== currentLineContent) {
            if(startLineContent.length >= currentLineContent.length) {
                // Turns out that this happens sometimes depending on how
                // the browser decides to break the line, in this case, now
                // try to return as if the adjustmentPotential is depleted.
                //adjust(spans, null);
                //resultLine = currentLine;
                //adjustment = null;
                // break;
                // try to continue and see if it will improve again at some point.
                continue;
                // throw new Error('Assertion failed, line changed but got shorter! '
                //                 + 'Something is fatally wrong.\n'
                //                 + `initial line: ${startLineContent}`
                //                 + `current line: ${currentLineContent}`);
            }
            //console.log(`>>>>line changed from:\n  `, startLineContent
            //          , 'to:\n  ', currentLineContent, currentLine);
            // FOUND IT!
            resultLine = currentLine;
            // Could be tried to fine-tune with positive width again
            // but actually, this should be sufficient or must improved
            // in here.
            yield 'found a line break.';
            break;
        }
    }

    let addHyphen;
    {
        let resultLineTextContent = resultLine.range.toString();
        if(bothLinesTextContent.indexOf(resultLineTextContent) !== 0) {
            throw new Error('Can\'t decide if line needs a hyphen:\n'
                + `"${resultLineTextContent}" is not in "${bothLinesTextContent}"`);
        }

        let nextLineStartContent = bothLinesTextContent.slice(resultLineTextContent.length)
          , nextLinePrecedingWhiteSpace = nextLineStartContent
          , nextLineTextContent = ''
          , currentLineLastChar = resultLineTextContent.slice(-1)
          ;

        for(let i=0, l=nextLineStartContent.length ;i<l; i++) {
            if(!WHITESPACE.has(nextLineStartContent[i])){
                nextLinePrecedingWhiteSpace = nextLineStartContent.slice(0, i);
                nextLineTextContent = nextLineStartContent.slice(i);
                break;
            }
        }
        addHyphen = _needsHyphen(nextLinePrecedingWhiteSpace
                                                    , nextLineTextContent
                                                    , currentLineLastChar);
    }
    // now repack the first line and undo the rest of the second line ...
    let newSpans = _packLine(true, 'span', resultLine.nodes, resultLine.range,
                             resultLine.range, isInitialLine, addHyphen, false);

    let isNarrowAdjusted = step !== null;
    if(isNarrowAdjusted)
        adjust(newSpans, step, Math.abs(step) / stops);
    // remove adjustment spans
    for(let elem of spans) {
        // The nodes from newSpans are already removed as children of these elements.
        elem.replaceWith(...elem.childNodes);
    }
    // TODO: would be interesting to plot how often each value appears
    // maybe, in the sweetspot range, if there is any, small changed could
    // have big effects. But it would differ between line length and
    // font-size/font-spec, so one value wouldn't do.
    // console.log(`narrowing ${adjustment}`);

    return [newSpans, isNarrowAdjusted];
}

function _justifyLineByWidening(stops, lineElements, container, options=null) {
    let lineRange = new Range()
      , firstNode = lineElements[0]
      , lastNode = lineElements[lineElements.length-1]
      , setPropertyToLine = (name, value)=>{
            for(let elem of lineElements) {
                elem.style.setProperty(name, value);
            }
        }
      , _lineStyleForAll = firstNode.ownerDocument.defaultView.getComputedStyle(firstNode)
      , getPropertyFromLine = (name)=>_lineStyleForAll.getPropertyValue(name)
      ;
    // This is the best method so far, it includes the hyphens that may
    // have been added by :after.
    lineRange.setStartBefore(firstNode);
    lineRange.setEndAfter(lastNode);

    let [rectContainingLine, lineParent] = _getContainingRect(firstNode, container);
    // let style = lineParent.ownerDocument.defaultView.getComputedStyle(lineParent);
    let widthPaddings = getElementSizesInPx(lineParent, 'padding-left', 'padding-right');

    // The values below looked all plausible.
    // FIXME: Does not take into account:
    //                      - floats around this line (we don't do this yet)
    //                      - hanging-punctuation(?) (not implemented in any browser)
    //                      -  drop-caps/initial-letter(Safari only?) maybe as
    //                         float with ::initial-letter? NOTE :initial-letter
    //                          :first-line fail with our span surrounded lines and
    //                          other inline elements.
    let rightStop = rectContainingLine.right - widthPaddings[1]
      , readUnusedWhiteSpace =()=>{
            // This will be called a lot and it's *very* expensive!
            // lineRange.getBoundingClientRect() includes also the hyphens
            // added with :after if any!
            return rightStop  - lineRange.getBoundingClientRect().right;
        }
      ;

    // This block is just a visualization, on "how bad" a line is,
    // i.e. more unusedWhiteSpace is worse, appears darker red,
    // "good" lines become lighter red to white.
    // FIXME: maybe this should rather show how much had to be done to
    //        the line, like the narrowing indicator.
    {
        // wsRatio will be 1 for ideal lines and < 1 for less than full lines.
        let lineBCR = lineRange.getBoundingClientRect()
          , lineStart = lineBCR.left
          , availableLineLength = rightStop - lineStart
          , actualLineLength = lineBCR.right - lineStart
          , wsRatio = actualLineLength / availableLineLength
            // === 0 for ideal lines
            // === Full line length for empty lines
            // === how to get the full line length????
          , hslColor = `hsl(0, 100%, ${100 * wsRatio}%)`
          ;
        setPropertyToLine('--line-color-code', hslColor);
    }
    // prepare the actual justification

    // TODO: does not include generic :before and :after content
    let lineText = _whiteSpaceNormalize(lineRange.toString());
    // Asking for this class is very specific, but at least it covers
    // one common pseudo class content case in our scenario.

    if(lastNode.classList.contains('r00-l-hyphen'))
        lineText +=  '-';

    let setStep = val=>setPropertyToLine('--justification-step', val)
      , readStep = ()=>parseFloat(getPropertyFromLine('--justification-step'))
      , generators = []
      ;

    generators.push(
            _justifyByGenerator(setStep, readStep, 0 , stops));

    // if(!options || options.wordSpacing !== false) {
    //         // We had some good results with this not used at all,
    //         // But if it can do some reduced word-spacing, optionally
    //         // not fully justified, it could still be an option.
    //     generators.push(
    //         _fullyJustifyByWordSpacingGenerator(setWordSpacingPx, lineWordSpaces));
    //}
    // run the actual justification
    justifyControlLoop(readUnusedWhiteSpace, generators);
}

function _isLineBreaking(element) {
    if(_isOutOfFlowContext(element))
        return false;
    if(element.tagName.toLowerCase() === 'br')
        return true;
    // FIXME: should maybe check for display: block etc. but that doesn't
    // happen in the current context.
    //
    // If we place a <span class="br"></span> on a line and add the
    // following CSS rule:
    //
    // .br {
    //      display: block;
    // }
    // The line finding algorithm will do the right thing earlier
    // in _justifyBlockElement. (FIXME: ... and it should handle <br />
    // etc. there as well.)
    //
    // On the other hand with a CSS rule like this:
    //
    // .br:after {
    //      content: '';
    //      display: block;
    // }
    //
    // We can fool the algorithm successfully, but for now this is
    // a non-issue.
    return false;
}

function _isBreakBetweenLines(firstLine, secondLine) {
    if(firstLine.range.endContainer === secondLine.range.startContainer)
        return false;
    // This is very good already, however, there are cases where the nodes
    // are not the same, and then the question is if there's in between
    // some breaking element, i.e. a <br /> for now.
    let range = new Range();
    range.setStart(firstLine.range.endContainer, firstLine.range.endOffset);
    range.setEnd(secondLine.range.startContainer, secondLine.range.startOffset);
    let ancestorElement = range.commonAncestorContainer
      , secondSameLevel = _getDirectChild(ancestorElement, secondLine.range.startContainer)
      ;

    // ascending
    // We established above that node is not the same as home.
    var node = firstLine.range.endContainer
      , home = secondLine.range.startContainer
      ;
    while(true) {
        // We right and up and are eventually going to find secondSameLevel
        node = node.nextSibling || node.parentElement;
        if(node.nodeType !== Node.ELEMENT_NODE) {
            if(node === home)
                return false; // found it
            continue; // node can be line breaking by itself.
        }
        if(_isLineBreaking(node))
            return true;
        if(node === secondSameLevel)
            break; // descend now

    }
    // descending
    let nodes = [node];
    while(true) {
        node = nodes.shift();
        if(!node)
            // this can't happen
            throw new Error('Ran out of nodes.');
        if(node.nodeType !== Node.ELEMENT_NODE) {
            if(node === home)
                return false; // found it
            continue; // node can be line breaking by itself.
        }
        if(_isLineBreaking(node))
            return true;
        if(node.childNodes.length)
            nodes.unshift(...node.childNodes);
    }
    return true;
}

/*
 * Return a new line or null if there's no further line left.
 * lastLine is the last returned line, after it, the search for the
 * next line must begin.
 */
function* _justifyLines(carryOverElement, [narrowingStops, wideningStops]) {
    let lastLine = null
      , isInitialLine = true
      , linesToWiden = []
      ;
    while(true) {
        let lines = []
          , firstLine = null
          , secondLine = null
          ;
        // This node, we want to be the first node to be *considered*
        // in the next line, the generator starts however in a parent element
        let startNode = null
          , skipUntilAfter = null
          ;
        if(lastLine === null)
            startNode = carryOverElement;
        else {
            skipUntilAfter = lastLine[lastLine.length-1].firstChild;
            startNode = _getDirectChild(carryOverElement, skipUntilAfter);
        }
        if(!startNode) {
            if(lastLine)
                yield lastLine; // we don't use these anyways!
            break;
        }

        let continueWithNextSiblings = startNode !== carryOverElement
          , findLinesArguments = [[
                carryOverElement, // container, needed for bounding rect
                // for _deepTextGen [node, continueWithNextSiblings]
                // The second argument  only has an effect if the first
                // argument is a ELEMENT_NODE.
                [startNode, continueWithNextSiblings], //
                skipUntilAfter // skips nodes, until this node, including this node
            ]]
          ;

        // Here we hit the "missing textNode mystery" in Chrome/Chromium:
        // it's there but not there...
        let debug = false; // false or _DEBUG
        for(let line of findLines(...findLinesArguments, debug)) {
            lines.push(line);
            if(lines.length === 2)
                break;
        }

        if(lastLine) {
            let lastLineLastElem = lastLine[lastLine.length - 1];
            // Search for "missing textNode mystery" in the CSS file
            lastLineLastElem.classList.remove('new-style-current-last-line-elem');
            yield lastLine;
            isInitialLine = false;
        }

        // no next line
        if(!lines.length) {
            break;
        }
        if(lines.length === 1) {
            // Found a terminal last line; do something with firstLine.
            firstLine = lines[0];
            let isTerminalLine = true
              , addHyphen = false
              ;
            lastLine = _packLine(true, 'span', firstLine.nodes, firstLine.range,
                        firstLine.range, isInitialLine, addHyphen, isTerminalLine);
        }
        //// We have two lines from here on.
        else if(_isBreakBetweenLines(...lines)) {
            // FIXME: it would be better to handle the <br /> case in
            // _justifyBlockElement, just like a _isBlock so we wouldn't
            // have to test in here all lines with _isBreakBetweenLines.
            // however, that approach seems to duplicate the <br /> element
            // somewhere in here, so that would need fixing.
            //
            // E.g. a <br /> caused the line break.
            // No need for trying the narrowing.
            firstLine = lines[0];
            let isTerminalLine = false
                , addHyphen = false
                ;
            lastLine = _packLine(true, 'span', firstLine.nodes, firstLine.range,
                        firstLine.range, isInitialLine, addHyphen, isTerminalLine);
        }
        else {
            [firstLine, secondLine] = lines;
            let isNarrowAdjusted;

            let gen = _findAndJustifyLineByNarrowing(
                                findLinesArguments, narrowingStops, firstLine,
                                secondLine, isInitialLine)
              , result = null
              ;
            while( !(result=gen.next()).done) {
                /*yield result.value; */
            }
            // is done
            [lastLine, isNarrowAdjusted] = result.value;


            if(!isNarrowAdjusted)
                linesToWiden.push(lastLine);
        }

        // Search for "missing textNode mystery" in the CSS file
        lastLine[lastLine.length - 1].classList.add('new-style-current-last-line-elem');

        // Required to help chrome to do hyphenation! Chrome doesn't hyphenate
        // on node boundaries.
        // FIXME: with secondLine we tend to split nodes that span over to
        // the next line, and that breaks the hyphenation for those lines
        // we could just include the complete node of the second line, should
        // not hurt.
        carryOverElement.normalize();
    }
    // console.log('_justifyLineByWidening with:', linesToWiden.length);

    // Makes white-space: no-wrap;
    carryOverElement.classList.add('runion-justified-block');

    for(let line of linesToWiden) {
        // console.log('_justifyLineByWidening:', line);
        yield ['_justifyLineByWidening', _justifyLineByWidening(wideningStops, line, carryOverElement)];
    }

}

function* _justifyInlines(notBlockNodes, stops) {
    // console.log('_justifyInlines', notBlockNodes);
    // The first line we have in here should be treated as a first line.
    //    CAUTION: seems like only the first line *of* a block should be
    //    treated as first line, NOT the first *after* a block!.
    // We still have e.g. <br /> elements in here, so last lines still
    // require detection, as they can happen anywhere.
    let firstNotBlock = notBlockNodes[0]
      , lastNotBlock = notBlockNodes[notBlockNodes.length-1]
      , parent = firstNotBlock.parentElement
      , range = new Range()
      ;
    range.setStartBefore(firstNotBlock);
    range.setEndAfter(lastNotBlock);

    // There's time saving potential when skipping this
    // entire function if there are no lines to justify!.
    // But sadly, using range.getBoundingClientRect() makes it rather
    // slower:
    // let bcr = range.getBoundingClientRect();
    // if(bcr.width === 0)
    //    return;
    // maybe we can just check so far if the range contains only whitespace:
    if(_isWhiteSpaceText(range.toString()))
        return;
    // ... insert magic here ...
    // I wonder if the general find lines would be a good start, but actually
    // all lines of a block are invalid after the first iteration. Hence,
    // find lines for the next one or two lines at each time must be enough.

    let carryOverElement = _createIsolatedBlockContextElement(notBlockNodes);

    let i = 0
      , justifyLines = _justifyLines(carryOverElement, stops)
      ;
    while(true) {
        let result = justifyLines.next();
        if(result.done)
            break;
        // not used, but just to yield something
        yield result.value;
        i++;
        if(i > Infinity)
            throw new Error('HALT FOR DEV!!! ' + i + ' (_justifyInlines)');
    }
    // NOTE: this could be in a finally clause, however currently for
    // debugging it's better when the carryOverElement stays available,
    // also, in case of an error, this requires debugoging anyways,
    // there's no alternative plan yet.
    carryOverElement.remove();

    let newFragment = firstNotBlock.ownerDocument.createDocumentFragment();
    newFragment.append(...carryOverElement.childNodes);
    parent.insertBefore(newFragment, lastNotBlock.nextSibling);
    range.deleteContents();
}

function* _justifyBlockElement(elem, fontSpecKey, stops, [skipSelector, skipClass], options) {
    let notBlocks = []
        // This way we don't create confusion in the iterator about
        // which nodes to visit, after we changed the element, it may
        // also work otherwise, but this is very explicit.
      , childNodes = [...elem.childNodes]
      , total = 0
      , i = 0, maxI = Infinity//120
      ;
    for(let node of childNodes) {
        if(i >= maxI)
            throw new Error('HALT FOR DEV! ' + i );
        i++;

        if(node.nodeType === Node.ELEMENT_NODE) {
            let skip = node.matches(skipSelector);
            if(skip || _isBlock(node)) {
                if(notBlocks.length) {
                    // also change the elements in place...
                    let t0 = performance.now();
                    yield* _justifyInlines(notBlocks, stops);
                    // for(let _ of _justifyInlines(notBlocks, stops)){};
                    total += (performance.now() - t0);
                    notBlocks = [];
                    yield ['DONE _justifyInlines'];
                    //if(i > 9)
                    //    throw new Error('HALT FOR DEV! XXX DONE _justifyInlines');
                }
                if(!skip){
                    // changes the node in place

                    // FIXME: could/should be handled in _justifyNextGenGenerator
                    let fontSpecChanges = _getFontSpecKey(node) !== fontSpecKey;
                    if(!fontSpecChanges)
                        total += yield* _justifyBlockElement(node, fontSpecKey, stops, [skipSelector, skipClass], options);
                    else
                        total += yield* _justifyNextGenGenerator(node, [skipSelector, skipClass], options);

                }
                else if(skipClass)
                    node.classList.add(skipClass);

                continue;
            }
        }
        // all the others
        notBlocks.push(node);
    }
    if(notBlocks.length) {
        let t0 = performance.now();
        yield* _justifyInlines(notBlocks, stops);
        // for(let _ of _justifyInlines(notBlocks, stops)){};
        total += (performance.now() - t0);
    }
    // Makes it "white-space: nowrap;" to force some in fringe-cases
    // breaking lines into being single lines.
    elem.classList.add('runion-justified-block');
    return total;
}


function _getWordSpaceForElement(elem) {
    // assert CSS word-spacing === normal
    let text = elem.ownerDocument.createTextNode('] [')
     , range = new Range()
     , wordSpacingPx
     ;
    elem.appendChild(text);
    range.setStart(text, 1);
    range.setEnd(text, 2);
    wordSpacingPx = range.getBoundingClientRect().width;
    text.remove();
    return wordSpacingPx;
}

// this can essentially be used as just a wrapper around _justifyBlockElement
function* _justifyNextGenGenerator(elem, skip, options) {
    let wsPx = _getWordSpaceForElement(elem);
    elem.style.setProperty('--word-space-size', `${wsPx}px`);
    console.log('--word-space-size', `${wsPx}px`);

    elem.classList.add('runion-justification-host');

    let [fontSpec/*, fontSizePx, fontSizePt*/] = _getFontSpec(elem)
      , fontSpecKey = _getFontSpecKey(elem)
      , [xtraMin, xtraDefault, xtraMax] = fontSpec.XTRA
      , [trackingMin, trackingDefault ,trackingMax] = fontSpec.tracking
      , [wordspaceMin, wordspaceDefault ,wordspaceMax] = fontSpec.wordspace
      // Used to be around ~ 3 (i.e. fontSpec.length) but this value (1)
      // seems to work fine and is noticeably quicker,
      , stopsFidelityFactor = 1
        // To be able to use a scale, where step/unit size is the same
        // between narrowing and widening, the last possible step of each
        // parameter will be a the decimal partial step and then be
        // clipped by min/max.
        // This provides a simple interface for CSS where we can
        // just set a "step" magnitude via "--jsutification-step".
        // CAUTION: step sizes only appear to be the same, because of
        // min/max for each parameter and the composition of all
        // parameters, the actual difference a step makes changes.
      , narrowingStops = Math.round(Math.abs(xtraMin - xtraDefault) * stopsFidelityFactor)
      , wideningStops = Math.round(Math.abs(xtraMax - xtraDefault) * stopsFidelityFactor)
      , xtraNarrowingRange = Math.abs(xtraMin - xtraDefault)
      , xtraWideningRange = Math.abs(xtraMax - xtraDefault)
      , xtraStepSize = options.XTRA
                  ? Math.max(
                        xtraNarrowingRange / narrowingStops,
                        xtraWideningRange / wideningStops
                        )
                  : 0
      , trackingNarrowingRange = Math.abs(trackingMin - trackingDefault)
      , trackingWideningRange = Math.abs(trackingMax - trackingDefault)
      , trackingStepSize = options.letterSpacing
                  ? Math.max(
                        trackingNarrowingRange / narrowingStops,
                        trackingWideningRange / wideningStops
                        )
                  : 0
      , wordspaceNarrowingRange = Math.abs(wordspaceMin - wordspaceDefault)
      , wordspaceWideningRange = Math.abs(wordspaceMax - wordspaceDefault)
      , wordspaceStepSize = options.wordSpacing
                  ? Math.max(
                        wordspaceNarrowingRange / narrowingStops,
                        wordspaceWideningRange / wideningStops
                    )
                  : 0
      ;
    elem.style.setProperty('--justification-step-xtra', `${xtraStepSize}`);
    elem.style.setProperty('--justification-xtra-min', `${xtraMin}`);
    elem.style.setProperty('--justification-xtra-default', `${xtraDefault}`);
    elem.style.setProperty('--justification-xtra-max', `${xtraMax}`);

    elem.style.setProperty('--justification-step-tracking', `${trackingStepSize}`);
    elem.style.setProperty('--justification-tracking-min', `${trackingMin}`);
    elem.style.setProperty('--justification-tracking-default', `${trackingDefault}`);
    elem.style.setProperty('--justification-tracking-max', `${trackingMax}`);

    elem.style.setProperty('--justification-step-wordspace', `${wordspaceStepSize}`);
    elem.style.setProperty('--justification-wordspace-min', `${wordspaceMin}`);
    elem.style.setProperty('--justification-wordspace-default', `${wordspaceDefault}`);
    elem.style.setProperty('--justification-wordspace-max', `${wordspaceMax}`);

    // This prevents that we apply "empty steps", that don't change anything,
    // since we can separately turn off the justification parameters.
    let effectiveNarrowingStops = Math.max(0, ...[
          xtraNarrowingRange / xtraStepSize
        , trackingNarrowingRange / trackingStepSize
        , wordspaceNarrowingRange / wordspaceStepSize
        ].filter(x=>isFinite(x))
    );

    let effectiveWideningStops = Math.max(0, ...[
          xtraWideningRange / xtraStepSize
        , trackingWideningRange / trackingStepSize
        , wordspaceWideningRange / wordspaceStepSize
        ].filter(x=>isFinite(x))
    );

    // console.log('effectiveNarrowingStops, effectiveWideningStops:'
    //                  , effectiveNarrowingStops, effectiveWideningStops);

    let t0 = performance.now();
    let total = yield* _justifyBlockElement(elem, fontSpecKey
            , [effectiveNarrowingStops, effectiveWideningStops], skip, options);
    let t1 = performance.now();
    // Makes white-space: no-wrap; must be removed on unjustify.

    yield ['DONE _justifyBlockElement'];

    console.log(`time in _justifyBlockElement ${(t1-t0) /1000} s`);
    console.log(`time in _justifyInlines ${total/1000} s`);
    yield ['did _justifyBlockElement'];
    return total;
}

export class JustificationController{
    constructor(elem, skip, options) {
        this._elem = elem;
        this._skip = skip;
        this._options = options || {};
        this._gen = null;
        this._timeout = null;
        this._running = false;
        this._statusReporters = new Set();
        this._lastReportedStatus = null;
    }
    get running() {
        return this._running;
    }
    setOption(name, value, reset=true) {
        this._options[name] = value;
        if(reset)
            this.reset();
    }
    /* usage: ctrl.setOption(false, ['XTRA', false]);
     *
     *    'XTRA', bool default: true
     *    'letterSpacing', bool default: true
     *    'wordSpacing', bool default: true
     */
    setOptions(reset, ...name_value) {
        for(let [name, value] of name_value)
            this.setOption(name, value);
        if(reset)
            this.reset();
    }
    getOption(name) {
        return name in this._options
            ? this._options[name]
            // Not set options are currently treated as true by the
            // algorithm, may change!
            : true
            ;
    }

    addStatusReporter(reporterCallback) {
        this._statusReporters.add(reporterCallback);
        if(this._lastReportedStatus !== null)
            reporterCallback(this._lastReportedStatus);
    }
    _reportStatus(status) {
        this._lastReportedStatus = status;
        for(let reporterCallback of this._statusReporters)
            reporterCallback(status);
    }
    setRunning(isRunning) {
        if(this._running === !!isRunning) // jshint ignore:line
            return;
        console.log('JustificationController.setRunning', isRunning);
        this._running = !!isRunning;

        if(this._running) {
            if(!this._gen) {
                this._reportStatus('init');
                this._unjustify();
                this._gen = _justifyNextGenGenerator(this._elem, this._skip, this._options);
            }
            else
                this._reportStatus('continue');
            this._scheduleIterate();
        }
        else {
            this._reportStatus('paused');
            this._unscheduleIterate();
        }
    }
    run() {
        this.setRunning(true);
    }
    pause() {
        this.setRunning(false);
    }
    cancel() {
        this._unscheduleIterate();
        this._gen = null;
        this._unjustify();
        this.setRunning(false);
        this._reportStatus('inactive');
    }
    restart() {
        this.cancel();
        this.run();
    }
    reset() {
        if(this.running)
            this.restart();
        else
            this.cancel();
    }
    _unjustify() {
        let [, skipClass] = this._skip
          , lineClass = 'runion-line'
          , justifiedBlockClass = 'runion-justified-block'
          , justificationHostClass = 'runion-justification-host'
          , justificationContextClass = 'justification-context-block'
          ;

        for(let lineElem of this._elem.querySelectorAll(`.${lineClass}`))
            lineElem.replaceWith(...lineElem.childNodes);

        for(let elem of [this._elem, ...this._elem.querySelectorAll(`.${justificationHostClass}`)]) {
            elem.classList.remove(justificationHostClass);
            for(let propertyName of [
                                  '--word-space-size'
                                , '--justification-step-xtra'
                                , '--justification-xtra-min'
                                , '--justification-xtra-default'
                                , '--justification-xtra-max'
                                , '--justification-step-tracking'
                                , '--justification-tracking-min'
                                , '--justification-tracking-default'
                                , '--justification-tracking-max'
                                , '--justification-step-wordspace'
                                , '--justification-wordspace-min'
                                , '--justification-wordspace-default'
                                , '--justification-wordspace-max'
                                ])
                elem.style.removeProperty(propertyName);
        }
        for( let rmClass of [skipClass, justifiedBlockClass])
            for(let elem of this._elem.querySelectorAll(`.${rmClass}`))
                elem.classList.remove(rmClass);

        for(let elem of this._elem.querySelectorAll(`.${justificationContextClass}`))
            elem.remove();

        // IMPORTANT:
        //
        // From MDN:
        //   > The Node.normalize() method puts the specified node and all of its
        //   > sub-tree into a "normalized" form. In a normalized sub-tree, no text
        //   > nodes in the sub-tree are empty and there are no adjacent text nodes.
        //
        // Without this, running unjustify seems to fix the markup, but
        // re-running justify afterwards creates lines as if each span of
        // the previous run is on it's own line. could be an internal browser
        // caching thing, however, it appears in Firefox and Chromium.
        //
        // This is likely due to the fact that we check if client-rects are
        // touching and that we don't include line separating whitespace
        // in the lines, which become fragment whitespace nodes eventually.
        // There could be a fix in the findLines algorithm as well. Running
        // `container.normalize()` always before findLines on the other hand
        // would likely make it more resilient.
        this._elem.normalize();
    }
    _scheduleIterate() {
        if(this._timeout !== null)
            // is already scheduled
            return;
        this._timeout = setTimeout(()=>this._iterate(), 0);
    }
    _unscheduleIterate() {
        clearTimeout(this._timeout);
        this._timeout = null;
    }
    _iterate() {
        // clean up for _scheduleIterate
        this._unscheduleIterate();

        if(!this._gen) return;

        let yieldVal = this._gen.next();
        if(yieldVal.done) {
            this._reportStatus('Done!');
            return;
        }
        let [stepName, data] = yieldVal.value;
        switch(stepName){
            case 'elementLines':
                break;
            case 'justifyLine':
                let [justifiedCount , total, ] = data;
                this._reportStatus(`${((justifiedCount/total) * 100).toFixed(1)}%`);
        }
        // schedule next round
        this._scheduleIterate();
    }
    destroy() {
        this.cancel();
    }
}
