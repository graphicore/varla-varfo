/* jshint browser: true, esversion: 9, laxcomma: true, laxbreak: true */
// import getEncodeFallback from '../../app/lib/ean13Encoder/fallback.mjs';
import DOMTool from './domTool.mjs';
import CalibrationWidget from './CalibrationWidget.mjs';

const UNIT_SCALE_LOCAL_STORAGE_KEY = 'unit-scale-physical';

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
    function documentSetUnitScalePhysical(unitScalePhysical) {
        console.log('documentSetUnitScalePhysical', unitScalePhysical);
        document.documentElement.style.setProperty('--unit-scale-physical', unitScalePhysical);
        // todo: backup with proper math via the angle etc.
        var normalReadingDistance = 28 / unitScalePhysical;


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
        // let normalReadingDistance = ((1/96)/unitScalePhysical/2) / Math.tan(alpha_rad);



        for(let [selector, textContent] of [
                ['.insert-normal-reading-distance',
                 `${normalReadingDistance} inches or ${normalReadingDistance * 2.54} centimeters`]
              , ['.insert-unit-scale-physical', `${unitScalePhysical}`]
              , ['.insert-device-ppi', `${96 * unitScalePhysical * window.devicePixelRatio}`]
              , ['.insert-real-window-width', `${window.innerWidth / 96 / unitScalePhysical}`]
              , ['.insert-real-window-height', `${window.innerHeight / 96 / unitScalePhysical}`]
              , ['.insert-real-window-width-cm', `${(window.innerWidth / 96 / unitScalePhysical) * 2.54}`]
              , ['.insert-real-window-height-cm', `${(window.innerHeight / 96 / unitScalePhysical) * 2.54}`]
            ]){
                for(let elem of document.querySelectorAll(selector))
                    elem.textContent = textContent;
        }
    }

    // initCalibrate should only perform if the calibration widget is not already
    // active, hence, we need state!
    let initialUnitScalePhysical = parseFloat(window.localStorage.getItem(UNIT_SCALE_LOCAL_STORAGE_KEY));
    if(!isFinite(initialUnitScalePhysical))
        // if localStorage returned null or if it can't be parsed as a number
        // it is NaN now. Defaulting to 1:
        initialUnitScalePhysical = 1;

    let calibrationWidget = new CalibrationWidget(
                            document.querySelector('.insert_calibration_widget'),
                            initialUnitScalePhysical,
                            false);

    // TODO: do this onLoad
    documentSetUnitScalePhysical(initialUnitScalePhysical);
    calibrationWidget.activate();


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

    document.body.addEventListener('unitscalephysical', e=>{
        console.log(e.type, e.detail);
        window.localStorage.setItem(UNIT_SCALE_LOCAL_STORAGE_KEY, e.detail);
        documentSetUnitScalePhysical(e.detail);
    });

    DOMTool.insert(document.body, 'prepend',
        makePageOutline(document.querySelector('main'), {'class': 'page_outline'}));

}
main();
