/* jshint browser: true, esversion: 9, laxcomma: true, laxbreak: true */
import DOMTool, {getElementSizesInPx} from '../../calibrate/js/domTool.mjs';
import WidgetsContainerWidget from './WidgetsContainerWidget.mjs';
import {JustificationController} from './justification.mjs';


class _ContainerWidget {
    constructor(baseElement) {
        this._baseElement = baseElement;
        this._domTool = new DOMTool(this._baseElement.ownerDocument);
        this._collectedChanges = null;

    }

    /* lol, not so sure that this should be in the super class*/
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

    // the subclass must define this.
    get _widgetsContainer(){
        throw new Error('Not Implemented: _widgetsContainer');
    }

    set _widgetsContainer(v){
        Object.defineProperty(this, '_widgetsContainer', {value: v});
    }

    _initWidgets(widgetsConfig) {
        let widgets = [];
        for(let [Ctor, ...args] of widgetsConfig) {
            let widget = new Ctor(this._domTool, this._widgetsContainer, ...args);
            // could do activate/close with these, but it's not yet necessary
            widgets.push(widget);
        }
        return widgets;
    }
}


// maybe [checkbox] sup/sub

// justification
    // [checkbox][button] * start/on/run-on-load/run-on-change
    //          * pause/stop/don't run-on-load/don't run on change(default)
    //    BUT! with hourclass indicator
    //  It's play/pause.

    // [checkbox] turn on/off line-color-coding default:on
    //          action toggle a class


    // maybe: turn off xtra
    // maybe instead of start/on  stop/pause:
    //          active/inactive
    //          which will be paused if stopped, without column change,
    //          and will restart wherever it was
    // an extension of pause is unjustify, which doesn't make much sense
    // without stop, because then it has to restard again just after unjustify.
    //          [button] cancel: unjustify + pause
    // OK, so then unjustify is the same as a layout change
    // (onResize/updateViewport)has to perform:
    //      stop, unjustify (wait for layout changing to settle?) start.
    //
    //
    // the algorithm only knows pause/play
    // cancel sets pause + runs unjustify
    //


    // While justifying, can I have a spinning hourglass?
    // While justifying: pick the next line from all unjustified lines
    // by how central it is to the viewport!!!
    //
    //

    // trim algorithm:
    //      [checkbox] stop after find lines
    //          like a breakpoint debugger1
    //              when we have a start/pause button, this can just pause
    //              after find lines, easy!
    //

//
const CHECKBOX_TEMPLATE = `
    <label class="{klass}">{label}:
        <input type="checkbox" checked="{*checked*}"/>
        {*button style*}
    </label>
`;

class CheckboxWidget {
    constructor(domTool, container, templateVars, checked, buttonStyle,
                localStorageKey, onChange) {
        this._domTool = domTool;
        this.container = container;
        var template = CHECKBOX_TEMPLATE;

        let _templateVars = [...Object.entries(templateVars)];

        _templateVars.push(['*button style*', buttonStyle ? '<span></span>' : '']);
        _templateVars.push(['checked', checked ? 'checked' : '']);

        for(let [k,v] of _templateVars)
            template = template.replaceAll('{' + k + '}', v);
        {
            let frag = this._domTool.createFragmentFromHTML(template);
            this.container.appendChild(frag);
        }
        this._localStorageKey = localStorageKey;
        // parent change propagation
        this._onChange = onChange;
        {
            let onChange = evt=> {
                    this._domTool.window.localStorage.setItem(localStorageKey,
                                    evt.target.checked ? 'true' : 'false');
                    this._onChange(evt.target.checked);
                }
              ;
            let elem = this.container.querySelector(`.${templateVars.klass} input[type="checkbox"]`)
              , storedValue = this._domTool.window.localStorage.getItem(localStorageKey)
              ;
            if(storedValue !== null)
                elem.checked = storedValue === 'true' ? true : false;

            elem.addEventListener('change', onChange);
            onChange({target: elem});
        }
    }
}


const GRADE_DARK_MODE_LOCAL_STORAGE_KEY = 'varla-varfo-grade-dark-mode'
    , AMPLIFY_GRADE_LOCAL_STORAGE_KEY = 'varla-varfo-grade-amplify'
    , JUSTIFICATION_ACTIVE_STORAGE_KEY = 'varla-varfo-justification-active'
    , LINE_COLOR_CODING_STORAGE_KEY = 'varla-varfo-line-color-coding'
    ;

