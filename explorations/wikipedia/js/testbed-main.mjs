/* jshint browser: true, esversion: 9, laxcomma: true, laxbreak: true */
import DOMTool from '../../calibrate/js/domTool.mjs';
import WidgetsContainerWidget from './WidgetsContainerWidget.mjs';


const PORTALS = [
    ['Responsive Web',
        ['Mobile',
            ['Mobile', 1024, 320]
        ],
        ['Tablet',
            ['Tablet', 1024, 768]
        ],
        ['Desktop',
            ['Desktop', 1024, 1024],
            ['Desktop HD', 1440, 1024]
        ]
    ],
    ['Android Devices',
        ['Common Mobile',
            ['Android', 640, 360],
            ['Pixel 3', 823, 411],
            ['Pixel 3 XL', 846, 411],
            ['Pixel 4', 869, 411],
            ['Pixel 4 XL', 869, 411],
            ['Galaxy S10', 760, 360],
            ['Galaxy S10+', 869, 412],
            ['Galaxy S10 Lite', 914, 412]
        ],
        ['Common Tablet',
            ['Nexus 7', 960, 600],
            ['Nexus 9', 1024, 768],
            ['Nexus 10', 1280, 800]
        ],
        ['Chromebook',
            ['Pixel Slate', 1333, 888],
            ['Pixelbook', 1200, 800]
        ]
    ],
    ['Apple Devices',
        ['iPhone',
            ['iPhone 8', 667, 375],
            ['iPhone 8 Plus', 736, 414],
            ['iPhone SE', 586, 320],
            ['iPhone 11 Pro', 812, 375],
            ['iPhone 11', 896, 414],
            ['iPhone 11 Pro Max', 896, 414],
            ['iPhone 12 Mini', 812, 375],
            ['iPhone 12', 844, 390],
            ['iPhone 12 Pro', 844, 390],
            ['iPhone 12 Pro Max', 926, 428]
        ],
        ['iPad',
            ['7.9″ iPad mini', 1024, 768],
            ['10.2″ iPad', 1080, 810],
            ['10.5″ iPad Air', 1112, 834],
            ['10.9″ iPad Air', 1180, 840],
            ['11″ iPad Pro', 1194, 834],
            ['12.9″ iPad Pro', 1366, 1024]
        ],
        ['Apple Watch',
            ['Apple Watch 38mm', 136, 170],
            ['Apple Watch 40mm', 162, 197],
            ['Apple Watch 42mm', 156, 195],
            ['Apple Watch 44mm', 184, 224]
        ],
        ['Apple TV',
            ['Apple TV', 1920, 1080]
        ],
        ['Mac',
            ['Touch Bar', 1085, 30]
        ]
    ],
    ['Custom',
        ['Laptop',
            // my computer, d-p-i = 2, ppi = 277  TUXEDO InfinityBook Pro 13 v4
            ['TUXEDO InfinityBook', 1600, 900]
        ]
    ]
];


function _flattenPortalsToNumbers(portals) {
    let reducer = (a, v)=>{
        if(Array.isArray(v))
            v.slice(1).reduce(reducer, a);
        else
            a.add(v);
        return a;
    };
    return Array.from(portals.reduce(reducer, new Set())).sort((a,b)=>b-a);
}

function _portalsToOptionElements(PORTALS) {
    var lines = [];
    for(let [ia, catA] of PORTALS.entries()) {
        for(let [ib, catB] of catA.entries()) {
            if(ib === 0)
                continue;
            for(let [ic, item] of catB.entries()){
                if(ic === 0) {
                    lines.push(`<optgroup label="${item}" data-level-a="${ia}">`);
                    continue;
                }
                let [name, w, h] = item;
                lines.push(`<option value="${ia}.${ib}.${ic}">${name} ${w}×${h}</option>`);
            }
            if(catB.length)
                lines.push('</optgroup>');
        }
    }
    return lines;
}

const PORTAL_PROPERTIES_TEMPLATE = `
<datalist id="portal_properties-px-sizes">
    ${_flattenPortalsToNumbers(PORTALS).map(v=> '<option value="' + v +'" />').join('\n    ')}
</datalist>

<fieldset>
    <legend>Portal Properties</legend>

    <p class="portal_properties-portal_selection">
        <label>Portals:
        <select class="portal_properties-portal_selection-topLevel">
            ${PORTALS.map(([label], i)=>'<option value="'+ i +'">'+label+'</option>').join('\n        ')}
        </select></label>
        <br />
        <select class="portal_properties-portal_selection-items">
            ${_portalsToOptionElements(PORTALS).join('\n        ')}
        </select>

    </p>
    <p>
    Manual Sizes<br />
    <label>Width:
        <input name="width"
               type="number"
               list="portal_properties-px-sizes"
               value="1024" min="300" step="1" /></label>
    <br />

    <label>Height:
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
<fieldset>
    <legend>Select Page</legend>
    <select class="testbed_subject-select_pages">
        <option value="./Typography%20-%20Wikipedia.html" selected>Typography - Wikipedia</option>
        <option value="../../../techniques/variations.html">CSS-Animation Variations</option>
    </select>
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

        this._uiPortalSelectTop = this.container.querySelector('.portal_properties-portal_selection-topLevel');
        this._uiPortalSelectItem = this.container.querySelector('.portal_properties-portal_selection-items');

        {
            let changeTop = ()=>{
                for(let opt of this._uiPortalSelectItem.getElementsByTagName('optgroup'))
                     opt.style.display = opt.getAttribute('data-level-a') === this._uiPortalSelectTop.value
                                         ? '' : 'none';
            };
            this._uiPortalSelectTop.addEventListener('change', changeTop);
            changeTop();

            let changeItem= ()=>{
                let path= this._uiPortalSelectItem.value.split('.')
                  , item = path.reduce((arr, i)=>arr[i], PORTALS)
                  , [label, width, height] = item
                  ;
                // keep orientation as it is
                let currentWidth = parseInt(this._uiWidth.value, 10)
                  , currentHeight = parseInt(this._uiHeight.value, 10)
                  , isPortrait = currentHeight >= currentWidth
                  , needsSwap = isPortrait && height < width
                  ;
                if(needsSwap)
                    [width, height] = [height, width];
                this._uiWidth.value = width;
                this._uiHeight.value = height;
                this.setSizes();
            };
            this._uiPortalSelectItem.addEventListener('change', changeItem);
        }

        this._uiWidth = this.container.querySelector('input[name="width"]');
        this._uiHeight = this.container.querySelector('input[name="height"]');
        this._uiUnit = this.container.querySelector('input[name="unit"]');


        this._uiSelectPage = this.container.querySelector('.testbed_subject-select_pages');
        if(this._uiSelectPage)
            this._uiSelectPage.addEventListener('change',()=>{
                this._portalElement.src = this._uiSelectPage.value;
            });

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
        this.setSizes();
    }

}

function main() {
    let userSettingsWidget = new WidgetsContainerWidget(
                    document.querySelector('.insert_user_settings'),
                    [
                        [PortalPropertiesWidget, document.getElementById('testbed-subject')]
                    ],
                    false
                    );
    let toggle = (/*evt*/)=>{
        userSettingsWidget.toggle();
    };
    for(let elem of document.querySelectorAll('.toggle-user_settings'))
        elem.addEventListener('click', toggle);
}
window.onload = main;
