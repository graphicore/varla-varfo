/* jshint browser: true, esversion: 9, laxcomma: true, laxbreak: true */
import {ID}  from './WidgetsContainerWidget.mjs';
import DOMTool from '../../calibrate/js/domTool.mjs';
import {main} from './demoController.mjs';


function massageWikipediaMarkup(documentOrElement) {
    documentOrElement.querySelectorAll('.thumbinner').forEach(e=>e.style.width='');
    (documentOrElement.body || documentOrElement).querySelectorAll('style').forEach(e=>e.remove());

    // These "thumbs" with ".tright" are originally "float: right" but in column
    // layout, there's not much use of floating elements, because we strive
    // to make columns narrow, so there's not enough space for floating.
    // Further, they are located at the beginning of each section, which
    // is not ideal when they don't float right.
    // Hence, for ease now, float: right items are moved to the end of the
    // section they would originally float: right.
    // Also, in books, it's often that figures are at the end of a section,
    // CAUTION: This only needs to be good enough for the demo document,
    //          it will likely fail on other wikipedia articles.
    let selectorSectioningStuff = '#toc, h1, h2, h3';
    for(let tright of documentOrElement.querySelectorAll('.thumb.tright')){
        let sibling = tright.nextElementSibling;
        while(sibling){
            if(sibling.matches(selectorSectioningStuff)) {
                tright.parentNode.insertBefore(tright, sibling);
                break;
            }
            sibling = sibling.nextElementSibling;
        }
    }
}

function wikiLinkClickHandler({window}, logger, evt) {
    let a = evt.target.closest('a');
    if(!a) return false;

    let [validates, message, parsed] = validateWikiURL(window, a.href, true);
    if(!validates) {
        logger.log(...message);
        return false;
    }
    // link is accepted.
    evt.preventDefault();
    evt.stopImmediatePropagation();
    return parsed;
}

function validateWikiURL({document, location}, urlString, allowLocal) {
    let wikiURL = new URL(urlString)
      , parsed = null
      // the api subdomain is not necessarily the same as the value of
      // the lang attribute value, e.g.:
      //    "zh-min-nan.wikipedia.org" produces a lang attribute of just "nan".
      , subDomain = null
      ;

    // allowLocal === true is used for handling links that got clicked
    // in the page body, but not not for direct user input.
    if(allowLocal && location.hostname === wikiURL.hostname) {
        // for links with the same hostname we get e.g.:
        // http://192.168.178.24:8080/wiki/Altgriechische_Sprache
        // this has neither an ".wikipedia.org" based hostname, nor a subdomain!
        // -> this selector has the proper subdomain
        // 'head link[rel="edit"]'
        // e.g. https://en.wikipedia.org/w/index.php?title=Typography&action=edit
        if(document.documentElement.hasAttribute('data-wikipedia-subdomain')){
            // we set this when applying a fetched article
            subDomain = document.documentElement.getAttribute('data-wikipedia-subdomain');
        }
        else {
            // Initially there's no explicitly set subdomain.
            // Let's go fishing!
            let link = document.querySelector('head > link[rel="edit"]')
              , url = new URL(link && link.getAtrribute('href') || '')
              ;
            subDomain = url.hostname.split('.')[0];
        }
        if(!subDomain)
            return [false, ['[validateWikiURL] can\'t figure api sub domain.'], parsed];
    }
    else if(wikiURL.hostname.endsWith('.wikipedia.org')) {
        // These URLs usually come from the languages category links.
        let hostnameParts = wikiURL.hostname.split('.');
        if(hostnameParts.length !== 3) {
            return [false, ['[validateWikiURL] too many sub domains', ...hostnameParts.slice(0, -2)], parsed];
        }
        subDomain = hostnameParts[0];
    }
    else {
        return [false, ['[validateWikiURL] unhandled domain:', wikiURL.hostname], parsed];
    }

    const wikiPath = '/wiki/';
    if(wikiURL.pathname.indexOf(wikiPath) !== 0) {
        return [false, ['[validateWikiURL] unhandled path-name:', wikiURL.pathname], parsed];
    }

    parsed = {
        page: decodeURIComponent(wikiURL.pathname.slice(wikiPath.length)).trim()
      , subDomain: subDomain
    };

    return [true, null, parsed];
}

