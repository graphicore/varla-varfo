/* jshint browser: true, devel: true, esversion: 9, laxcomma: true, laxbreak: true, unused: false */
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
 * NOTE: this generator keeps internal state (and that's it's sole purpose),
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

function justifyLine(container, lineElements, fontSizePx, tolerances) {
    let lineRange = new Range()
      , firstNode = lineElements[0]
      , lastNode = lineElements[lineElements.length-1]
      , lineParent
      , parentRects
      , setPropertyToLine = (name, value)=>{
            for(let elem of lineElements) {
                elem.style.setProperty(name, value);
            }
        }
      , _lineStyleForAll = firstNode.ownerDocument.defaultView.getComputedStyle(firstNode)
      , getPropertyFromLine = (name)=>_lineStyleForAll.getPropertyValue(name)
      ;
    lineRange.setStart(firstNode, 0);
    lineRange.setEnd(lastNode, lastNode.childNodes.length);
    // This is probably very robust, as long as we have block/inline elements.
    // Needs refinements when more display types must be supported.
    lineParent = getClosestBlockParent(firstNode);

    if(lineParent === container) {
        console.log('DON\'T KNOW (yet) what to do: lineParent === container');
        return;
    }
    parentRects = lineParent.getClientRects();
    // expect all of the line to be

    // Using this: firstNode.getClientRects()[0]
    // fails in firefox when we force .runion-line.r00-l-first::before
    // to break (what we do). The first rect is the breaking rect with a
    // width of zero. The lineRange.getClientRects() don't have this issue.
    let rectOfFirstLine = lineRange.getClientRects()[0]
      , rectOfLine
      ;
    for(let rect of parentRects) {

        // If rectOfFirstLine is contained in rectOfLine we got a hit.
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
    // let style = lineParent.ownerDocument.defaultView.getComputedStyle(lineParent);
    let widthPaddings = getElementSizesInPx(lineParent, 'padding-left', 'padding-right');

    // The values below looked all plausible.
    // FIXME: Does not take into account:
    //                      - first-line text-indent
    //                      - floats around this line (we don't do this yet)
    //        Last lines should not be justified ever.
    let availableLineLength = rectOfLine.width - widthPaddings[0] - widthPaddings[1]
      , actualLineLength = lineRange.getBoundingClientRect().width
      , readUnusedWhiteSpace =()=>{ // This will be called a lot!
            return availableLineLength - lineRange.getBoundingClientRect().width;
        }
      ;

    // This block is just a visualization, on "how bad" a line is,
    // i.e. more unusedWhiteSpace is worse, appears darker red,
    // "good" lines become lighter red to white.
    {
        // wsRatio will be 1 for ideal lines and < 1 for less than full lines.
        let wsRatio = actualLineLength / availableLineLength
          , hslColor = `hsl(0, 100%, ${100 * wsRatio}%)`
          ;
        setPropertyToLine('background', hslColor);
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
            //
            let wordSpacingEm = wordSpacingPx / fontSizePx;
            setPropertyToLine('--word-space', wordSpacingEm);
            // this was just for reporting
            // line.setAttribute('data-wordspace', Math.round(parseFloat(line.style.wordSpacing) * 1000));
        }
      , setXTRA = val=>setPropertyToLine('--font-stretch', val)
      , readXTRA = ()=>parseFloat(getPropertyFromLine('--font-stretch'))
      , [xtraMin, ,xtraMax] = tolerances.XTRA
      , generators = [
            _justifyByGenerator(setXTRA, readXTRA, xtraMin,xtraMax),
            _justifyByLetterSpacingGenerator    (setLetterSpacingEm, lineGlyphsLength,
                              fontSizePx, tolerances['letter-spacing']),
            _fullyJustifyByWordSpacingGenerator(setWordSpacingPx, lineWordSpaces),
        //   // NOTE: these are different to the vabro way, but could be possible!
        //   // letter-space
        // , _justifyByGenerator(setVal, readVal, originalMin, originalMax)
        //   // word-space (there's a rule that this must stay smaller than line space I think)
        // , _justifyByGenerator(setVal, readVal, originalMin, originalMax)
    ];
    // run the actual justification
    justifyControlLoop(readUnusedWhiteSpace, generators);
}


// TODO: could also define an order, as the vabro.js order is different than
//       what DB suggested the last time.
// modes.wordspace = true
// modes.letterspace = true
// modes.xtra = true

function OLD_justifyByXTRA(line, tolerances, paragraph, parabox) {
    // TODO: I'd like to generalize this as a control system for all
    //       [min, /*default*/ ,max] triples, as I think the other two
    //       available functions are maybe not as sensitive as this one
    //

    // FIXME: do somewhere outside
    //don't wordspace last line of paragraph
    // if (line.nextElementSibling) {
    //     if (modes.wordspace) {
    //         line.addClass("needs-wordspace");
    //     }
    //     if (modes.letterspace) {
    //         line.addClass('needs-letterspace');
    //     }
    // }

    // Since this, for now runs only for one entry "XTRA"
    // for(let [axis, tol] of Object.entries(tolerances)){
    let axis = 'XTRA'
      , tol = tolerances[axis]
      // the two above may be function arguments
      , [originalMin, /* originalDefault */, originalMax] = tol
      , cmin = originalMin
      , cmax = originalMax
        // TODO: the start value, it's not using the default at tol[1] here
        // maybe we can use the actual current line value and maybe even
        // log a message/warning if it's not the default value.
        // Just until this code gets  more mature.
      , cnow = fvs2obj(paragraph.style.fontVariationSettings)[axis]
      , cnew
      , dw
      , tries = 10
      ;
    while (tries--) {
        // FIXME: do this our way
        // set the new value for the line, no need for the setFVS function!
        // interesting, that we in the first iteration set the current
        // now value. I'd like to refactor this to be smarter
        line.setFVS(axis, cnow);
        line.setAttribute('data-' + axis, Math.round(cnow));

        // FIXME: do this our way
        // measure available space on the line.
        // TODO: could be:
        // dw = yield undefined; // maybe there's a value that makes sense
        // then the caller can decide what to do when dw has changed and if
        // e.g. wordspace adjustment etc. is still required.
        dw = parabox.width - line.clientWidth;

        //console.log(line.textContent.trim().split(' ')[0], dw, cmin, cmax, cnow);

        // This means "+/- less than one pixel"
        if (Math.abs(dw) < 1) {
            // FIXME: move these effects outside of this function
            // we don't do line wordspace anymore
            // line.removeClass('needs-wordspace');
            // line.setAttribute('data-wordspace', 0);
            break;
        }

        // the line is bigger than the available space
        if (dw < 0) { // suggests dw < 0 and dw < -1
            //narrower
            cnew = (cnow + cmin) / 2; // in the middle between now and min
            cmax = cnow; // FIXME: maybe only do this if(cnow < cmax)
        }
        else { // suggests dw > 0 and dw > 1
            cnew = (cnow + cmax) / 2; // in the middle between now and max
            cmin = cnow; // FIXME: maybe only do this if(cnow < cmax)
        }

        // FIXME: can I understand what this does better? I think
        // it's to end the control system, once the size of the next
        // change compared to the magnitude of the overall change value
        // range is getting very small.
        // It reads somethinglike this: If the ratio of the
        // difference between next and current value (cnew - cnow)
        // and the difference between the original max and min values
        // is smaller than 0.005.
        if (Math.abs(cnew - cnow) / (originalMax - originalMin) < 0.005) {
            break;
        }
        cnow = cnew;
    }
}

function* _justifyByLetterSpacingGenerator(setVal, lineGlyphsLength, fontSizePx, [minLS, /*defaultLS*/,maxLS]) {
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

function justifyByLetterSpacing(line, tolerances, parabox, fontsizepx) {
        // available space
    let dw = parabox.width - line.clientWidth
      , [minLS, /*defaultLS*/,maxLS] = tolerances['letter-spacing']
        // FIXME: line.textContent.length must consider for
        //        multiple consecutive white spaces, that are reduced
        //        in HTML to one white spice.
        // available pixel per glyph
      , fitLS = dw / line.textContent.length / fontsizepx
      ;
    fitLS = Math.max(minLS, Math.min(maxLS, fitLS));
    // FIXME: whoa, no fancy control system? I think this should
    // maybe test and correct down if needed. But maybe it's just good
    // enough.
    // because we devided by fontsizepx we can use this in em directly.
    line.style.letterSpacing = fitLS + "em";
    // this was just for reporting
    // line.setAttribute('data-letterspace', Math.round(fitLS * 1000));
                //console.log(line.textContent.trim().split(' ')[0], dw);
}

function justifyByWordSpacing(line, parabox, fontsizepx) {
    var dw = parabox.width - line.clientWidth;
    // FIXME: this also needs to be white-space normalized
    var spaces = line.textContent.split(" ").length - 1;
    // No control system again, also, this just expands to fully fit the line,
    // there's no min/max adherence.
    line.style.wordSpacing = (dw / spaces / fontsizepx) + "em";
    // this was just for reporting
    // line.setAttribute('data-wordspace', Math.round(parseFloat(line.style.wordSpacing) * 1000));
    //console.log(line.textContent.trim().split(' ')[0], dw);
}

function _vabroOriginalOutline(paragraph,modes,tolerances,line) {
    //now expand width to fit
    let justifyByXTRA =()=>{throw new Error('Not Implemented justifyByXTRA');};
    paragraph.querySelectorAll("var").forEach(justifyByXTRA(line));

    if (modes.letterspace && 'letter-spacing' in tolerances) {
        paragraph.querySelectorAll("var.needs-letterspace").forEach(justifyByLetterSpacing);
    }

    if (modes.wordspace) {
        paragraph.querySelectorAll("var.needs-wordspace").forEach(justifyByWordSpacing);
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

function getPrimaryFontFamily(ff) {
    return ff.split(',')[0].trim().replace(/^["']\s*/, '').replace(/\s*$/, '')
        // had a case in Firefox, where ff = "AmstelvarAlpha-VF" (including the double quotes)
        // and return was: AmstelvarAlpha-VF"
        // I don't know which cases are supposed to be cleaned up with the
        // calls to replace before.
        .replace("\"", '');
}

function obj2fvs(fvs) {
    var clauses = [];
    for(let [k, v] of Object.entries(fvs)){
        clauses.push('"' + k + '" ' + v);
    }
    return clauses.join(", ");
}

function fvs2obj(css) {
    var result = {};
    if (css === 'normal') {
        return result;
    }
    css.split(',').forEach(function(clause) {
        var m = clause.match(/['"](....)['"]\s+(\-?[0-9\.]+)/);
        if (m) {
            result[m[1]] = parseFloat(m[2]);
        }
    });
    return result;
}

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
            for(let [axis, sml] of Object.entries(high)){
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

function doJustification() {
    document.querySelectorAll('.specimen.justify .rendered').forEach(function(paragraph) {
        var container = paragraph.closest('.specimen.justify');

        var modes = {};

        container.className.split(/\s+/).forEach(function(word) {
            modes[word] = true;
        });

        var startTime = (window.performance || Date).now();

        //reset paragraph to plain text and remove special styling
        var parastyle = getComputedStyle(paragraph);
        var fontfamily = getPrimaryFontFamily(parastyle.fontFamily);
        var fontsizepx = parseFloat(parastyle.fontSize);
        var fontsize = fontsizepx * 72/96;
        var fvs = fvs2obj(parastyle.fontVariationSettings);
        var relweight;

        if (fvs.XOPQ && globalAxes[fontfamily] && globalAxes[fontfamily].XOPQ) {
            relweight = 100 * fvs.XOPQ / globalAxes[fontfamily].XOPQ.default;
        } else if (parseInt(parastyle.fontWeight)) {
            relweight = 100 * parseInt(parastyle.fontWeight) / 400;
        } else {
            relweight = 100;
        }

        var tolerances = getJustificationTolerances(fontfamily, fontsize, relweight);

// >>>



        var words = paragraph.textContent.trim().split(/\s+/);

        paragraph.innerHTML = "<span>" + words.join("</span> <span>") + "</span>";

        //start at maximum squish and then adjust upward from there
        for(let [axis, tol] of Object.entries(tolerances)){
            if (axis.length !== 4) {
                // letter-spacing and word-spacing are not set here
                return;
            }
            // from what we have, only XTRA arrives here
            if (axis.toLowerCase() in modes) {
                // tol === min value
                // FIXME: If we don't do this as the default in the CSS
                //        we must do it prior to justification
                paragraph.setFVS(axis, tol[0]);
            }
        }

        // that's to get the availableLineLength
        var parabox = paragraph.getBoundingClientRect();
        var spans = paragraph.querySelectorAll("span");

        // put words into lines, my approach is more sophisticated
        var lastY = false;
        var lines = [], line = [];

        spans.forEach(function(word) {
            // var box = word.getBoundingClientRect();
            // var eol = box.left - parabox.left + box.width;
            var y = word.getBoundingClientRect().top;
            if (lastY === false) {
                lastY = y;
            }

            if (y === lastY) {
                line.push(word.textContent);
            } else {
                //wrap!
                line = line.join(" ");
                lines.push(line);
                line = [word.textContent];
                // word = word.previousSibling;
                // while (word.previousSibling) {
                //   word = word.previousSibling;
                //   paragraph.removeChild(word.nextSibling);
                // }
                // paragraph.removeChild(word);
                //paragraph.innerHTML = paragraph.innerHTML.trim();
            }

            lastY = y;
        });

        if (line.length) {
          lines.push(line.join(" "));
        }

        // the text content of the words is unpacked already
        // this is putting the words into lines, which themselves are
        // mad up <var> elements
        paragraph.innerHTML = "<var>" + lines.join("</var> <var>") + "</var>";




        // this is the actual justification, will copy...
        //now expand width to fit
        paragraph.querySelectorAll("var").forEach(function(line, index) {
            //don't wordspace last line of paragraph
            if (line.nextElementSibling) {
                if (modes.wordspace) {
                    line.addClass("needs-wordspace");
                }
                if (modes.letterspace) {
                    line.addClass('needs-letterspace');
                }
            }

            for(let [axis, tol] of Object.entries(tolerances)){
                if (axis.length !== 4) {
                    return;
                }
                if (axis.toLowerCase() in modes) {

                    var cmin = tolerances[axis][0];
                    var cmax = tolerances[axis][2];
                    var cnow = fvs2obj(paragraph.style.fontVariationSettings)[axis];
                    var cnew;

                    var dw, tries = 10;

                    while (tries--) {
                        line.setFVS(axis, cnow);
                        line.setAttribute('data-' + axis, Math.round(cnow));
                        dw = parabox.width - line.clientWidth;

                        //console.log(line.textContent.trim().split(' ')[0], dw, cmin, cmax, cnow);

                        if (Math.abs(dw) < 1) {
                            line.removeClass('needs-wordspace');
                            line.setAttribute('data-wordspace', 0);
                            break;
                        }

                        if (dw < 0) {
                            //narrower
                            cnew = (cnow + cmin) / 2;
                            cmax = cnow;
                        } else {
                            cnew = (cnow + cmax) / 2;
                            cmin = cnow;
                        }

                        if (Math.abs(cnew - cnow) / (tolerances[axis][2] - tolerances[axis][0]) < 0.005) {
                            break;
                        }

                        cnow = cnew;
                    }
                }
            }
        });

        if (modes.letterspace && 'letter-spacing' in tolerances) {
            paragraph.querySelectorAll("var.needs-letterspace").forEach(function(line) {
                var dw = parabox.width - line.clientWidth;

                var minLS = tolerances['letter-spacing'][0];
                var maxLS = tolerances['letter-spacing'][2];
                var fitLS = dw / line.textContent.length / fontsizepx;

                fitLS = Math.max(minLS, Math.min(maxLS, fitLS));

                line.style.letterSpacing = fitLS + "em";

                line.setAttribute('data-letterspace', Math.round(fitLS * 1000));

                //console.log(line.textContent.trim().split(' ')[0], dw);
            });
        }

        if (modes.wordspace) {
            paragraph.querySelectorAll("var.needs-wordspace").forEach(function(line) {
                var dw = parabox.width - line.clientWidth;
                var spaces = line.textContent.split(" ").length - 1;
                line.style.wordSpacing = (dw / spaces / fontsizepx) + "em";

                line.setAttribute('data-wordspace', Math.round(parseFloat(line.style.wordSpacing) * 1000));

                //console.log(line.textContent.trim().split(' ')[0], dw);
            });
        }

        //set up param labels
        paragraph.querySelectorAll("var").forEach(function(line) {
            var label = [];
            line.getAttributeNames().forEach(function(attr) {
                var nicename;
                if (attr.substr(0, 5) !== 'data-') {
                    return;
                }
                switch(attr) {
                    case 'data-params': return;
                    case 'data-letterspace': nicename = 'ls'; break;
                    case 'data-wordspace': nicename = 'ws'; break;
                    default: nicename = attr.substr(5); break;
                }
                label.push(nicename + ' ' + line.getAttribute(attr));
            });
            if (label.length) {
                line.setAttribute('data-params', label.join(" "));
            }

            line.textContent = line.textContent;
        });

        window.doLineHeights();

        var endTime = (window.performance || Date).now();

        console.log(container.className, "Reflowed in " + Math.round(endTime - startTime) / 1000 + "s");
    });
}
/****
 * END OF vabro.js copy.
 ****/

// for development:
export function justify(elem, options) {
    let lines = Array.from(findLines(elem));

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
    console.log('fontSize', fontSize, 'relweight', relweight, 'tolerances:', tolerances);
    // > fontSize 12 relweight 100 tolerances: {
    //                // All these appear a bit low/narrow for the current AmstelVar
    //                // all values: [min, default, max]
    // >        XTRA: [375, 402, 402],
    // >        'letter-spacing': [-0.025, 0, 0.025],
    // >        'word-spacing': [-0.20500000000000002, 0, 0.20500000000000002]
    // > }


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
            justifyLine(elem, lineElements, fontSizePx, tolerances);
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
    // TODO: if  justify is still running (async execution mode)
    //       it must be possible to abort it. Therefore, the caller
    //       must provide an `abort` function
    let abort = ()=>console.warn('Not implemented justify->abort().')
      , unjustify = ()=>{
            abort();
            _unjustify(elem, elementLines);
    }
    return {unjustify: unjustify, abort: abort};
}

function _unjustify(container, elementLines) {
    console.log('unjustify');
    for(let line of elementLines){
        for(let elem of line) {
            elem.replaceWith(...elem.childNodes);
        }
    }
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
    container.normalize();
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
