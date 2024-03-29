/* jshint browser: true, devel: true, esversion: 9, laxcomma: true, laxbreak: true, unused: true */
import {getElementSizesInPx, getComputedPropertyValues} from './domTool.mjs';

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

    toString() {
        return `[line::${this.range.toString()}]]`;
    }
}

function _getContainingRect(lineRangeOrNode, lineParent) {
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
        if(rect.width === 0 || rect.height === 0)
            continue;
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
                   //      difference: -0.63336181640625
                   // which is a very small rule violation, but still breaks,
                   // hence, I add a second more forgiving rule:
                   //           rect.right - lineRect.right >= -2
                   // It's not quite clear to me how the browser decides
                   // which magnitude of rule breaking is OK, so this is
                   // so far a game of guessing.
                   //
                   // TODO: a "best fit" approach could be better than a
                   //        definite fit. E.g. where the biggest portion
                   //        of the area of lineRect is contained.
                   // Setting -webkit-hyphens: none; for runion lines
                   // made this check much more relieable again!
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
        logs.push(['top', lineRect.top, '>=', rect.top, lineRect.top >= rect.top, 'difference:', rect.top - lineRect.top]);
        logs.push(['bot', lineRect.bottom, '<=', rect.bottom, lineRect.bottom <= rect.bottom, 'difference:', rect.bottom - lineRect.bottom]);
        logs.push(['lef', lineRect.left, '>=', rect.left, lineRect.left >= rect.left, 'difference:', rect.left - lineRect.left]);
        logs.push(['rig', lineRect.right, '<=', rect.right, lineRect.right <= rect.right, 'difference:', rect.right - lineRect.right]);
    }
    for(let line of logs)
        console.log(...line);
    throw new Error(`_getContainingRect couldn't identify a containing rect`
                  + ` for: "${lineRangeOrNode.textContent || lineRangeOrNode.toString()}"`);
}

function _isOutOfFlowContext(elem) {
    return elem.offsetParent === null;
}