async function fetchWikiPage({URL, URLSearchParams, fetch, window}, {subDomain, page}) {
    // API:
    // https://en.wikipedia.org/w/api.php
    // e.g.: https://en.wikipedia.org/w/api.php?action=help&recursivesubmodules=1
    // https://en.wikipedia.org/w/api.php?action=query&titles=Belgrade&prop=extracts&format=json&exintro=1
    var searchParams = new URLSearchParams({
            format: 'json'
          , origin: '*' // mediawiki CORS magic, THANKS!!!
          // We can get the language links for the page from the query action:
          //        https://en.wikipedia.org/w/api.php?action=help&modules=query
          //        prop: '2Blanglinks'
          //        see: https://en.wikipedia.org/w/api.php?action=help&modules=query%2Blanglinks
          // , action: 'query'
          // , prop: 'extracts'
          // , titles: 'Belgrade'
          , action: 'parse'
          , prop: 'text|headhtml'
          , formatversion: 2
          , page: page
        })
      , url
      ;
    searchParams.sort();
    // construct url because we likely serve from location.hostname
    // which is e.g. https://graphicore.github.io/ or localhost:8080
    url = new URL('w/api.php', `https://${subDomain}.wikipedia.org/`);
    url.search = searchParams;

    let response;
    try {
        response = await fetch(url);
    }
    catch (e) {
        if(e instanceof TypeError) {
            // Sadly, if I enter a wrong subdomain, console reports e.g.
            // main.mjs:1143 GET https://xxxx.wikipedia.org/w/api.php[...] net::ERR_NAME_NOT_RESOLVED
            // But that is not reported in the response object.
            // So this is for that very special case, to improve the feedback
            // to the user.
            throw new Error(`${e}. This happens e.g. when the subdomain `
                           + `(here: "${subDomain}") can't be resolved.`);
        }
        // re-raise, will be reported
        throw e;
    }

    if(!response.ok)
        throw new Error(`[fetch failed] ${response.status} ${response.status} `
                       + `${response.statusText}`);


    let data = await response.json();
    if(data.error) {
        // Handle error documents returned from the API here.
        // data.error.code e.g. "missingtitle"
        // data.error.info e.g. "The page you specified doesn't exist."
        throw new Error(`[${data.error.code}] for page "${page}" in `
                      + `${subDomain}.wikipedia.org: ${data.error.info}`);
    }
    return {page, subDomain, data};
}

function applyWikiPage({document}, {subDomain, data}) {
    let domTool = new DOMTool(document)
      , currentLang = document.documentElement.getAttribute('lang')
        // it doesn't come with closing tags ...
      , headHtml = `${data.parse.headhtml}</body></html>`
        // the fragment parser does not return the <html> element
      , domParser = new DOMParser()
      , doc = domParser.parseFromString(headHtml, 'text/html')
      , fetchedLang = doc.querySelector('html').getAttribute('lang')
      , frag = domTool.createFragmentFromHTML(data.parse.text)
      , target = document.querySelector('.mw-parser-output')
      , h1 = document.querySelector('h1')
      ;

    // at this point all content must be good
    document.documentElement.setAttribute('data-wikipedia-subdomain', subDomain);
    h1.textContent = data.parse.title;
    target.replaceWith(...frag.children);
    target = document.querySelector('.mw-parser-output');
    massageWikipediaMarkup(target);
    if(fetchedLang !== currentLang) {
        // TODO: changing the "dir" attribute and changing the layout
        // to rtl direction is not supported yet. However, we don't have
        // fonts for those cases yet as well.
        for(let elem of document.querySelectorAll(
                // Some elements have a different language as their content
                // and hence set lang, e.g. a word in an <em> in Greek also,
                // wikipedia links that change language have a hreflang
                // attribute.
                `[lang=${currentLang}]:not(a[hreflang],p *, i, span, em, b, strong)`)) {
            elem.setAttribute('lang', fetchedLang);
        }
    }
    return true;
}

