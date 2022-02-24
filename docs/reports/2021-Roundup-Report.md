---
layout: default-emsquare
override_title: "2021 Roundup Report — VarLa-VarFo"
override_header: "VarLa-VarFo — Variable Layouts for Variable Fonts"
title: "2021 Roundup Report"
author: Lasse Fister, [@gaphicore](https://github.com/graphicore)
modules:
    - "Emsquare/Volume-01/js/main.mjs"
styles:
    - "lib/css/varla-varfo.css"
    - "lib/css/widgets.css"
    - "Emsquare/Volume-01/main.css"
---

<div class="author do-not-justify" style="text-indent:0; text-align: right;">
{%- capture author -%}*by* **{{page.author}}**{%- endcapture -%}
{{ author | markdownify }}
</div>

The year 2021 was characterized by starting the project from scratch. Hence
initial exploration to gather an understanding of some
[open](../../explorations/techniques/absolute_units_evaluation.html)
[questions](../..//explorations/calibrate/) and
[techniques](../../explorations/techniques/variations.html) and to create
a [starting point](../../explorations/wikipedia/Typography/firefox_save_page_as/Typography%20-%20Wikipedia.html),
to work iteratively into was necessary. Afterward, concepts have been
implemented to point in the right direction—subsequently to be refined
and updated throughout the year. In the second half of the year work on
the [Emsquare publication](../../Emsquare) has started, the appearance
of this report is taken from there.


## Technical Highlights from a Web Developer Perspective

**CSS:** The implementation leans heavily on newer CSS features, like
extensive usage of custom properties, calc(), and @keyframes for
interpolation of e.g. grade (GRAD) values using font-size as an input. The
result is a *CSS framework* that provides high-level custom properties to
drive lower-level typographic expressions. Some CSS is backed up or driven
by JavaScript, but all that can be in CSS is in CSS. That way the role of
JavaScript is more focused on controlling and less on the details of using
the actual fonts. Though, using @keyframes requires an in-JavaScript fallback
mechanism for all browsers that are not Blink-engine (i.e. Chrome, etc.).

**Justification:** To implement the justification scheme it's necessary
to identify the lines as created by the native browser text-setting
engine. Then those lines are marked up so that they can be controlled using
CSS. It is ensured that the semantics of the original markup isn't changing.
For example, this would happen by—at the break of a line—splitting existing
inline tags, like links (`<a>`), into two elements. AFAIK, both, the
*line-finding*  and *line-markup* have never been done before like this.
Unfortunately, the justification implementation is not as fast as it should
be for production use in websites, but it makes a strong proof of concept.

## Git History Summary

This is just a small and likely too sparse summary of the git commit history
of the year.

### Jan/Feb

* Initial Explorations
* Calibration Widget: Explore the state of dimensional units and calibration in the web platform

### Feb/Mar

* article: [Calibrate CSS](https://graphicore.github.io/varla-varfo/explorations/calibrate/)
* [take over Wikipedia markup](../../explorations/wikipedia/Typography/firefox_save_page_as/Typography%20-%20Wikipedia.html) and the article about Typography as a playground
* initial user controls widget
* [portal testbed tool](../../explorations/portals/)
* [bookmarklet](javascript:void((function%20()%7Bvar%20collected%20=%20new%20Map(),%20unique%20=%20new%20Map(),%20tags%20=%20Symbol('tags'),%20size%20=%20Symbol('size');for(elem%20of%20document.getElementsByTagName(%22*%22))%20%7Blet%20computed%20=%20window.getComputedStyle(elem,null);if%20(computed.display%20===%20'none')continue;if(elem.offsetParent%20===%20null%20&&%20computed.position%20!==%20'fixed')/*%20a%20parent%20node%20is%20hidden%20*/continue;if(!Array.from(elem.childNodes).some(node=%3E/*%20is%20a%20text%20Node%20*/node.nodeType%20===%20Node.TEXT_NODE%20&&/*%20only%20whitespace*/node.wholeText.trim()%20!==%20''))continue;let%20fontFamily%20=%20computed.getPropertyValue('font-family'),%20fontSize%20=%20computed.getPropertyValue('font-size'),%20fontWeight%20=%20computed.getPropertyValue('font-weight'),%20fontStyle%20=%20computed.getPropertyValue('font-style'),%20fontVariationSettings%20=%20computed.getPropertyValue('font-variation-settings'),%20key%20=%20%60$%7BfontFamily%7D%60,%20id%20=%20%5BfontSize,%20fontFamily,%20fontVariationSettings,%20fontWeight,%20fontStyle%5D.join(';'),%20value%20=%20unique.get(id);if(!value)%20%7Bvalue%20=%20%7BfontSize,%20fontFamily,%20fontVariationSettings,%20fontWeight,%20fontStyle%7D;value%5Btags%5D%20=%20new%20Set();value%5Bsize%5D%20=%20parseInt(fontSize,%2010);unique.set(id,%20value);if(!collected.has(key))collected.set(key,%20%5B%5D);collected.get(key).push(value);%7Dvalue%5Btags%5D.add(elem.tagName);%7Dvar%20body%20=%20document.createElement('body');for(let%20%5Bkey,%20bucket%5D%20of%20collected.entries())%7Blet%20heading%20=%20document.createElement('h2'),%20samples%20=%20document.createElement('ul');heading.textContent%20=%20key;body.appendChild(heading);body.appendChild(samples);bucket.sort((a,b)=%3Eb%5Bsize%5D%20-%20a%5Bsize%5D);for(let%20item%20of%20bucket)%20%7Blet%20li%20=%20document.createElement('li'),%20size%20=%20document.createElement('small'),%20sample%20=%20document.createElement('span');size.textContent=item.fontSize;li.appendChild(size);li.appendChild(sample);for(let%20%5Bprop,%20value%5D%20of%20Object.entries(item))sample.style%5Bprop%5D%20=%20value;sample.textContent%20=%20'The%20quick%20brown%20fox%20jumps%20over%20the%20lazy%20dog.';sample.setAttribute('data-tags',%20Array.from(item%5Btags%5D).map(t=%3E%60%3C$%7Bt%7D%3E%60).join(',%20'));samples.appendChild(li);%7D%7Dlet%20customStyleId%20=%20'typo-ramp-style';if(!document.getElementById('customStyleId'))%7Blet%20style%20=%20document.createElement('style');style.id%20=%20customStyleId;style.textContent%20=%20%60body,%20body%20*%20%7Ball:%20revert;%7Dul%20%7Blist-style:%20none;%7Dli%20small%20%7Bwidth:%206rem;text-align:%20right;padding-right:%202rem;display:%20inline-block;%7Dli:hover%20span::after%20%7Ball:%20initial;content:%20attr(style)%20%22%20#%20%22%20attr(data-tags);color:%20purple;position:%20absolute;font-size:%201rem;%7D%60;document.head.appendChild(style);%7Ddocument.body.parentNode.replaceChild(body,%20document.body);%7D)());)
  to extract type size ramps from web pages
* initial dark-mode and grade/GRAD

### Mar/Apr

* initial experimental relative distance user widget
* initial runion-01: columns, line-length, gutter, padding, line-height
* implement line-finding
* first justification implementation

### Apr/May

* Better grade/GRAD implementation
* superscript and subscript synthesis
* justification color coding
* maintenance and refinements
* ATypI Tech Talks, May 3–5

### May/Jun

* new justification algorithm
* change justification fontSpec by the used font

### Jun/Jul

* use Wikipedia API to fetch and display other articles
* justification and runion-01 improvements

### Jul/Aug

* initial Emsquare setup with Jekyll
* maintenance

### Aug/Sep

* CSS-Framework refinements
* Emsquare editorial work
* justification refinements; different line-handling modes; headline inter-line harmonization

### Sep/Oct

* switch fonts widget
* MacOS/iOS debugging
* Dynamic margins in pull quotes

### Oct/Nov

* inspection Widget

### Nov/Dec

* varla-varfo flow chart
* separate wiring from type-spec data in CSS and Javascript
* identify and research bug for GRAD in subscript/superscript (can't fix so far)

### Jan 2022

* dynamically update inspector report when state changes


## Software Flow Chart

{% include figure
        src="./images/varla-varfo-flow.4cd9dcc.png"
        caption="Varla-Varfo flow chart, end of 2021.
                 See [the PDF at GitHub](https://github.com/graphicore/varla-varfo/blob/4cd9dcca192a277a651ca900671eb55b8494fa7a/docs/flowcharts/varla-varfo-flow.pdf)."
%}


## Outlook and Tasks for 2022

* support different languages, e.g. German will likely need longer shortest lines
* integrate with existing VideoProof, TypeTools
* make justification more stable (it still has some issues in some cases)
* add handling of very small portals and portals far away and for different
  reading contexts/modes (presentational/informational).
* detecting portals merely by resolution/screen-pixel-count is likely insufficient
* maybe include CSS-Calibration for portal-proofing
* improve UI (better structuring, design)
* custom type-specs editor
* support for other fonts
* add UI to customize the type-spec setup (related to TypeTools?)





