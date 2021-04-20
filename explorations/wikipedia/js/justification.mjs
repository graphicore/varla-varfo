/* jshint browser: true, esversion: 9, laxcomma: true, laxbreak: true */
import {getElementSizesInPx} from '../../calibrate/js/domTool.mjs';

/***
 * Justification
 * to port https://variablefonts.typenetwork.com/topics/spacing/justification
 ***/
function _deepText(node) {
    var all = [];
    if(node) {
        node = node.firstChild;
        while(node !== null) {
            if(node.nodeType === Node.TEXT_NODE)
                all.push(node);
            else
                  all.push(..._deepText(node));
            node = node.nextSibling;
        }
    }
    return all;
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
function _isWhiteSpaceTextNode(node) {
  // Use ECMA-262 Edition 3 String and RegExp features
  return !(/[^\t\n\r ]/.test(node.data));
}

function _hasNoSizeTextNode(node){
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
/**
 * Find lines that the browser has composed by using Range objects
 * and their getBoundingClientRect.
 *
 * FIXME: needs work for special cases etc.
 * TODO: we could search from back to front as that would make a better
 *       pipeline with the following transformations, if we keep doing
 *       those from back to front.
 */
function* findLines(elem) {
    var textNodes = _deepText(elem)
      , currentLine = null
      , last = null
      ;
    // NOTE: i/maxI is for development and debugging only to limit
    // the algorithm.
    var i=0, maxI = Infinity;//3000;
    for(let ti=0, tl=textNodes.length;ti<tl && i<maxI;ti++) {
        let endNode = textNodes[ti];
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
        if(endNode.parentNode.offsetParent === null && _hasNoSizeTextNode(endNode))
            continue;
        // this is only done initialy once
        if(!currentLine) {
            currentLine = new Line();
        }
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
            if(currentLine.collectWhitespace === true){
                endNodeIndex += 1;
                continue;
            }


            // FIXME: current known glitches:
            //   * Chromium and Firefox
            //     ## Section: Citations
            //     all pretty bad, but it seems the reason is no longer
            //     how lines are detected.
            let rects = Array.from(currentLine.range.getClientRects())
              , [beforeLastRect, lastRect] = rects.slice(-2)
              , touchingLeft = false
              , touchingBottom = false
              , changed = false
              ;

            if(rects.length <= 1) {
                // Pass; line breaks and column breaks create new client
                // rects,  if there's only one rect, there's no line or
                // column break. Zero rects should never happen (in this
                // context?), but it would also mean neither line or
                // column break. Even an empty string node would produce
                // one rect.
            }
            else if(rects.length > 1) {
                // Other reasons why we would have more rects is that
                // the nodes in the selection could be actually in different
                // elements like in "<em>hello<em> <strong>world</strong>"
                // even on the same line, this would create three rects
                // one for each "hello", " ", and "world".
                //
                // FIXME: precision? fringe cases e.g. pseudo element content?
                // look for the line:
                //              ISBN 978-3-447-06184-1. "the latter
                // it has an aditional " in a pseudo-element, and that causes
                // the line to break, because the lower level client rects
                // of the TextNodes don't touch at that position.
                if(Math.abs(Math.floor(lastRect.left - beforeLastRect.right)) <= 1) {
                    // The result of the subtraction above will be positive
                    // for e.g. a column change and negative for a normal
                    // line change.
                    touchingLeft = true;
                }

                if (Math.floor(lastRect.bottom - beforeLastRect.bottom) < 1) {
                    touchingBottom = true;
                }
                changed = !(touchingLeft && touchingBottom);
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


function getClosestBlockParent(node) {
  // if node is a block it will be returned
  let elem;
  if(node.type === Node.ELEMENT_NODE)
    elem = node;
  else
    elem = node.parentElement;

  while(true){
      // Used to identify a block element, elem.clientWidth is 0 for inline
      // elements. To futher distinguish, elem.getBoundlingClientRect()
      // would return for an inline and a block element a width, that is
      // also for an inline element not 0 (unless is may be empty?).
      if(elem.clientWidth !== 0)
      // got a block
      return elem;
    elem = elem.parentNode;
  }
}

function* reverseArrayIterator(array) {
    for(let i=array.length-1;i>=0;i--)
        yield [array[i], i];
}

function markupLine(line, index, nextLinePrecedingWhiteSpace, nextLineTextContent) {
    let {range, nodes} = line
      , filtered = []
      , lineElements = []
      ;
    let randBG = `rgb(${(Math.random() / 2 + .5) * 255}, `
                   + `${(Math.random() / 2 + .5) * 255}, `
                   + `${(Math.random() / 2 + .5) * 255})`;

    for(let node of nodes) {
        let startIndex = node === range.startContainer
                    ? range.startOffset
                    : 0
          , endIndex = node === range.endContainer
                    ? range.endOffset
                    : node.data.length // -1???
          ;
        if(startIndex === endIndex)
            // This means the selection is empty. it messes with
            // detecting the first/last element reliably, hence I filter
            // it in a pass before, that way.
            // TODO: see if it happens, and, when it happens whether
            // it breaks any assumptions.
            continue;

        filtered.push([node, startIndex, endIndex]);
    }

    if(!filtered.length) {
        // maybe we don't need this anymore!
        console.log('Removed a line at:', index);
        return null;
    }

    // FIXME: add all punctuation and "white-space" etc. that breaks lines.
    // not too sure about ] and ) but I've seen a line-break after a ] in
    // a foot note link (inside a <sup>.
    let lineBreakers = new Set([' ', '-', '—', '.', ',', ']', ')', '\t', '\r', '\n']);
    let addHyphen = false;
    {
        let [node, , endIndex] = filtered[filtered.length-1];
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

    // There are cases where the line essentially is a block element,
    // like a <h2> and after that closes, we get a "\n" which is attributed
    // to that line. We should detect these, but I'm not sure how!
    // Basically, there is white-space that matters, in an inline context,
    // and whitespace that does not matter, in an block context.
    // Wrapping white space that does not matter into a <span> is not good.
    // E.g. after headlines, new sections then start with an empty line.
    // But, it would also cause trouble within the section.
    //
    // NOTE, the <h2> problem above comes from the rule:
    //        h2 + p, h3 + p {
    //              margin-block-start: 0;
    //        }
    // Which then fails. there are other cases where that rule is not
    // good, e.g. where the .thumbs at the beginning of a section are
    // display: none (a temporary measure) or where for other reasons
    // elements are hidden. There's a dirty fix:
    //        h2 ~ p, h3 ~ p {
    //              margin-block-start: 0;
    //        }
    // But that changes other cases, e.g. when a div.hatnote follows
    // the h2 (## History).
    // All in all, for the current phase of development, it may be better
    // to fix these problems on the CSS-level and move on for now.
    //
    // OK, this is all I need so far.
    filtered = filtered.filter(([node])=>{
        // Remove if node is only white space and node.previousSibling is
        // an element and 'block'.
        // If the previous sibling is a comment, we should skip that
        // but it could be <h2><comment><whitespace><comment><this node whitespace>
        // ... so, catching some cases here:
        let cur = node
          , getComputedStyle = node.ownerDocument.defaultView.getComputedStyle
          ;
        while(true) {
            if(cur.nodeType === Node.TEXT_NODE) {
                if(!_isWhiteSpaceTextNode(cur))
                    // Keep! Is not only white space.
                    return true;
            }
            if(!cur.previousSibling)
                // Seems like we reached the first node in an element.
                // not what we are looking for at all here, keep.
                return true;
            cur = cur.previousSibling;
            if(cur.nodeType === Node.ELEMENT_NODE) {
                let display = getComputedStyle(cur).getPropertyValue('display');
                if(display === 'block') {
                    // found it
                    return false;
                }
                if(display === 'none')
                    continue;
                // FIXME: cur could also be position absolute to be a `continue`!
                // But this would mess up other things in the line finding
                // as well, so to edgy for now.
                // The white space matters probably, could be the space
                // between two <a>s.
                return true;
            }
            if(cur.nodeType === Node.COMMENT_NODE)
                continue;
        }
    });

    // TODO: Although they seem to cause no trouble (yet), all
    // white space only first line (.r00-l-first nodes) seem
    // unnecessary as well:
    // for(let node of document.querySelectorAll('.r00-l-first')) {
    //       // NOTE: don't use \s
    //       if(/^\s+$/g.test(node.textContent)) console.log(node);
    // }

    // Do it from end to start, so all offsets stay valid.
    let last = filtered.length-1;
    for(let i=last;i>=0;i--) {
        let [node, startIndex, endIndex] = filtered[i];
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
        span.style.background = randBG;

        // try letting range wrap here ...
        // works awesomely great so far.
        let r = new Range();
        r.setStart(node, startIndex);
        r.setEnd(node, endIndex);
        r.surroundContents(span);
    }
    return lineElements;
}


// This is terribly slow, but it works most of the time/for most of
// the lines, It's also just a proof of concept and not what we're
// going to do eventually.
function OLD_justifyLine(container, elements) {
    //get the line height

    //if the height of all elements getBoundingClientRect is bigger than
    // the line height
    // or maybe better, if there are difffernt bottoms in the first and
    // last  client rect that have any width:
    var setProperty = (name, value)=>{
            for(let elem of elements) {
                elem.style.setProperty(name, value);
            }
        }
      , setFontStretchChange = change=>setProperty('--font-stretch-change', change)
      , everythingIsOnTheSameLine= ()=>{
            if(elements.length === 1) {
                let elem = elements[0]
                  , boxes = elem.getClientRects()
                  ;
                if(boxes.length === 1)
                    return true;
                else
                    return false;

            }
            else {
                let bottoms = new Set();
                for(let elem of elements){
                    bottoms.add(Math.floor(elem.getBoundingClientRect().bottom));
                    if(bottoms.size > 1) {
                        let difference = Math.max(...bottoms) - Math.min(...bottoms);
                        if(difference > 10)
                            return false;
                    }
                }
                return true;
            }
            // false is better for this quick and dirty hack,
            // because it means, at least don't grow too much
            // and at the end we do line containment.
            return false;
        }
      ;
    let xtraStepGrow = 5
      , xtraStepShrink = 1
      // Do it relative for testing now, no need to getComputedStyle ;-)
      // starting at
      , change = 0
      // css --font-stretch is 440
      , maxChange = 200
      , minChange = -40
      ;
    function growToFit() {
        while(everythingIsOnTheSameLine()) {
            // make the line longer
            change += xtraStepGrow;
            if(change > maxChange)
                // giving up
                return;
            setFontStretchChange(change);
        }
        // the line broke
        shrinkToFit();
    }
    function shrinkToFit() {
        while(!everythingIsOnTheSameLine()) {
            // make the line shorter
            change -= xtraStepShrink;
            if(change < minChange) {
                // giving up, this could be bad for the following lines!
                // Trying a containment protocol, which I generally think
                // does more harm than good, but testing it.
                setProperty('white-space', 'nowrap');
                // can't set to ::before directly
                elements[0].classList.add('line-containment');
                console.log('CAUTION: applied line containment protocol');
                return;
            }
            setFontStretchChange(change);
        }
    }

    if(!everythingIsOnTheSameLine()) {
        // make the line shorter
        //     (this should never be the case, unless we went to far making the
        //     line wider, however, it could help if the browser breaks lines
        //     differntly after we did created the element line)
        console.log('Bad: the line breaks initially', elements);
        shrinkToFit();
    }
    else {
        growToFit();
    }
}

function justifyLine(container, lineElements) {
    let lineRange = new Range()
      , lastNode = lineElements[lineElements.length-1]
      , lineParent
      , parentRects
      ;
    lineRange.setStart(lineElements[0], 0);
    lineRange.setEnd(lastNode, lastNode.childNodes.length);
    // lineParent = lineRange.commonAncestorContainer;
    // if(lineParent === lineElements[0]){
    //     console.log('commonAncestorContainer is line node');
    // }
    // This is probably very robust.
    lineParent = getClosestBlockParent(lineElements[0]);

    if(lineParent === container) {
        console.log('DON\'T KNOW (yet) what to do: lineParent === container');
        return;
    }
    parentRects = lineParent.getClientRects();
    // expect all of the line to be

    // Using this: lineElements[0].getClientRects()[0]
    // fails in firefox when we force .runion-line.r00-l-first::before
    // to break (what we do). The first rect is the breaking rect with a
    // width of zero. The lineRange.getClientRects() don't have this issue.
    let rectOfFirstLine = lineRange.getClientRects()[0]
      , rectOfLine
      , i=0
      ;
    for(let rect of parentRects) {

        // if rectOfFirstLine is in rectOfLine we got a hit
        // console.log('rectOfFirstLine', rectOfFirstLine, 'rect', rect, i++);
        if(        rectOfFirstLine.top >= rect.top
                && rectOfFirstLine.bottom <= rect.bottom
                && rectOfFirstLine.left >= rect.left
                && rectOfFirstLine.right <= rect.right) {
            rectOfLine = rect;
            break;
        }
        // console.log('did not fit', i++, 'rectOfFirstLine', rectOfFirstLine ,
        //      '\nrect', rect, '\n',
        //       parentRects, '\n', lineParent,
        //       lineRange.getClientRects()
        //       );
        // console.log(rectOfFirstLine.top, '>=', rect.top, rectOfFirstLine.top >= rect.top);
        // console.log(rectOfFirstLine.bottom, '<=', rect.bottom, rectOfFirstLine.bottom <= rect.bottom);
        // console.log(rectOfFirstLine.left, '>=', rect.left, rectOfFirstLine.left >= rect.left);
        // console.log(rectOfFirstLine.right, '<=', rect.right, rectOfFirstLine.right <= rect.right);
    }
    let style = lineParent.ownerDocument.defaultView.getComputedStyle(lineParent);
    let widthPaddings = getElementSizesInPx(lineParent, 'padding-left', 'padding-right');

    // Looks all plausible!
    // FIXME: Does not take into account a first-line text-indent.
    // Last lines should not be justified ever.
    let availableLineLength = rectOfLine.width - widthPaddings[0] - widthPaddings[1]
      , actualLineLength = lineRange.getBoundingClientRect().width
      , availableWhiteSpace = availableLineLength - actualLineLength
      ;
    //console.log('availableWhiteSpace', availableWhiteSpace, '...',
    //    actualLineLength, '/', availableLineLength , '=',
    //    actualLineLength / availableLineLength);

    // will be 1 for ideal lines and > 1 for less than full lines
    var wsRatio = actualLineLength / availableLineLength;
    var hslColor = `hsl(0, 100%, ${100 * wsRatio}%)`;
    for(let elem of lineElements) {
        elem.style.background = hslColor;
    }
}


// for development:
export function justify() {

let elem = document.querySelector('.runion-01');
let lines = Array.from(findLines(elem));


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

//for(let [i, lineElements] of elementLines.entries()){
//    if(i > 100)
//       break;
//    justifyLine(elem, lineElements);
//}
async function* justifyLineGenerator() {
    for(let [i, lineElements] of elementLines.entries()) {
        justifyLine(elem, lineElements);
        if(i === 51) {
            console.log('STOPING justifyLine due to dev iterations limit', i);
            return;
        }
        yield await new Promise((resolve, reject)=>{
           setTimeout(()=>resolve(true), 0);
        });

    }
}
let runJustifyLine = (async function() {
    for await (let val of justifyLineGenerator()) {
        //pass; console.log(num);
    }
});

runJustifyLine();

}

// TODO before doing actual justification:
//  * collect whitespace and empty nodes between lines
//    probably in ranges and possibly as charData, though, range.toString()
//    produces the char data needed ... BUT: the ranges may become unusable
//    during markupLine and there we need info about the chardata between
//    lines.
//    DONE!
//  * filter empty lines (I would  expect the step before makes this unneccessary)
//    DONE // yes unnecessary
//  * Gather line length information. Looking for actualLineLength and
//    maxLineLength, then excessSpace === maxLineLength - actualLineLength
//    (we want to minimize excessSpace). We can then also calculate how big
//    a wordSpace is on that line. Therefore
//    DONE (even color coded)
//  * Get wordSpace of a line. We need to get wordCount for that and the
//    above. (could also measure using ranges between each word) would
//    likely be most accurate, since the default word-space depends on
//    the font/font spec
//  * maxLineLength can be done by getting the clientRects of the
//    closest block parent element, choose the clientRect that contains
//    the line, get it's line width by subtracting padding-left and padding-right\
//    DONE
//  * For cases like text-indent: the start of the line must be its first
//    clientRects "left" value. This must be subtracted from maxLineLength.
//  * Identify lines that can't have justification, e.g. because of a <br />
//    or a following block element or because it's the last line of a block.
//    In a way, figure if the reason of the
//    line break is caused by something different than the line becoming
//    too wide.
//
// See where we are THEN and start the actual justification implementation.