function drawRect(document, rect, label) {
    let div = document.createElement('div')
      , props = [
            ['position', 'absolute']
          , ['top', `${document.defaultView.scrollY + rect.top}px`]
          , ['left', `${document.defaultView.scrollX + rect.left}px`]
          , ['width', `${rect.width}px`]
          , ['height', `${rect.height}px`]
          , ['background', '#f005']
          //, ['outline', '1px solid lime']
          , ['overflow', 'visible']
          , ['z-index', '9999']
      ];
    for(let [k, v] of props)
        div.style.setProperty(k, v);
    if(label) {
        let l = document.createElement('span')
          , props = [
                ['display', 'block']
              , ['position', 'absolute']
              , ['top', '-2em']
              , ['background', '#ff05']
           ]
          ;
        l.append(label);
        for(let [k, v] of props)
            l.style.setProperty(k, v);
        div.append(l);
    }
    document.body.append(div);
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
            // index of the node, i.e. after the last element.
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
              , firstRect = rects[0]
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

            // If there's just one DOMElement selected, but we get two rects,
            // it's save to say that the line is crooked, in so far, that
            // Chrome/Chromium seems to create a rect at the end of the
            // previous line, for the previous hyphen, with the width of
            // the hyphen but the hyphen is not part of the selection.
            // This seems to work as well with FireFox, which doesn't
            // misbehave in this fashion. Thus, the heuristic seem good
            // enough.
            if(rects.length > 1) {
                if( currentLine.range.startContainer === currentLine.range.endContainer
                    && currentLine.range.endOffset - currentLine.range.startOffset === 1) {
                        // remember for the whole lifetime of the line
                        currentLine.isCrooked = true;
                }
                if(currentLine.isCrooked) {
                    rects.shift();
                    firstRect = rects[0];
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
                        `Math.floor(lastRect.bottom - firstRect.bottom) = ${Math.floor(lastRect.bottom - firstRect.bottom)}`,
                        ' >= 3\n',
                        `Math.floor(lastRect.top - firstRect.top) = ${Math.floor(lastRect.top - firstRect.top)}`,
                        ' >= 3\n',
                        'lastRect:', ...printRect(lastRect), '\n',
                        'firstRect', ...printRect(firstRect), '\n'
                    );
                    console.log('currentLine:', currentLine.range.toString());
                    console.log(currentLine.range.getBoundingClientRect(), '=> getBoundingClientRect');

                    // drawRect(container.ownerDocument, currentLine.range.getBoundingClientRect(), 'getBoundingClientRect');
                    // for(let [i, r] of rects.entries())
                    //   drawRect(container.ownerDocument, r, `rect_${i}`);
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
    if(currentLine && currentLine.range.toString().length){
        yield currentLine;
    }
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
    let [display] = getComputedPropertyValues(elem, 'display');
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

function* justifyControlLoop(readUnusedWhiteSpace, generators) {
    let gen = generators.shift();
    while(gen) {
        let unusedWhiteSpace = readUnusedWhiteSpace();
        if (Math.abs(unusedWhiteSpace) < 1) {
            // all good, we have a perfect line
            return;
        }
        let result = gen.next(unusedWhiteSpace);
        yield `justifyControlLoop result ${result}`;
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
      , _getFullWidth = elem=>{
            // Here an issue in Safari occurred where the element had two
            // client rects, the first had no dimension, i.e. width and
            // height were 0, for no apparent reason. Previously this just
            // took the first rect in any case, now we use the first rect
            // that has a width.
            for(let rect of elem.getClientRects())
                if(rect.width) return rect.width;
            return 0;
        }
        // In the standard box model, this would be equal to the
        // width or height property of the element + padding + border-width.
        // But if box-sizing: border-box is set for the element this
        // would be directly equal to its width or height.
      , fullWidth = _getFullWidth(block)
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
                let fixIndentElement = node.cloneNode(false);
                // This must be removed again!
                fixIndentElement.classList.add('fix-indent-element_marker');
                cloned.insertBefore(fixIndentElement, cloned.firstChild);
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


function _onlyVoidBetween(elem1, elem2) {
    // must be siblings
    if(elem1.parentElement !== elem2.parentElement)
        return false;

    // elem2 precedes elem1
    if(elem1.compareDocumentPosition(elem2) & Node.DOCUMENT_POSITION_PRECEDING)
        // the old switcheroo
        [elem1, elem2] = [elem2, elem1];

    let next = elem1.nextSibling;
    while(next) {
        if(next === elem2)
            return true;
        if((next.nodeType === next.TEXT_NODE && next.textContent.length === 0)
                || next.nodeType === next.COMMENT_NODE) {
            next = next.nextSibling;
            continue;
        }
        return false;
    }
    // never reaches this.
    return false;
}

// FIXME: INSPECTION_MODE_BEACON_CLASS should be injected by the caller.
const INSPECTION_MODE_CLASS = 'varla_varfo-font_spec_inspector'
    , INSPECTION_MODE_BEACON_CLASS = `${INSPECTION_MODE_CLASS}-beacon`
    ;
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
        for(let elem of elements)
            elem.classList.add('line-in-progress');
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
    if(upper === lower)
        throw new Error('_getInterpolationPosition with lower === upper '
            + ` (=== ${lower}) creates a division by zero situation.` );
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

function _findPosBetween(mark, sortedKeys) {
    let lower = sortedKeys[0]
      , upper = lower
      ;
    for(let key of sortedKeys) {
        if(mark >= key)
            lower = upper = key;
        if(mark <= key){
            upper = key;
            break;
        }
    }
    return [lower, upper];
}

function _calculateFontSpec(spec, keys) {
    if('XTRA' in spec)
        // Bottomed out, could also be keys.length === 0, but the current
        // test allows shortcutting the spec-depth, so it's more flexible.
        // I.e. this cold be used to position a spec that does not need
        // interpolation on an upper level, insead of putting two identical
        // specs next to each other.
        return spec;
    let [key, ...tail] = keys
        // In the lowest level, this would fail!
        // As indicator we use the presence of the key XTRA above.
      , specKeys = Array.from(Object.keys(spec)).map(parseFloat).sort((a,b)=>a-b)
      , [lower, upper] = _findPosBetween(key, specKeys)
      ;
    if(lower === upper) {
        // This prevents a division by zero in _getInterpolationPosition,
        // but it also is an optimization.
        // Could be a direct hit or potentially extrapolation, which we
        // don't do (yet?) and which is also prevented in findPosBetween.
        // No need to interpolate, just return the result.
        return _calculateFontSpec(spec[lower], tail);
    }
    let loweSpec = _calculateFontSpec(spec[lower], tail)
      , upperSpec = _calculateFontSpec(spec[upper], tail)
      , t = _getInterpolationPosition(key, upper, lower)
      , resultSpec = {}
      ;
    for(let k of Object.keys(upperSpec))
        resultSpec[k] = _interpolateArray(t, upperSpec[k], loweSpec[k]);
    return resultSpec;
}

export function parseFontVariationSettings(variations) {
    // "GRAD" 0, "VVFS" 31.9992, "XTRA" 468, "opsz" 31.9992, "slnt" 0, "wdth" 30, "wght" 200
    let result = new Map();
    for(let kv of variations.split(',')) {
        let[k, v] = kv.trim().split(' ');
        k = k.replaceAll(/["']/g, '');
        v = parseFloat(v);
        result.set(k, v);
    }
    return result;
}

function _getFontSpecProperties(referenceElement) {
    let [rawFontVariations, rawFontFamily] = getComputedPropertyValues(referenceElement,
            'font-variation-settings',
            '--font-family')
      , fontFamily = rawFontFamily.trim()
      , fontVariations = parseFontVariationSettings(rawFontVariations)
      , opticalFontSizePt = fontVariations.get('opsz')
      , width = fontVariations.get('wdth')
      , weight = fontVariations.get('wght')
      ;
    return [fontFamily, weight, width, opticalFontSizePt];
}

function _getFontSpec(justificationSpecs, referenceElement) {
    var [fontFamily, weight, width, opticalFontSizePt] = _getFontSpecProperties(referenceElement)
      , fontSpecConfig = justificationSpecs[fontFamily]
      , spec =  _calculateFontSpec(fontSpecConfig, [weight, width, opticalFontSizePt])
      ;
    console.log(`Font Spec for ${fontFamily} @ wght ${weight} wdth ${width} ${opticalFontSizePt} pt`, spec);
    return spec;
}

function _getFontSpecKey(referenceElement) {
    var [fontFamily, weight, width, opticalFontSizePt] = _getFontSpecProperties(referenceElement);
    return `${fontFamily}@wght:${weight};wdth:${width};opsz:${opticalFontSizePt};`;
}


function* _findLineApplyNarrowing(findLinesArguments, stops, firstLine,
                                                secondLine, isInitialLine, initialStep=0) {
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
    yield 'packed';
    // Now reduce [--font-xtra, ...] until the line breaks later, i.e.
    // until something from the second line jumps onto the first line, OR,
    // until we run out of negative [--font-xtra, ...] adjustment potential.
    // using _adjustLine

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
                    //
                    // Safari on iPhone runs into this when line color
                    // coding is OFF. There's a side-effect based
                    // work-around in general.css using CSS property
                    //     "mix-blend-mode: darken;"
                    // Under the selector
                    //      ".justification-context-block .runion-line"
                    //
                    // It's interesting though, that not raising this Error
                    // fixes the bug as well! The applied work around however
                    // synchronizes the behavior with color coding and without.
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

    let startValue = initialStep
      , step = initialStep
      , adjustmens = genNarrowAdjustments(stops, startValue)
      ;
    _adjustLine(spans, step);
    while(true) {
        let adjustmentVal = adjustmens.next();
        yield 'adjusted next';
        if(adjustmentVal.done) {
            //console.log(`no more potential: step ${step} of ${stops} from ${startValue}`
            //          , '\n', startLineContent);
            // don't adjust this with negative width ->
            //          undo all adjustments and go to positive width
            resultLine = currentLine;
            step = initialStep;
            break;
        }
        // if there's potential for adjustment

        step = adjustmentVal.value;
        _adjustLine(spans, step);
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
                //_adjustLine(spans, '');
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

    let isNarrowAdjusted = step !== initialStep;
    _adjustLine(newSpans, step);
    // remove adjustment spans
    for(let elem of spans) {
        // The nodes from newSpans are already removed as children of these elements.
        elem.replaceWith(...elem.childNodes);
    }

    // This merges elements of (there should be only one, like a cursor)
    // INSPECTION_MODE_BEACON_CLASS with preceding and following line
    // elements. That element should really be at the lowest level,
    // especieally not inbetween lines.
    // This also changes the `elements` array and the actual elements
    // as well, so this is rather expensive, but since it's only happenening
    // in one specific line at a time, it should be OK.
    // Be aware that elements here does only contain line-elements,
    // not sibllings etc. Also, elements may not have the same parentElement.
    for(let i=0,l=newSpans.length;i<l;i++) {
        let elem = newSpans[i];
        if(elem.previousElementSibling
                && elem.previousElementSibling.classList.contains(INSPECTION_MODE_BEACON_CLASS)
                && _onlyVoidBetween(elem.previousElementSibling, elem)) {
            // prepend to children, so it's inside of the line element
            elem.insertBefore(elem.previousElementSibling, elem.firstChild);
        }
        else if(elem.nextElementSibling
                && elem.nextElementSibling.classList.contains(INSPECTION_MODE_BEACON_CLASS)
                && _onlyVoidBetween(elem, elem.nextElementSibling)) {
            elem.append(elem.nextElementSibling);

            // merge next element,  so it's inside of the line element
            let nextElem = newSpans[i+1];
            if(nextElem && _onlyVoidBetween(elem, nextElem)) {
                elem.append(...nextElem.childNodes);
                nextElem.remove();
                newSpans.splice(i+1, 1);
                l = l-1;
                for(let class_ of nextElem.classList)
                    // hyphen/last element in line classes
                    elem.classList.add(class_);
            }
        }
    }

    // TODO: would be interesting to plot how often each value appears
    // maybe, in the sweetspot range, if there is any, small changed could
    // have big effects. But it would differ between line length and
    // font-size/font-spec, so one value wouldn't do.
    // console.log(`narrowing ${adjustment}`);

    return [newSpans, isNarrowAdjusted, step];
}

function _setPropertyToLine(lineElements, name, value) {
     for(let elem of lineElements)
        elem.style.setProperty(name, value);
}

function _adjustLine(lineElements, adjustmentStep) {
    _setPropertyToLine(lineElements, '--line-adjust-step', adjustmentStep);
}

function _setLineColorCode(lineElements, adjustmentStep, narrowingStops, wideningStops) {
    let hslColor;
    if(narrowingStops && adjustmentStep < 0) {
        let colorIntensity = Math.abs(adjustmentStep) / narrowingStops;
        hslColor = `hsl(180, 80%, ${30 + 70 * (1 - colorIntensity)}%)`;
    }
    else if(wideningStops && adjustmentStep > 0) {
        let colorIntensity = adjustmentStep / wideningStops;
        hslColor = `hsl(0, 100%, ${30 + 70 * (1 - colorIntensity)}%)`;
    }
    else//(adjustmentStep === 0)
        hslColor = '';
    _setPropertyToLine(lineElements, '--line-color-code', hslColor);
}

function* _applyLineWidening(stops, lineElements, container) {
    let lineRange = new Range()
      , firstNode = lineElements[0]
      , lastNode = lineElements[lineElements.length-1]
      , adjustLine =  (step)=>_adjustLine(lineElements, step)
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
            // seems better when filtering out non-dimensional rects.
            var right = 0;
            for(let rect of lineRange.getClientRects()) {
                if(rect.height === 0 || rect.width === 0)
                    continue;
                if(rect.right > right)
                    right = rect.right;
            }
            return rightStop - right;
        }
      ;

        // FIXME: using --line-adjust-step as a start value is only
        // interesting for the special case not for the general!
    let readStep = ()=>parseFloat(getPropertyFromLine('--line-adjust-step')) || 0
      , generators = []
      ;

    generators.push(
            // hmm, if readStep < 0, we should probably still start there
            // in the special case scenrio!
            _justifyByGenerator(adjustLine, readStep, readStep(), stops));

    // if(!options || options.wordSpacing !== false) {
    //         // We had some good results with this not used at all,
    //         // But if it can do some reduced word-spacing, optionally
    //         // not fully justified, it could still be an option.
    //     generators.push(
    //         _fullyJustifyByWordSpacingGenerator(setWordSpacingPx, lineWordSpaces));
    //}
    // run the actual justification
    yield* justifyControlLoop(readUnusedWhiteSpace, generators);

    // Visualize, with color, how much widening was applied to the line.
    let step = readStep();
    return step;
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
    // in _blockHandler.
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

function* _linesGenerator(carryOverElement, [narrowingStops, wideningStops]
                      , interLineHarmonizationFactor) {
    let lastLine = null
      , stepBeforeLastStep = 0
      , lastStep = 0
      , initialStep = 0
      , isInitialLine = true
      , linebreaks = []
      ;
    while(true) {
        // With this we can have a releation between the narrowing of
        // the previous line and the current line, the initial motivation
        // was to optically harmonize subsequent lines of the main headline
        // if the adjustment was very extreme. So, there we start with a
        // value half between 0 and the previous line, instead of starting
        // with zero. I.e.: interLineHarmonizationFactor = 0.5;
        if(interLineHarmonizationFactor) {
            // Harmonize between the two previous lines.
            initialStep = (stepBeforeLastStep - lastStep) * interLineHarmonizationFactor + lastStep;
            initialStep = Math.min(wideningStops, Math.max(-narrowingStops, initialStep));
            // Set this for the whole parent as the base to operate on.
            // FIXME: applying an interLineHarmonizationFactor e.g. to
            // "pull" mode currently breaks justification, we should make
            // this property save to use, even if we don't apply it there.
            carryOverElement.style.setProperty('--line-adjust-step', initialStep);
        }
        stepBeforeLastStep = lastStep;

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
            skipUntilAfter = lastLine[lastLine.length-1].lastChild;
            // possible because of the INSPECTION_MODE_BEACON_CLASS span element
            if(skipUntilAfter.nodeType === skipUntilAfter.ELEMENT_NODE) {
                let emptyText = skipUntilAfter.ownerDocument.createTextNode('');
                skipUntilAfter.parentElement.appendChild(emptyText);
                skipUntilAfter = emptyText;
            }

            startNode = _getDirectChild(carryOverElement, skipUntilAfter);
        }
        if(!startNode)
            break;

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
            _adjustLine(lastLine, initialStep);
            _setLineColorCode(lastLine, initialStep, narrowingStops, wideningStops || 0);
        }
        //// We have two lines from here on.
        else {
            [firstLine, secondLine] = lines;

            let isNarrowAdjusted
              ,  gen = _findLineApplyNarrowing(
                                findLinesArguments, narrowingStops, firstLine,
                                secondLine, isInitialLine, initialStep)
              , result = null
              ;
            while( !(result=gen.next()).done) {
                // Yield to slow down and inspect/animate.
                if(debug === _DEBUG)
                    yield result.value;
            }
            // is done
            [lastLine, isNarrowAdjusted, lastStep] = result.value;

            let lastLineLastElem = lastLine[lastLine.length - 1]
              , br = lastLineLastElem.ownerDocument.createElement('br')
              ;
            lastLineLastElem.after(br);
            linebreaks.push(br);

            // Allow widening when lastStep < 0 even if wideningStops
            // is zero, because we can widen within the narrowing range.
            if(!isNarrowAdjusted && wideningStops !== false) {
                // this is the reasons why some lines in the justification
                // context break and don't widen well! Since it's hard to
                // put the line into a separate white-space: nowrap container
                // because it's elements may be within e.g. achors which
                // may be splitted and can't be full transferred, it's
                // better to apply nowrap temporarily.
                carryOverElement.style.setProperty('white-space', 'nowrap');
                let gen = _applyLineWidening(wideningStops, lastLine, carryOverElement)
                  , result = null
                  ;
                while( !(result=gen.next()).done) {
                    // Yield to slow down and inspect/animate.
                    if(debug === _DEBUG)
                        yield result.value;
                }
                lastStep = result.value;
                carryOverElement.style.removeProperty('white-space');
            }
            _setLineColorCode(lastLine, lastStep, narrowingStops, wideningStops || 0);
            yield lastLine;
        }
        let lastLineLastElem = lastLine[lastLine.length - 1];
        // Search for "missing textNode mystery" in the CSS file
        lastLineLastElem.classList.add('new-style-current-last-line-elem');
        // Required to help chrome to do hyphenation! Chrome doesn't hyphenate
        // on node boundaries.
        // FIXME: with secondLine we tend to split nodes that span over to
        // the next line, and that breaks the hyphenation for those lines
        // we could just include the complete node of the second line, should
        // not hurt.
        carryOverElement.normalize();
    }
    linebreaks.map(br=>br.remove());
    // console.log('_justifyLineByWidening with:', linesToWiden.length);

    // Makes white-space: no-wrap;
    carryOverElement.classList.add('runion-justified-block');
}

// This a lot like a decorator of the justifyLinesGenerator.
function* _inlinesHandler(linesGenerator, notBlockNodes) {
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

    let carryOverElement = _createIsolatedBlockContextElement(notBlockNodes)
      , i = 0
      , linesGen = linesGenerator(carryOverElement)
      ;
    while(true) {
        let result = linesGen.next();
        if(result.done)
            break;
        // not used, but just to yield something
        yield result.value;
        i++;
        if(i > Infinity)
            throw new Error('HALT FOR DEV!!! ' + i + ' (_inlinesHandler)');
    }
    // NOTE: this could be in a finally clause, however currently for
    // debugging it's better when the carryOverElement stays available,
    // also, in case of an error, this requires debugoging anyways,
    // there's no alternative plan yet.
    carryOverElement.remove();

    let newFragment = firstNotBlock.ownerDocument.createDocumentFragment();
    // 'fix-indent-element_marker' must be removed again otherwise
    // the element will be duplicated.
    newFragment.append(...Array.from(carryOverElement.childNodes)
        .filter(e=>!(e.classList && e.classList.contains('fix-indent-element_marker'))));
    parent.insertBefore(newFragment, lastNotBlock.nextSibling);
    range.deleteContents();
}

function* _blockHandler(justificationSpec, elem, [skipSelector, skipClass], options, inlinesHandler) {
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
            let skip = node.matches(skipSelector)
              , isBreaking = _isLineBreaking(node)
              ;
            // TODO: here we can switch into e.g. headline specific line
            // handling.
            if(skip || _isBlock(node) || isBreaking) {
                if(notBlocks.length) {
                    // also change the elements in place...
                    let t0 = performance.now();
                    yield* inlinesHandler(notBlocks);
                    // for(let _ of inlinesHandler(notBlocks)){};
                    total += (performance.now() - t0);
                    notBlocks = [];
                    yield ['DONE inlinesHandler'];
                    //if(i > 9)
                    //    throw new Error('HALT FOR DEV! XXX DONE inlinesHandler');
                }
                if(isBreaking) {/*pass*/}
                else if(!skip) {
                    // changes the node in place
                    total += yield* _lineTreatmentGenerator(justificationSpec, node, [skipSelector, skipClass], options);
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
        yield* inlinesHandler(notBlocks);
        // for(let _ of inlinesHandler(notBlocks)){};
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

const _JUSTIFICATION_HOST_CLASS = 'runion-justification-host'
    , _LINE_HANDLING_CLASS_PREFIX = 'line_handling_';

function _getLineTreatmentParameters(justificationSpec, elem, options) {
    // This is removed in unjustify.
    let {justificationSpecs, wdthJustificationSpecs} = justificationSpec
      , properties = []
      , setProperty = (name, val)=>properties.push([name, val])
      , allLineHandlingProperties = new Set([
                'wdth', 'wordspace', 'tracking', 'xtra'])
      , [modeKey, lineHandlingPropertiesRaw,interLineHarmonizationFactorRaw,
         lineHandlingDirectionRaw
        ] = getComputedPropertyValues(elem,
                            '--line-handling-mode'
                          , '--line-handling-properties'
                          , '--inter-line-harmonization-factor'
                          , '--line-handling-direction'
                          ).map(s=>s.trim())
      , usedLineHandlingProperties = new Set(lineHandlingPropertiesRaw.split(/\s+/)
                // Make sure we know them all, so unusedLineHandlingProperties
                // will be correct and can be used to unset/reset some CSS-properties.
                .filter(prop=>allLineHandlingProperties.has(prop)))
      , unusedLineHandlingProperties = new Set([...allLineHandlingProperties]
                .filter(prop=>!usedLineHandlingProperties.has(prop)))
      , interLineHarmonizationFactor = parseFloat(interLineHarmonizationFactorRaw) || 0
      , lineHandlingDirections = new Set(['both', 'narrowing', 'widening'])
      , lineHandlingDirection_ = lineHandlingDirectionRaw.replace(/["']+/g, '')
      , lineHandlingDirection = lineHandlingDirections.has(lineHandlingDirection_)
                                        ? lineHandlingDirection_ : 'both'
      , fontSpec = _getFontSpec(justificationSpecs, elem)
      , numberOfAxis = usedLineHandlingProperties.size
      , [absoluteFontSizePX, runionColumnWidthEN] = getComputedPropertyValues(elem,
                        'font-size', '--column-width-en').map(parseFloat)
      , absoluteFontSizePT = absoluteFontSizePX * 0.75
        // It makes sense to have more steps with bigger type and bigger
        // line length and less steps with smaller type and smaller line
        // length, because the fidelity with big type should go up, as in
        // terms of absolute change the impact becomes bigger with each
        // step when everything is scaled. Having less steps will also
        // reduce the number of tries the algorithm has to justify text.
        // This could be a way to tweak the performance as a trade off
        // between fidelity of line fitting vs amount of steps.
        //
        // Each axis in here is treated as having the same impact on the
        // length as well, we could use numbers > 0 and < 1 for axis with
        // less range compared to a "standard" and numbers > 1 for axis
        // with a bigger impact than the standard. This would have to be
        // configured per font.
     ,  narrowingStops = numberOfAxis
                        // 12 pt and 65 ren are some magic/random numbers
                        // that relate this calculation to some real world
                        // appearance.
                        * (absoluteFontSizePT / 12)
                        * (runionColumnWidthEN / 65)
                        // 10 is a magic number, guess for an apropriate
                        // amount of steps  based on a 12 pt font size and
                        // at 65 ren  width of column.
                        * 10
      , wideningStops = narrowingStops
      , allNarrowingStops = []
      , allWideningStops = []
      ;
    for(let prop of unusedLineHandlingProperties) {
        // This makes the formulae in the --dynamic-xxxx properties
        // invalid, i.e. it turns them off when they are unused.
        // I tried to do this with CSS classes to add and remove
        // the --dynamic-xxxx properties, but due to the nature of
        // CSS selectors, it turned out to be overly complicted.
        // This is much simpler.
        setProperty(`--line-adjust-step-${prop}`, 'initial');
    }
    for(let prop of usedLineHandlingProperties) {
        switch(prop) {
            case 'xtra':
                let [xtraMin, xtraDefault, xtraMax] = fontSpec.XTRA
                  , xtraNarrowingRange = Math.abs(xtraMin - xtraDefault)
                  , xtraWideningRange = Math.abs(xtraMax - xtraDefault)
                  , xtraStepSize = options.XTRA
                                ? Math.max(
                                        xtraNarrowingRange / narrowingStops,
                                        xtraWideningRange / wideningStops
                                        )
                                : 0
                ;
                setProperty('--line-adjust-step-xtra', `${xtraStepSize}`);
                setProperty('--line-adjust-xtra-min', `${xtraMin}`);
                setProperty('--line-adjust-xtra-default', `${xtraDefault}`);
                setProperty('--line-adjust-xtra-max', `${xtraMax}`);
                allNarrowingStops.push(xtraNarrowingRange / xtraStepSize);
                allWideningStops.push(xtraWideningRange / xtraStepSize);
                break;
            case 'tracking':
                let [trackingMin, trackingDefault ,trackingMax] = fontSpec.tracking
                  , trackingNarrowingRange = Math.abs(trackingMin - trackingDefault)
                  , trackingWideningRange = Math.abs(trackingMax - trackingDefault)
                  , trackingStepSize = options.letterSpacing
                                ? Math.max(
                                        trackingNarrowingRange / narrowingStops,
                                        trackingWideningRange / wideningStops
                                        )
                                : 0
                 ;
                setProperty('--line-adjust-step-tracking', `${trackingStepSize}`);
                setProperty('--line-adjust-tracking-min', `${trackingMin}`);
                setProperty('--line-adjust-tracking-default', `${trackingDefault}`);
                setProperty('--line-adjust-tracking-max', `${trackingMax}`);
                allNarrowingStops.push(trackingNarrowingRange / trackingStepSize);
                allWideningStops.push(trackingWideningRange / trackingStepSize);
                break;
            case 'wordspace':
                let [wordspaceMin, wordspaceDefault ,wordspaceMax] = fontSpec.wordspace
                  , wordspaceNarrowingRange = Math.abs(wordspaceMin - wordspaceDefault)
                  , wordspaceWideningRange = Math.abs(wordspaceMax - wordspaceDefault)
                  , wordspaceStepSize = options.wordSpacing
                              ? Math.max(
                                      wordspaceNarrowingRange / narrowingStops,
                                      wordspaceWideningRange / wideningStops
                                  )
                              : 0
                  ,  wsPx = _getWordSpaceForElement(elem)
                  ;
                setProperty('--word-space-size', `${wsPx}px`);
                setProperty('--line-adjust-step-wordspace', `${wordspaceStepSize}`);
                setProperty('--line-adjust-wordspace-min', `${wordspaceMin}`);
                setProperty('--line-adjust-wordspace-default', `${wordspaceDefault}`);
                setProperty('--line-adjust-wordspace-max', `${wordspaceMax}`);
                allNarrowingStops.push(wordspaceNarrowingRange / wordspaceStepSize);
                allWideningStops.push(wordspaceWideningRange / wordspaceStepSize);
                break;
            case 'wdth':
                let [rawWDTHDefault, rawFontFamily] = getComputedPropertyValues(
                        elem,  '--font-width', '--font-family')
                    // This value should be in sync with --font-width in any
                    // case, otherwise the default deviates and that can
                    // confuse the algorithm. This is because a --line-adjust-step
                    // of 0 would not match the default, which is expected.
                  , wdthDefault = parseFloat(rawWDTHDefault)
                  , fontFamily = rawFontFamily.trim()
                  , [wdthMin, wdthMax] = wdthJustificationSpecs[fontFamily]
                  , wdthNarrowingRange = Math.abs(wdthMin - wdthDefault)
                  , wdthWideningRange = Math.abs(wdthMax - wdthDefault)
                    // FIXME: no options.wdth so far, can't turn this on/off
                    // from the UI so far.
                  , wdthStepSize = //options.wdth
                              //?
                               Math.max(
                                      wdthNarrowingRange / narrowingStops,
                                      wdthWideningRange / wideningStops
                                  )
                              //: 0
                  ;
                setProperty('--line-adjust-step-wdth', wdthStepSize);
                setProperty('--line-adjust-wdth-min', wdthMin);
                setProperty('--line-adjust-wdth-default', wdthDefault);
                setProperty('--line-adjust-wdth-max', wdthMax);
                allNarrowingStops.push(wdthNarrowingRange / wdthStepSize);
                allWideningStops.push(wdthWideningRange / wdthStepSize);
                break;
            default:
                console.warn(`Unkown line handling property name "${prop}".`);
        }
    }

    // This prevents that we apply "empty steps", that don't change anything,
    // since we can separately turn off the justification parameters.
    let effectiveNarrowingStops = Math.max(0,
                            ...allNarrowingStops.filter(x=>isFinite(x)))
      , effectiveWideningStops = Math.max(0,
                            ...allWideningStops.filter(x=>isFinite(x)))
      ;

    if(lineHandlingDirection === 'narrowing')
          effectiveWideningStops = 0; // no widening
    if(lineHandlingDirection === 'widening')
        effectiveNarrowingStops = 0; // no narrowing

    // Only for reporting in the inspect widget and as debugging info.
    setProperty('--info-line-adjust-stops', `"-${effectiveWideningStops || 0}, +${effectiveNarrowingStops || 0} line-handling direction ${lineHandlingDirection}"`);

        // bind some args to the inner generator
    let linesGenerator = carryOverElement=>
                            _linesGenerator(carryOverElement,
                                        [effectiveNarrowingStops, effectiveWideningStops],
                                        interLineHarmonizationFactor)
        // bind the inner generator to the outer generator
      , inlinesHandler = notBlockNodes=>
                    _inlinesHandler(linesGenerator, notBlockNodes)
      ;
    return [modeKey, inlinesHandler, properties];
}

// skip === [skipSelector, skipClass]
function* _lineTreatmentGenerator(justificationSpec, elem, skip, options) {
    let [
            modeKey, inlinesHandler, elementProperties
        ] = _getLineTreatmentParameters(justificationSpec, elem, options)
      , fontSpecKey = `"${modeKey}_${_getFontSpecKey(elem)}"`
      , [inheritedFontSpecKey] = getComputedPropertyValues(elem, '--font-spec-key')
      , fontSpecChanged = fontSpecKey !== inheritedFontSpecKey
      ;

    if(fontSpecChanged) {
        // initialize
        elem.classList.add(_JUSTIFICATION_HOST_CLASS);
        // This is only for the check above, it doesn't change the font
        // spec. Also, it makes use of the CSS inhertance of custom
        // properties.
        elem.style.setProperty('--font-spec-key', fontSpecKey);
        for(let [prop, val] of elementProperties)
            elem.style.setProperty(prop, val);
    }

    let t0 = performance.now();
    let total = yield* _blockHandler(justificationSpec, elem, skip, options, inlinesHandler);
    let t1 = performance.now();
    // Makes white-space: no-wrap; must be removed on unjustify.

    console.log(`time in _blockHandler ${(t1-t0) /1000} s`);
    console.log(`time in _inlinesHandler ${total/1000} s`);
    yield ['DONE _blockHandler'];
    return total;
}

export class JustificationController{
    constructor(justificationSpec, elem, skip, options) {
        this._justificationSpec = justificationSpec;
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
                this._gen = _lineTreatmentGenerator(this._justificationSpec, this._elem, this._skip, this._options);
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
          , justificationContextClass = 'justification-context-block'
          ;

        for(let lineElem of this._elem.querySelectorAll(`.${lineClass}`))
            lineElem.replaceWith(...lineElem.childNodes);

        for(let elem of [this._elem, ...this._elem.querySelectorAll(`.${_JUSTIFICATION_HOST_CLASS}`)]) {
            elem.classList.remove(_JUSTIFICATION_HOST_CLASS);
            for(let klass of elem.classList){
                if(klass.startsWith(_LINE_HANDLING_CLASS_PREFIX))
                    elem.classList.remove(klass);
            }
            for(let propertyName of [
                                  '--word-space-size'
                                , '--line-adjust-step-xtra'
                                , '--line-adjust-xtra-min'
                                , '--line-adjust-xtra-default'
                                , '--line-adjust-xtra-max'
                                , '--line-adjust-step-tracking'
                                , '--line-adjust-tracking-min'
                                , '--line-adjust-tracking-default'
                                , '--line-adjust-tracking-max'
                                , '--line-adjust-step-wordspace'
                                , '--line-adjust-wordspace-min'
                                , '--line-adjust-wordspace-default'
                                , '--line-adjust-wordspace-max'
                                , '--font-spec-key'
                                , '--line-adjust-wdth-min'
                                , '--line-adjust-wdth-default'
                                , '--line-adjust-step-wdth'
                                , '--line-adjust-wdth-max'
                                , '--info-line-adjust-stops'
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
