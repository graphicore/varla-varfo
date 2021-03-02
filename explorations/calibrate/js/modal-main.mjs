/* jshint browser: true, esversion: 9, laxcomma: true, laxbreak: true */
// import getEncodeFallback from '../../app/lib/ean13Encoder/fallback.mjs';
import DOMTool from './domTool.mjs';
import CalibrationWidget from './CalibrationWidget.mjs';

const UNIT_SCALE_LOCAL_STORAGE_KEY = 'unit-scale-physical';


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
        //
        let normalReadingDistance_ = ((1/96)/unitScalePhysical/2) / Math.tan(alpha_rad) * 2.54;

        for(let [selector, textContent] of [
                ['.insert-normal-reading-distance',
                 `${normalReadingDistance} inches or ${normalReadingDistance * 2.54} centimeters`]
              , ['.insert-unit-scale-physical', `${unitScalePhysical}`]
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

    let calibrationWidget = new CalibrationWidget(document.body, initialUnitScalePhysical)
      , initCalibrate = evt=>calibrationWidget.activate()
      ;

    // TODO: do this onLoad
    documentSetUnitScalePhysical(initialUnitScalePhysical);
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

    document.body.addEventListener('unitscalephysical', e=>{
        console.log(e.type, e.detail);
        window.localStorage.setItem(UNIT_SCALE_LOCAL_STORAGE_KEY, e.detail);
        documentSetUnitScalePhysical(e.detail);
    });



}
main();
