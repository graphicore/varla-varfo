/* jshint browser: true, esversion: 9, laxcomma: true, laxbreak: true */
import DOMTool from '../../calibrate/js/domTool.mjs';
import WidgetsContainerWidget from './WidgetsContainerWidget.mjs';

const PORTAL_PROPERTIES_TEMPLATE = `

<datalist id="portal_properties-px-sizes">
    <option value="1920" />
    <option value="1680" />
    <option value="1536" />
    <option value="1440" />
    <option value="1280" />
    <option value="1200" />
    <option value="1080" />
    <option value="1024" />
    <option value="960" />
    <option value="900" />
    <option value="800" />
    <option value="768" />
</datalist>

<fieldset>
    <legend>Portal Properties</legend>


    <p><label>Width:
        <input name="width"
               type="number"
               list="portal_properties-px-sizes"
               value="1024" min="300" step="1" /></label>
    </p>

    <p><label>Height:
        <input name="height"
               type="number"
               list="portal_properties-px-sizes"
               value="768" min="300" step="1" /></label>
    </p>

    <!-- <label>Unit: <select>
        <option value="px" selected>px</option>
        <option value="cm">cm</option>
        <option value="in">in</option>
    </select></label>
    -->
    <input name="unit" type="hidden" value="px" />

    <p>
    <label>Switch Orientation:
        <input class="portal_properties-set_orientation"
               type="checkbox"
               value="true" "/><span></span></label>
    </p>
</fieldset>
`;
/* We may not use this now */
class PortalPropertiesWidget {
    /* Set information about the portal that we can't determine yet ourselves. */
    constructor(baseElement, portalElement) {
        this._baseElement = baseElement;
        this._portalElement = portalElement;
        this._domTool = new DOMTool(this._baseElement.ownerDocument);
        var dom = this._domTool.createElementfromHTML(
            'div', {'class': 'portal_properties'},
            PORTAL_PROPERTIES_TEMPLATE
        );
        this.container = dom;
        this._baseElement.appendChild(dom);

        this._uiWidth = this.container.querySelector('input[name="width"]');
        this._uiHeight = this.container.querySelector('input[name="height"]');
        this._uiUnit = this.container.querySelector('input[name="unit"]');


        this._uiAllOrientation = this.container.querySelectorAll('input.portal_properties-set_orientation');

        {
            let setOrientation = (evt)=>this.setOrientation(evt.target.checked);
            for(let orientation of this._uiAllOrientation)
                orientation.addEventListener('click', setOrientation);
        }

        {
            let setSizes = ()=>this.setSizes();
            for(let size of [this._uiWidth , this._uiHeight])
                size.addEventListener('change', setSizes);
        }
    }

    setOrientation(setToPortrait) {
        let width = parseInt(this._uiWidth.value, 10)
         , height = parseInt(this._uiHeight.value, 10)
         , isPortrait = height >= width
         , needsSwap = setToPortrait !== isPortrait
         ;

        if(needsSwap)
            [this._uiWidth.value, this._uiHeight.value] = [
                            this._uiHeight.value, this._uiWidth.value];

        this.setSizes();
    }

    setSizes() {
        console.log('setSizes');
        let width = parseInt(this._uiWidth.value, 10)
          , height = parseInt(this._uiHeight.value, 10)
          , isPortrait = height >= width
          ;

        for(let orientation of this._uiAllOrientation)
            orientation.checked = isPortrait;

        this._portalElement.style.setProperty('width', `${this._uiWidth.value}${this._uiUnit.value}`);
        this._portalElement.style.setProperty('height', `${this._uiHeight.value}${this._uiUnit.value}`);
    }

    activate() {
        this.setSizes()
    }

}

function main() {
    let userSettingsWidget = new WidgetsContainerWidget(
                    document.querySelector('.insert_user_settings'),
                    [
                        [PortalPropertiesWidget, document.getElementById('testbed-subject')]
                    ],
                    true
                    );
    userSettingsWidget.activate();
}
window.onload = main;
