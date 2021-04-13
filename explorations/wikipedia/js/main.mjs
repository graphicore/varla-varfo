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
    var widthPx = elem.clientWidth // this includes padding left and right
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
      , enInPx = emInPx / 2
      , compensateForError = 5
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

function findLines() {
var r00 = document.querySelector('.runion-01');

function deepText(node){
    var all = [];
    if(node) {
        node = node.firstChild;
        while(node !== null) {
            if(node.nodeType === Node.TEXT_NODE)
                all.push(node);
            else
                  all.push(...deepText(node));
            node = node.nextSibling;
        }
    }
    return all;
}

function isEmptyTextNode(node){
      return /^\s+$/g.test(node.data);
}

function hasNoSizeTextNode(node){
    let rtest = new Range();
    rtest.setStart(node, 0);
    rtest.setEnd(node, node.data.length);
    let bounds = rtest.getBoundingClientRect();
      return bounds.width === 0 && bounds.height === 0;
}


function* iterate(elem) {
    var computed = elem.ownerDocument.defaultView.getComputedStyle(elem)
      , columnWidthEn = parseFloat(computed.getPropertyValue('--column-width-en'))
      , fontSize = getElementSizesInPx(elem, 'font-size')
      , columnWidth = 0.5 * fontSize * columnWidthEn
      , textNodes = deepText(elem)
      , lines = []
      , currentLine = null
      , last = null
      ;
    // This is not a clean char by char selection, what I'm looking for
    //  much rather, we must go into element textNodes and return
    var i=0, maxI = Infinity;//3000;
    for(let ti=0, tl=textNodes.length;ti<tl && i<maxI;ti++) {
        let endNode = textNodes[ti];
        let endNodeIndex = 0;
        // hasNoSizeTextNode seems better for me, because we also may want
        // to keep e.g. ' ' when tuning word-space.
        // skip empty text nodes ...
        // if(isEmptyTextNode(endNode)) {
        //     console.log('skipping empty:',  endNode);
        //     continue;
        // }
        if(hasNoSizeTextNode(endNode)) {
            // console.log('skipping no size:',  endNode);
            continue;
        }

        while(i<maxI) {
            // this is only done initialy once
            if(!currentLine) {
                // a range can be 0 length, so initially start and end can be the same
                currentLine = {
                    range: new Range()
                  , nodes: [endNode]
                };
                currentLine.range.setStart(endNode, endNodeIndex);
            }
            try {
                // expecting an IndexSizeError ...
                currentLine.range.setEnd(endNode, endNodeIndex);
            }
            catch(err) {
                if(err.name === 'IndexSizeError') {
                    // see the BTW, there's another way to detect this
                    // console.log(`at ${i}: (BTW ${endNode.data.length === endNodeIndex-1})`, err);
                    break;
                }
                throw err; // re-raise
            }

            // print bb
            let bcr = currentLine.range.getBoundingClientRect()
              , xOffset = window.pageXOffset
              , yOffset = window.pageYOffset
              , bottom = bcr.bottom + yOffset
              , width = bcr.width
              , [lastEndNode, lastEndNodeIndex, lastBottom] = last || [null, null, null]
                // only the main case!
                // TODO: detect column change!

                // actually, I get the correct line height with
                // (bottom - lastBottom).toFixed(2) here (which is
                // currently 20.8px) but there's a little error
                // hence, the toFixed, CAUTION line-height can change
                // between elements!
              , lineHasChanged =  last && (bottom - lastBottom).toFixed(2) > 0
                // FIXME: guessed 5 would be good enough, but there should
                // be a more robust way.
                // FIXME: This heuristic also fails when e.g. in a list
                // item (see under Contents 6.1) the line is shorter due
                // to  indentation. We must compensate for all kinds of
                // indentation e.g. a new <p> will likely have an indent!
                // NOTE: a bigger change of the selection top is also a
                // very strong indicator of a column change, but, it wouldn't
                // detect when the columns are only one line, e.g. in
                // firefox CSS-widows and CSS-orphans does not work so this
                // definitely happens!
                // TODO: we may also likely have to identify cases where
                // justification is not required or wanted!
                // (section headliness/"column-span: all;" elements) etc.
                // but for now it makes more sense to apply this to as
                // much different stuff as possible.
              , columnHasChanged = width > columnWidth + 5
              ;
            // we already unpacked the old last!
            // caution how endNodeIndex changes below in the condition
            // that's why I don't do this after the condition.
            last = [endNode, endNodeIndex, bottom];
            // console.log(`bcr ${i}, ${endNodeIndex} => bottom ${bcr.bottom + yOffset} left ${bcr.left + xOffset} x+O ${bcr.x + xOffset} right ${bcr.right + xOffset}  `);
            if(lineHasChanged || columnHasChanged) {
                // console.log('lineHasChanged', lineHasChanged, bottom, lastBottom, (bottom - lastBottom));
                // console.log(columnHasChanged, 'width', width, 'columnWidth', columnWidth);
                currentLine.range.setEnd(lastEndNode, lastEndNodeIndex);
                lines.push(currentLine);
                yield currentLine.range;
                currentLine = {
                    range: new Range()
                  , nodes: [lastEndNode]
                };
                currentLine.range.setStart(lastEndNode, lastEndNodeIndex);
            }
            else {
                // If we start a new line we don't do this and try
                // this endNode + endNodeIndex again
                endNodeIndex += 1;
            }

            if(currentLine.nodes[currentLine.nodes.length-1] !== endNode) {
                currentLine.nodes.push(endNode);
            }
            i += 1;
        }
    }
    markupLines(lines);
}


function markupLines(lines) {
    // do it from end to start, so all offsets stay valid
    for(let i=lines.length-1;i>=0;i--)
        markupLine(lines[i], i);
}
function markupLine(line, index) {
    let {range, nodes} = line
      , filtered = []
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

        filtered.push([node, startIndex, endIndex, node.data]);
    }

    // do it from end to start, so all offsets stay valid
    let last = filtered.length-1;
    for(let i=last;i>=0;i--) {
        let [node, startIndex, endIndex, txt] = filtered[i];
        // we have at least one char of something
        let span = document.createElement('span');
        span.classList.add('runion-line');
        span.classList.add(`r00-l${index}`);
        if(i === 0)
            span.classList.add('r00-l-first');
        if(i === last)
            span.classList.add('r00-l-last');
        span.style.background = randBG;

        // try letting range wrap here ...
        // works awesomely great so far.
        let r = new Range();
        r.setStart(node, startIndex);
        r.setEnd(node, endIndex);
        r.surroundContents(span);
    }
}


var gen = iterate(r00)
  , next = ()=>{
        // show selection
        let val = gen.next();
        if(val.done)
            return;
        let lineRange = val.value;
        // document.getSelection().removeAllRanges();
        // document.getSelection().addRange(lineRange);
        //setTimeout(next, 0);
        next();
    }
  ;

next();
}
window.findLines = findLines;




function massageWikipediaMarkup(document){
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
