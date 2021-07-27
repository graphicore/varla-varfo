import {main, COLUMN_CONFIG} from './../../../../explorations/wikipedia/js/demoController.mjs';
const config = {
    columnConfig: (function (columnConfig){
        let result = {};
        for(let [k,v] of Object.entries(columnConfig))
            result[k] = v;
        result.columns = columnConfig.columns.slice(0, 1);// only apply one column
        return result;
    })(COLUMN_CONFIG.en)
};
console.log('config', config);
window.onload = ()=>main(config);
