/* jshint browser: true, esversion: 9, laxcomma: true, laxbreak: true */
import {getElementSizesInPx, getComputedStyle, getComputedPropertyValues
                                } from '../../calibrate/js/domTool.mjs';
import WidgetsContainerWidget, {ID}  from './WidgetsContainerWidget.mjs';
import {JustificationController, parseFontVariationSettings} from './justification.mjs';

class _ContainerWidget {
    constructor(domTool, baseElement) {
        this._baseElement = baseElement;
        this._domTool = domTool;
        this._collectedChanges = null;
        this._widgetsById = null;
        this._widgets = null;
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
            if(typeof conf.nodeType === 'number') {
                this._domTool.appendChildren(this._widgetsContainer, conf);
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
    reset () {
        for(let widget of this._widgets) {
            if(widget.reset)
                widget.reset();
        }
    }
}

// TODO/MAYBE/nice to have: As a way to speed up perceived
// justification: while justifying: pick the next paragraph from all
// unjustified paragraphs by how close it is to the viewport.

const CHECKBOX_TEMPLATE = `
    <label class="{klass} {extra-classes}">{label}:
        <input type="checkbox" {*checked*}/>
        {*button style*}
    </label>
`;

class CheckboxWidget {
    constructor(domTool, container, templateVars, checked, buttonStyle,
                localStorageKey, onChange) {
        this._domTool = domTool;
        this.container = container;
        this._defaultChecked = checked;
        var template = CHECKBOX_TEMPLATE;

        if(ID in templateVars)
            this[ID] = templateVars[ID];

        let _templateVars = [...Object.entries(templateVars)];

        _templateVars.push(['*button style*', buttonStyle ? '<span></span>' : '']);
        _templateVars.push(['*checked*', this._defaultChecked ? 'checked="checked"' : '']);
        if(!('extra-classes' in templateVars))
            _templateVars.push(['extra-classes', '']);
        for(let [k,v] of _templateVars)
            template = template.replaceAll('{' + k + '}', v);
        {
            let frag = this._domTool.createFragmentFromHTML(template);
            this._elem = frag.querySelector(`.${templateVars.klass} input[type="checkbox"]`);
            this._rootElem = frag.querySelector(`.${templateVars.klass}`);
            this.container.appendChild(frag);
        }
        this._localStorageKey = localStorageKey;
        // parent change propagation
        this._onChange = onChange;

        {
            let onChange = evt=> {
                    if(this._localStorageKey)
                        this._domTool.window.localStorage.setItem(this._localStorageKey,
                                    evt.target.checked ? 'true' : 'false');
                    this._onChange(evt.target.checked);
                }
              ;
            let storedValue = null;
            if(this._localStorageKey)
                storedValue = this._domTool.window.localStorage.getItem(this._localStorageKey);

            if(storedValue !== null)
                this._elem.checked = storedValue === 'true' ? true : false;

            this._elem.addEventListener('change', onChange);
            onChange({target: this._elem});
        }
    }
    get root() {
        return this._rootElem;
    }
    setChecked(checked) {
        this._elem.checked = checked;
        _dispatchChangeEvent(this._elem);
    }
    get checked() {
        return this._elem.checked;
    }
    set checked(checked) {
        this.setChecked(checked);
    }
    reset() {
        this.setChecked(this._defaultChecked);
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

            let inputHandler = (evt)=>this._inputHandler(evt, false);
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
                input.addEventListener(input.type === 'range' ? 'input' : 'change', inputHandler);
            }
            this.container.querySelector(`.${templateVars.klass}-reset`)
                            .addEventListener('click', ()=>this.reset());

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
    _inputHandler (evt, dispatchAnyways) {
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
            min = Math.min(this._templateVars.max, Math.max(this._templateVars.min, parseFloat(target.value)));
            max = Math.max(max, min);
        }
        else if(role === 'set-max') {
            max = Math.min(this._templateVars.max, Math.max(this._templateVars.min, parseFloat(target.value)));
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
    reset() {
        for(let elem of this._minInputs)
            elem.value = this._templateVars.minDefault;
        for(let elem of this._maxInputs)
            elem.value = this._templateVars.maxDefault;
        this._inputHandler(null, true);
    }
}

const GRADE_DARK_MODE_LOCAL_STORAGE_KEY = 'varla-varfo-grade-dark-mode'
    , AMPLIFY_GRADE_LOCAL_STORAGE_KEY = 'varla-varfo-grade-amplify'
    , JUSTIFICATION_ACTIVE_STORAGE_KEY = 'varla-varfo-justification-active'
    , LINE_COLOR_CODING_STORAGE_KEY = 'varla-varfo-line-color-coding'
    , JUSTIFICATION_OPTION_XTRA_STORAGE_KEY = 'varla-varfo-justification-option-XTRA'
    , JUSTIFICATION_OPTION_LETTERSPACING_STORAGE_KEY = 'varla-varfo-justification-option-letterspacing'
    , JUSTIFICATION_OPTION_WORDSPACING_STORAGE_KEY = 'varla-varfo-justification-option-wordspacing'
    , SWITCH_FONT_STYLES_STORAGE_KEY = 'varla-varfo-switch-font-styles'
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
    constructor(domTool, baseElement, id, targetElement, justificationController
                , defaults // currently olnly used for CheckboxWidget
                , columnConfig
                , getCurrentLineHeightInPercent, recalculateLineHeight) {
        super(domTool, baseElement);
        if(id)
            this[ID] = id;
        this._targetElement = targetElement;
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

        function _getDefault(key, notDefDefaultValue) {
            return key in defaults ? defaults[key] : notDefDefaultValue;
        }

        let resetJustification = () => {
            if(this._justificationController.running)
                this._justificationController.restart();
            else
                this._justificationController.cancel();

            // on initialization this is not possible
            if(this._widgets !== null)
                this.getWidgetById('justificationRunning')
                    .setChecked(this._justificationController.running);
        };

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
            // [checkbox] font-switcheroo
            [
               CheckboxWidget, {
                      klass: `${klass}-switch-font-styles`
                    , label: 'Switch Font Styles'
                },
                false, /* checked: bool */
                false, /* buttonStyle: bool */
                SWITCH_FONT_STYLES_STORAGE_KEY,
                (isOn)=> {
                    let action = isOn ? 'add' : 'remove';
                    this._targetElement.classList[action]('switched-fonts');
                    resetJustification();
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
                _getDefault('lineColorCoding', true), /* default checked: bool */
                false, /* buttonStyle: bool */
                LINE_COLOR_CODING_STORAGE_KEY,
                (isOn)=> {
                    let action = isOn ? 'add' : 'remove';
                    this._targetElement.classList[action]('color-coded-lines');
                }
            ],
            '<h3>Justification Options:</h3>',
            [   CheckboxWidget, {
                      klass: `${klass}-justification_use_xtra`
                    ,'extra-classes': `${klass}-justification_option`
                    , label: 'Use XTRA'
                },
                _getDefault('useXTRA', true), /* checked: bool */
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
                _getDefault('useLetterSpacing', true), /* checked: bool */
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
                _getDefault('useWordSpacing', true), /* checked: bool */
                false, /* buttonStyle: bool */
                JUSTIFICATION_OPTION_WORDSPACING_STORAGE_KEY,
                (isOn)=> {
                    this._justificationController.setOption('wordSpacing', isOn);
                }
            ],
            '<br / >',
            [   SimpleButtonWidget, {
                      klass: `${klass}-reset-justification`
                    , text: 'reset justification'
                },
                resetJustification
            ],
            '<hr />',
            // [checkbox] grade in dark-mode: on/off default: on
            [   CheckboxWidget, {
                      klass: `${klass}-switch_grade_checkbox`
                    , label: 'Grade (in Dark Color Scheme)'
                },
                _getDefault('useGrade', true), /* checked: bool */
                true, /* buttonStyle: bool */
                GRADE_DARK_MODE_LOCAL_STORAGE_KEY,
                (isOn)=> {
                    let value = isOn ?  '1' : '0';
                    this._targetElement.style.setProperty(
                                                '--toggle-grade', value);
                }
            ],
            [   SliderWidget, this._targetElement, {
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
    let evt = elem.ownerDocument.createEvent("HTMLEvents");
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
    constructor(domTool, container, targetElement, templateVars, localStorageKey,
                                            customProperty, onChange) {
        this._domTool = domTool;
        this.container = container;
        this._targetElement = targetElement;
        var template = SLIDER_TEMPLATE;
        this._defaultValue = templateVars.value;

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
                    this._targetElement.style.setProperty(
                                                customProperty, evt.target.value);
                    this._domTool.window.localStorage.setItem(localStorageKey, evt.target.value);
                    this._onChange(evt.target.value);
                    onInput(evt);
                }
              ;

            this._inputElem = this.container.querySelector(`.${templateVars.klass} input[type="range"]`);
            {
                let storedValue = this._domTool.window.localStorage.getItem(localStorageKey);
                if(storedValue !== null)
                    this._inputElem.value = storedValue;
            }
            this._inputElem.addEventListener('input', onInput);
            this._inputElem.addEventListener('change', onChange);

            this.container.querySelector(`.${templateVars.klass}-reset`)
                          .addEventListener('click', ()=>this.reset());

            onChange({target: this._inputElem});
        }
    }
    reset() {
        this._inputElem.value = this._defaultValue;
        _dispatchChangeEvent(this._inputElem);
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
    constructor(domTool, container, targetElement, templateVars, localStorageKey,
                                    rootNodeClassTemplate, onChange) {
        this._domTool = domTool;
        this.container = container;
        this._targetElement = targetElement;
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
          ;
        if(checkedInput.value === 'default') {
            for(let mode of ['light', 'dark'])
                this._targetElement.classList.remove(this._rootNodeClassTemplate.replace('{schemeName}',mode));
        }
        else {
            let mode = checkedInput.value
              , otherMode = mode === 'light' ? 'dark' : 'light'
              ;
            localStorageValue = mode;

            this._targetElement.classList.remove(
                this._rootNodeClassTemplate.replace('{schemeName}',otherMode));
            this._targetElement.classList.add(
                this._rootNodeClassTemplate.replace('{schemeName}',mode));
        }
        // "default" will delete the entry
        this._domTool.window.localStorage.setItem(this._localStorageKey, localStorageValue);
        this._onChange(localStorageValue);
    }
    reset() {
        let defaultCheckedItem = this._root.querySelector(`input[value="default"]`);
        defaultCheckedItem.checked = true;
        this._setColorScheme();
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
    constructor(domTool, baseElement, targetElement, handleUserSettingsChange) {
        super(domTool, baseElement);
        this._targetElement = targetElement;
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
            [   SliderWidget, this._targetElement, {
                      klass: `${klass}-fine_user_zoom`
                    , label: 'Fine&nbsp;Zoom'
                    , min: '-4'
                    , max: '4'
                    , value: '0.00'
                    , step: '.01'
                },
                FINE_USER_ZOOM_LOCAL_STORAGE_KEY, '--fine-user-zoom',
                (v)=>handleUserSettingsChange('fine-user-zoom', v)
            ],
            [   ColorSchemeWidget, this._targetElement, {
                      klass: `${klass}-color_scheme`
                    , label: 'Color&nbsp;Scheme'
                },
                COLOR_SCHEME_LOCAL_STORAGE_KEY, 'explicit-{schemeName}-mode',
                (v)=>handleUserSettingsChange('color-scheme', v)
            ],
            /* SLIDER +- 4PT  in 0.01 steps
             * 10 inch -> 1pt change
             * I'll use 25cm -> 1pt change as metric units suit me better
             * we may have to localize this!
             */
            [   SliderWidget, this._targetElement, {
                      klass: `${klass}-user_distance`
                    , label: 'Relative&nbsp;Distance'
                    , min: '-200'  // - 2 meters
                    , max: '500' // + 5 meters
                    , value: '0'
                    , step: '25'
                },
                USER_DISTANCE_LOCAL_STORAGE_KEY, '--user-distance-cm',
                (v)=>handleUserSettingsChange('user-distance', v)
            ],

        ];

        this._widgets = this._initWidgets(widgetsConfig);
    }
}

// FIXME: import from justification.mjs (which doesn't export this yet)
const JUSTIFICATION_CONTEXT_BLOCK_CLASS = 'justification-context-block';
const INSPECTOR_TEMPLATE = `
<fieldset>
    <legend>Inspect</legend>
    <!-- insert: widgets -->
</fieldset>
`;
const INSPECTION_MODE_CLASS = 'varla_varfo-font_spec_inspector'
    , INSPECTION_MODE_BEACON_CLASS = `${INSPECTION_MODE_CLASS}-beacon`
    ;
class InspectorWidget extends _ContainerWidget {
    constructor(domTool, baseElement, targetElement, skipSelector='') {
        super(domTool, baseElement);
        this._targetElement = targetElement;
        this._skipSelector = skipSelector;
        var klass = this._class = 'inspector';
        var dom = this._domTool.createElementfromHTML(
            'div', {'class': klass},
            INSPECTOR_TEMPLATE
        );
        this._reportContainer = this._domTool.createElement('ul'
                                    , {'class': `${klass}-report_container`});

        this.container = dom;
        this._baseElement.appendChild(dom);
        this._widgetsContainer = this._domTool.createElement('div');
        this._domTool.insertAtMarkerComment(this.container,
                            'insert: widgets', this._widgetsContainer);


        var widgetsConfig = [
            //switch to turn on/off selection tool
            // [checkbox] play/pause justification
            [   CheckboxWidget, {
                      klass: `${klass}-toggle_selection_tool`
                    , label: 'Inspect element'
                    , [ID]: 'inspect-element-toggle'
                },
                false, /* checked: bool */
                true, /* buttonStyle: bool */
                undefined,
                (isOn)=> {
                    // actually the indicator should listen/subscribe
                    // to changes on the this._targetElement about this!
                    this._targetElement.classList[isOn ? 'add':'remove'](INSPECTION_MODE_CLASS);

                }
            ],
            [   SimpleButtonWidget, {
                      klass: `${klass}-reset`
                    , text: 'reset'
                },
                () => this.reset()
            ],
            this._reportContainer

            // when inspection in ON we need to listen to click events
            // from the content window and filter elements to see if
            // and what we want to display of them.

            //first Observer:
            //    -> when .inspector-toggle_selection_tool is added
            //        -> document catch and interrupt all click events
            //        -> if user settings widget is hidden, bring it up
            //          (and/or bring it by???),
            //           and scroll the reporting container into view
            //        -> report event.target to here ...


            // Elements that don't apply should be reported as well, so
            // that we can see the tool is responsive, however the report
            // would differ.
            // When stuff changes, it would be nice to have the tool change
            // as well, though, if a line is lost, we can't track it until
            // it re-appears, a new version of the line would be another
            // line anyways, often with other contents etc. but tracking
            // is not a high priority!

          // [maybe: switch inspection display modes/type of information shown]
          // display to show inspection values


        ];
        this._inspectionIsOn  = false;

        let targetWindow = this._targetElement.ownerDocument.defaultView;
        // used to unregister the click Event
        this._abortController = null;

        this._toggleObserver = new targetWindow.MutationObserver(
                                this._toggleObserverCallback.bind(this));
        this._toggleObserver.observe(this._targetElement,
                                { attributes: true });
        this._beaconObserver = new targetWindow.MutationObserver(
                                this._beaconObserverCallback.bind(this));
        this._beaconObserver.observe(this._targetElement,
                                { subtree: true, childList: true
                                , attributeFilter: ['class', 'style']});

        this._widgets = this._initWidgets(widgetsConfig);
        this._toggleSwitch = this.getWidgetById('inspect-element-toggle');
        // stays of unless the default is changed above.
        this._toggleInspectionMode();
    }
    _toggleObserverCallback (mutationRecords) {
        for(let rec of mutationRecords) {
            if(rec.type === 'attributes' && rec.attributeName === 'class') {
                this._toggleInspectionMode();
                break;
            }
        }
    }
    _beaconObserverCallback (mutationRecords) {
        // Determine wheather to update the inspector report.
        // console.log('_beaconObserverCallback', mutationRecords.length);
        let reportNeedsUpdate = false
          , reason = '(not set)'
          , beacon = this._targetElement.ownerDocument.querySelector(
                `:not(.${JUSTIFICATION_CONTEXT_BLOCK_CLASS}) .${INSPECTION_MODE_BEACON_CLASS}`)
          ;
        RECORDS:
        for( let rec of mutationRecords) {
            if(rec.target.closest(`.${JUSTIFICATION_CONTEXT_BLOCK_CLASS}`)) {
                // Target is in/itself the justification in progress element, ignore!
                continue;
            }

            if(rec.type === 'attributes') {
                if(beacon && rec.target.contains(beacon)){
                    reportNeedsUpdate = true;
                    reason = `attribute changed: ${rec.attributeName}`;
                    break RECORDS;
                }
            }
            else if(rec.type !== 'childList') {
                console.warn(`UNHANDLED rec.type ${rec.type} in _`
                            + `beaconObserverCallback not childList`, rec);
                continue;
            }

            // using :scope prevents that the selector also matches when
            // target is e.g. the <article> but beacon is much deeper in
            // the structure, which is rather not interesting in the "childList"
            // case. But time will tell.
            let b_con = rec.target.querySelector(`:scope > .${INSPECTION_MODE_BEACON_CLASS}`);
            if(b_con) {
                // Detects the justification reset case.
                // Unfortunately this fires a bit too often, e.g.
                // when justification.mjs calls _getWordSpaceForElement
                // (look in rec at textNodes added or removed with a content
                // of "] ["). It also fires often before the other
                // tighter defined cases below and partly shadows those.
                // TODO: this is not perfect, but good enough for now.
                reportNeedsUpdate = true;
                reason = 'looks like reset';
                break RECORDS;
            }

            if(rec.target.closest(this._skipSelector) !== null)
                continue;
            for(let node of rec.addedNodes) {
                if(node.nodeType !== node.ELEMENT_NODE)
                    continue;
                if(node.classList.contains(JUSTIFICATION_CONTEXT_BLOCK_CLASS))
                    // don't report for the justificaton in progress element
                    continue;

                if(!node.classList.contains(INSPECTION_MODE_BEACON_CLASS))
                    // the node is not the beacon
                    continue;
                // The added node is the beacon.
                // This always requires updating the report:
                //      on initial insert and on move
                reportNeedsUpdate = true;
                reason = 'initial insert or move';
                break RECORDS;
            }
            for(let node of rec.removedNodes) {
                if(node.nodeType !== node.ELEMENT_NODE)
                    continue;
                if(node.classList.contains(JUSTIFICATION_CONTEXT_BLOCK_CLASS))
                    continue;
                if(!node.classList.contains(INSPECTION_MODE_BEACON_CLASS))
                    continue;
                // The removed node was the beacon.
                // This always requires updating the report:
                //      on removal and on move
                reportNeedsUpdate = true;
                reason = 'removal or move';
                break RECORDS;
            }
        }
        if(!reportNeedsUpdate)
            return;
        // console.warn('>>>> REPORT NEEDS UPDATE', reason);
        this._updateReport();
    }
    createtReport(elem) {
        // runion functional elements hiearchy stack
        let stack = [
            'runion-line'
          , 'runion-justification-host' // defining a .line_handling_mode-{name}
          , 'runion-01'
        ];

        let result = [];

        let current = elem
          , found = new Map()
          ;

        for(let class_ of stack) {
            ancestors:
            while(current) {
                if(current.classList.contains(class_)) {
                    // => identified for class class
                    found.set(class_, current);
                    // will look at current again for next class
                    // because elements can have double role, e.g.
                    // 'runion-justification-host' can also be a 'runion-01'
                    break ancestors;
                }
                current = current.parentElement;
            }
            if(!current)
                if(found.size)
                    break;
                // reset to search for next class
                current = elem;
        }
        let mkfrac = (htmlOrChildren)=> typeof htmlOrChildren === 'string'
                        ? this._domTool.createFragmentFromHTML(htmlOrChildren)
                        : this._domTool.createFragment(htmlOrChildren)
          , mkelem = (tag, htmlOrChildren, attr)=>this._domTool.createElement(
                        tag, attr, typeof htmlOrChildren === 'string'
                                                ? mkfrac(htmlOrChildren)
                                                : htmlOrChildren)
          , mkData = (label, content)=>mkelem('span'
                    , [mkelem('span', label, {'class': `${this._class}-report_data-label`})
                        , ': ', content]
                    , {'class': `${this._class}-report_data-line`}
            )
          , roundTo = (decimaldigits, num) => {
                let scale = 10 ** decimaldigits;
                return Math.round(num * scale) / scale ;
            }
          , round2 = num=>roundTo(2, num)
          , mkSizePt = (label, sizePt, dpr, rem)=>mkData(label, mkfrac([
                mkelem('span', `${round2(sizePt)} pt`, {title:
                                    `${round2(sizePt * 4/3)} px`
                                  + `, ${round2(sizePt * 4/3 * dpr)} device-px`
                                  + (typeof rem === 'number'
                                        ?   `, ${sizePt / rem} rem`
                                        : '')
                                })
            ]))
          , mkSizeEn = (label, sizeEn, rem)=>mkData(label, mkfrac([
                mkelem('span', `${round2(sizeEn)} en`, {title:
                                    `${round2(sizeEn / 2)} em`
                                  + `, ${round2(sizeEn / 2 * rem)} pt`
                                  + `, ${round2(sizeEn / 2 * rem * 4/3)} px`
                                })
            ]))
          , mkTag = elem=>`<${elem.localName}${(elem.classList.length ? ' class="' + elem.classList + '"' : '')}>`
          , mkElement = elem=>mkfrac([mkData('tag', elem.localName)
                , ...(elem.classList.length
                        ? [mkData(elem.classList.length === 1
                                        ? 'class'
                                        : 'classes', elem.classList)]
                        : [])
            ])
            // Will return NaN for undefined and unparseable values, but e.g
            // 12px will be parsed as a 12, discarding the "px".
          , getPropertiesAsNumber=(elem, ...properties)=>getComputedPropertyValues(elem, ...properties).map(parseFloat)
          , reports = []
          , reporters = new Map([
                // for all reporters: elem may be undefined!
                [undefined, (elem/*, type*/)=>
                    mkfrac(
                      `<em>NOT IMPLEMENTED</em> `
                      + (elem
                            ? `on element ${mkTag(elem)}`
                            : 'without element.')
                    )
                ]
              , ['global', (elem, {devicePixelRatio}/*, type*/)=>{
                    // elem should be <html>/document.defaultView
                    let fontSizePt = parseFloat(elem.style
                            .getPropertyValue('--default-browser-font-size'));

                    return mkfrac([
                        mkSizePt('browser font size', fontSizePt, devicePixelRatio)
                      , mkData('devicePixelRatio', devicePixelRatio)
                    ]);
                }]
              , ['document', (elem, {devicePixelRatio, documentFontSize}/*, type*/)=>{
                    // elem should be <html>/document.defaultView
                    return mkfrac([
                        mkSizePt('document font size (= 1 rem)', documentFontSize, devicePixelRatio, documentFontSize)
                    ]);
                }]
              , ['runion-01', (elem, {documentFontSize}/*, type*/)=>{
                return mkfrac([
                    mkElement(elem)
                  , mkData('column-count', `${elem.style.getPropertyValue('--column-count')} em`)
                  , ...[
                        ['--column-gap-en', 'column gap/gutter']
                      , ['--column-width-en', 'line width']
                      , ['--padding-left-en', 'padding left']
                      , ['--padding-right-en', 'padding right']
                   ].map(([propName, label])=>mkSizeEn(label, parseFloat(
                                elem.style.getPropertyValue(propName)),
                                documentFontSize))
                  , mkData('line-height', `${elem.style.getPropertyValue('--js-line-height')} em`)
                ]);
                }]
              , ['runion-justification-host', (elem/*, {documentFontSize}*//*, type*/)=>{
                    // line_handling_mode-{class}

                let [fontSizePx] = getPropertiesAsNumber(elem, 'font-size')
                  , wordSpaceSize = elem.style.getPropertyValue('--word-space-size')
                  , hasOwnWordSpaceSize = wordSpaceSize !== ''
                  , wordSpaceSizePx = parseFloat(wordSpaceSize)
                  , lineAdjust = new Map()
                  ;
                for(let propName of elem.style) {
                    if(!propName.startsWith('--line-adjust-')) continue;
                    // --line-adjust-step-xtra: 1.08333;
                    // --line-adjust-xtra-min: 460.667;
                    // --line-adjust-xtra-default: 468;
                    // --line-adjust-xtra-max: 472.333;
                    let [key, val] = propName.split('-').slice(4, 6);
                    if(key === 'step')
                        // step is special, could be fixed.
                        // [key, val] = [val, key];
                        // but we don't need to report the step-size.
                        continue;

                    if(!lineAdjust.has(key))
                        lineAdjust.set(key, {});
                    lineAdjust.get(key)[val] = elem.style.getPropertyValue(propName);
                }

                let lineHandlingMode;
                for(let klass of elem.classList) {
                    let prefix = 'line_handling_mode-';
                    if(!klass.startsWith(prefix)) continue;
                    lineHandlingMode = klass.slice(prefix.length);
                    break;
                }
                return mkfrac([
                    mkElement(elem)
                  , mkData('line handling mode', lineHandlingMode)
                  , ...(hasOwnWordSpaceSize ? [
                        mkData('measured word space size',
                                `${roundTo(5, wordSpaceSizePx/fontSizePx)} `
                                + `em, ${roundTo(5, wordSpaceSizePx)} px`)
                    ] : [])
                  , mkData('line adjustment ranges (min, default, max)', mkelem('dl',
                            Array.from(lineAdjust.entries())
                                .map(([dt, dd])=>
                                    mkfrac([mkelem('dt', dt),
                                    mkelem('dd', `${roundTo(5, dd.min)}, ${roundTo(5, dd.default)}, ${roundTo(5, dd.max)}`)])
                            )
                     ))
                    // calling it steps in the UI, as it's also --line-adjust-step
                  , mkData('line adjustment steps/range',
                        elem.style.getPropertyValue('--info-line-adjust-stops').replaceAll('"', ''))
                ]);
                }]
              , ['runion-line', (elem/*, {devicePixelRatio, documentFontSize}*//*, type*/)=>{
                  // TODO: get resulting calculated values ...

                // These need maintenance if anything is added
                // Chrome does not give us custom property names
                // in the calculated style, in that case we could look
                // for the dynamic prefix...
                let style = getComputedStyle(elem)
                  , dynamicProps = []
                  , calculatedResults
                  ;
                for(let propName of [ '--dynamic-letter-space'
                                    , '--dynamic-word-space'
                                    , '--dynamic-font-xtra'
                                    , '--dynamic-font-width']){

                    let val = style.getPropertyValue(propName);
                    if(val === '' || val === 'initial') continue;
                    dynamicProps.push([propName, val]);
                }
                // The values look like e.g.:
                //      clamp( -0.0866667, calc( 0 + 2.25 * 0.0383333), 0.153333 )
                // We are going to use font-variation-settings to get the
                // results of these formulas.
                // CSS.registerProperty() or @property would solve this,
                // and getComputedStyle would return the solved values,
                // but these are not yet available in Firefox and Safari.
                if(dynamicProps.length) {
                    let prop = [];
                    for(let i=0, l=dynamicProps.length; i<l; i++) {
                        let propKey = `XXX${i}`.slice(-4)
                          , [, val] = dynamicProps[i]
                          ;
                        dynamicProps[i].push(propKey);
                        // e.g.: "XXX0"  clamp( -0.0866667, calc( 0 + 2.25 * 0.0383333), 0.153333 )
                        prop.push(`"${propKey}" ${val}`);
                    }
                    let calculator = this._domTool.createElement('span',
                                    {style: `font-variation-settings: ${prop.join(', ')}`});
                    // must be in the document
                    this._reportContainer.appendChild(calculator);
                    // font-variation-settings is charming
                    calculatedResults = parseFontVariationSettings(
                            getComputedStyle(calculator)
                            .getPropertyValue('font-variation-settings'));
                    calculator.remove();
                }
                return mkfrac([
                    mkElement(elem)
                  , mkData('line adjustment step', elem.style.getPropertyValue('--line-adjust-step'))
                  , ...dynamicProps.map(([name, ,propKey])=>mkData(
                                        name.slice('--dynamic-'.length).replace('-', ' ')
                                      , calculatedResults.get(propKey)))
                ]);
                }]
              , ['clicked', (elem, {devicePixelRatio, documentFontSize}/*, type*/)=>{
                    let style = getComputedStyle(elem)
                      , fontVariations = parseFontVariationSettings(
                            style.getPropertyValue('font-variation-settings'))

                      , [fontSizePx, lineHeightPx, letterSpacing, wordSpacing
                            ] = getPropertiesAsNumber(elem
                                                        , 'font-size'
                                                        , 'line-height'
                                                        , 'letter-spacing'
                                                        , 'word-spacing')
                      ;
                    //  same as font-size in PT and only there for debugging, non-functional.
                    fontVariations.delete('VVFS');

                    return mkfrac([
                      mkElement(elem)
                    , mkData('font family', style.getPropertyValue('font-family'))
                    , mkData('font style',
                            fontVariations.get('slnt') !== 0
                                ? `slanted ${fontVariations.get('slnt')} deg`
                                : (style.getPropertyValue('font-style') === 'italic'
                                        ? 'italic'
                                        : 'normal/upright')
                      )
                    , mkSizePt('font size', fontSizePx * 0.75 , devicePixelRatio, documentFontSize)
                    , mkData('line-height ', `${round2(lineHeightPx/fontSizePx)} em`)
                    , mkData('letter-spacing', isNaN(letterSpacing)
                                    ? style.getPropertyValue('letter-spacing')
                                    : `${roundTo(5, letterSpacing/fontSizePx)} em`)
                    , mkData('word-spacing', `${roundTo(5, wordSpacing/fontSizePx)} em`)
                    , mkData('font-variation-settings', mkelem('dl',
                                    Array.from(fontVariations.entries())
                                         .map(([dt, dd])=>
                                            mkfrac([mkelem('dt', dt), mkelem('dd', dd)])
                                    )
                     ))
                    ]);
                }]
            ])
          , key2label = {'global': 'global/browser defaults'}
          , report=(type, element, shared)=>reports.push([
                mkelem('li',[
                    mkfrac(`<strong class="${this._class}-report_heading">${key2label[type] || type}</strong>`)
                  , reporters.get(reporters.has(type) ? type : undefined)
                                 (element, shared, type)
                ])
            ])
          ;
        {
            let reportedInitialElement
              , doc = elem.ownerDocument
              , win = doc.defaultView
              , htmlElem = doc.documentElement
              , shared = {
                    devicePixelRatio: win.devicePixelRatio
                  , documentFontSize: parseFloat(getComputedStyle(htmlElem)
                                        .getPropertyValue('font-size')
                                    ) * 0.75
                }
              ;

            report('clicked', elem, shared);

            for(let _class of stack) {
                if(!reportedInitialElement) {
                    // Start reporting after an intial element was found
                    // then also the missing of elements will be reported.
                    if(!found.has(_class)) continue;
                    reportedInitialElement = true;
                }
                report(_class, found.get(_class), shared);
            }
            report('document', htmlElem, shared);// "document" "controlled by us, applied to the complete document"
            report('global', htmlElem, shared); // "global defaults" "Controlled by the environment and browser."
            for(let report of reports.reverse())
                result.push(...report);
        }
        return result;
    }
    /**
     * CAUTION: This is based on a code example in the docs of
     * two **NON-STANDARD** but complementary methods in mdn:
     *      https://developer.mozilla.org/en-US/docs/Web/API/Document/caretRangeFromPoint
     *      https://developer.mozilla.org/en-US/docs/Web/API/Document/caretPositionFromPoint
     */
    _insertBeacon({clientX, clientY}) {
        let range, textNode, offset
          , document = this._targetElement.ownerDocument
          ;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(clientX, clientY);
            textNode = range.startContainer;
            offset = range.startOffset;
        }
        else if (document.caretPositionFromPoint) {
            range = document.caretPositionFromPoint(clientX, clientY);
            textNode = range.offsetNode;
            offset = range.offset;
        }
        else {
            //  TODO:This browser supports neither document.caretRangeFromPoint
            // nor document.caretPositionFromPoint. We should warn in the
            // inspector window that the info is not updated automatically!
            return;
        }
        // Only split and insert into TEXT_NODEs
        if (!textNode || textNode.nodeType !== 3)
            return;

        let newNode = textNode.splitText(offset)
          , beacon = document.createElement('span')
          ;
        beacon.classList.add(INSPECTION_MODE_BEACON_CLASS);
        textNode.parentNode.insertBefore(beacon, newNode);
        return beacon;
    }
    _removeBeacons() {
        for(let oldBeacon of this._targetElement.ownerDocument
                    .querySelectorAll(`.${INSPECTION_MODE_BEACON_CLASS}`))
            oldBeacon.remove();
    }
    _updateReport() {
        let beacon = this._targetElement.ownerDocument.querySelector(
                `:not(.${JUSTIFICATION_CONTEXT_BLOCK_CLASS}) .${INSPECTION_MODE_BEACON_CLASS}`)
         , elem = beacon && beacon.parentElement
         ;
        this._domTool.clear(this._reportContainer);
        if(elem)
            this._domTool.appendChildren(
                        this._reportContainer, this.createtReport(elem));
    }

    _clickHandler(evt) {
        // FIXME: Maybe, we want to exclude all of the widgets, also
        // when they are directly, stand alone version, in the content
        // window. However, these are also subject of e.g. opsz or grade
        // so it makes some sense to make the widgets inspectable as well,
        // then this "bug" would be a "feature".
        //
        // At least exclude the this._toggleSwitch from the prevent
        // default, so we can turn off inspection mode.
        // Actually, it's really counter intuitive to be able to select
        // and inspect all of the user controls.
        if(this._toggleSwitch.root ===  evt.target || this._toggleSwitch.root.contains(evt.target))
            return;
        if(evt.target.closest(this._skipSelector) !== null)
            return;
        if(evt.target.closest(`.${JUSTIFICATION_CONTEXT_BLOCK_CLASS}`) !== null)
            // don't apply in in progress element.
            return;

        // To be able to update the clicked "psoition" even after lines
        // markup etc. change, insert a marker "beacon" element.

        // First remove any old beacon(s):
        this._removeBeacons();
        // Plant the beacon, report creation will be trigered by the
        // mutation observer.
        this._insertBeacon(evt);
        evt.preventDefault();
        evt.stopPropagation();
    }

    _startClickHandling() {
        let doc = this._targetElement.ownerDocument;
        this._abortController = new doc.defaultView.AbortController();
        doc.addEventListener(
                'click'
              , (...args)=>this._clickHandler(...args)
              , {
                    capture: true
                  , signal: this._abortController.signal
                }
        );
        if(!this._toggleSwitch.checked)
            this._toggleSwitch.checked = true;
        this._inspectionIsOn = true;
    }
    _stopClickHandling() {
        this._abortController.abort();
        this._abortController = null;
        if(this._toggleSwitch.checked)
            this._toggleSwitch.checked = false;
        this._inspectionIsOn = false;
    }
    _toggleInspectionMode() {
        let isOn = this._targetElement.classList.contains(INSPECTION_MODE_CLASS);
        if(this._inspectionIsOn === isOn)
            return;
        if(isOn)
            this._startClickHandling();
        else
            this._stopClickHandling();
    }
    reset() {
        this._removeBeacons();
        this._stopClickHandling();
    }
    destroy () {
        this._toggleObserver.disconnect();
        this._beaconObserver.disconnect();
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
    root.style.setProperty('--default-browser-font-size', `${fontSizePT}`);
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
    elem.style.setProperty('--js-line-height', `${lineHeight}`);
}

// Characters per line runion
function runion_01 (columnConfig, elem) {
    // unsetting padding here, otherwise, we sometimes get wrong/in between
    // transitioning numbers from getELementLineWidthAndEmInPx when the
    // resizing was one big jump (at least from FireFox).
    elem.style.setProperty('--padding-left-en', 0);
    elem.style.setProperty('--padding-right-en', 0);
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
    elem.style.setProperty('--js-line-height', `${lineHeight}`);

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

function _fixGrade(elem, style, properties, stops, cache) {
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

    let [/*normalizedFontSize*/, propertyValues
                           ] = _interpolatePiecewise(stops, fontSizePt);

    return propertyValues;
}

function _fixCSSKeyframesByFontSize(elem, style, properties, stops /* , cache */) {
    // CAUTION: --sup-scale must be removed prior to calling this, but
    // it's done by the caller. This is because --sup-scale itself affects
    // font-size which must be the initial/original value when calculating these.
    for(let propertyName of properties)
        if(style.getPropertyValue(propertyName) !== '') {
            // the @keyframe animation is actually supported
            throw new IsSupported();
        }

    let fontSizePt = parseFloat(style.getPropertyValue('font-size')) * 0.75
      , [/*normalizedFontSize*/, propertyValues
                            ] = _interpolatePiecewise(stops, fontSizePt)
      ;
    return propertyValues;
}


function _fixCSSKeyframesByColumnWidth(elem, style, properties, stops /* , cache */) {
    for(let propertyName of properties)
        if(style.getPropertyValue(propertyName) !== '') {
            // the @keyframe animation is actually supported
            throw new IsSupported();
        }
    let columnWidth = parseFloat(style.getPropertyValue('--column-width-en'))
      , [/*normalizedColumnWidth*/, propertyValues
                            ] = _interpolatePiecewise(stops, columnWidth)
      ;
    return propertyValues;
}

function fixCSSKeyframes(document, cssKeyframeFixes) {
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
      , fixFunctions = {
            byColumnWidth: _fixCSSKeyframesByColumnWidth
          , byFontSize: _fixCSSKeyframesByFontSize
          , grade: _fixGrade
        }
      , cleanup = elem=> {
            for(let[, , properties] of cssKeyframeFixes)
                for(let propertyName of properties)
                    elem.style.removeProperty(propertyName);
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
        for(let [funcName, animationName, properties, stops] of cssKeyframeFixes) {
            let applyFixFunc= fixFunctions[funcName];
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
                    let propertyValues = applyFixFunc(elem, style, properties, stops, cache);
                    if(!Array.isArray(propertyValues))
                        // _fixGrade uses cache to return early if possible
                        continue;
                    for(let [i, propertyName] of properties.entries()) {
                        let propertyValue = propertyValues[i];
                        elem.style.setProperty(propertyName, propertyValue);
                    }
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


export function main(
                    contentWindow,
                    { /* inject */
                      massageMarkupFunc=null
                    , WikipediaArticleURLWidget=null
                    , defaults={}
                    },
                    { /* typeSpec */
                      columnConfig: columnConfigI18N
                    , cssKeyframeFixes
                    , justificationSpecs
                    , wdthJustificationSpecs
                    }
                    ) {

    let contentDocument = contentWindow.document
      , widgetHostWindow = contentWindow.parent && contentWindow.parent.isVarlaVarfoWidgetHost
                ? contentWindow.parent
                : contentWindow
      , widgetHostDocument = widgetHostWindow.document
      , widgetInParent = contentWindow !== widgetHostWindow
      // i18n is a stub
      , columnConfig = columnConfigI18N.en
      ;

    if(widgetInParent) {
        if(!widgetHostWindow.registerSettingsWidget)
            widgetHostWindow.registerSettingsWidget = [];
    }

    if(massageMarkupFunc)
        massageMarkupFunc(document);
    setDefaultFontSize(document);

    let justificationController = null
      , userSettingsWidget = null
      , userSettingsWidgetSelector = '.insert_user_settings'
      , toggleUserSettingsSelector = '.toggle-user_settings'
        // NOTE: '.mw-parser-output' is a very specialized guess for our case here!
      , runionTargetSelector = '.runify-01, .mw-parser-output'
      , justificationSkip = [
            /* skipSelector selects elements to skip*/
            '.hatnote, #toc, h3, ul, ol, table, .do-not-jsutify,figure>*:not(figcaption)',
            /* skipClass: added to skipped elements */
            'skip-justify'
       ]
      , toggleUserSettingsWidget = null
      , runion01Elem = null
      ;



    let initContent = () => {
        let userSettingsWidgetContainer = widgetHostDocument.querySelector(userSettingsWidgetSelector);
        if(!userSettingsWidgetContainer) {
            console.log('Demo is disabled: no userSettingsWidgetContainer.');
            return;
        }

        let wikipediaArticleURLWidgetState = null;
        if(justificationController !== null) {
            justificationController.destroy();
            justificationController = null;
        }
        if(userSettingsWidget !== null) {
            // carry over
            if(WikipediaArticleURLWidget)
                wikipediaArticleURLWidgetState = userSettingsWidget.getWidgetById('wikipedia-article-url').state;
            userSettingsWidget.destroy();
            userSettingsWidget = null;
        }
        // FIXME: we must be able to use this with more than one element.
        //        as runion_01 is applied to all matching elements as well
        runion01Elem = contentDocument.querySelector(runionTargetSelector);

        // FIXME:
        //      run justificationController only always after runion_01 is finished!
        justificationController = new JustificationController(
                      {justificationSpecs, wdthJustificationSpecs}
                    , runion01Elem
                    , justificationSkip
        );

        let recalculateLineHeight = (min, max) => _runion_01_recalculateLineHeight(columnConfig, runion01Elem, min, max)
          , getCurrentLineHeightInPercent = () => {
              return (parseFloat(runion01Elem.style.getPropertyValue('--js-line-height')) * 100).toFixed(2);
          }
          , _collectedChanges = []
          , handleUserSettingsChange = (type, value) => {
              // A simple debouncing scheme: This collects all events that
              // come in synchronously, usually right after initialization,
              // then dispatches all together asynchronously, using a generic
              // promise for the delay.
              if(_collectedChanges.length === 0) {
                  // dispatch async
                  Promise.resolve(true)
                  .then(()=>{
                      // this event will trigger scheduleUpdateViewport
                      var event = new CustomEvent(USER_SETTINGS_EVENT,
                              { detail: _collectedChanges.slice(), bubbles: true });
                      // reset
                      _collectedChanges.splice(0, _collectedChanges.length);
                      contentWindow.dispatchEvent(event);
                  });
              }
              _collectedChanges.push([type, value]);
          }
          ;

        userSettingsWidget = new WidgetsContainerWidget(
                        userSettingsWidgetContainer,
                        [
                            WikipediaArticleURLWidget
                                ? [WikipediaArticleURLWidget,
                                    {[ID]: 'wikipedia-article-url'},
                                    updateAfterChangedContent,
                                    wikipediaArticleURLWidgetState]
                                : null,
                            [PortalAugmentationWidget,
                                    'portal-augmentation',
                                    contentDocument.documentElement,
                                    justificationController,
                                    defaults,
                                    columnConfig,
                                    getCurrentLineHeightInPercent,
                                    recalculateLineHeight],
                            [UserPreferencesWidget,
                                    contentDocument.documentElement,
                                    handleUserSettingsChange],
                            [InspectorWidget,
                                    contentDocument.documentElement,
                                    `${userSettingsWidgetSelector}, ${toggleUserSettingsSelector}`],
                            [SimpleButtonWidget, {
                                          klass: `widgets_container-reset_all`
                                        , text: 'reset all'
                                    },
                                    () => {
                                        userSettingsWidget.reset();
                                    }
                                ],
                        ].filter(item=>!!item),
                        // Create a button to close the widget.
                        widgetInParent ? true : false
                    );

        if(widgetInParent) {
            // Don't show or activate the widget toggle button, will
            // be handled in parent window.
            for(let elem of document.querySelectorAll(toggleUserSettingsSelector)) {
                elem.style.setProperty('display', 'none');
            }
            widgetHostWindow.registerSettingsWidget.push(userSettingsWidget);
        }
        else {
            // Controls to bring the menu up when it's inline in the document.
            let toggle = (/*evt*/)=>{
                let top = `${contentWindow.scrollY}px`;
                if(!userSettingsWidget.isActive ||
                        top === userSettingsWidget.container.style.getPropertyValue('top'))
                    // If it is active and in view we turn if off.
                    userSettingsWidget.toggle();

                if(userSettingsWidget.isActive)
                    userSettingsWidget.container.style.setProperty('top', top);
            };
            for(let elem of document.querySelectorAll(toggleUserSettingsSelector)) {
                if(toggleUserSettingsWidget !== null) {
                    elem.removeEventListener('click', toggleUserSettingsWidget);
                }
                elem.addEventListener('click', toggle);
            }
            toggleUserSettingsWidget = toggle;
        }
    };

    // Must be executed on viewport changes as well as on userSettings
    // changes. User-Zoom changes should also trigger resize, so our own
    // user settings are most important here!
    var updateViewportScheduled = null
      , scheduleUpdateViewport = (time)=> {
            // If it is not paused updateViewport will start it again.
            justificationController.pause();
            if(updateViewportScheduled !== null) {
                clearTimeout(updateViewportScheduled);
            }
            updateViewportScheduled = setTimeout(updateViewport,
                                    time !== undefined ? time : 100);
        }
      , currentWindowWidth = contentWindow.innerWidth
      , resizeHandler = (/*evt*/)=>{
            // don't update when height changes, because it has no
            // implications on layout so far, and it doesn't work with
            // e.g. all browsers on the iPhone, where scrolling increases
            // the adress bar and triggers a resize event.
            if(currentWindowWidth !== contentWindow.innerWidth) {
                currentWindowWidth = contentWindow.innerWidth;
                scheduleUpdateViewport();
            }
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

            // do not cancel e.g. on color-scheme change
            if(cancelJustification)
                justificationController.cancel();
            // CAUTION: this only sets a few CSS-variables, it will always
            // come to same conclusion, **if the view port parameters
            // did not change.** The heuristic whether to cancelJustification
            // and then re-run it seems a bit brittle anyways.
            runion_01(columnConfig, runion01Elem);
            fixCSSKeyframes(document, cssKeyframeFixes);
            // only run if it is not paused by the user.
            if(userSettingsWidget.getWidgetById('portal-augmentation')
                                             .getWidgetById('justificationRunning')
                                             .checked)
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
    contentWindow.addEventListener('resize', resizeHandler);
    contentWindow.addEventListener(USER_SETTINGS_EVENT, scheduleUpdateViewport);

    if(WikipediaArticleURLWidget) {
        contentDocument.addEventListener('click',
            (evt)=> userSettingsWidget
                    .getWidgetById('wikipedia-article-url')
                    .windowClickHandler(evt)
        );
    }
    contentWindow.addEventListener('beforeunload',
                ()=>userSettingsWidget && userSettingsWidget.destroy());
}

