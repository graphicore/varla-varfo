import {main, COLUMN_CONFIG} from './../../../explorations/wikipedia/js/demoController.mjs';
const config = {
    columnConfig: (function (columnConfig){
        let result = {};
        for(let [k,v] of Object.entries(columnConfig))
            result[k] = v;
        result.columns = columnConfig.columns.slice(0, 1);// only apply one column
        return result;
    })(COLUMN_CONFIG.en)
  , defaults: {
        lineColorCoding: false
    }
};

window.onload = ()=>{
    main(config);
    let requestFullScreen = evt=>evt.target.requestFullscreen();
    for(let elem of document.querySelectorAll('figure img'))
        elem.addEventListener('click', requestFullScreen);
};