const PORTAL_AUGMENTATION_TEMPLATE = `
<fieldset>
    <legend>Demo Control Center</legend>
    <!-- insert: widgets -->
</fieldset>
`;
/* We may not use this now */
class PortalAugmentationWidget extends _ContainerWidget {
    /* Set information about the portal that we can't determine yet ourselves. */
    constructor(baseElement, justificationController) {
        super(baseElement);
        this._justificationController = justificationController;
        var klass = 'portal_augmentation';
        var dom = this._domTool.createElementfromHTML(
            'div', {'class': klass},
            PORTAL_AUGMENTATION_TEMPLATE
        );
        this.container = dom;
        this._baseElement.appendChild(dom);
        this._widgetsContainer = this._domTool.createElement('div');
        this._domTool.insertAtMarkerComment(this.container,
                            'insert: widgets', this._widgetsContainer);


        let widgetsConfig = [
            // [checkbox] play/pause justification
            [   CheckboxWidget, {
                      klass: `${klass}-run_justification_checkbox`
                    , label: 'Justification'
                },
                true, /* checked: bool */
                true, /* buttonStyle: bool */
                JUSTIFICATION_ACTIVE_STORAGE_KEY,
                (isOn)=> {
                    console.log(`${JUSTIFICATION_ACTIVE_STORAGE_KEY}:`, isOn);
                    this._justificationController.setRunning(isOn);
                }
            ],
            // [checkbox] turn on/off line-color-coding default:on
            [   CheckboxWidget, {
                      klass: `${klass}-toggle_line_color_coding`
                    , label: 'Line&nbsp;Color-Coding'
                },
                true, /* checked: bool */
                true, /* buttonStyle: bool */
                LINE_COLOR_CODING_STORAGE_KEY,
                (isOn)=> {
                    console.log(`${LINE_COLOR_CODING_STORAGE_KEY}:`, isOn);
                    let action = isOn ? 'add' : 'remove';
                    this._domTool.documentElement.classList[action]('color-coded-lines');
                }
            ],
            // [checkbox] grade in dark-mode: on/off default: on
            [   CheckboxWidget, {
                      klass: `${klass}-switch_grade_checkbox`
                    , label: 'Switch&nbsp;Grade in Dark Color Scheme'
                },
                true, /* checked: bool */
                true, /* buttonStyle: bool */
                GRADE_DARK_MODE_LOCAL_STORAGE_KEY,
                (isOn)=> {
                    console.log(`${GRADE_DARK_MODE_LOCAL_STORAGE_KEY}:`, isOn);
                    let value = isOn ?  '1' : '0';
                    this._domTool.documentElement.style.setProperty(
                                                '--toggle-grade', value);
                }
            ],
            [   SliderWidget, {
                      klass: `${klass}-amplify_grade`
                    , label: 'Amplify&nbsp;Grade'
                    , min: '1'
                    , max: '15'
                    , value: '1'
                    , step: '1'
                },
                AMPLIFY_GRADE_LOCAL_STORAGE_KEY, '--amplify-grade',
                ()=>{}// onChange
            ],
        ];

        this._widgets = this._initWidgets(widgetsConfig);
    }
}

const USER_SETTINGS_EVENT = 'user-settings';

