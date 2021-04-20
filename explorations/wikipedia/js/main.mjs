/* jshint browser: true, esversion: 9, laxcomma: true, laxbreak: true */
import DOMTool from '../../calibrate/js/domTool.mjs';
import WidgetsContainerWidget from './WidgetsContainerWidget.mjs';

const PORTAL_AUGMENTATION_TEMPLATE = `
<fieldset>
    <legend>Portal Augmentation</legend>
    <em>nothing yet</en>
</fieldset>
`;
/* We may not use this now */
class PortalAugmentationWidget{
    /* Set information about the portal that we can't determine yet ourselves. */
    constructor(baseElement) {
        this._baseElement = baseElement;
        this._domTool = new DOMTool(this._baseElement.ownerDocument);
        var dom = this._domTool.createElementfromHTML(
            'div', {'class': 'portal_augmentation'},
            PORTAL_AUGMENTATION_TEMPLATE
        );
        this.container = dom;
        this._baseElement.appendChild(dom);
    }
}

const USER_SETTINGS_EVENT = 'user-settings';

const SLIDER_TEMPLATE = `
    <label class="{klass}">{label}:
        <input type="range" min="{min}" max="{max}" value="{value}" step="{step}" />
    </label>
`;
class SliderWidget {
    constructor(domTool, container, templateVars, localStorageKey,
                                            customProperty, onChange) {
        this._domTool = domTool;
        this.container = container;
        var template = SLIDER_TEMPLATE;

        for(let [k,v] of Object.entries(templateVars))
            template = template.replaceAll('{' + k + '}', v);
        {
            let frag = this._domTool.createFragmentFromHTML(template);
            this.container.appendChild(frag);
        }
        this._localStorageKey = localStorageKey;
        this._customProperty = customProperty;
        this._onChange = onChange;
        {
            let onInput = evt=>{
                    evt.target.parentNode.setAttribute('data-value', evt.target.value);
                }
              , onChange = evt=> {
                    evt.target.ownerDocument.documentElement.style.setProperty(
                                                customProperty, evt.target.value);
                    this._domTool.window.localStorage.setItem(localStorageKey, evt.target.value);
                    this._onChange(evt.target.value);
                    onInput(evt);
                }
              ;

            let elem = this.container.querySelector(`.${templateVars.klass} input[type="range"]`);
            var storedValue = this._domTool.window.localStorage.getItem(localStorageKey);
            if(storedValue !== null)
                elem.value = storedValue;


            elem.addEventListener('input', onInput);
            elem.addEventListener('change', onChange);
            onChange({target: elem});
        }
    }
}


const COLOR_SCHEME_SWITCH_TEMPLATE = `
<form class="{klass}">
    <p>
    <span class="{klass}-label">{label}:</span><br />
    <label class="{klass}-default"><input
        type="radio" name="color-scheme" value="default" /> User Preference</label><br />
    <label class="{klass}-dark"><input
        type="radio" name="color-scheme" value="dark"/> Dark</label><br />
    <label class="{klass}-light"><input
        type="radio" name="color-scheme" value="light"/> Light</label>
    </p>
</form>
`;
class ColorSchemeWidget {
    constructor(domTool, container, templateVars, localStorageKey,
                                    rootNodeClassTemplate, onChange) {
        this._domTool = domTool;
        this.container = container;
        var template = COLOR_SCHEME_SWITCH_TEMPLATE;
        for(let [k,v] of Object.entries(templateVars))
            template = template.replaceAll('{' + k + '}', v);

        {
            let frag = this._domTool.createFragmentFromHTML(template);
            this.container.appendChild(frag);
        }
        this._localStorageKey = localStorageKey;
        this._rootNodeClassTemplate = rootNodeClassTemplate;
        this._onChange = onChange;

        ///////////
        this._root = this.container.querySelector(`.${templateVars.klass}`);

        {
            // set initial selection from local storage ...
            let storedColorScheme = this._domTool.window.localStorage.getItem(this._localStorageKey);
            let checkedItem = null;
            if(storedColorScheme)
                checkedItem = this._root.querySelector(`input[value="${storedColorScheme}"]`);
            if(!checkedItem)
                checkedItem = this._root.querySelector(`input[value="default"]`);
            checkedItem.checked = true;
        }
        this._root.addEventListener('change', ()=>this._setColorScheme());
        this._setColorScheme();
    }
    _setColorScheme() {
        var checkedInput = this._root.querySelector('input[type="radio"][name="color-scheme"]:checked')
          , localStorageValue = null
          , rootElement = this._domTool.document.documentElement
          ;
        if(checkedInput.value === 'default') {
            for(let mode of ['light', 'dark'])
                rootElement.classList.remove(this._rootNodeClassTemplate.replace('{schemeName}',mode));
        }
        else {
            let mode = checkedInput.value
              , otherMode = mode === 'light' ? 'dark' : 'light'
              ;
            localStorageValue = mode;

            rootElement.classList.remove(
                this._rootNodeClassTemplate.replace('{schemeName}',otherMode));
            rootElement.classList.add(
                this._rootNodeClassTemplate.replace('{schemeName}',mode));
        }
        // "default" will delete the entry
        this._domTool.window.localStorage.setItem(this._localStorageKey, localStorageValue);
        this._onChange(localStorageValue);
    }
}

