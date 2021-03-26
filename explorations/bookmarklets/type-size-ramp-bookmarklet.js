(function (){
    var collected = new Map()
      , unique = new Map()
      , tags = Symbol('tags')
      , size = Symbol('size')
      ;
    for(elem of document.getElementsByTagName("*")) {
        let computed = window.getComputedStyle(elem,null)

        if (computed.display === 'none')
            continue;
        if(!Array.from(elem.childNodes).some(node=>
                // is a text Node
                node.nodeType === Node.TEXT_NODE &&
                                    // only whitespace
                                    node.wholeText.trim() !== ''))
            continue;


        let fontFamily = computed.getPropertyValue('font-family')
          , fontSize = computed.getPropertyValue('font-size')
          , fontWeight = computed.getPropertyValue('font-weight')
          , fontStyle = computed.getPropertyValue('font-style')
          , fontVariationSettings = computed.getPropertyValue('font-variation-settings')
          , key = `${fontFamily}`
          , id = [fontSize, fontFamily, fontVariationSettings, fontWeight, fontStyle].join(';')
          , value = unique.get(id)
          ;

        if(!value) {
            value = {fontSize, fontFamily, fontVariationSettings, fontWeight, fontStyle}
            value[tags] = new Set();
            value[size] = parseInt(fontSize, 10);
            unique.set(id, value);
            if(!collected.has(key))
                collected.set(key, []);
            collected.get(key).push(value);
        }
        value[tags].add(elem.tagName);
    }
    var body = document.createElement('body');
    for(let [key, bucket] of collected.entries()){
        let heading = document.createElement('h2')
          , samples = document.createElement('ul')
          ;
        heading.textContent = key;
        body.appendChild(heading);
        body.appendChild(samples);
        bucket.sort((a,b)=> a[size] < b[size]);
        for(let item of bucket) {
            let li = document.createElement('li')
              , size = document.createElement('small')
              , sample = document.createElement('span')
              ;
            size.textContent=item.fontSize;
            li.appendChild(size);
            li.appendChild(sample);

            for(let [prop, value] of Object.entries(item))
                sample.style[prop] = value;
            sample.textContent = 'Hello World';
            sample.setAttribute('data-tags', Array.from(item[tags]).map(t=>`<${t}>`).join(', '));
            samples.appendChild(li);
        }
    }
    let customStyleId = 'typo-ramp-style';
    if(!document.getElementById('customStyleId')){
        let style = document.createElement('style');
        style.id = customStyleId;
        style.textContent = `
body, body * {
    all: revert;
}

ul {
    list-style: none;
}

li small {
    width: 6rem;
    text-align: right;
    padding-right: 2rem;
    display: inline-block;
}

li:hover span::after {
    all: initial;
    content: attr(style) " # " attr(data-tags);
    color: purple;
    position: absolute;
    font-size: 1rem;
}
`;
        document.head.appendChild(style);
    }
    document.body.parentNode.replaceChild(body, document.body);
})()
