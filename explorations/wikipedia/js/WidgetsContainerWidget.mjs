/* jshint browser: true, esversion: 9, laxcomma: true, laxbreak: true */
import DOMTool from '../../calibrate/js/domTool.mjs';

const WIDGETS_CONTAINER_TEMPLATE = `
<!-- insert: child widgets -->
<button class="close">done</button>
`;

export default class WidgetsContainerWidget {
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
    toggle() {
        if(this._isActive)
            this.close();
        else
            this.activate();
    }

}
