/* jshint browser: true, esversion: 9, laxcomma: true, laxbreak: true */
import DOMTool, {getElementSizesInPx} from '../../calibrate/js/domTool.mjs';
import WidgetsContainerWidget, {ID}  from './WidgetsContainerWidget.mjs';
import {JustificationController} from './justification.mjs';

class _ContainerWidget {
    constructor(baseElement) {
        this._baseElement = baseElement;
        this._domTool = new DOMTool(this._baseElement.ownerDocument);
        this._collectedChanges = null;
        this._widgetsById = null;
        this._widgets = null;
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
        for(let conf of widgetsConfig) {
            if(typeof conf === 'string') {
                this._domTool.appendHTML(this._widgetsContainer, conf);
                continue;
            }
            let [Ctor, ...args] = conf;
            let widget = new Ctor(this._domTool, this._widgetsContainer, ...args);
            // could do activate/close with these, but it's not yet necessary
            widgets.push(widget);
        }
        return widgets;
    }
    getWidgetById(id) {
        if(!this._widgetsById){
            this._widgetsById = new Map();
            for(let widget of this._widgets) {
                if(!(ID in widget))
                    continue;
                if(this._widgetsById.has(widget[ID]))
                    throw new Error(`Widget-ID already in use: ${widget[ID]}`);
                this._widgetsById.set(widget[ID], widget);
            }
        }
        let widget = this._widgetsById.get(id);
        if(!widget)
            throw new Error(`KeyError getWidgetById not found: ${id}`);
        return widget;
    }
    activate () {
        for(let widget of this._widgets)
            if(widget.activate)
                widget.activate();
    }
}

// TODO/MAYBE/nice to have: As a way to speed up perceived
// justification: while justifying: pick the next paragraph from all
// unjustified paragraphs by how close it is to the viewport.

const CHECKBOX_TEMPLATE = `
    <label class="{klass} {extra-classes}">{label}:
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

        if(ID in templateVars)
            this[ID] = templateVars[ID];

        let _templateVars = [...Object.entries(templateVars)];

        _templateVars.push(['*button style*', buttonStyle ? '<span></span>' : '']);
        _templateVars.push(['*checked*', checked ? 'checked' : '']);

        for(let [k,v] of _templateVars)
            template = template.replaceAll('{' + k + '}', v);
        {
            let frag = this._domTool.createFragmentFromHTML(template);
            this.container.appendChild(frag);
        }
        this._localStorageKey = localStorageKey;
        // parent change propagation
        this._onChange = onChange;
        this._elem = this.container.querySelector(`.${templateVars.klass} input[type="checkbox"]`);
        {
            let onChange = evt=> {
                    this._domTool.window.localStorage.setItem(localStorageKey,
                                    evt.target.checked ? 'true' : 'false');
                    this._onChange(evt.target.checked);
                }
              ;
            let storedValue = this._domTool.window.localStorage.getItem(localStorageKey)
              ;
            if(storedValue !== null)
                this._elem.checked = storedValue === 'true' ? true : false;

            this._elem.addEventListener('change', onChange);
            onChange({target: this._elem});
        }
    }
    setChecked(checked) {
        this._elem.checked = checked;
        _dispatchChangeEvent(this._elem);
    }
}

const SIMPLE_LABEL_TEMPLATE = `
    <{tag} class="{klass}">{text}</{tag}>
`;

class SimpleLabelWidget {
    constructor(domTool, container, templateVars) {
        this._domTool = domTool;
        this.container = container;
        var template = SIMPLE_LABEL_TEMPLATE;

        if(ID in templateVars)
            this[ID] = templateVars[ID];

        for(let [k,v] of Object.entries(templateVars)) {
            if(k === 'text')
                // see below: this.setText(templateVars.text)
                continue;
            template = template.replaceAll('{' + k + '}', v);
        }
        {
            let frag = this._domTool.createFragmentFromHTML(template);
            this.container.appendChild(frag);
        }
        this._elem = container.querySelector(`${templateVars.tag}.${templateVars.klass}`);
        this.setText(templateVars.text);
    }
    setText(text) {
        this._elem.textContent = text;
    }
}

const SIMPLE_BUTTON_TEMPLATE = `<button class="{klass}">{text}</button>`;
class SimpleButtonWidget {
    constructor(domTool, container, templateVars, onClick) {
        this._domTool = domTool;
        this.container = container;
        var template = SIMPLE_BUTTON_TEMPLATE;

        for(let [k,v] of Object.entries(templateVars))
            template = template.replaceAll('{' + k + '}', v);
        {
            let frag = this._domTool.createFragmentFromHTML(template);
            this.container.appendChild(frag);
        }
        this._onClick = onClick;
        {
            let elem = this.container.querySelector(`button.${templateVars.klass}`);
            elem.addEventListener('click', ()=>this._onClick());
        }
    }
}


const ARTICLE_URL_TEMPLATE = `
    <legend>Load Wikipedia Article</legend>
    <form>
    <!-- The reason to ask for a URL and not just a subdomain + pagename
        is that the URL can be copied directly from Wikipedia. I believe
        this will be the primary or at least initial interaction process.
    -->
    <input class="article_url-text_input"
        type="text"
        value=""
        title="Enter a Wikipedia article URL"
        placeholder="https://en.wikipedia.org/wiki/Typography"/>
    <div class="article_url-loading_status"></div>
    <button class="article_url-load">load</button><br />
    <form>
