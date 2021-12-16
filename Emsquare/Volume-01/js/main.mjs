import { main } from './../../../explorations/wikipedia/js/demoController.mjs';
import { typeSpec } from './../../../explorations/wikipedia/js/typeSpec.mjs';

function reduceColumnConfig (columnConfig) {
    let result = {};
    for(let [k,v] of Object.entries(columnConfig))
        result[k] = v;
    result.columns = columnConfig.columns.slice(0, 1); // only apply one column
    return result;
}

const typeSpec_ = {};
for(let [k,v] of  Object.entries(typeSpec)) {
    if(k === 'columnConfig') {
        let columnConfig_ = {};
        for(let [lang, columnConfig] of Object.entries(v))
            columnConfig_[lang] = reduceColumnConfig(columnConfig);
        typeSpec_[k] = columnConfig_;
        continue;
    }
    typeSpec_[k] = typeSpec[k];
}

const inject = {};
window.onload = ()=>{
    main(window, inject, typeSpec_);
};
