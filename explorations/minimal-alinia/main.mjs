import { main } from '../../../lib/js/demoController.mjs';
import { typeSpec } from './type-spec.mjs';


// only apply this amount of columns
const MAX_COLUMNS = 1;

function reduceColumnConfig (columnConfig) {
    let result = {};
    for(let [k,v] of Object.entries(columnConfig))
        result[k] = v;
    result.columns = columnConfig.columns.slice(0, Math.max(1, MAX_COLUMNS));
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