const FINE_USER_ZOOM_LOCAL_STORAGE_KEY = 'varla-varfo-fine-user-zoom';
const USER_DISTANCE_LOCAL_STORAGE_KEY = 'varla-varfo-user-distance';
const COLOR_SCHEME_LOCAL_STORAGE_KEY = 'varla-varfo-explicit-color-scheme';
const USER_PREFERENCES_TEMPLATE = `
<fieldset>
    <legend>User Preferences</legend>
    <!-- insert: widgets -->
</fieldset>
`;


class UserPreferencesWidget{
    /* SLIDER +- 4PT  in 0.01 steps */
    constructor(baseElement) {
        this._baseElement = baseElement;
        this._domTool = new DOMTool(this._baseElement.ownerDocument);
        this._collectedChanges = null;
        var klass = 'user_preferences';
        var dom = this._domTool.createElementfromHTML(
            'div', {'class': klass},
            USER_PREFERENCES_TEMPLATE
        );
        this.container = dom;
        this._baseElement.appendChild(dom);
        this._widgetsContainer = this._domTool.createElement('div');
        this._domTool.insertAtMarkerComment(this.container,
                            'insert: widgets', this._widgetsContainer);
        var widgetsConfig = [
            /* SLIDER +- 4PT  in 0.01 steps */
            [   SliderWidget, {
                      klass: `${klass}-fine_user_zoom`
                    , label: 'Fine&nbsp;Zoom'
                    , min: '-4'
                    , max: '4'
                    , value: '0.00'
                    , step: '.01'
                },
                FINE_USER_ZOOM_LOCAL_STORAGE_KEY, '--fine-user-zoom',
                (v)=>this._handleUserSettingsChange('fine-user-zoom', v)
            ],
            [   ColorSchemeWidget, {
                      klass: `${klass}-color_scheme`
                    , label: 'Color&nbsp;Scheme'
                },
                COLOR_SCHEME_LOCAL_STORAGE_KEY, 'explicit-{schemeName}-mode',
                (v)=>this._handleUserSettingsChange('color-scheme', v)
            ],
            /* SLIDER +- 4PT  in 0.01 steps
             * 10 inch -> 1pt change
             * I'll use 25cm -> 1pt change as metric units suit me better
             * we may have to localize this!
             */
            [   SliderWidget, {
                      klass: `${klass}-user_distance`
                    , label: 'Relative&nbsp;Distance'
                    , min: '-200'  // - 2 meters
                    , max: '500' // + 5 meters
                    , value: '0'
                    , step: '25'
                },
                USER_DISTANCE_LOCAL_STORAGE_KEY, '--user-distance-cm',
                (v)=>this._handleUserSettingsChange('user-distance', v)
            ],

        ];

        this._widgets = [];
        for(let [Ctor, ...args] of widgetsConfig) {
            let widget = new Ctor(this._domTool, this._widgetsContainer, ...args);
            // could do activate/close with these, but it's not yet necessary
            this._widgets.push(widget);
        }
    }

    _handleUserSettingsChange(type, value) {
        // A simple debouncing scheme: This collects all events that
        // come in synchronously, usually right after initialization,
        // then dispatches all together asynchronously, using a generic
        // promise for the delay.
        if(this._collectedChanges === null) {
            this._collectedChanges = [];
            // dispatch async
            Promise.resolve(true)
            .then(()=>{
                var event = new CustomEvent(USER_SETTINGS_EVENT,
                        { detail: this._collectedChanges, bubbles: true });
                // reset
                this._collectedChanges = null;
                this._domTool.window.dispatchEvent(event);
            });
        }
        this._collectedChanges.push([type, value]);
    }
}