const SLIDER_TEMPLATE = `
    <label class="{klass}">{label}:
        <input type="range" min="{min}" max="{max}" value="{value}" step="{step}"
    /> </label>&nbsp;<button class="{klass}-reset">reset</button>
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
                    this._domTool.documentElement.style.setProperty(
                                                customProperty, evt.target.value);
                    this._domTool.window.localStorage.setItem(localStorageKey, evt.target.value);
                    this._onChange(evt.target.value);
                    onInput(evt);
                }
              ;

            let elem = this.container.querySelector(`.${templateVars.klass} input[type="range"]`)
              , reset = this.container.querySelector(`.${templateVars.klass}-reset`);
            var storedValue = this._domTool.window.localStorage.getItem(localStorageKey);
            if(storedValue !== null)
                elem.value = storedValue;

            elem.addEventListener('input', onInput);
            elem.addEventListener('change', onChange);
            reset.addEventListener('click', ()=>{
                elem.value = templateVars.value;
                let evt = document.createEvent("HTMLEvents");
                evt.initEvent("change", false, true);
                elem.dispatchEvent(evt);
            });
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


class UserPreferencesWidget extends _ContainerWidget{
    constructor(baseElement) {
        super(baseElement);

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

        this._widgets = this._initWidgets(widgetsConfig);
    }
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
    root.style.setProperty('--default-font-size', `${fontSizePT}`);
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
    const minLineLength = 33
       , maxLineLength = 65
        // at minimal line length === 1
        // at maximal line length === 1.2
        // otherwise inbetween.
        // never smaller than 1
       , minLineHeight = 1
       , maxLineHeight = 1.2
       , calcLineHeight=(lineLengthEn)=>{
            const lineLengthPos = lineLengthEn-minLineLength
                , lineLengthRange = maxLineLength - minLineLength
                , ratio = lineLengthPos/lineLengthRange
                , raw = minLineHeight + ((maxLineHeight-minLineHeight) * ratio)
                ;
            return Math.min(maxLineHeight, Math.max(minLineHeight, raw));
         }
       ;
    var columnConfig = [
        [ 0, 65, 0]  // 1
      , [minLineLength, maxLineLength, 3] // 2
      , [minLineLength, 50, 2.5] // 3
      , [minLineLength, 40, 2] // 4
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
          , lineHeight = calcLineHeight(lineLengthEn)
          ;
        if(lineLengthEn > minLineLength && lineLengthEn <= maxLineLength)
            // compose
            return [columns, lineLengthEn, columnGapEn, paddingLeftEn, paddingRightEn, lineHeight];
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
          , lineHeight = calcLineHeight(lineLengthEn)
          ;
        // compose
        return [columns, lineLengthEn, columnGapEn, paddingLeftEn, paddingRightEn, lineHeight];
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
                    paddingRightEn, lineHeight] = _runion_01_columns(availableWidthEn);

    elem.style.setProperty('--column-count', `${columns}`);
    elem.style.setProperty('--column-gap-en', `${columnGapEn}`);
    elem.style.setProperty('--column-width-en', `${lineLengthEn}`);
    elem.style.setProperty('--padding-left-en', `${paddingLeftEn}`);
    elem.style.setProperty('--padding-right-en', `${paddingRightEn}`);
    elem.style.setProperty('--line-height', `${lineHeight}`);

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

function _interpolatePiecewise(stops, indexValue) {
    let [min, ] = stops[0]
      , [max, ] = stops[stops.length - 1]
      , normalized = Math.min(max, Math.max(min, indexValue))
      , lower, lowerValues, upper, upperValues
      ;
    for(let [stopIndex, ...values] of stops) {
        if(normalized === stopIndex)
            // shortcut, direct hit
            return [normalized, values];
        if(normalized > stopIndex) {
            lower = stopIndex;
            lowerValues = values;
            continue;
        }
        else if(normalized < stopIndex) {
            upper = stopIndex;
            upperValues = values;
            break;
        }
    }
    // interpolate
    let factor = (normalized - lower) / (upper - lower)
      , values = []
      ;
    for(let i=0,l=Math.min(lowerValues.length, upperValues.length); i<l; i++){
        let lower = lowerValues[i]
          , upper = upperValues[i]
          ;
        values.push( (upper - lower) * factor + lower );
    }
    return [normalized, values];
}

class IsSupported {}


const stopsGradeRobotoFlex = [
    /* [fontSize, --grad-400, --grad-700] */
    [10,   0,   0]
  , [11,  -6,  -6]
  , [12,  -9, -10]
  , [13, -12, -15]
  , [14, -14, -20]
  , [15, -16, -30]
  , [16, -18, -38]
  , [17, -22, -43]
  , [18, -24, -54]
];

const stopsGradeAmstelVar = [
    /* [fontSize, --grad-400, --grad-700] */
    [10,  -3,  -80]
  , [11,  -6,  -90]
  , [12, -10,  -95]
  , [13, -12, -100]
  , [14, -14, -105]
  , [15, -16, -110]
  , [16, -18, -115]
  , [17, -22, -120]
  , [18, -24, -125]
];

const stopsSynthSup = [
    /* [fontSize, --sup-scale] */
    [  8, 0.65]
  , [ 14, 0.57]
  , [144, 0.25]
];


function _fixGrade(stops, elem, style, cache) {
    // Here's a problem when testing for e.g. "--grad-400": once we have
    // set this on a parent element, it will return a value for each child.
    // The workaround is a new property --grad-supported, that we don't
    // set to an element.style.
    // ...if not set, returns the empty string.
    if(style.getPropertyValue('--grad-supported') !== '') {
        // the @keyframe animation is actually supported
        // FIXME: we should not call this anymore for the whole tree traversal.
        throw new IsSupported();
    }
    let fontSizePt = parseFloat(style.getPropertyValue('font-size')) * 0.75;

    // Generally, as a rule, we can skip applying these if font-size didn't
    // change between a parent that has these and a child, because the
    // custom properties do inherit.
    // The cache is specific per @keyframe substitution, hence shoudn't get
    // mixups between AmstelVar and RobotoFlex here. In other words, if
    // elem.parentElement is not in the cache, because it uses another
    // @keyframe animation, these changes will be applied.
    cache.set(elem, {fontSizePt: fontSizePt});
    let parentFontSize = (cache.get(elem.parentElement)||{}).fontSizePt;
    if( parentFontSize !== undefined && fontSizePt === parentFontSize)
        return;

    let [/*normalizedFontSize*/, [grad400, grad700]
                           ] = _interpolatePiecewise(stops, fontSizePt);
    elem.style.setProperty('--grad-400', grad400);
    elem.style.setProperty('--grad-700', grad700);
}

function _fixGradeRobotoFlex(...args) {
    return _fixGrade(stopsGradeRobotoFlex, ...args);
}

function _fixGradeAmstelVar(...args) {
    return _fixGrade(stopsGradeAmstelVar, ...args);
}

function _fixSynthSub(elem, style/*, cache*/) {
    // CAUTION: --sup-scale must be removed prior to calling this, but
    // it's done by the caller. This is because --sup-scale itself affects
    // font-size which must be the initial/original value when calculating these.

    // ...if not set, returns the empty string.
    if(style.getPropertyValue('--sup-scale') !== '') {
        // the @keyframe animation is actually supported
        throw new IsSupported();
    }
    let fontSizePt = parseFloat(style.getPropertyValue('font-size')) * 0.75
      , [/*normalizedFontSize*/, [supScale]] = _interpolatePiecewise(stopsSynthSup, fontSizePt)
      ;
    elem.style.setProperty('--sup-scale', supScale);
}

const _fixCssKeyFramesFunctions = [
    // synth-sub must be first, as grade depends on
    // font-size and this changes font-size.
    ['synth-sub-and-super-script', _fixSynthSub, ['--grad-400', '--grad-700']]
  , ['AmstelVar-grad-by-font-size', _fixGradeAmstelVar, ['--grad-400', '--grad-700']]
  , ['RobotoFlex-grad-by-font-size', _fixGradeRobotoFlex, ['--sup-scale']]
];

function fixCSSKeyframes(document) {
    let getComputedStyle = document.defaultView.getComputedStyle
      , treeWalker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT
            // All we need to determine whether to show the node, we need
            // also to process it further, so I think filtering is done
            // better in the action directly.
            // {acceptNode: elem=>{ return NodeFilter.FILTER_ACCEPT; }}
        )
      , elem = treeWalker.currentNode
      , skip = new Set()
      , caches = new Map()
      , cleanup = elem=> {
            for(let[,,removeProps] of _fixCssKeyFramesFunctions)
                for(let prop of removeProps)
                    elem.style.removeProperty(prop);
        }
      ;
    while(elem) {
        let style = getComputedStyle(elem)
          , elemAnimationNames = new Set(style.getPropertyValue('animation-name')
                                              .split(',')
                                              .map(n=>n.trim()))
          ;
        // These must be removed always, so that we don't
        // apply a keyframe substitute when it is actually disabled.
        cleanup(elem);
        for(let [animationName, applyFixFunc] of _fixCssKeyFramesFunctions) {
            if(skip.has(animationName))
                continue;
            // animation-name does not inherit, so we can address
            // exactly the elements that have these animations applied.
            // LOL, that the grad animation applies to *.
            // An optimization is to remember (see usage of cache) the
            // relevant properties of the parent and only apply the
            // fix, if the properties have changed.
            if(elemAnimationNames.has(animationName)) {
                let cache = caches.get(animationName);
                if(!cache)
                    caches.set(animationName, cache = new Map());
                try {
                    applyFixFunc(elem, style, cache);
                }
                catch(err) {
                    if(err instanceof IsSupported) {
                        // The @keyframeanimation is supported.
                        // Do not call this anymore for the whole tree
                        // traversal.
                        skip.add(animationName);
                        break;
                    }
                    throw err;
                }
            }
        }
        elem = treeWalker.nextNode();
    }
}

function massageWikipediaMarkup(document) {
    document.querySelectorAll('.thumbinner').forEach(e=>e.style.width='');
    // These "thumbs" with ".tright" are originally "float: right" but in column
    // layout, there's not much use of floating elements, because we strive
    // to make columns narrow, so there's not enough space for floating.
    // Further, they are located at the beginning of each section, which
    // is not ideal when they don't float right.
    // Hence, for ease now, float: right items are moved to the end of the
    // section they would originally float: right.
    // Also, in books, it's often that figures are at the end of a section,
    // CAUTION: This only needs to be good enough for the demo document,
    //          it will likely fail on other wikipedia articles.
    let selectorSectioningStuff = '#toc, h1, h2, h3';
    for(let tright of document.querySelectorAll('.thumb.tright')){
        let sibling = tright.nextElementSibling;
        while(sibling){
            if(sibling.matches(selectorSectioningStuff)) {
                tright.parentNode.insertBefore(tright, sibling);
                break;
            }
            sibling = sibling.nextElementSibling;
        }
    }
}

function main() {
    massageWikipediaMarkup(document);
    setDefaultFontSize(document);

    let runionTargetSelector = '.runify-01, .mw-parser-output';

    // FIXME: we should be able to use this with more than one element.
    //        as runion_01 is applied to all matching elements as well
    // FIXME:
    //      run this only always after runion_01 is finished!
    let runion01Elem = document.querySelector(runionTargetSelector)
      , skip = [
            /* skipSelector selects elements to skip*/
            '.hatnote, #toc, h1, h2, h3, ul, ol, blockquote, table, .do-not-jsutify',
            /* skipClass: added to skipped elements */
            'skip-justify'
        ]
      , justificationController = new JustificationController(runion01Elem, skip)
      ;



    let userSettingsWidget = new WidgetsContainerWidget(
                    document.querySelector('.insert_user_settings'),
                    [
                        [PortalAugmentationWidget, justificationController],
                        UserPreferencesWidget
                    ]);
    let toggle = ()=>userSettingsWidget.toggle();
    for(let elem of document.querySelectorAll('.toggle-user_settings'))
        elem.addEventListener('click', toggle);


    // Must be executed on viewport changes as well as on userSettings
    // changes. User-Zoom changes should also trigger resize, so our own
    // user settings are most important here!
    var updateViewportScheduled
      , updateViewport = (evt)=>{
            if(updateViewportScheduled !== null) {
                clearTimeout(updateViewportScheduled);
                updateViewportScheduled = null;
            }
            // do not cancel on color-scheme change
            let  justificationWasRunning = justificationController.running;
            justificationController.cancel();
            // NOTE: '.mw-parser-output' is a very specialized guess for our case here!
            for(let elem of document.querySelectorAll(runionTargetSelector))
                runion_01(elem);
            fixCSSKeyframes(document);
            // only run if it is not paused by the user.
            if(justificationWasRunning)
                justificationController.run();
        }
      ;
    // This will most likely be executed by the USER_SETTINGS_EVENT handler
    // so here's a way to cancel this fail-safe initial call.
    updateViewportScheduled = setTimeout(updateViewport, 0);
    window.addEventListener('resize', updateViewport);
    window.addEventListener(USER_SETTINGS_EVENT, updateViewport);
}
window.onload = main;
