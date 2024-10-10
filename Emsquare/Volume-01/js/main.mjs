import { main } from '../../../lib/js/demoController.mjs';
import { typeSpec } from '../../../lib/js/typeSpec.mjs';

function reduceColumnConfig (columnConfig) {
    let result = {};
    for(let [k,v] of Object.entries(columnConfig))
        result[k] = v;
    result.columns = columnConfig.columns.slice(0, 1); // only apply one column
    return result;
}

const massageConfigurations = {
    columnConfig: reduceColumnConfig
}

const inject = {};
window.onload = ()=>{
    main(window, inject, typeSpec, massageConfigurations);
};
