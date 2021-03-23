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


const FINE_USER_ZOOM_LOCAL_STORAGE_KEY = 'varla-varfo-fine-user-zoom';
const USER_PREFERENCES_TEMPLATE = `
<fieldset>
    <legend>User Preferences</legend>
    <label class="user_preferences-fine_user_zoom">Fine&nbsp;Zoom:
        <input type="range" min="-4" max="4" value="0.00" step=".01" />
    </label>
</fieldset>
`;

class UserPreferencesWidget{
    /* SLIDER +- 4PT  in 0.01 steps */
    constructor(baseElement) {
        this._baseElement = baseElement;
        this._domTool = new DOMTool(this._baseElement.ownerDocument);
        var dom = this._domTool.createElementfromHTML(
            'div', {'class': 'user_preferences'},
            USER_PREFERENCES_TEMPLATE
        );
        this.container = dom;
        this._baseElement.appendChild(dom);
        {
            let change = evt=>{
                evt.target.parentNode.setAttribute('data-value', evt.target.value);
                evt.target.ownerDocument.documentElement.style.setProperty('--fine-user-zoom', evt.target.value);
                this._domTool.window.localStorage.setItem(FINE_USER_ZOOM_LOCAL_STORAGE_KEY, evt.target.value);
            };

            let elem = this.container.querySelector('.user_preferences-fine_user_zoom input[type="range"]');
            var storedValue = this._domTool.window.localStorage.getItem(FINE_USER_ZOOM_LOCAL_STORAGE_KEY);
            if(storedValue !== null)
                elem.value = storedValue;

            elem.addEventListener('input', change);
            change({target: elem});
        }
    }
}

function main() {
    let userSettingsWidget = new WidgetsContainerWidget(
                    document.querySelector('.insert_user_settings'),
                    [
                        PortalAugmentationWidget,
                        UserPreferencesWidget
                    ]);
    for(let elem of document.querySelectorAll('.toggle-user_settings'))
        elem.addEventListener('click', ()=>userSettingsWidget.toggle());
}
window.onload = main;
