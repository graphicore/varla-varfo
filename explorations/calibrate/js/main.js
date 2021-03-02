/* jshint browser: true, esversion: 9, laxcomma: true, laxbreak: true */
// import getEncodeFallback from '../../app/lib/ean13Encoder/fallback.mjs';
import DOMTool from './domTool.mjs';
import CalibrationWidget from './CalibrationWidget.mjs';

const UNIT_SCALE_ADJUST_LOCAL_STORAGE_KEY = 'unit-scale-adjust-physical';

function makePageOutline(elem, attr) {
    var domTool = new DOMTool(elem.ownerDocument)
      , containerTag = 'ol'
      , result = domTool.createElement(containerTag, attr)
      , current = [1, result]
      , depthContainers = [current]
      ;
    for(let heading of elem.querySelectorAll('h1,h2,h3,h4,h5,h6')){
        let depth = parseInt(heading.tagName[1], 10);

        while(depth > current[0]){
            let [d, parentContaier] = current
              , newDepth = d + 1
              , newContainer = domTool.createElement(containerTag,
                    {'class': `page_outline-container page_outline-container-${newDepth}`})
              ;
            parentContaier.appendChild(domTool.createElement('li',
                    {'class': `page_outline-deeper page_outline-deeper-${newDepth}`},
                    newContainer));
            current = [newDepth, newContainer];
            depthContainers.push(current);
        }
        while(depth < current[0]) {
            depthContainers.pop();
            current = depthContainers.slice(-1)[0];
        }
        let parent = current[1]
          , anchor = heading.id || null
          , outlineItemContent = domTool.createTextNode(heading.textContent)
          , cssClass= `page_outline-entry page_outline-entry-${heading.tagName.toLowerCase()}`
          ;
        if(anchor)
            outlineItemContent = domTool.createElement('a', {href: `#${anchor}`}, outlineItemContent);
        parent.appendChild(domTool.createElement('li', {'class': cssClass}, outlineItemContent));
    }
    return result;
}

function main() {
    function documentSetUnitScaleAdjust(unitScaleAdjust) {
        console.log('documentSetUnitScaleAdjust', unitScaleAdjust);
        document.documentElement.style.setProperty('--unit-scale-adjust', unitScaleAdjust);
        // todo: backup with proper math via the angle etc.
        var normalReadingDistance = 28 / unitScaleAdjust;


        function rad2deg(rad){return rad * 180 / Math.PI;}
        function deg2rad(deg){return deg * Math.PI / 180;}
        // 1/96: the size of 1 px at 96 dpi
        // 28 inch "nominal arm’s length of 28 inches"
        let alpha_rad = Math.atan2(1/96/2, 28);


        // 0.0213 degrees: rad2deg(alpha_rad * 2)
        // It's interesting that the above is correct: we can also scale
        // the "nominal arm" directly.
        // However, this scales the pixel and gets the viewing distance
        // from the angle. This was made as a proof!
        //
        let normalReadingDistance_ = ((1/96)/unitScaleAdjust/2) / Math.tan(alpha_rad) * 2.54;

        for(let elem of document.querySelectorAll('.insert-normal-reading-distance'))
            elem.textContent = `${normalReadingDistance} inches or ${normalReadingDistance * 2.54} centimeters`;

    }

    // initCalibrate should only perform if the calibration widget is not already
    // active, hence, we need state!
    let initialUnitScaleAdjust = parseFloat(window.localStorage.getItem(UNIT_SCALE_ADJUST_LOCAL_STORAGE_KEY));
    if(!isFinite(initialUnitScaleAdjust))
        // if localStorage returned null or if it can't be parsed as a number
        // it is NaN now. Defaulting to 1:
        initialUnitScaleAdjust = 1;

    let calibrationWidget = new CalibrationWidget(document.body, initialUnitScaleAdjust)
      , initCalibrate = evt=>calibrationWidget.activate()
      ;

    // TODO: do this onLoad
    documentSetUnitScaleAdjust(initialUnitScaleAdjust);
    for(let initCalibrateButton of document.querySelectorAll('.ui-init-calibrate'))
        initCalibrateButton.addEventListener('click', initCalibrate);


    if(window.visualViewport) {
        // This is a control output, because pinch-zoom is sometimes
        // hard to control.Useful for development mostly.
        let indicator = document.createElement('div')
          , viewport = window.visualViewport
          ;
        indicator.style="position: fixed; z-index: 1000; right:0; bottom:0; height: 1.4em; text-align: right;";
        // always visible
        indicator.classList.add('modal');
        document.body.appendChild(indicator);
        window.visualViewport.addEventListener('resize', e=>{
            indicator.textContent = viewport.scale;
        });
    }

    document.body.addEventListener('unitscaleadjust', e=>{
        console.log(e.type, e.detail);
        window.localStorage.setItem(UNIT_SCALE_ADJUST_LOCAL_STORAGE_KEY, e.detail);
        documentSetUnitScaleAdjust(e.detail);
    });

    DOMTool.insert(document.body, 'prepend',
        makePageOutline(document.querySelector('main'), {'class': 'page_outline'}));

}
main();