const ARTICLE_URL_TEMPLATE = `
    <legend>Load Wikipedia Article</legend>
    <form>
    <!-- The reason to ask for a URL and not just a subdomain + pagename
        is that the URL can be copied directly from Wikipedia. I believe
        this will be the primary or at least initial interaction process.
    -->
    <input class="article_url-text_input"
        type="text"
        value=""
        title="Enter a Wikipedia article URL"
        placeholder="https://en.wikipedia.org/wiki/Typography"/>
    <div class="article_url-loading_status"></div>
    <button class="article_url-load">load</button><br />
    <form>
`;

class WikipediaArticleURLWidget {
    constructor(domTool, baseElement, templateVars, updateAfterChangedContent, state) {
        this._baseElement = baseElement;
        this._domTool = domTool;

        this._updateAfterChangedContent = updateAfterChangedContent;

        if(ID in templateVars)
            this[ID] = templateVars[ID];

        var template = ARTICLE_URL_TEMPLATE;
        {
            // TODO: _templateVars in case when templateVars needs augmentation, remove?
            let _templateVars = [...Object.entries(templateVars || {})];
            for(let [k,v] of _templateVars)
                template = template.replaceAll('{' + k + '}', v);
        }
        var dom = this._domTool.createElementfromHTML(
            'fieldset', {'class': 'article_url'},
            template
        );
        this.container = dom;
        this._baseElement.appendChild(dom);

        this._input = this.container.querySelector('input');
        // Using a form here may be against the HTML nesting rules
        // (it's here contained within a fieldset), but using the submit
        // event directly is very handy it e.g. triggers when pressing
        // enter when the cursor is in the text input element and also
        // when pressing the load button.
        this._form = this.container.querySelector('form');
        this._form.addEventListener('submit', evt=>{
            evt.preventDefault();
            this.load();
        });
        this._loadingStatus = this.container.querySelector('.article_url-loading_status');

        if(state) {
            this.setLoadingStatus(state.state || null);
            if(state.input)
                this._input.value = state.input;
        }
        // So far, don't do local Storage.
    }
    load() {
        let requestURL = this._input.value;
        if(requestURL.indexOf('://') === -1)
            // Add a protocol, we always use https, so we don't require
            // the user to specify it, but it will also come with a URL
            // copy pasted from the browser address bar.
            requestURL = `https://${requestURL}`;

        let [validates, message, parsed] = validateWikiURL(window, requestURL, false);
        if(!validates) {
            this.setLoadingStatus(message.join(' '));
            return false;
        }
        this.fetchWikiPage(parsed);
    }
    get state() {
        return {
            state: this._loadingStatus.textContent
          , input: this._input.value
        };
    }
    // Only used for errors/problems so far.
    setLoadingStatus(message) {
        this._loadingStatus.textContent = message || '';
    }
    fetchWikiPage(parsed) {
        return fetchWikiPage(window, parsed)
        .then(
            fetched=> {
                // success
                applyWikiPage(window, fetched);
                // -> set this._input value!
                this._input.value = `https://${fetched.subDomain}.wikipedia.org/wiki/${fetched.page}`;
                this.setLoadingStatus(null);
                this._updateAfterChangedContent();
            },
            err=>this.setLoadingStatus(`[${err.name}] ${err.message}`)
        );
    }
    windowClickHandler(evt) {
        let window =  evt.view
          , parsed = wikiLinkClickHandler(window, window.console, evt)
          ;
        if(!parsed)
            return false;
        // This way, the URL will be displayed in the
        // "Load Wikipedia Article" widget.
        return this.fetchWikiPage(parsed);
    }
}


const config = {
    WikipediaArticleURLWidget: WikipediaArticleURLWidget
  , massageMarkupFunc: massageWikipediaMarkup
};

window.onload = ()=>{
    main(config);
};