function getElementSizesInPx(elem, ...properties) {
    // At the moment asserting expecting all queried properties
    // to return "px" values.
    var style = elem.ownerDocument.defaultView.getComputedStyle(elem)
      , result = []
      ;
    for(let p of properties) {
        let vStr = style[p];
        if(vStr.slice(-2) !== 'px')
            throw new Error(`Computed style of "${p}" did not yield a "px" value: ${vStr}`);
        let val = parseFloat(vStr.slice(0, -2));
        if(val !== val)
            throw new Error(`Computed style of "${p}" did not parse to an integer: ${vStr}`);
        result.push(val);
    }
    return result;
}

function getElementFontSizePt(elem) {
    var [fontSizePx] = getElementSizesInPx(elem, 'font-size')
      , fontSizePT = fontSizePx * (3/4)
      ;
    return fontSizePT;
}

function setDefaultFontSize(document) {
    var root = document.querySelector(':root')
      , fontSizePT = getElementFontSizePt(root)
      ;
    root.style.setProperty('--default-font-size', fontSizePT);
}

function getELementLineWidthAndEmInPx(elem) {
    // elem.clientWidth:
    // Note: This property will round the value to an integer. If you need
    // a fractional value, use element.getBoundingClientRect().

    var widthPx = elem.getBoundingClientRect().width // this includes padding left and right
      , [emInPx] = getElementSizesInPx(elem, 'font-size')
      ;
    return [widthPx, emInPx];
}

function _runion_01_columns(availableWidthEn) {
    // TODO: Could be cool to configure the unknowns via the testing rig.
    // Would need to reach into the window, could, for that matter, also
    // be done by the user-settings dialogue however, this is not meant
    // to be an end-user-facing setting, just a tool to get the algorithm
    // dialed in.

    /*
     * columnConfig:
     *    This will likely be dependent on the locale!
     *    index 0 == columns 1
     *    [minLineLength, maxLineLength, columnGap] in en
     *    NOTE: for columnGap, it could be just 1em (2en, default in CSS),
     *    but also for wider columns it can (and probably should) be wider.
     *    Since 2 columns are more likely to be wider, I added a bit.
     *    Otherwise, it would be good to have a better informed rule for that
     *    as well, but it will be hard to calculate within this algorithm as
     *    it is.
     */
    var columnConfig = [
        [ 0, 65, 0]  // 1
      , [33, 65, 3] // 2
      , [33, 50, 2.5] // 3
      , [33, 40, 2] // 4
    ];
    for(let columns=1,max=columnConfig.length; columns<=max; columns++) {
        let [minLineLength, maxLineLength, columnGapEn] = columnConfig[columns-1]
            // NOTE: there's (yet?) no default left/right padding, but the
            // compose function expects these. If there's such a thing in
            // the future, also look at the padding case below!
          , paddingLeftEn = 0
          , paddingRightEn = 0
          , gaps = columns - 1
          , lineLengthEn = (availableWidthEn - (gaps * columnGapEn)) / columns
          ;
        if(lineLengthEn > minLineLength && lineLengthEn <= maxLineLength)
            // compose
            return [columns, lineLengthEn, columnGapEn, paddingLeftEn, paddingRightEn];
    }

    // Add padding, we don’t use more than the configured columns.
    for(let columns=columnConfig.length, min=1; columns>=min; columns--) {
        let [minLineLength, maxLineLength, columnGapEn] = columnConfig[columns-1];

        let gaps = columns - 1
          , lineLengthEn = (availableWidthEn - (gaps * columnGapEn)) / columns
          ;

        if(lineLengthEn <= minLineLength)
            continue; // use less columns
        // line length is > maxLineLength because we already figured in
        // the first run that it is *NOT*: lineLengthEn > minLineLength && lineLengthEn <= maxLineLength
        lineLengthEn = maxLineLength;

        // CAUTION, if at some point there's a default left/right padding for a column
        // setup, it must be included in the respective paddingLeftEn/paddingRightEn
        // value before distributing the rest.
        let paddingEn = availableWidthEn - (lineLengthEn * columns) - (gaps * columnGapEn)
            // Another strategy could be e.g. to distribute the padding to the right only.
          , paddingLeftEn = paddingEn * 3/5
          , paddingRightEn = paddingEn * 2/5
          ;
        // compose
        return [columns, lineLengthEn, columnGapEn, paddingLeftEn, paddingRightEn];
    }
    // With a proper config this should not be possible (1 column min-width = 0),
    // thus, if this happens we must look at the case and figure out what to do.
    throw new Error(`Can\'t compose column setup for availableWidthEn: ${availableWidthEn}!`);
}