`;

class ArticleURLWidget {
    constructor(baseElement, templateVars, updateAfterChangedContent, state) {
        this._baseElement = baseElement;
        this._domTool = new DOMTool(this._baseElement.ownerDocument);

        this._updateAfterChangedContent = updateAfterChangedContent;

        if(ID in templateVars)
            this[ID] = templateVars[ID];

        var template = ARTICLE_URL_TEMPLATE;
        {
            // TODO: _templateVars in case when templateVars needs augmentation, remove?
            let _templateVars = [...Object.entries(templateVars || {})];
            for(let [k,v] of _templateVars)
                template = template.replaceAll('{' + k + '}', v);
        }
        var dom = this._domTool.createElementfromHTML(
            'fieldset', {'class': 'article_url'},
            template
        );
        this.container = dom;
        this._baseElement.appendChild(dom);

        this._input = this.container.querySelector('input');
        // Using a form here may be against the HTML nesting rules
        // (it's here contained within a fieldset), but using the submit
        // event directly is very handy it e.g. triggers when pressing
        // enter when the cursor is in the text input element and also
        // when pressing the load button.
        this._form = this.container.querySelector('form');
        this._form.addEventListener('submit', evt=>{
            evt.preventDefault();
            this.load();
        });
        this._loadingStatus = this.container.querySelector('.article_url-loading_status');

        if(state) {
            this.setLoadingStatus(state.state || null);
            if(state.input)
                this._input.value = state.input;
        }
        // So far, don't do local Storage.
    }
    load() {
        let requestURL = this._input.value;
        if(requestURL.indexOf('://') === -1)
            // Add a protocol, we always use https, so we don't require
            // the user to specify it, but it will also come with a URL
            // copy pasted from the browser address bar.
            requestURL = `https://${requestURL}`;

        let [validates, message, parsed] = validateWikiURL(window, requestURL, false);
        if(!validates) {
            this.setLoadingStatus(message.join(' '));
            return false;
        }
        this.fetchWikiPage(parsed);
    }
    get state() {
        return {
            state: this._loadingStatus.textContent
          , input: this._input.value
        };
    }
    // Only used for errors/problems so far.
    setLoadingStatus(message) {
        this._loadingStatus.textContent = message || '';
    }
    fetchWikiPage(parsed) {
        return fetchWikiPage(window, parsed)
        .then(
            fetched=> {
                // success
                applyWikiPage(window, fetched);
                // -> set this._input value!
                this._input.value = `https://${fetched.subDomain}.wikipedia.org/wiki/${fetched.page}`;
                this.setLoadingStatus(null);
                this._updateAfterChangedContent();
            },
            err=>this.setLoadingStatus(`[${err.name}] ${err.message}`)
        );
    }
}


const MIN_MAX_SLIDER_TEMPLATE = `
<div class="{klass}">
    <span class="like_a_label">{label}:</span><br />
    <span class="like_a_label">min</span>
    <input class="{klass}-min_slider" data-role="set-min" type="range" step="{step}" min="{min}" max="{max}" value="{minValue}""/>
    <input class="{klass}-min_number" data-role="set-min" type="number" min="{min}" max="{max}" value="{minValue}" />
    (default:&nbsp;{minDefault})<br />

    <span class="like_a_label">max</span>
    <input class="{klass}-max_slider" data-role="set-max" type="range" step="{step}" min="{min}" max="{max}" value="{maxValue}""/>
    <input class="{klass}-max_number" data-role="set-max" type="number" min="{min}" max="{max}" value="{maxValue}" />
    (default:&nbsp;{maxDefault})<br />
    <span class="like_a_label">actual value:</span>&nbsp;<span class="{klass}-actual_value">{actualValue}</span><br />
    <button class="{klass}-reset">reset</button>
</div>
`;

