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

function _dispatchAsync(elem, name, value=null) {
    var event = new CustomEvent(name, { detail: value, bubbles: true });
    // dispatch async
    Promise.resolve(event)
        .then(event=>elem.dispatchEvent(event));
}

const SLIDER_TEMPLATE = `
    <label class="{klass}">{label}:
        <input type="range" min="{min}" max="{max}" value="{value}" step="{step}" />
    </label>
`;
class SliderWidget {
    constructor(domTool, container, templateVars, localStorageKey, customProperty) {
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
        {
            let onInput = evt=>{
                    evt.target.parentNode.setAttribute('data-value', evt.target.value);
                }
              , onChange = evt=> {
                    evt.target.ownerDocument.documentElement.style.setProperty(
                                                customProperty, evt.target.value);
                    this._domTool.window.localStorage.setItem(localStorageKey, evt.target.value);
                    // FIXME: should be configured, maybe even dispatched from parent!
                    _dispatchAsync(this._domTool.window, USER_SETTINGS_EVENT, customProperty);
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
    constructor(domTool, container, templateVars, localStorageKey, rootNodeClassTemplate) {
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
        // FIXME: should be configured, maybe even dispatched from parent!
        _dispatchAsync(this._domTool.window, USER_SETTINGS_EVENT, '--color-scheme');
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
                FINE_USER_ZOOM_LOCAL_STORAGE_KEY, '--fine-user-zoom'
            ],
            [   ColorSchemeWidget, {
                      klass: `${klass}-color_scheme`
                    , label: 'Color&nbsp;Scheme'
                },
                COLOR_SCHEME_LOCAL_STORAGE_KEY, 'explicit-{schemeName}-mode'
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
                USER_DISTANCE_LOCAL_STORAGE_KEY, '--user-distance-cm'
            ],

        ];

        this._widgets = [];
        for(let [Ctor, ...args] of widgetsConfig) {
            let widget = new Ctor(this._domTool, this._widgetsContainer, ...args);
            // could do activate/close with these, but it's not yet necessary
            this._widgets.push(widget);
        }
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

function runion_01 (elem) {
    // FIXME:
    // not sure where this applies actually, so I'll make this variable.
    //
    // When layout changes, this will re-run, hence a good start would
    // be to undo all changes that have been applied before.
    //
    // Could apply to:
    //
    //      all of the text:
    //              h1,h2,h3 markup (anything else likely as well)would be kept alive
    //              we could make some of these column-span h1, or h1+h2, or h1+h2+h3
    //              so, we'd need to select col-spanning elements and mark them up
    //              could be done in pure css or by js
    //
    // I'm not sure to which amount of text a "runion" aplies, or what it
    // is exactly. It's a "run of text" but i don't know how to determine
    // its start or end, so this would have to be configurable, too.
    //
    // A col-span element obviously ends a runion. Hence, a runion could
    // be all elements between col-span elements.
    // A runion could also be bigger than the screen, requiring scrolling
    // up and down, hence, a runion could end somewhere in between. We
    // could insert an empty/no-headline-just-margin col-span element in
    // between OR we could insert it within the runion and make the CSS
    // apply to to more than one screen of the same runion.
    //
    //
    // additionally, whatever counts as a runion, if its textContent length
    // is lower than 365, we'll mark it with a special, alarming, background
    // color, because it is not specified how to handle in the Runion 1 case:
    //      #shorter text strings later#
    //
    // Would be cool to configure the unknowns via the testing rig ...
    // would need to reach into the window.
    // Could, for that matter, also be done by the user-settings dialogue
    // however, this is not meant to be a end-user-facing setting, just a
    // tool to get the algorithm dialed in.

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

function main() {
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
    var updateViewport = (e)=>{
        //console.log('updateViewport', e && e.type || e + '', e && e.detail);
        // NOTE: '.mw-parser-output' is a very specialized guess for our case here!
        for(let elem of document.querySelectorAll('.runify-01, .mw-parser-output'))
            runion_01(elem);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener(USER_SETTINGS_EVENT, updateViewport);
}
window.onload = main;