// Characters per line runion
function runion_01 (elem) {
    var [widthPx, emInPx] = getELementLineWidthAndEmInPx(elem)
        // NOTE: rounding errors made e.g. 4-column layouts appear as
        // 3-columns. The CSS-columns property can't be forced to a definite
        // column-count, it's rather a recommendation for a max-column-count.
        // This creates "room for error", 5px was determined by trying out.
        // A fail is when _runion_01_columns returns e.g. a 4 columns setting
        // but the browser shows 3 columns.
        // FIXME: I can't reproduce this anymore, hence no compensation
        // anymore. It could be that element.clientWidth returns a rounded
        // value and I switched it to element.getBoundingClientRect() which
        // does not round. It's also better when this is precise, because
        // then it is better suited to estimate actual line-length.
      , enInPx = emInPx / 2
      , compensateForError = 0
      , availableWidthEn = (widthPx - compensateForError) / enInPx
      , [columns, lineLengthEn, columnGapEn, paddingLeftEn,
                    paddingRightEn] = _runion_01_columns(availableWidthEn);

    elem.style.setProperty('--column-count', `${columns}`);
    elem.style.setProperty('--column-gap-en', `${columnGapEn}`);
    elem.style.setProperty('--column-width-en', `${lineLengthEn}`);
    elem.style.setProperty('--padding-left-en', `${paddingLeftEn}`);
    elem.style.setProperty('--padding-right-en', `${paddingRightEn}`);
    // Debugging stuff:
    // elem.style.setProperty('--available-width-en', `${availableWidthEn}`);
    // elem.style.setProperty('--mesured-width-px', `${widthPx}`);
    // elem.style.setProperty('--em-in-px', `${emInPx}`);
    // elem.style.setProperty('--en-in-px', `${enInPx}`);
    // let totalEn = columns * lineLengthEn + (columns-1) * columnGapEn + paddingLeftEn + paddingRightEn;
    // elem.style.setProperty('--result-totals', `${totalEn}en ${totalEn * enInPx}px`);

    // NOTE: classes may need to be removed if a runion changes its type!
    elem.classList.add('runion-01');
}


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

function justify() {

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
window.findLines = justify;

function massageWikipediaMarkup(document) {
    document.querySelectorAll('.thumbinner').forEach(e=>e.style.width='');
}

function main() {
    massageWikipediaMarkup(document);
    setDefaultFontSize(document);

    let userSettingsWidget = new WidgetsContainerWidget(
                    document.querySelector('.insert_user_settings'),
                    [
                        PortalAugmentationWidget,
                        UserPreferencesWidget
                    ]);
    let toggle = ()=>userSettingsWidget.toggle();
    for(let elem of document.querySelectorAll('.toggle-user_settings'))
        elem.addEventListener('click', toggle);

    // Must be executed on viewport changes as well as on userSettings
    // changes. User-Zoom changes should also trigger resize, so our own
    // user settings are most important here!
    var updateViewportScheduled
      , updateViewport = (e)=>{
            if(updateViewportScheduled !== null) {
                clearTimeout(updateViewportScheduled);
                updateViewportScheduled = null;
            }
            // NOTE: '.mw-parser-output' is a very specialized guess for our case here!
            for(let elem of document.querySelectorAll('.runify-01, .mw-parser-output'))
                runion_01(elem);
        }
      ;
    // This will most likely be executed by the USER_SETTINGS_EVENT handler
    // so here's a way to cancel this fail-safe initial call.
    updateViewportScheduled = setTimeout(updateViewport, 0);
    window.addEventListener('resize', updateViewport);
    window.addEventListener(USER_SETTINGS_EVENT, updateViewport);
}
window.onload = main;
