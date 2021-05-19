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
    }
    else if(node) {
        // Only if node is an element, otherwise, assert it's a text
        // node and continue with it and then it's nextSiblinds...
        // this way we can start the generator in the middle of an element.
        if(node.nodeType === Node.ELEMENT_NODE && !continueWithNextSiblings)
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
        while(node !== nodes[nodes.length-1]) {
            nodes.pop();
            if(!nodes.length)
                throw new Error('Node not found in nodes!');
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

function _getContainingRect(lineRangeOrNode,
                                        container=null) {
    let lineParent = getClosestBlockParent(
                // if it has a startContainer it's probably a Range
                // otherwise, assume it is a  Node
                lineRangeOrNode.startContainer || lineRangeOrNode);

    // FIXME: This may make sense in the justifyLine context but can be optional
    // in findLines, I've never seen this trigger, but it is a possibility!
    //if(container && lineParent === container) {
    //    console.log('FIXME: DON\'T KNOW (yet) what to do: lineParent === container', lineParent, container);
    //    return;
    //}
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
        // to 1, and now we get some ovwerflow.
        // If left/right is a fit, we're at least in the correct column,
        // which is the main reason for this.
        // Would be nice to have this very accurate though, so we can
        // rely on it.
        if(     //   lineRect.top >= rect.top
                //   lineRect.bottom <= rect.bottom
                   lineRect.left >= rect.left
                && lineRect.right <= rect.right) {
            return [rect, lineParent];
        }
        // TODO: since this still sometimes goes wring, below
        // is very helpful debugging output, which I would uncomment when
        // needed. Once this heuristic stabilizes we may remove that stuff.
        logs.push(['did not fit', i++, 'lineRect', lineRect ,
            '\nrect', rect, '\n',
            parentRects, '\n', lineParent,
            lineRangeOrNode.getClientRects()
            ]);
        logs.push(['top', lineRect.top, '>=', rect.top, lineRect.top >= rect.top]);
        logs.push(['bot', lineRect.bottom, '<=', rect.bottom, lineRect.bottom <= rect.bottom]);
        logs.push(['lef', lineRect.left, '>=', rect.left, lineRect.left >= rect.left]);
        logs.push(['rig', lineRect.right, '<=', rect.right, lineRect.right <= rect.right]);
    }
    for(let line of logs)
        console.log(...line);
    throw new Error(`_getContainingRect couldn't identify a containing rect`
                  + ` for: ${lineRangeOrNode.textContent || lineRangeOrNode.toString()}`);
}

function _isOutOfFlowContext(elem) {
    return elem.offsetParent === null;
}

/**
 * Find lines that the browser has composed by using Range objects
 * and their getBoundingClientRect.
 *
 * FIXME: needs work for special cases etc.
 * TODO: we could search from back to front as that would make a better
 *       pipeline with the following transformations, if we keep doing
 *       those from back to front.
 */
function* findLines(elem, skip=[null, null]) {
    var textNodesGen
      , container // = elem.nodeType === Node.ELEMENT_NODE ? elem : elem.parentElement
      , skipUntilAfter = null
      , currentLine = null
      , last = null
      ;

    if(Array.isArray(elem)){
        [container, elem, skipUntilAfter] = elem;
    }
    else
        container = elem;

    // console.log('findLines starting _deepTextGen with:', elem, elem.textContent);
    textNodesGen = _deepTextGen(elem, skip);

    // NOTE: i/maxI is for development and debugging only to limit
    // the algorithm.
    let i=0
      , maxI = Infinity;//3000; --> this can be controlled by the caller
    while(true) {
        let rv = textNodesGen.next();
        if(rv.done){
            console.log('textNodesGen is done!', rv);
            break;
        }
        let endNode = rv.value;
        if(skipUntilAfter) {
            //console.log('SKIPPING:', endNode.textContent);
            if(skipUntilAfter === endNode){
                // console.log('That was the last skip');
                // the node after this node wont be skipped anymore
                skipUntilAfter = null;
            }
            // continue anyways

            continue;
        }

        let endNodeIndex = 0;

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

                if (Math.floor(lastRect.bottom - firstRect.bottom) < 1
                        // e.g. our <sup> tags are not touching on bottom
                        || Math.floor(lastRect.top - firstRect.top) < 1) {
                    withinVerticalBounds = true;
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
}


// The check in here finds elements where the inline behavior is like
// a block, e.g. display: inline block would match as well.
function getClosestBlockParent(node) {
  // if node is a block it will be returned
  let elem;
  if(node.type === Node.ELEMENT_NODE)
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

function markupLine(line, index, nextLinePrecedingWhiteSpace, nextLineTextContent) {
    let {range, nodes} = line
      , prepared = []
      , lineElements = []
      ;
    let randBG = `hsl(${Math.round((Math.random() * 70)) + 90}, `  // 90 to 160
                   + `${Math.round((Math.random() * 30)) + 60}%, ` // 55 to 90
                   + `${Math.round((Math.random() * 20)) + 70}%)`; // 70 to 90

    for(let node of nodes) {
        let startIndex = node === range.startContainer
                    ? range.startOffset
                    : 0
          , endIndex = node === range.endContainer
                    ? range.endOffset
                    : node.data.length // -1???
          ;
        prepared.push([node, startIndex, endIndex]);
    }

    // FIXME: add all punctuation and "white-space" etc. that breaks lines.
    // not too sure about ] and ) but I've seen a line-break after a ] in
    // a foot note link (inside a <sup>.
    // All elements on a page that end up with the class `r00-l-hyphen`
    // should be inspected to see what belongs in here, at least for our
    // example, this could be feasible. This heuristic is probably not
    // ideal in the long run, yet simple.
    let lineBreakers = new Set([' ', '-', '–', '—', '.', ',', ']', ')', '\t', '\r', '\n']);
    let addHyphen = false;
    {
        let [node, , endIndex] = prepared[prepared.length-1];
        // FIXME: there are other heuristics/reasons to not add a hyphen!
        //        but the error is not always in here.
        // If the last character is not a line breaking character,
        // e.g. in Firefox after sectioning headlines, I get hyphens.
        if(        !nextLinePrecedingWhiteSpace.length
                && nextLineTextContent.length
                && !lineBreakers.has(nextLineTextContent[0])
                && !lineBreakers.has(node.data[endIndex-1])) {
            addHyphen = true;
        }
    }
    // TODO: Although they seem to cause no trouble (yet), all
    // white space only first line (.r00-l-first nodes) seem
    // unnecessary as well:
    // for(let node of document.querySelectorAll('.r00-l-first')) {
    //       // NOTE: don't use \s
    //       if(/^\s+$/g.test(node.textContent)) console.log(node);
    // }

    // Do it from end to start, so all offsets stay valid.
    let last = prepared.length-1;
    for(let i=last;i>=0;i--) {
        let [node, startIndex, endIndex] = prepared[i];
        // we have at least one char of something
        let span = document.createElement('span');
        lineElements.unshift(span); // backwards iteration so no push...
        span.classList.add('runion-line');
        span.classList.add(`r00-l${index}`);
        if(i === 0)
            span.classList.add('r00-l-first');
        if(i === last) {
            span.classList.add('r00-l-last');
            if(addHyphen)
                span.classList.add('r00-l-hyphen');
        }
        span.style.setProperty('--line-color-code', randBG);

        // try letting range wrap here ...
        // works awesomely great so far.
        let r = new Range();
        r.setStart(node, startIndex);
        r.setEnd(node, endIndex);
        r.surroundContents(span);
    }
    return lineElements;
}


const _LINE_BREAKING_SIBLING_TAGS = new Set(['br']);
function _isLineBreakingSiblingTag(elem){
    return _LINE_BREAKING_SIBLING_TAGS.has(elem.tagName.toLowerCase());
}

const _TYPICAL_INLINE_TAGS = new Set(['a', 'sup', 'sub', 'strong', 'b', 'em', 'i', 'span']);
function _isTypicalInlineElemTag(elem){
    return _TYPICAL_INLINE_TAGS.has(elem.tagName.toLowerCase());
}

const _TYPICAL_BLOCK_TAGS = new Set(['div', 'p', 'ul', 'li' /*stretch*/, 'h1', 'h2', 'h3']);
function _isTypicalBlockElemTag(elem){
    return _TYPICAL_BLOCK_TAGS.has(elem.tagName.toLowerCase());
}

// Find lines that text would indent. Lines after soft breaks/<br /> are
// not included in here.
function _isBlockFirstLine(lineElements) {
    let [elemOne, ] = lineElements
        // getting this lazily
      , blockParent = null// = getClosestBlockParent(elemOne)
      , node = elemOne
      ;
    while(node) {
        // Not looking at non-element nodes (elem.previousSibling) here,
        // because we already filtered them in findLines/markupLine if
        // they are irrelevant and otherwise put them into span line
        // containers.
        let previousElementSibling = node.previousElementSibling;
        if(previousElementSibling) {

            if(previousElementSibling.classList.contains('runion-line')) {
                return false;
            }

            // Handle cases that don't count.
            if(_isOutOfFlowContext(previousElementSibling)) {
                // Is not visible or irrelevant.
                node = previousElementSibling;
                continue;
            }

            // Even if the relevant element before is display: block
            // this is not treated as a first line, it must be the first
            // line of a block. Also, <br /> is not creating a new paragraph
            // line after it.
            return false;
        }

        // it's the first relevant child
        let parentElement = node.parentElement;
        if(!parentElement)
            // This doesn't happen ever, just for completeness.
            return false;


        if(_isTypicalInlineElemTag(parentElement)){
            node = parentElement;
            continue;
        }

        if(_isTypicalBlockElemTag(parentElement))
            return true;

        if(blockParent === null)
            // doing this lazily, we may never need it if the
            // conditions before hit.
            // If this is the big performance hit, we could
            // easily before this  e.g. check for pretty sure element tags
            // of parentElement, like <p> but that can be altered by CSS.
            blockParent = getClosestBlockParent(elemOne);
        // We're out of previous element siblings, if the parent is a
        // block, this is a first line:
        if(blockParent === parentElement)
            return true;
        // Alternatively:
        if(_isBlock(parentElement))
            return true;

        // It's not a block, i.e. inline.
        // Now, we must check if the parent (inline) element is the first
        // relevant element in a block.
        node = parentElement;
    }
    return false;
}

/**
 * Returns True if line is the last line of a block
 * or breaks because it's followed by a block or a soft break,
 * like <br />. These are two rather separate things, but for the
 * moment I only need this to not justify the line.
 */
function _isLastLine(lineElements) {
    let elemN = lineElements[lineElements.length-1]
      , blockParent = null // evaluated lazily
      , node = elemN
      ;
    while(node) {
        let nextElementSibling = node.nextElementSibling;
        if(nextElementSibling) {
            if(_isOutOfFlowContext(nextElementSibling)){
                node = nextElementSibling;
                continue;
            }

            // We add these so the nature is expected to be inline.
            if(nextElementSibling.classList.contains('runion-line')) {
                return false;
            }

            if(_isLineBreakingSiblingTag(nextElementSibling)) {
                return true;
            }

            if(_isBlock(nextElementSibling)) {
                return true;
            }

            if(nextElementSibling.childNodes.length)
                // There are sometimes empty spans at the end of lines
                // in our wikipedia example, e.g. in the "Citations" section.
                return false;
        }
        //it's the last relevant child.
        let parentElement = node.parentElement;
        if(!parentElement)
            // This doesn't happen ever, just for completeness.
            return false;

        if(_isTypicalInlineElemTag(parentElement)) {
            node = parentElement;
            continue;
        }
        if(_isTypicalBlockElemTag(parentElement))
            return true;


        if(blockParent === null)
            // doing this lazily, we may never need it if the
            // conditions before hit.
            // If this is the big performance hit, we could
            // easily before this  e.g. check for pretty sure element tags
            // of parentElement, like <p> but that can be altered by CSS.
            blockParent = getClosestBlockParent(elemN);
        // We're out of previous element siblings, if the parent is a
        // block, this is a first line:
        if(blockParent === parentElement)
            return true;
        // Alternatively:
        if(_isBlock(parentElement))
            return true;

        // it's an inline parent, look at its surroundings.
        node = parentElement;
    }
    return false;
}



function _findLogicalLinePosition(lineElements /*, index*/) {
    let classes = [];

    // seems to slow things down a lot! Maybe because of getClosestBlockParent
    // because everything else is IMHO quick.
    if(_isBlockFirstLine(lineElements)) {
        classes.push('r00-first-line');
        // FIXME/TODO: if(_isInitialLine(lineElements)){
                // TODO: we don't identify outline/sections yet but
                // should add a class to identify initial under what
                // kind of section (h1=toplevel,h2=section,h3=subsection)
                // r00-initial-h1, r00-initial-h2, r00-initial-h3
                // just use the closest heading to determine
        //        elem.classList.add('r00-initial-line');
        // }
    }
    if(_isLastLine(lineElements)) {
        // is the last line of a block
        // or breaks because it's followed by a block or a soft break,
        // like <br />. These are two rather separate things, but for the
        // moment I only need this to not justify the line.
        classes.push('r00-last-line');
    }
    return classes;
}


function _markLogicalLinePositions(elementLines) {
    let toMark = [];
    // Important for performance is here to first collect all classes
    // then apply them in a second pass, because adding the classes
    // had Firefox re-evaluate some of it's caches for each iteration
    // resulting slowing it down a lot.
    for(let [index, lineElements] of elementLines.entries()) {
        let classes = _findLogicalLinePosition(lineElements, index);
        if(classes.length)
            toMark.push([index, classes]);
    }
    // 2. pass apply classes.
    for(let[index, classes] of toMark) {
        let lineElements = elementLines[index];
        for(let klass of classes) {
            for(let elem of lineElements) {
                elem.classList.add(klass);
            }
        }
    }
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
        control = yield value;
        [currentMin, currentMax, value] = _approachZero(currentMin, currentMax, value, control);
    }
}

function* _justifyByGenerator(setVal, readVal, originalMin, originalMax, tries=10) {
    let control = yield true
      , value = readVal() /*initial value*/
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
            // the generator gave up
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

function justifyLine(container, lineElements, fontSizePx, tolerances, options=null) {
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

    let setLetterSpacingEm = (letterSpacingEm)=>{
            // NOTE: it is defined in pt:
            //      letter-spacing: calc(1pt * var(--letter-space));
            let letterSpacingPt = letterSpacingEm * fontSizePx * 0.75;
            setPropertyToLine('--letter-space', letterSpacingPt);
            // this was just for reporting
            // line.setAttribute('data-letterspace', Math.round(fitLS * 1000));
                        //console.log(line.textContent.trim().split(' ')[0], control);
        }
      , lineGlyphsLength = lineText.length
      , lineWordSpaces = lineText.split(' ').length - 1
      , setWordSpacingPx = (wordSpacingPx)=> {
            // NOTE: it is defined in em:
            //      word-spacing: calc(1em * var(--word-space));
            let wordSpacingEm = wordSpacingPx / fontSizePx;
            setPropertyToLine('--word-space', wordSpacingEm);
            // this was just for reporting
            // line.setAttribute('data-wordspace', Math.round(parseFloat(line.style.wordSpacing) * 1000));
        }
      , setXTRA = val=>setPropertyToLine('--font-stretch', val)
      , readXTRA = ()=>parseFloat(getPropertyFromLine('--font-stretch'))
      , [xtraMin, ,xtraMax] = tolerances.XTRA
      , generators = []
      ;
    if(!options || options.XTRA !== false) {
        generators.push(
            _justifyByGenerator(setXTRA, readXTRA, xtraMin,xtraMax));
    }
    if(!options || options.letterSpacing !== false) {
        generators.push(
            _justifyByLetterSpacingGenerator    (setLetterSpacingEm, lineGlyphsLength,
                              fontSizePx, tolerances['letter-spacing']));
    }
    if(!options || options.wordSpacing !== false) {
            // We had some good results with this not used at all,
            // But if it can do some reduced word-spacing, optionally
            // not fully justified, it could still be an option.
        generators.push(
            _fullyJustifyByWordSpacingGenerator(setWordSpacingPx, lineWordSpaces));
    }
        //   // NOTE: these are different to the vabro way, but could be possible!
        //   // letter-space
        // , _justifyByGenerator(setLetterSpacingEm, readLetterSpacingEm, originalMin, originalMax)
        //   // word-space (there's a rule that this must stay smaller than line space I think)
        // , _justifyByGenerator(setWordSpacingPx, readWordSpacingPx, originalMin, originalMax)

    // run the actual justification
    justifyControlLoop(readUnusedWhiteSpace, generators);
}

function* _justifyByLetterSpacingGenerator(setVal, lineGlyphsLength,
                                fontSizePx, [minLS, /*defaultLS*/,maxLS]) {
        // unusedSpace
    let unusedSpace = yield true
        // available pixel per glyph
      , letterSpacingEm = unusedSpace / lineGlyphsLength / fontSizePx
      ;
    // CAUTION: min/max are as it seems in em, as old usage implied.
    letterSpacingEm = Math.max(minLS, Math.min(maxLS, letterSpacingEm));
    // FIXME: whoa, no fancy control system? I think this should
    // maybe test and correct down if needed. But maybe it's just good
    // enough.
    setVal(letterSpacingEm);
}

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

/***
 * vabro.js
 *
 * This started initially as a direct copy of vabro.js
 * https://github.com/TypeNetwork/variable-fonts-info-site/blob/master/js/varbro.js
 * https://variablefonts.typenetwork.com/topics/spacing/justification
 *
 */


const globalAxes = {
  "RobotoDelta-VF":{
    "order":["XTRA","XOPQ","YOPQ","YTLC","YTUC","YTAS","YTDE","YTAD","YTDD","UDLN","wght","wdth","opsz","PWGT","PWDT","POPS","GRAD","YTRA"],"XTRA":{"name":"XTRA","min":210.0,"max":513.0,"default":359.0},
    "XOPQ":{"name":"XOPQ","min":26.0,"max":171.0,"default":94.0},
    "YOPQ":{"name":"YOPQ","min":26.0,"max":132.0,"default":77.0},
    "YTLC":{"name":"YTLC","min":416.0,"max":570.0,"default":514.0},
    "YTUC":{"name":"YTUC","min":528.0,"max":760.0,"default":712.0},
    "YTAS":{"name":"YTAS","min":649.0,"max":854.0,"default":750.0},
    "YTDE":{"name":"YTDE","min":-305.0,"max":-98.0,"default":-203.0},
    "YTAD":{"name":"YTAD","min":460.0,"max":600.0,"default":563.0},
    "YTDD":{"name":"YTDD","min":-1.0,"max":1.0,"default":0.0},
    "UDLN":{"name":"UDLN","min":-195.0,"max":0.0,"default":-49.0},
    "wght":{"name":"wght","min":100.0,"max":900.0,"default":400.0},
    "wdth":{"name":"wdth","min":75.0,"max":125.0,"default":100.0},
    "opsz":{"name":"opsz","min":8.0,"max":144.0,"default":12.0},
    "PWGT":{"name":"PWGT","min":44.0,"max":150.0,"default":94.0},
    "PWDT":{"name":"PWDT","min":560.0,"max":867.0,"default":712.0},
    "POPS":{"name":"POPS","min":-1.0,"max":1.0,"default":0.0},
    "GRAD":{"name":"GRAD","min":-1.0,"max":1.0,"default":0.0},
    "YTRA":{"name":"YTRA","min":-1.0,"max":1.0,"default":0.0},
    "instances":[]
  },
  "Amstelvar-VF":{
    "order":["opsz"],"opsz":{"name":"Optical Size","min":0.0,"max":1.0,"default":0.0},
    "instances":[]
  },
  "Roboto-VF":{
    "order":["wght","wdth","slnt"],"wght":{"name":"Weight","min":100.0,"max":900.0,"default":400.0},
    "wdth":{"name":"Width","min":75.0,"max":100.0,"default":100.0},
    "slnt":{"name":"Slant","min":0.0,"max":12.0,"default":0.0},
    "instances":[]
  },
  "Roboto-min-VF":{
    "wght":{"name":"Weight","min":100.0,"max":900.0,"default":400.0},
    "wdth":{"name":"Width","min":75.0,"max":100.0,"default":100.0},
    "slnt":{"name":"Slant","min":-12.0,"max":0.0,"default":0.0},
    "instances":[{"axes":{"wght":100.0,"wdth":100.0,"slnt":0.0},
    "name":"Thin"},
    {"axes":{"wght":300.0,"wdth":100.0,"slnt":0.0},
    "name":"Light"},
    {"axes":{"wght":400.0,"wdth":100.0,"slnt":0.0},
    "name":"Regular"},
    {"axes":{"wght":500.0,"wdth":100.0,"slnt":0.0},
    "name":"Medium"},
    {"axes":{"wght":700.0,"wdth":100.0,"slnt":0.0},
    "name":"Bold"},
    {"axes":{"wght":900.0,"wdth":100.0,"slnt":0.0},
    "name":"Black"},
    {"axes":{"wght":100.0,"wdth":100.0,"slnt":-12.0},
    "name":"Thin Italic"},
    {"axes":{"wght":300.0,"wdth":100.0,"slnt":-12.0},
    "name":"Light Italic"},
    {"axes":{"wght":400.0,"wdth":100.0,"slnt":-12.0},
    "name":"Italic"},
    {"axes":{"wght":500.0,"wdth":100.0,"slnt":-12.0},
    "name":"Medium Italic"},
    {"axes":{"wght":700.0,"wdth":100.0,"slnt":-12.0},
    "name":"Bold Italic"},
    {"axes":{"wght":900.0,"wdth":100.0,"slnt":-12.0},
    "name":"Black Italic"},
    {"axes":{"wght":300.0,"wdth":75.0,"slnt":0.0},
    "name":"Condensed Light"},
    {"axes":{"wght":400.0,"wdth":75.0,"slnt":0.0},
    "name":"Condensed Regular"},
    {"axes":{"wght":526.3158,"wdth":75.0,"slnt":0.0},
    "name":"Condensed Medium"},
    {"axes":{"wght":710.12659,"wdth":75.0,"slnt":0.0},
    "name":"Condensed Bold"},
    {"axes":{"wght":300.0,"wdth":75.0,"slnt":-12.0},
    "name":"Condensed Light Italic"},
    {"axes":{"wght":400.0,"wdth":75.0,"slnt":-12.0},
    "name":"Condensed Italic"},
    {"axes":{"wght":526.3158,"wdth":75.0,"slnt":-12.0},
    "name":"Condensed Medium Italic"},
    {"axes":{"wght":710.12659,"wdth":75.0,"slnt":-12.0},
    "name":"Condensed Bold Italic"}]
  },
  "AmstelvarAlpha-VF":{
    "order":["wght","wdth","opsz","XOPQ","XTRA","YOPQ","YTLC","YTSE","GRAD","XTCH","YTCH","YTAS","YTDE","YTUC","YTRA","PWGT","PWDT"],"wght":{"name":"Weight","min":100.0,"max":900.0,"default":400.0},
    "wdth":{"name":"Width","min":35.0,"max":100.0,"default":100.0},
    "opsz":{"name":"Optical Size","min":10.0,"max":72.0,"default":14.0},
    "XOPQ":{"name":"x opaque","min":5.0,"max":500.0,"default":88.0},
    "XTRA":{"name":"x transparent","min":42.0,"max":402.0,"default":402.0},
    "YOPQ":{"name":"y opaque","min":4.0,"max":85.0,"default":50.0},
    "YTLC":{"name":"lc y transparent","min":445.0,"max":600.0,"default":500.0},
    "YTSE":{"name":"Serif height","min":0.0,"max":48.0,"default":18.0},
    "GRAD":{"name":"Grade","min":88.0,"max":150.0,"default":88.0},
    "XTCH":{"name":"x transparent Chinese","min":736.0,"max":1082.0,"default":911.0},
    "YTCH":{"name":"y transparent Chinese","min":736.0,"max":1082.0,"default":907.0},
    "YTAS":{"name":"y transparent ascender","min":650.0,"max":850.0,"default":750.0},
    "YTDE":{"name":"y transparent descender","min":150.0,"max":350.0,"default":250.0},
    "YTUC":{"name":"y transparent uppercase","min":650.0,"max":950.0,"default":750.0},
    "YTRA":{"name":"y transparent","min":800.0,"max":1200.0,"default":1000.0},
    "PWGT":{"name":"Para Weight","min":38.0,"max":250.0,"default":88.0},
    "PWDT":{"name":"Para Width","min":60.0,"max":402.0,"default":402.0},
    "instances":[]
  }
};

// CALCULATION STUFF
const calculations = {
    "notes":"This file contains parameters for adjusting horizontal and vertical spacing based on various typographic criteria.",
    "line-height":{
        "notes":"these are font: charsPerLine: fontSize: YOPQ Multiplier",
        "YOPQdefault":50,
        "default":{
            "45":{
                "12":4,
                "72":0
            }
        },
        "AmstelvarAlpha-VF":{
            "20":{
                "8":1.5,
                "12":1.2,
                "144":0
            },
            "60":{
                "8":2,
                "12":1.8,
                "144":1
            }
        }
    },
    "justification": {
        "notes":"font: size in points: weight as percentage of normal: parameter: min/default/max",
        // font:{
        //      size in points: {
        //          weight as percentage of normal:
        //                  # XTRA, letter-spacing, word-spacing
        //                  parameter: [min/default/max]
        //      }
        // }
        //

        "defaultWordSpace":0.3195,
        "maxLetterSpace":1,
        "default":{
            "10":{
                "100":{
                    "letter-spacing":[0,0,0],
                    "word-spacing":[-0.2,0,0.2]
                },
                "210":{
                    "letter-spacing":[0,0,0],
                    "word-spacing":[-0.2,0,0.2]
                }
            },
            "14":{
                "100":{
                    "letter-spacing":[-0.05,0,0.05],
                    "word-spacing":[-0.21,0,0.21]
                },
                "210":{
                    "letter-spacing":[-0.05,0,0.05],
                    "word-spacing":[-0.21,0,0.21]
                }
            },
            "48":{
                "100":{
                    "letter-spacing":[-0.1,0,0.1],
                    "word-spacing":[-0.25,0,0.25]
                    },
                "210":{
                    "letter-spacing":[-0.1,0,0.1],
                    "word-spacing":[-0.25,0,0.25]
                }
            }
        },
        "AmstelvarAlpha-VF":{
            "10":{
                "100":{
                    "XTRA":[370,402,402],
                    "letter-spacing":[0,0,0],
                    "word-spacing":[-0.2,0,0.2]
                },
                "210":{
                    "XTRA":[370,402,402],
                    "letter-spacing":[0,0,0],
                    "word-spacing":[-0.2,0,0.2]
                }
            },
            "14":{
                "100":{
                    "XTRA":[380,402,402],
                    "letter-spacing":[-0.05,0,0.05],
                    "word-spacing":[-0.21,0,0.21]
                },
                "210":{
                    "XTRA":[302,326,342],
                    "letter-spacing":[-0.05,0,0.05],
                    "word-spacing":[-0.21,0,0.21]
                }
            },
            "48":{
                "100":{
                    "XTRA":[325,342,359],
                    "letter-spacing":[-0.1,0,0.1],
                    "word-spacing":[-0.25,0,0.25]},
                "210":{
                    "XTRA":[325,342,359],
                    "letter-spacing":[-0.1,0,0.1],
                    "word-spacing":[-0.25,0,0.25]
                }
            }
        },
        "RobotoDelta-VF":{
            "10": {
                "100": {
                    "XTRA":[340,359,385],
                    "letter-spacing":[0,0,0],
                    "word-spacing":[-0.2,0,0.2]
                },
                "210": {
                    "XTRA":[340,359,385],
                    "letter-spacing":[0,0,0],
                    "word-spacing":[-0.2,0,0.2]
                }
            },
            "14": {
                "100": {
                    "XTRA":[340,359,385],
                    "letter-spacing":[-0.05,0,0.05],
                    "word-spacing":[-0.21,0,0.21]
                },
                "210":{
                    "XTRA":[340,359,385],
                    "letter-spacing":[-0.05,0,0.05],
                    "word-spacing":[-0.21,0,0.21]
                }
            },
            "48":{
                "100":{
                    "XTRA":[290,359,420],
                    "letter-spacing":[-0.1,0,0.1],
                    "word-spacing":[-0.25,0,0.25]
                },
                "210":{
                    "XTRA":[290,359,420],
                    "letter-spacing":[-0.1,0,0.1],
                    "word-spacing":[-0.25,0,0.25]
                }
            }
        }
    }
};

/**
 * targetX = fontSize OR charsPerLine
 * targetY = fontWeight OR fontSize
 * theGrid = calculations.justification[fontFamily|default] OR calculations['line-height'][fontFamily|default]
 */
function interInterpolate(targetX, targetY, theGrid) {

    var numsort = function(a,b) { return a - b; };

    //now we need to find the "anchor" Xs and Ys on either side of the actual X and Y
    // so if our X/Y is 36/600, the anchors might be 14/400 and 72/700
    var Xs = Object.keys(theGrid);
    Xs.sort(numsort);
    Xs.forEach(function(v,i) { Xs[i] = parseInt(v); });

    var lower = [Xs[0], 0], upper = [Xs[Xs.length-1], Infinity];
    var done = false;
    Xs.forEach(function(anchorX) {
        if (done) {
            return;
        }

        var Ys, Ydone;

        if (anchorX <= targetX) {
            //set lower and keep looking
            lower[0] = anchorX;
        }

        if (anchorX >= targetX || anchorX === upper[0]) {
            //found our upper X! Now search Ys
            upper[0] = anchorX;

            //find lower Y
            Ys = Object.keys(theGrid[lower[0]]);
            Ys.sort(numsort);
            Ys.forEach(function(v,i) { Ys[i] = parseInt(v); });
            Ydone = false;
            lower[1] = Ys[0];
            Ys.forEach(function(anchorY) {
                if (Ydone) {
                    return;
                }
                if (anchorY <= targetY) {
                    lower[1] = anchorY;
                }
                if (anchorY >= targetY) {
                    Ydone = true;
                }
            });

            //find upper Y
            Ys = Object.keys(theGrid[upper[0]]);
            Ys.sort(numsort);
            Ys.forEach(function(v,i) { Ys[i] = parseInt(v); });
            Ydone = false;
            upper[1] = Ys[Ys.length-1];
            Ys.forEach(function(anchorY) {
                if (Ydone) {
                    return;
                }
                if (anchorY >= targetY) {
                    upper[1] = anchorY;
                    Ydone = true;
                }
            });

            done = true;
        }
    });

    //okay, now we have our lower and upper anchors!

    //how far bewteen lower and upper are we
    var Xratio = upper[0] === lower[0] ? 0 : Math.max(0, Math.min(1, (targetX - lower[0]) / (upper[0] - lower[0])));
    var Yratio = upper[1] === lower[1] ? 0 : Math.max(0, Math.min(1, (targetY - lower[1]) / (upper[1] - lower[1])));

    //get axis values for the four corners
    var corners = {
        șẉ: theGrid[lower[0]][lower[1]],
        ŝẉ: theGrid[upper[0]][lower[1]],
        șẇ: theGrid[lower[0]][upper[1]],
        ŝẇ: theGrid[upper[0]][upper[1]]
    };

    //now we need to interpolate along the four edges
    var edges = {
        ș: [corners.șẇ, corners.șẉ, Yratio],
        ŝ: [corners.ŝẇ, corners.ŝẉ, Yratio],
        ẉ: [corners.ŝẉ, corners.șẉ, Xratio],
        ẇ: [corners.ŝẇ, corners.șẇ, Xratio]
    };

    for(let [edge, hlr] of Object.entries(edges)){
        var high = hlr[0];
        var low = hlr[1];
        var ratio = hlr[2];
        var middle = {};
        if (typeof high === 'number' && typeof low === 'number') {
            edges[edge] = low + (high - low) * ratio;
        } else {
            for(let [axis, /* sml */] of Object.entries(high)){
                middle[axis] = [];
                for (var i=0; i<3; i++) {
                    middle[axis].push(low[axis][i] + (high[axis][i] - low[axis][i]) * ratio);
                }
            }
            edges[edge] = middle;
        }
    }

    //now we can inter-interpolate between the interpolated edge values
    if (typeof edges.ẉ === 'number') {
        return edges.ẉ + (edges.ẇ - edges.ẉ) * Yratio;
    } else {
        var axes = Object.keys(corners.șẉ);
        var result = {};
        axes.forEach(function(axis) {
            result[axis] = [];
            for (var i=0; i<3; i++) {
                result[axis].push(edges.ẉ[axis][i] + (edges.ẇ[axis][i] - edges.ẉ[axis][i]) * Yratio);
            }
        });

        return result;
    }
}

function getJustificationTolerances(font, targetsize, targetweight) {
    let settings
      , lastName = font
        // temporary, to not confuse old settings data with new settings data
      , aliases = {
            'AmstelVar': 'AmstelvarAlpha-VF'
        }
      ;

    while(lastName) {
        settings = calculations.justification[lastName];
        if(settings)
            break;
        lastName = aliases[lastName];
    }
    if(lastName !== font)
        console.log(`Using an alias for font "${font}": ${lastName}`);

    if(!settings){
        console.log(`font "${font}" not found in ${[...Object.keys(calculations.justification)].join(', ')}. `
            + 'Using default.');
        settings = calculations.justification['default'];
    }

    return interInterpolate(targetsize, targetweight, settings);
}

/****
 * END OF vabro.js copy.
 ****/

function* _justifyLineGenerator(elem, elementLines, fontSizePx, tolerances, options) {
    // FIXME: for Firefox and Chrome in the Section "Citations" I get an
    //              Error: _getContainingRect couldn't identify a
    //              containing rect for:
    //              enze Morali, Rom 1881], "Topografia di
    //  But, there are more similar to the above, seems like some
    //  lines  are wider in this context than we would expect in
    //  _getContainingRect.
    //      Chrome: rig 533.890625 <= 530.546875 false
    //      Firefox: rig 546.7333374023438 <= 542.3999938964844 false
    //  and for Firefox a really much too wide justified:
    //              "Sons. pp. 4, 123."
    //
    // In the following line range
    //      let devStart = 830
    //        , devCount = 60
    //        ;
    let devStart = 0
    , devCount = Infinity
    ;
    let jtAllTime = 0, justifiedCount = 0
    , total = elementLines.length
    ;
    for(let [i, lineElements] of elementLines.entries()) {
        if(i < devStart)
            continue;
        if(lineElements[0].classList.contains('r00-last-line'))
            continue;
        let j0 = performance.now();
        try {
            justifyLine(elem, lineElements, fontSizePx, tolerances, options);
        }
        catch(e){
            console.error(e);
            total -= 1;
            continue;
        }
        let j1 = performance.now();
        justifiedCount += 1;
        jtAllTime += j1 - j0;

        yield [justifiedCount , total, i];

        if(justifiedCount >= devCount) {
            console.log('STOPPING justifyLine due to dev iterations limit', devCount);
            break;
        }
    }
    console.log(`justifyLine(s) took ${jtAllTime / 1000} seconds for ${justifiedCount} lines.`);
}

// for development:
function* _justifyGenerator(elem, skip, options) {
    var t0, t1;
    t0 = performance.now();
    let lines = Array.from(findLines(elem, skip));
    t1 = performance.now();
    console.log(`findLines took ${(t1 - t0) / 1000} seconds. Found ${lines.length} lines.`);

    let relweight
        // FIXME: there are e.g. <strong> elements!
      , elemStyle = elem.ownerDocument.defaultView.getComputedStyle(elem)
      , fontWeight = parseFloat(elemStyle.getPropertyValue('--font-weight'))
        // in pt; using --x-font-size I get the CSS-`calc` formular not the actual value.
      , fontSizePx = parseFloat(elemStyle.getPropertyValue('font-size'))
      , fontSize = fontSizePx * 3/4
        // expecting a clean, no font-stack fallbacks, single family name from --font-family
      , fontfamily = elemStyle.getPropertyValue('--font-family').trim()
      ;

    let fvs = {XOPQ: false}; // FIXME: don't do this now, as we don't have an
                  // XOPQ value in font variations settings anyways.
     if (fvs.XOPQ && globalAxes[fontfamily] && globalAxes[fontfamily].XOPQ) {
         relweight = 100 * fvs.XOPQ / globalAxes[fontfamily].XOPQ.default;
     } else if (fontWeight) {
         // we want to land here for now
         relweight = 100 * fontWeight / 400;
     } else {
         relweight = 100;
     }


    let tolerances = getJustificationTolerances(fontfamily, fontSize, relweight);
    console.log('justification tolerances:', 'fontSize', fontSize, 'relweight', relweight, 'tolerances:', tolerances);
    // > fontSize 12 relweight 100 tolerances: {
    //                // All these appear a bit low/narrow for the current AmstelVar
    //                // all values: [min, default, max]
    // >        XTRA: [375, 402, 402],
    // >        'letter-spacing': [-0.025, 0, 0.025],
    // >        'word-spacing': [-0.20500000000000002, 0, 0.20500000000000002]
    // > }

    t0 = performance.now();
    // Do it from end to start, so all offsets stay valid.
    // FIXME: this nextLineTextContent is not exactly beautiful, can I do better?
    // It's rather robust though, look at the next line as well to determine
    // if a hyphen is needed. Maybe, I should collect inter-line white space.
    let nextLineTextContent = ''
      , nextLinePrecedingWhiteSpace = ''
      , elementLines = []
      ;
    for(let line_index of reverseArrayIterator(lines)) {
        let [line, ] = line_index
          , precedingWhiteSpace = line.wsTextContent
          , textContent = line.range.toString()
          , lineElements = markupLine(...line_index, nextLinePrecedingWhiteSpace, nextLineTextContent)
          ;

        if(lineElements)
            elementLines.unshift(lineElements);
        nextLinePrecedingWhiteSpace = precedingWhiteSpace;
        nextLineTextContent = textContent;
    }
    t1 = performance.now();
    console.log(`markupLine(s) took ${(t1 - t0) / 1000} seconds.`);

    // This is required to make text-indents on first lines work

    t0 = performance.now();
    _markLogicalLinePositions(elementLines);
    t1 = performance.now();
    console.log(`_markLogicalLinePositions took ${(t1 - t0) / 1000} seconds.`);

    yield ['elementLines', elementLines];

    let gen = _justifyLineGenerator(elem, elementLines, fontSizePx, tolerances, options);
    for(let data of gen)
        yield ['justifyLine', data];
}


/**
 * The concept here is, that a column layout with growing number of columns
 * has big performance problems when justifying. With one column it's
 * much fast (but not fast) than with four columns. This element is
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
      ;


    // FIXME: the width/padding is not correct for all cases,
    // rather use actual clientRects width minus padding to determine
    // the available space for the line in the block.
    // .justification-context-block {
    //     position: absolute;
    //     visibility: hidden;
    //     column-span: all /* Take out of column layout. */
    //     padding: 0; width: calc(0.5em * '--column-width');
    // }
    cloned.classList.add('justification-context-block');

    /**
     * MAYBE: Add some element.style to ensure we  have the same line
     * length and not a multi column layout!
     */

    for(let node of notBlockNodes){
        cloned.appendChild(node.cloneNode(true));
    }

    // insert at the same position, so we get the same CSS-rules to apply
    // to the container. CAUTION: this can become problematic where we have
    // e.g. position related CSS selectors (first-child, ~ etc.)
    block.parentNode.insertBefore(cloned, block);
    return cloned;
}

/*
 * Here we have a couple of unknowns:
 * What is the nature of lastLine ?
 *     I would expect it to be in the type of lineElements, i.e.
 *     lowest level spans that wrap the textNodes of the line.
 * This means however, we cannot do lastLine[lastElementIndex].nextSibling,
 * instead, we must dig up the lastLine[lastElementIndex].parentElements
 * until we find a node of which the parentElement === carryOverElement
 * and of *that* use use its .nextSibling
 *
 * If lastLine is null this is the first line. We must use carryOverElement.
 */

function _getDirectChild(carryOverElement, node) {
    while(node.parentElement !== carryOverElement){
        node = node.parentElement;
        if(!node)
            throw new Error(`Node ${node} appears not to be a `
                            + `descendant of ${carryOverElement}`);
    }
    return node;
}


function _getNext(carryOverElement, node) {
    if(node.nextSibling)
        return node.nextSibling;
    while(node.parentElement !== carryOverElement) {
        node = node.parentElement;
        if(!node)
            throw new Error(`Node ${node} appears not to be a `
                            + `descendant of ${carryOverElement}`);
        if(node.nextSibling)
            break;
    }
    return node.nextSibling;
}

function _getStartNode(carryOverElement, lastLine) {
    if(lastLine === null)
        return carryOverElement;

    return _getNext(carryOverElement, lastLine[lastLine.length-1]);
}

// _function markupLine(line, index, nextLinePrecedingWhiteSpace, nextLineTextContent) {
//     let {range, nodes} = line
//       , prepared = []
//       , lineElements = []
//       ;
//     let randBG = `hsl(${Math.round((Math.random() * 70)) + 90}, `  // 90 to 160
//                    + `${Math.round((Math.random() * 30)) + 60}%, ` // 55 to 90
//                    + `${Math.round((Math.random() * 20)) + 70}%)`; // 70 to 90
//
//     for(let node of nodes) {
//         let startIndex = node === range.startContainer
//                     ? range.startOffset
//                     : 0
//           , endIndex = node === range.endContainer
//                     ? range.endOffset
//                     : node.data.length // -1???
//           ;
//         prepared.push([node, startIndex, endIndex]);
//     }
//
//     // FIXME: add all punctuation and "white-space" etc. that breaks lines.
//     // not too sure about ] and ) but I've seen a line-break after a ] in
//     // a foot note link (inside a <sup>.
//     // All elements on a page that end up with the class `r00-l-hyphen`
//     // should be inspected to see what belongs in here, at least for our
//     // example, this could be feasible. This heuristic is probably not
//     // ideal in the long run, yet simple.
//     let lineBreakers = new Set([' ', '-', '–', '—', '.', ',', ']', ')', '\t', '\r', '\n']);
//     let addHyphen = false;
//     {
//         let [node, , endIndex] = prepared[prepared.length-1];
//         // FIXME: there are other heuristics/reasons to not add a hyphen!
//         //        but the error is not always in here.
//         // If the last character is not a line breaking character,
//         // e.g. in Firefox after sectioning headlines, I get hyphens.
//         if(        !nextLinePrecedingWhiteSpace.length
//                 && nextLineTextContent.length
//                 && !lineBreakers.has(nextLineTextContent[0])
//                 && !lineBreakers.has(node.data[endIndex-1])) {
//             addHyphen = true;
//         }
//     }
//     // TODO: Although they seem to cause no trouble (yet), all
//     // white space only first line (.r00-l-first nodes) seem
//     // unnecessary as well:
//     // for(let node of document.querySelectorAll('.r00-l-first')) {
//     //       // NOTE: don't use \s
//     //       if(/^\s+$/g.test(node.textContent)) console.log(node);
//     // }
//
//     // Do it from end to start, so all offsets stay valid.
//     let last = prepared.length-1;
//     for(let i=last;i>=0;i--) {
//         let [node, startIndex, endIndex] = prepared[i];
//         // we have at least one char of something
//         let span = node.ownerDocument.createElement('span');
//         lineElements.unshift(span); // backwards iteration so no push...
//         span.classList.add('runion-line');
//         span.classList.add(`r00-l${index}`);
//         if(i === 0)
//             span.classList.add('r00-l-first');
//         if(i === last) {
//             span.classList.add('r00-l-last');
//             if(addHyphen)
//                 span.classList.add('r00-l-hyphen');
//         }
//         span.style.setProperty('--line-color-code', randBG);
//
//         // try letting range wrap here ...
//         // works awesomely great so far.
//         let r = new Range();
//         r.setStart(node, startIndex);
//         r.setEnd(node, endIndex);
//         r.surroundContents(span);
//     }
//     return lineElements;
// }

function _packLine(addClasses, tagName, nodes, startRange, endRange) {
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
    if(addClasses) {
        elements[0].classList.add('new-style-line-first-elem');
        elements[elements.length-1].classList.add('new-style-line-last-elem');
    }
    return elements;
}

function _justifyLine(findLinesArguments, carryOverElement, firstLine, secondLine) {
    let spans = [], nodes
      , firstLineTextContent = firstLine.range.toString()
      ;

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

    spans = _packLine(false, 'span', nodes, firstLine.range, secondLine.range);

    // Now reduce [--font-stretch, ...] until the line breaks later, i.e.
    // until something from the second line jumps onto the first line, OR,
    // until we run of negative [--font-stretch, ...] adjustment potential.
    let adjust = (nodes, val)=> {
        for(let node of nodes) {
            if(val)
                node.style.setProperty('--font-stretch', val);
            else
                node.style.removeProperty('--font-stretch');
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

    // console.log('spans[0]', spans[0].textContent, spans);

    // find the current first line:
    // assert it has the same content as the initial firstLine
    let startNodeElement = _getDirectChild(carryOverElement, spans[0])
      // , startNode = [startNodeElement, true] // special instructions for deepTextNodes
      , getStartLineContent=()=> {

            let startLineResult = findLines(...findLinesArguments).next();
            if(startLineResult.done)
                // We just put that line there, it must be there!
                throw new Error('Assertion failed, finding a line is mandatory.');
            return [startLineResult.value.range.toString(), startLineResult.value];
        }
      , [startLineContent, ] = getStartLineContent()
      ;
    // console.log('startNodeElement', startNodeElement);
    if(firstLineTextContent !== startLineContent)
        throw new Error(`Assertion failed, firstLineTextContent must equal `
            + `startLineContent but it does not:\n"${firstLineTextContent}"\n`
            + `vesus "${startLineContent}".\nstartNodeElement was ${startNodeElement.tagName} ${startNodeElement.textContent}`);

    let adjustmentPotential = -200
      , adjustment = 0
      , adjustmentStepSize = -1
      , rawValue = 440
      , resultLine = null
      , currentLine = null
      ;
    while(true) {
        adjustment += adjustmentStepSize;
        // if there's potential for adjustment
        if(Math.abs(adjustmentPotential) < Math.abs(adjustment)) {
            //console.log(`${adjustment} no more potential (${adjustmentPotential}):\n  `,
            //    startLineContent
            //);
            // don't adjust this with negative width ->
            //          undo all adjustments and go to positive width
            adjust(spans, null);
            resultLine = currentLine;
            adjustment = null;
            break;
        }
        adjust(spans, rawValue + adjustment);
        let currentLineContent;
        [currentLineContent, currentLine] = getStartLineContent();
        if(startLineContent !== currentLineContent) {
            if(startLineContent.length >= currentLineContent.length) {
                // Turns out that this happens sometimes depending on how
                // the browser decides to break the line, in this case, now
                // try to return as if the adjustmentPotential is depleted.
                adjust(spans, null);
                resultLine = currentLine;
                adjustment = null;
                break;
                // throw new Error('Assertion failed, line changed but got shorter! '
                //                 + 'Something is fatally wrong.\n'
                //                 + `initial line: ${startLineContent}`
                //                 + `current line: ${currentLineContent}`);
            }
            //console.log(`>>>>line changed ${adjustment} from:\n  `, startLineContent
            //          , 'to:\n  ', currentLineContent, currentLine);
            resultLine = currentLine;
            break; // could be tried to fine-tune with positive width again
        }
    }
    // now repack the first line and undo the rest of the second line ...
    let newSpans = _packLine(true, 'span', resultLine.nodes, resultLine.range, resultLine.range);
    adjust(newSpans, adjustment === null ? null : rawValue + adjustment);
    // remove adjustment spans
    for(let elem of spans) {
        elem.replaceWith(...elem.childNodes);
    }
    // TODO: would be interesting to plot how often each value appears
    // maybe, in the sweetspot range, if there is any, small changed could
    // have big effects. But it would differ between line length and
    // font-size/font-spec, so one value wouldn't do.
    // console.log(`narrowing ${adjustment}`);

    return newSpans;
}

/*
 * Return a new line or null if there's no further line left.
 * lastLine is the last returned line, after it, the search for the
 * next line must begin.
 */
function _justifyNextLine(carryOverElement, lastLine=null) {
    let lines = []
      , firstLine = null
      , secondLine = null
      ;

    // console.log('_justifyNextLine', carryOverElement, carryOverElement.textContent);
    // console.log('lastLine', lastLine);

    // This node, we want to be the first node to be *considered*
    // in the next line, the generator starts however in a parent element
    //
    let startNode = null
      , skipUntilAfter = null
      ;
    if(lastLine === null)
        startNode = carryOverElement;
    else {
        skipUntilAfter = lastLine[lastLine.length-1].firstChild;
        startNode = _getDirectChild(carryOverElement, skipUntilAfter);
    }
    if(!startNode)
        return null;

    //console.log('startNode:', startNode, startNode && startNode.textContent,
    //            '\nskipUntilAfter:', skipUntilAfter && skipUntilAfter.textContent);

    let continueWithNextSiblings = startNode !== carryOverElement
      , findLinesArguments = [[carryOverElement, [startNode, continueWithNextSiblings], skipUntilAfter]]
      ;
    for(let line of findLines(...findLinesArguments)) {
        lines.push(line);
        if(lines.length === 2)
            break;
    }
    if(!lines.length)
        return null;
    else if(lines.length === 1) {
        // FIXME: a last line can also be just before a <br /> but
        // this we don't detect here.
        console.log('found a terminal last line');
        // do something with firstLine
        firstLine = lines[0];
        return _packLine(true, 'span', firstLine.nodes, firstLine.range, firstLine.range);
    }

    [firstLine, secondLine] = lines;
    // console.log('_justifyLine(firstLine, secondLine):', firstLine, secondLine);
    let line = _justifyLine(findLinesArguments, carryOverElement, firstLine, secondLine);
    // throw new Error('killed here to analyze');

    // Required to help chrome to do hyphenation! Chrome doesn't hyphenate
    // on node boundaries.
    // FIXME: with secondLine we tend to split nodes that span over to
    // the next line, and that breaks the hyphenation for those lines
    // we could just include the complete node of the second line, should
    // not hurt.
    carryOverElement.normalize();
    return line;
}

function _justifyInlines(notBlockNodes) {
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

    let lastLine = null;
    let i = 0;
    do {
        lastLine = _justifyNextLine(carryOverElement, lastLine);
        i++;
        if(i > Infinity)
            throw new Error('HALT FOR DEV!!! ' + i + ' (_justifyInlines)');
    } while(lastLine);


    let newFragment = firstNotBlock.ownerDocument.createDocumentFragment();
    carryOverElement.remove();
    newFragment.append(...carryOverElement.childNodes);
    parent.insertBefore(newFragment, lastNotBlock.nextSibling);
    range.deleteContents();
}

function* _justifyBlockElement(elem, [skipSelector, skipClass], options) {
    // console.log('_justifyBlockElement', elem);
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
                    _justifyInlines(notBlocks);
                    total += (performance.now() - t0);
                    notBlocks = [];
                    yield ['DONE _justifyInlines'];
                }
                if(!skip){
                    // changes the node in place
                    total += yield* _justifyBlockElement(node, [skipSelector, skipClass], options);

                }
                else if(skipClass)
                    node.classList.add(skipClass);

                continue;
            }
        }
        // all the others
        notBlocks.push(node);
    }
    if(notBlocks.length){
        let t0 = performance.now();
        _justifyInlines(notBlocks);
        total += (performance.now() - t0);
    }
    yield ['DONE _justifyBlockElement'];
    return total;
}


function* _neoJustifyLineGenerator(elem, skip, options) {
    let t0 = performance.now();
    let total = yield* _justifyBlockElement(elem, skip, options);
    let t1 = performance.now();
    console.log(`time in _justifyBlockElement ${(t1-t0) /1000} s`);
    console.log(`time in _justifyInlines ${total/1000} s`);
    yield ['did _justifyBlockElement'];
}

export class JustificationController{
    constructor(elem, skip, options) {
        this._runionActivatedClass = 'runion-activated';
        this._elem = elem;
        this._skip = skip;
        this._options = options || {};
        this._gen = null;
        this._elementLines = null;
        this._timeout = null;
        this._running = false;
        this._statusReporters = new Set();
        this._lastReportedStatus = null;
    }
    get running() {
        return this._running;
    }
    setOption(name, value) {
        // Has no restart usesetOptions instead.
        this._options[name] = value;
    }
    /* usage: ctrl.setOption(false, ['XTRA', false]);
     *
     *    'XTRA', bool default: true
     *    'letterSpacing', bool default: true
     *    'wordSpacing', bool default: true
     */

    setOptions(restart, ...name_value) {
        for(let [name, value] of name_value)
            this.setOption(name, value);
        if(restart)
            this.restart();
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
                // _neoJustifyLineGenerator/_justifyGenerator
                this._gen = _justifyGenerator(this._elem, this._skip, this._options);
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
    _unjustify() {
        let [, skipClass] = this._skip;
        if(this._elementLines) {
            for(let line of this._elementLines) {
                for(let elem of line) {
                    elem.replaceWith(...elem.childNodes);
                }
            }
            this._elementLines = null;
        }
        this._elem.classList.remove(this._runionActivatedClass);

        for(let elem of this._elem.querySelectorAll(skipClass)) {
            elem.classList.remove(skipClass);
        }
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
                this._elementLines = data;
                this._elem.classList.add(this._runionActivatedClass);
                break;
            case 'justifyLine':
                let [justifiedCount , total, ] = data;
                this._reportStatus(`${((justifiedCount/total) * 100).toFixed(1)}%`);
        }
        // schedule next round
        this._scheduleIterate();
    }
}