class MinMaxSliderWidget {
    constructor(domTool, container, templateVars, getActualValue, localStorageKey, onChange) {
        this._domTool = domTool;
        this.container = container;
        this._templateVars = templateVars;
        this._getActualValue = getActualValue;
        var template = MIN_MAX_SLIDER_TEMPLATE;

        if(ID in templateVars)
            this[ID] = templateVars[ID];

        for(let [k,v] of Object.entries(templateVars))
            template = template.replaceAll('{' + k + '}', v);
        {
            let frag = this._domTool.createFragmentFromHTML(template);
            this.container.appendChild(frag);
        }

        this._localStorageKey = localStorageKey;
        this._onChange = onChange;
        {
            let onInput = (evt, dispatchAnyways)=> {
                    let target = evt && evt.target
                      , role = target && target.getAttribute('data-role')
                      , oldMin, oldMax
                      ;

                    for(let elem of this._minInputs) {
                        if(target && elem === target) continue;
                        oldMin = parseFloat(elem.value);
                        break;
                    }
                    for(let elem of this._maxInputs) {
                        if(target && elem === target) continue;
                        oldMax = parseFloat(elem.value);
                        break;
                    }
                    let min = oldMin
                      , max = oldMax
                      ;

                    if(role === 'set-min') {
                        min = Math.min(templateVars.max, Math.max(templateVars.min, parseFloat(target.value)));
                        max = Math.max(max, min);
                    }
                    else if(role === 'set-max') {
                        max = Math.min(templateVars.max, Math.max(templateVars.min, parseFloat(target.value)));
                        min = Math.min(max, min);
                    }

                    for(let elem of this._minInputs)
                        elem.value = min;
                    for(let elem of this._maxInputs)
                        elem.value = max;

                    //if(this._localStorageKey)
                    //    this._domTool.window.localStorage.setItem(this._localStorageKey, target.value);

                    if(dispatchAnyways || oldMin !== min || oldMax !==max)
                        this._onChange(min, max);
                }
              ;

            let allInputs = this.container.querySelectorAll(`.${templateVars.klass} input`);
            this._minInputs = [];
            this._maxInputs = [];
            for(let input of allInputs) {
                let role = input.getAttribute('data-role');
                if(role === 'set-min')
                    this._minInputs.push(input);
                else if(role === 'set-max')
                    this._maxInputs.push(input);
                else continue;
                // The text/number inputs should not fire while typing,
                // hence onChange, while the sliders may fire on each
                // movement, hence onInput.
                input.addEventListener(input.type === 'range' ? 'input' : 'change', onInput);
            }

            let reset = this.container.querySelector(`.${templateVars.klass}-reset`);
            reset.addEventListener('click', ()=>{
                for(let elem of this._minInputs)
                    elem.value = templateVars.minDefault;
                for(let elem of this._maxInputs)
                    elem.value = templateVars.maxDefault;
                onInput(null, true);
            });

            //
            //var storedValue = null;
            //if(this._localStorageKey)
            //    storedValue = this._domTool.window.localStorage.getItem(this._localStorageKey);
            //if(storedValue !== null)
            //    elem.value = storedValue;
            //
           //elem.addEventListener('input', onInput);
           //elem.addEventListener('change', onChange);
           //reset.addEventListener('click', ()=>{
           //    elem.value = templateVars.value;
           //    _dispatchChangeEvent(elem);
           //});
           //onChange({target: elem});
        }
    }
    displayActualValue (value) {
        for(let elem of this.container.querySelectorAll(`.${this._templateVars.klass}-actual_value`))
            elem.textContent = value;
    }
    activate () {
        this.displayActualValue(this._getActualValue());
    }
}

