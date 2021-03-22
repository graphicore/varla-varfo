/* jshint browser: true, esversion: 9, laxcomma: true, laxbreak: true */
import DOMTool from '../../calibrate/js/domTool.mjs';

/* We may not use this now */
class PortalAugmentationWidget{
    /* Set information about the portal that we can't determine yet ourselves. */
    constructor(baseElement) {
        this._baseElement = baseElement;
        this._domTool = new DOMTool(this._baseElement.ownerDocument);
        var dom = this._domTool.createElementfromHTML(
            'div', {'class': 'portal_augmentation'},
            '<em>nothing yet</en>'
        );
        this.container = dom;
        this._baseElement.appendChild(dom);
    }
}

const USER_PREFERENCES_TEMPLATE = `
 <label>Fine Zoom: <input type="range" min="-4" max="4" value="0.00" step=".01" /></label>
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

        let change = evt=>evt.target.parentNode.setAttribute('data-value', evt.target.value);
        for(let elem of this.container.querySelectorAll('input[type="range"]')){
            console.log('???', elem);
            elem.addEventListener('input', change);
            change({target: elem});
        }
    }

}

const WIDGETS_CONTAINER_TEMPLATE = `
<!-- insert: child widgets -->
<button class="close">close</button>
`;

class WidgetsContainerWidget {
    constructor(baseElement, widgets) {
        this._baseElement = baseElement;
        this._domTool = new DOMTool(this._baseElement.ownerDocument);
        this._isActive = false;
        var dom = this._domTool.createElementfromHTML(
            'div', {'class': 'widgets_container'},
            WIDGETS_CONTAINER_TEMPLATE
        );
        this.container = dom;
        this._isActive = false;

        for(let elem of this.container.querySelectorAll('button.close'))
            elem.addEventListener('click', ()=>this.close());


        this._widgets = [];
        let children = this._baseElement.ownerDocument.createDocumentFragment();
        for(let Widget of widgets) {
            let child = this._domTool.createElement('div',
                            {'class': 'widgets_container-child_widget'});
            children.appendChild(child);
            this._widgets.push(new Widget(child));
        }
        this._domTool.insertAtMarkerComment(
                        this.container, 'insert: child widgets', children);
    }

    activate() {
        if(this._isActive)
            return;
        this._domTool.insert(this._baseElement, 'prepend', this.container);
        for(let widget of this._widgets)
            if(widget.activate)
                widget.activate();

        this._isActive = true;
    }
    close() {
        if(!this._isActive)
            return;
        // event listeners are preserved
        this._domTool.removeNode(this.container);
        for(let widget of this._widgets)
            if(widget.close)
                widget.close();

        this._isActive = false;
    }
}


function main(){
    let userSettingsWidget = new WidgetsContainerWidget(
                    document.querySelector('.insert_user_settings'),
                    [
                        PortalAugmentationWidget,
                        UserPreferencesWidget
                    ]);
    userSettingsWidget.activate();

}
window.onload = main;