const GRADE_DARK_MODE_LOCAL_STORAGE_KEY = 'varla-varfo-grade-dark-mode'
    , AMPLIFY_GRADE_LOCAL_STORAGE_KEY = 'varla-varfo-grade-amplify'
    , JUSTIFICATION_ACTIVE_STORAGE_KEY = 'varla-varfo-justification-active'
    , LINE_COLOR_CODING_STORAGE_KEY = 'varla-varfo-line-color-coding'
    , JUSTIFICATION_OPTION_XTRA_STORAGE_KEY = 'varla-varfo-justification-option-XTRA'
    , JUSTIFICATION_OPTION_LETTERSPACING_STORAGE_KEY = 'varla-varfo-justification-option-letterspacing'
    , JUSTIFICATION_OPTION_WORDSPACING_STORAGE_KEY = 'varla-varfo-justification-option-wordspacing'
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
    constructor(baseElement, justificationController, columnConfig,
                    getCurrentLineHeightInPercent, recalculateLineHeight) {
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
            // Line-height algorithm manipuation
            // TODO: it would be propper cool to have a single min-max slider
            // between 100 % and 200 %
            [    MinMaxSliderWidget, {
                      klass: `${klass}-line_height`
                    , label: 'Line-Height (in % of font-size)'
                    , [ID]: 'line-height'
                    , min: 100
                    , max: 200
                    , step: 1
                    , minValue: parseInt(columnConfig.minLineHeight * 100, 10)
                    , maxValue: parseInt(columnConfig.maxLineHeight * 100, 10)
                    , actualValue: getCurrentLineHeightInPercent()
                    , minDefault: parseInt(columnConfig.minLineHeight * 100, 10)
                    , maxDefault: parseInt(columnConfig.maxLineHeight * 100, 10)
                },
                getCurrentLineHeightInPercent, // getActualValue needed onActivate
                null, /*local storage key*/
                // on change
                (min, max)=>{
                    recalculateLineHeight(min / 100, max / 100);
                    this.getWidgetById('line-height')
                        .displayActualValue(getCurrentLineHeightInPercent());
                }
            ],
            '<hr />',
            // [checkbox] play/pause justification
            [   CheckboxWidget, {
                      klass: `${klass}-run_justification_checkbox`
                    , label: 'Justification'
                    , [ID]: 'justificationRunning'
                },
                true, /* checked: bool */
                true, /* buttonStyle: bool */
                JUSTIFICATION_ACTIVE_STORAGE_KEY,
                (isOn)=> {
                    this._justificationController.setRunning(isOn);
                }
            ],
            [   SimpleLabelWidget, {
                      klass: `${klass}-reset-justification`
                    , text: ''
                    , tag: 'span'
                    , [ID]: 'justify-status'
                },
            ],
            '<br />',
            // [checkbox] turn on/off line-color-coding default:on
            [   CheckboxWidget, {
                      klass: `${klass}-toggle_line_color_coding`
                    , label: 'Line&nbsp;Color-Coding'
                },
                true, /* checked: bool */
                false, /* buttonStyle: bool */
                LINE_COLOR_CODING_STORAGE_KEY,
                (isOn)=> {
                    let action = isOn ? 'add' : 'remove';
                    this._domTool.documentElement.classList[action]('color-coded-lines');
                }
            ],
            '<h3>Justification Options:</h3>',
            [   CheckboxWidget, {
                      klass: `${klass}-justification_use_xtra`
                    ,'extra-classes': `${klass}-justification_option`
                    , label: 'Use XTRA'
                },
                true, /* checked: bool */
                false, /* buttonStyle: bool */
                JUSTIFICATION_OPTION_XTRA_STORAGE_KEY,
                (isOn)=> {
                    this._justificationController.setOption('XTRA', isOn);
                }
            ],
            [   CheckboxWidget, {
                      klass: `${klass}-justification_use_letter-spacing`
                    , 'extra-classes': `${klass}-justification_option`
                    , label: 'Use Letter-Spacing'
                },
                true, /* checked: bool */
                false, /* buttonStyle: bool */
                JUSTIFICATION_OPTION_LETTERSPACING_STORAGE_KEY,
                (isOn)=> {
                    this._justificationController.setOption('letterSpacing', isOn);
                }
            ],
            [   CheckboxWidget, {
                      klass: `${klass}-justification_use_word-spacing`
                    , 'extra-classes': `${klass}-justification_option`
                    , label: 'Use Word-Spacing'
                },
                true, /* checked: bool */
                false, /* buttonStyle: bool */
                JUSTIFICATION_OPTION_WORDSPACING_STORAGE_KEY,
                (isOn)=> {
                    this._justificationController.setOption('wordSpacing', isOn);
                }
            ],
            '<br / >',
            [   SimpleButtonWidget, {
                      klass: `${klass}-reset-justification`
                    , text: 'reset'
                },
                () => {
                    if(this._justificationController.running)
                        this._justificationController.restart();
                    else
                        this._justificationController.cancel();

                    this.getWidgetById('justificationRunning')
                        .setChecked(this._justificationController.running);
                }
            ],
            '<hr />',
            // [checkbox] grade in dark-mode: on/off default: on
            [   CheckboxWidget, {
                      klass: `${klass}-switch_grade_checkbox`
                    , label: 'Grade (in Dark Color Scheme)'
                },
                true, /* checked: bool */
                true, /* buttonStyle: bool */
                GRADE_DARK_MODE_LOCAL_STORAGE_KEY,
                (isOn)=> {
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
        {
            let justifyStatus = this.getWidgetById('justify-status');
            this._justificationController.addStatusReporter(status=>justifyStatus.setText(status));
        }
    }
}

function _dispatchChangeEvent(elem) {
    let evt = document.createEvent("HTMLEvents");
    evt.initEvent("change", false, true);
    elem.dispatchEvent(evt);
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
                _dispatchChangeEvent(elem);
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
      , fontSizePT = getElementFontSizePt(root) //  * 0.875 <- match wikipedia but the hack is bad at this point, do in CSS!
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


      // These _MIN... and _MAX... constants are used at different
      // positions in the actual COLUMN_CONFIG data.
const _MIN_LINE_LENGTH_EN = 33
    , _MAX_LINE_LENGTH_EN = 65
    ;
export const COLUMN_CONFIG = {
        en: {
            // at minimal line length === 1
            // at maximal line length === 1.2
            // otherwise inbetween.
            // never smaller than 1
            // As long as we don't adjust YTRA min should be 5% that's 1 + 0.05.
            //
            // used as default for now
            // as a factor of font-size, actual value relative positioned to line-length
            // as shorter lines require shorter line-height.
            minLineHeight: 1.1
          , maxLineHeight: 1.3
            // Kind of a duplicate, could be calculated from
            // the "columns" setting.
          , minLineLength: _MIN_LINE_LENGTH_EN
          , maxLineLength: _MAX_LINE_LENGTH_EN
          , columns:[
                /* This will likely be dependent on the locale!
                 * index 0 == columns 1
                 * [minLineLength, maxLineLength, columnGap] in en
                 * NOTE: for columnGap, it could be just 1em (2en, default in CSS),
                 * but also for wider columns it can (and probably should) be wider.
                 * Since 2 columns are more likely to be wider, I added a bit.
                 * Otherwise, it would be good to have a better informed rule for that
                 * as well, but it will be hard to calculate within this algorithm as
                 * it is.
                 */
                [ 0, _MAX_LINE_LENGTH_EN, 0]  // 1
              , [_MIN_LINE_LENGTH_EN, _MAX_LINE_LENGTH_EN, 3] // 2
              , [_MIN_LINE_LENGTH_EN, 50, 2.5] // 3
              , [_MIN_LINE_LENGTH_EN, 40, 2] // 4
            ]
        }
    }
    ;



function _runion_01_columns(columnConfig, availableWidthEn) {
    // TODO: Could be cool to configure the unknowns via the testing rig.
    // Would need to reach into the window, could, for that matter, also
    // be done by the user-settings dialogue however, this is not meant
    // to be an end-user-facing setting, just a tool to get the algorithm
    // dialed in.

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

function _runion_01_lineHeight ({minLineHeight, maxLineHeight,
                          minLineLength, maxLineLength}, lineLengthEn) {
    const lineLengthPos = lineLengthEn-minLineLength
        , lineLengthRange = maxLineLength - minLineLength
        , ratio = lineLengthPos/lineLengthRange
        , raw = minLineHeight + ((maxLineHeight-minLineHeight) * ratio)
        ;
    return Math.min(maxLineHeight, Math.max(minLineHeight, raw));
}


// FIXME: Bad practices implementation :-(
//       * knows too much about how the ui for setting line height works
//       * duplicates logic from runion_01
//       * takes advantage of several css custom properties (maybe that's ok?)
//   >>> * should be a method of a new runion controller
function _runion_01_recalculateLineHeight(columnConfig, elem, min, max) {

    let lineLengthEn = parseFloat(elem.style.getPropertyValue('--column-width-en'))
      , newColumnConfig = {
            minLineHeight: min
          , maxLineHeight: max
          , minLineLength: columnConfig.minLineLength
          , maxLineLength: columnConfig.maxLineLength
        }
      ;
    let lineHeight = _runion_01_lineHeight(newColumnConfig, lineLengthEn);
    // should be a method!
    elem.style.setProperty('--line-height', `${lineHeight}`);
}

// Characters per line runion
function runion_01 (columnConfig, elem) {
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
                    paddingRightEn] = _runion_01_columns(columnConfig.columns, availableWidthEn)
      , lineHeight = _runion_01_lineHeight(columnConfig, lineLengthEn)
      ;

    elem.style.setProperty('--column-count', `${columns}`);
    elem.style.setProperty('--column-gap-en', `${columnGapEn}`);
    elem.style.setProperty('--column-width-en', `${lineLengthEn}`);
    elem.style.setProperty('--padding-left-en', `${paddingLeftEn}`);
    elem.style.setProperty('--padding-right-en', `${paddingRightEn}`);

    // TODO: this is subject of the line-height fine-tuning UI
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

function massageWikipediaMarkup(documentOrElement) {
    documentOrElement.querySelectorAll('.thumbinner').forEach(e=>e.style.width='');
    (documentOrElement.body || documentOrElement).querySelectorAll('style').forEach(e=>e.remove());

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
    for(let tright of documentOrElement.querySelectorAll('.thumb.tright')){
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

function wikiLinkClickHandler({window}, logger, evt) {
    let a = evt.target.closest('a');
    if(!a) return false;

    let [validates, message, parsed] = validateWikiURL(window, a.href, true);
    if(!validates) {
        logger.log(...message);
        return false;
    }
    // link is accepted.
    evt.preventDefault();
    evt.stopImmediatePropagation();
    return parsed;
}

function validateWikiURL({document, location}, urlString, allowLocal) {
    let wikiURL = new URL(urlString)
      , parsed = null
      // the api subdomain is not necessarily the same as the value of
      // the lang attribute value, e.g.:
      //    "zh-min-nan.wikipedia.org" produces a lang attribute of just "nan".
      , subDomain = null
      ;

    // allowLocal === true is used for handling links that got clicked
    // in the page body, but not not for direct user input.
    if(allowLocal && location.hostname === wikiURL.hostname) {
        // for links with the same hostname we get e.g.:
        // http://192.168.178.24:8080/wiki/Altgriechische_Sprache
        // this has neither an ".wikipedia.org" based hostname, nor a subdomain!
        // -> this selector has the proper subdomain
        // 'head link[rel="edit"]'
        // e.g. https://en.wikipedia.org/w/index.php?title=Typography&action=edit
        if(document.documentElement.hasAttribute('data-wikipedia-subdomain')){
            // we set this when applying a fetched article
            subDomain = document.documentElement.getAttribute('data-wikipedia-subdomain');
        }
        else {
            // Initially there's no explicitly set subdomain.
            // Let's go fishing!
            let link = document.querySelector('head > link[rel="edit"]')
              , url = new URL(link && link.getAtrribute('href') || '')
              ;
            subDomain = url.hostname.split('.')[0];
        }
        if(!subDomain)
            return [false, ['[validateWikiURL] can\'t figure api sub domain.'], parsed];
    }
    else if(wikiURL.hostname.endsWith('.wikipedia.org')) {
        // These URLs usually come from the languages category links.
        let hostnameParts = wikiURL.hostname.split('.');
        if(hostnameParts.length !== 3) {
            return [false, ['[validateWikiURL] too many sub domains', ...hostnameParts.slice(0, -2)], parsed];
        }
        subDomain = hostnameParts[0];
    }
    else {
        return [false, ['[validateWikiURL] unhandled domain:', wikiURL.hostname], parsed];
    }

    const wikiPath = '/wiki/';
    if(wikiURL.pathname.indexOf(wikiPath) !== 0) {
        return [false, ['[validateWikiURL] unhandled path-name:', wikiURL.pathname], parsed];
    }

    parsed = {
        page: decodeURIComponent(wikiURL.pathname.slice(wikiPath.length)).trim()
      , subDomain: subDomain
    };

    return [true, null, parsed];
}

async function fetchWikiPage({URL, URLSearchParams, fetch, window}, {subDomain, page}) {
    // API:
    // https://en.wikipedia.org/w/api.php
    // e.g.: https://en.wikipedia.org/w/api.php?action=help&recursivesubmodules=1
    // https://en.wikipedia.org/w/api.php?action=query&titles=Belgrade&prop=extracts&format=json&exintro=1
    var searchParams = new URLSearchParams({
            format: 'json'
          , origin: '*' // mediawiki CORS magic, THANKS!!!
          // We can get the language links for the page from the query action:
          //        https://en.wikipedia.org/w/api.php?action=help&modules=query
          //        prop: '2Blanglinks'
          //        see: https://en.wikipedia.org/w/api.php?action=help&modules=query%2Blanglinks
          // , action: 'query'
          // , prop: 'extracts'
          // , titles: 'Belgrade'
          , action: 'parse'
          , prop: 'text|headhtml'
          , formatversion: 2
          , page: page
        })
      , url
      ;
    searchParams.sort();
    // construct url because we likely serve from location.hostname
    // which is e.g. https://graphicore.github.io/ or localhost:8080
    url = new URL('w/api.php', `https://${subDomain}.wikipedia.org/`);
    url.search = searchParams;

    let response;
    try {
        response = await fetch(url);
    }
    catch (e) {
        if(e instanceof TypeError) {
            // Sadly, if I enter a wrong subdomain, console reports e.g.
            // main.mjs:1143 GET https://xxxx.wikipedia.org/w/api.php[...] net::ERR_NAME_NOT_RESOLVED
            // But that is not reported in the response object.
            // So this is for that very special case, to improve the feedback
            // to the user.
            throw new Error(`${e}. This happens e.g. when the subdomain `
                           + `(here: "${subDomain}") can't be resolved.`);
        }
        // re-raise, will be reported
        throw e;
    }

    if(!response.ok)
        throw new Error(`[fetch failed] ${response.status} ${response.status} `
                       + `${response.statusText}`);


    let data = await response.json();
    if(data.error) {
        // Handle error documents returned from the API here.
        // data.error.code e.g. "missingtitle"
        // data.error.info e.g. "The page you specified doesn't exist."
        throw new Error(`[${data.error.code}] for page "${page}" in `
                      + `${subDomain}.wikipedia.org: ${data.error.info}`);
    }
    return {page, subDomain, data};
}

function applyWikiPage({document}, {subDomain, data}) {
    let domTool = new DOMTool(document)
      , currentLang = document.documentElement.getAttribute('lang')
        // it doesn't come with closing tags ...
      , headHtml = `${data.parse.headhtml}</body></html>`
        // the fragment parser does not return the <html> element
      , domParser = new DOMParser()
      , doc = domParser.parseFromString(headHtml, 'text/html')
      , fetchedLang = doc.querySelector('html').getAttribute('lang')
      , frag = domTool.createFragmentFromHTML(data.parse.text)
      , target = document.querySelector('.mw-parser-output')
      , h1 = document.querySelector('h1')
      ;

    // at this point all content must be good
    document.documentElement.setAttribute('data-wikipedia-subdomain', subDomain);
    h1.textContent = data.parse.title;
    target.replaceWith(...frag.children);
    target = document.querySelector('.mw-parser-output');
    massageWikipediaMarkup(target);
    if(fetchedLang !== currentLang) {
        // TODO: changing the "dir" attribute and changing the layout
        // to rtl direction is not supported yet. However, we don't have
        // fonts for those cases yet as well.
        for(let elem of document.querySelectorAll(
                // Some elements have a different language as their content
                // and hence set lang, e.g. a word in an <em> in Greek also,
                // wikipedia links that change language have a hreflang
                // attribute.
                `[lang=${currentLang}]:not(a[hreflang],p *, i, span, em, b, strong)`)) {
            elem.setAttribute('lang', fetchedLang);
        }
    }
    return true;
}

export function main({columnConfig=COLUMN_CONFIG.en}) {
    massageWikipediaMarkup(document);
    setDefaultFontSize(document);

    let justificationController = null
      , userSettingsWidget = null
      , userSettingsWidgetContainer = document.querySelector('.insert_user_settings')
        // NOTE: '.mw-parser-output' is a very specialized guess for our case here!
      , runionTargetSelector = '.runify-01, .mw-parser-output'
      , justificationSkip = [
            /* skipSelector selects elements to skip*/
            '.hatnote, #toc, h1, h2, h3, ul, ol, blockquote, table, .do-not-jsutify',
            /* skipClass: added to skipped elements */
            'skip-justify'
       ]
      , toggleUserSettingsWidget = null
      , runion01Elem = null
      ;


    let initContent = () => {
        let articleURLWidgetState = null;
        if(justificationController !== null) {
            justificationController.destroy();
            justificationController = null;
        }
        if(userSettingsWidget !== null) {
            // carry over
            articleURLWidgetState = userSettingsWidget.getWidgetById('article-url').state;
            userSettingsWidget.destroy();
            userSettingsWidget = null;
        }
        // FIXME: we must be able to use this with more than one element.
        //        as runion_01 is applied to all matching elements as well
        runion01Elem = document.querySelector(runionTargetSelector);

        // FIXME:
        //      run justificationController only always after runion_01 is finished!
        justificationController = new JustificationController(runion01Elem, justificationSkip);

        let recalculateLineHeight = (min, max) => _runion_01_recalculateLineHeight(columnConfig, runion01Elem, min, max)
          , getCurrentLineHeightInPercent = ()=> {
              return (parseFloat(runion01Elem.style.getPropertyValue('--line-height')) * 100).toFixed(2);
          }
          ;

        userSettingsWidget = new WidgetsContainerWidget(
                        userSettingsWidgetContainer,
                        [
                            [ArticleURLWidget,
                                    {[ID]: 'article-url'},
                                    updateAfterChangedContent,
                                    articleURLWidgetState],
                            [PortalAugmentationWidget,
                                    justificationController,
                                    columnConfig,
                                    getCurrentLineHeightInPercent,
                                    recalculateLineHeight],
                            UserPreferencesWidget
                        ]);
        let toggle = (/*evt*/)=>{
            let top = `${window.scrollY}px`;
            if(!userSettingsWidget.isActive ||
                    top === userSettingsWidget.container.style.getPropertyValue('top'))
                // If it is active and in view we turn if off.
                userSettingsWidget.toggle();

            if(userSettingsWidget.isActive)
                userSettingsWidget.container.style.setProperty('top', top);
        };
        for(let elem of document.querySelectorAll('.toggle-user_settings')) {
            if(toggleUserSettingsWidget !== null) {
                elem.removeEventListener('click', toggleUserSettingsWidget);
            }
            elem.addEventListener('click', toggle);
        }
        toggleUserSettingsWidget = toggle;
    };

    // Must be executed on viewport changes as well as on userSettings
    // changes. User-Zoom changes should also trigger resize, so our own
    // user settings are most important here!
    var updateViewportScheduled = null
      , scheduleUpdateViewport = (time)=> {
            if(updateViewportScheduled !== null) {
                clearTimeout(updateViewportScheduled);
            }
            updateViewportScheduled = setTimeout(updateViewport,
                                    time !== undefined ? time : 100);
        }
        // TODO: this function should be part of the runion implementation,
        // rather than calling "runion_01(runion01Elem)". It's likely that
        // we'll have different runions on one page.
      , updateViewport = (evt)=>{
            let cancelJustification = true
                // Don't cancel justification when color mode changes
                // it's not supposed to change layout at all. However
                // there may be subtle line-length differences due to
                // grade, but insignificant.
              , keepJustificationState = new Set(['color-scheme'])
              ;
            if(evt && evt.type === 'user-settings') {
                if(evt.detail) {
                    cancelJustification = false;
                    // all sub events in detail must be in keepJustificationState
                    for(let [subEventType, ] of evt.detail) {
                        if(!keepJustificationState.has(subEventType)){
                            cancelJustification = true;
                            break;
                        }
                    }
                }
            }

            if(updateViewportScheduled !== null) {
                clearTimeout(updateViewportScheduled);
                updateViewportScheduled = null;
            }
            // do not cancel on color-scheme change
            let  justificationWasRunning = justificationController.running;
            if(cancelJustification)
                justificationController.cancel();
            // CAUTION: this only sets a few CSS-variables, it will always
            // come to same conclusion, **if the view port parameters
            // did not change.** The heuristic whether to cancelJustification
            // and then re-run it seems a bit brittle anyways.
            runion_01(columnConfig, runion01Elem);
            fixCSSKeyframes(document);
            // only run if it is not paused by the user.
            if(cancelJustification && justificationWasRunning)
                justificationController.run();
        }
      , updateAfterChangedContent = ()=>{
            initContent();
            // This will most likely be executed by the USER_SETTINGS_EVENT handler
            // so here's a way to cancel this fail-safe initial call.
            scheduleUpdateViewport();
        }
      ;

    updateAfterChangedContent();
    // FIXME: resize is currently only interesting when the width of
    // the page changes, height can change more often (open the debugger,
    // OSsses may change height to make room for the main toolbar when in
    // fullscreen and the mouse touches the upper/lower screen edge,
    // iOS increases the address bar when scrolled into zoom etc ...
    window.addEventListener('resize', scheduleUpdateViewport);
    window.addEventListener(USER_SETTINGS_EVENT, updateViewport);

    window.document.addEventListener('click', evt=>{
        let parsed = wikiLinkClickHandler(window, window.console, evt);
        if(!parsed)
            return false;
        // This way, the URL will be displayed in the
        // "Load Wikipedia Article" widget.
        return userSettingsWidget.getWidgetById('article-url').fetchWikiPage(parsed);
     } , false);
}

