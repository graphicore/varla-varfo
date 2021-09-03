/* jshint browser: true, esversion: 7, laxcomma: true, laxbreak: true */

// I took this from googlefonts/fontbakery-dashboard and made it into a es module.
// `document` is not required/expected to be global anymore, it's injected

// skip markdown parsing for now
// import marked from 'marked.mjs';
function marked(){
    throw new Error('Markdown parser `marked` is not available');
}

function ValueError(message) {
    this.name = 'ValueError';
    this.message = message || '(No message for ValueError)';
    this.stack = (new Error()).stack;
}
ValueError.prototype = Object.create(Error.prototype);
ValueError.prototype.constructor = ValueError;

export default class DOMTool {
  constructor(document){
        this.document = document;
  }

  get window(){
      return this.document.defaultView; // fancy way to do this
  }

  get documentElement() {
      return this.document.documentElement; // fancy way to do this
  }

  static appendChildren(elem, contents, cloneChildNodes) {
      var _contents = (contents === undefined || contents === null)
              ? []
              : (contents instanceof Array ? contents : [contents])
              ;
      for(let child of _contents) {
          if(!child || typeof child.nodeType !== 'number')
              child = DOMTool.createTextNode(elem.ownerDocument, child);
          else if(cloneChildNodes)
              child = child.cloneNode(true);//always a deep clone
          elem.appendChild(child);
      }
  }

  static createTextNode(document, text) {
      return document.createTextNode(text);
  }

  createTextNode(text) {
      return DOMTool.createTextNode(this.document, text);
  }

  static createElement(document, tagname, attr, contents, cloneChildNodes) {
      var elem = attr && 'xmlns' in attr
          ? document.createElementNS(attr.xmlns, tagname)
          : document.createElement(tagname)
          ;

      if(attr) for(let k in attr) {
          if(k === 'xmlns')
              continue;
          elem.setAttribute(k, attr[k]);
      }

      DOMTool.appendChildren(elem, contents, cloneChildNodes);
      return elem;
  }

  createElement(tagname, attr, contents, cloneChildNodes) {
      return DOMTool.createElement(this.document, tagname, attr,
                                   contents, cloneChildNodes);
  }

  static createChildElement(parent, tagname, attr, contents, cloneChildNodes) {
      var elem = DOMTool.createElement(parent.ownerDocument, tagname, attr, contents, cloneChildNodes);
      parent.appendChild(elem);
      return elem;
  }

  createChildElement(parent, tagname, attr, contents, cloneChildNodes){
      return DOMTool.createChildElement(parent, tagname, attr, contents, cloneChildNodes);
  }

  static createElementfromHTML(document, tag, attr, innerHTMl) {
      var frag = DOMTool.createFragmentFromHTML(document, innerHTMl);
      return DOMTool.createElement(document, tag, attr, frag);
  }

  createElementfromHTML(tag, attr, innerHTMl) {
      return DOMTool.createElementfromHTML(this.document, tag, attr, innerHTMl);
  }

  static createElementfromMarkdown(document, tag, attr, markdownText) {
      return DOMTool.createElementfromHTML(document, tag, attr, marked(markdownText, {gfm: true}));
  }

  createElementfromMarkdown(document, tag, attr, markdownText) {
      return DOMTool.createElementfromMarkdown(this.document, tag, attr, markdownText);
  }

  static createFragmentFromMarkdown(document, mardownText) {
      return DOMTool.createFragmentFromHTML(document, marked(mardownText, {gfm: true}));
  }

  createFragmentFromMarkdown(mardownText) {
      return DOMTool.createFragmentFromMarkdown(this.document, mardownText);
  }

  static appendHTML(document, elem, html) {
      var frag = DOMTool.createFragmentFromHTML(document, html);
      elem.appendChild(frag);
  }
  appendHTML(elem, html) {
      DOMTool.appendHTML(this.document, elem, html);
  }

  static appendMarkdown(document, elem, markdown) {
      DOMTool.appendHTML(document, elem, marked(markdown, {gfm: true}));
  }

  appendMarkdown(elem, markdown) {
      return DOMTool.appendMarkdown(this.document, elem, markdown);
  }

  static createFragmentFromHTML(document, html) {
      return document.createRange().createContextualFragment(html);
  }

  createFragmentFromHTML(html) {
      return DOMTool.createFragmentFromHTML(this.document, html);
  }

  static createFragment(document, contents, cloneChildNodes) {
      var frag = document.createDocumentFragment();
      DOMTool.appendChildren(frag, contents, cloneChildNodes);
      return frag;
  }

  createFragment(contents, cloneChildNodes) {
      return DOMTool.createFragment(this.document, contents, cloneChildNodes);
  }

  static createComment(document, text) {
      return document.createComment(text);
  }

  createComment(document, text){
      return DOMTool.createComment(this.document, text);
  }


  static isDOMElement(node) {
      return node && node.nodeType && node.nodeType === 1;
  }

  static replaceNode(newNode, oldNode) {
      if(oldNode.parentNode) // replace has no effect if oldNode has no place
          oldNode.parentNode.replaceChild(newNode, oldNode);
  }

  static removeNode(node) {
      if(node.parentNode)
          node.parentNode.removeChild(node);
  }

  static insertBefore(newElement, referenceElement) {
      if(referenceElement.parentElement && newElement !== referenceElement)
          referenceElement.parentElement.insertBefore(newElement
                                                    , referenceElement);
  }

  static insertAfter(newElement, referenceElement) {
      // there is no element.insertAfter() in the DOM
      if(!referenceElement.nextSibling)
          referenceElement.parentElement.appendChild(newElement);
      else
          DOMTool.insertBefore(newElement, referenceElement.nextSibling);
  }

  static insert(element, position, child) {
      switch(position) {
          case 'append':
              element.appendChild(child);
              break;
          case 'prepend':
              if(element.firstChild)
                  DOMTool.insertBefore(child, element.firstChild);
              else
                  element.appendChild(child);
              break;
          case 'before':
              DOMTool.insertBefore(child, element);
              break;
          case 'after':
              DOMTool.insertAfter(child, element);
              break;
          default:
              throw new ValueError('Unknown position keyword "'+position+'".');
      }
  }

  static getChildElementForSelector(element, selector, deep) {
      var elements = Array.prototype.slice
                          .call(element.querySelectorAll(selector));
      if(!deep)
          // I don't know an easier way to only allow
          // direct children.
          elements = elements.filter(elem=>elem.parentNode === element);
      return elements[0] || null;
  }

  static getMarkerComment(element, marker) {
      var frames = [[element && element.childNodes, 0]]
        , frame, nodelist, i, l, childNode
        ;
      main:
      while((frame = frames.pop()) !== undefined){
          nodelist = frame[0];
          for(i=frame[1],l=nodelist.length;i<l;i++) {
              childNode = nodelist[i];
              if(childNode.nodeType === 8 //Node.COMMENT_NODE == 8
                         && childNode.textContent.trim() === marker) {
                  return childNode;
              }
              if(childNode.nodeType === 1) { //Node.ELEMEMT_NODE == 1
                  frames.push([nodelist, i+1]);
                  frames.push([childNode.childNodes, 0]);
                  break;
              }
          }
      }
      return null;
  }

  static insertAtMarkerComment(element, marker, child, fallbackPosition) {
      var found = DOMTool.getMarkerComment(element, marker);
      if(found)
          DOMTool.insert(found, 'after', child);
      else if (fallbackPosition !== false)
          // undefined defaults to append
          DOMTool.insert(element, fallbackPosition || 'append', child);
      else
          throw new Error('Marker <!-- '+marker+' --> not found');
  }

  static clear(target, destroyEventName) {
      while(target.lastChild) {
          if(destroyEventName)
              // children can listen for the event and cleanup if needed
              // activatedElement.addEventListener('destroy', function (e) { //... }, false);
              target.lastChild.dispatchEvent(new Event(destroyEventName));
          DOMTool.removeNode(target.lastChild);
      }
  }

  // TODO: document what this is for.
  static validateChildEvent(event, stopElement, ...searchAttributes) {
      var elem = event.target
        , results
        ;
      if(event.defaultPrevented) return;

      search:
      while(true) {
          if(elem === stopElement.parentElement || !elem)
              return;

          for(let searchAttribute of searchAttributes){
              if(elem.hasAttribute(searchAttribute))
                // found!
                break search;
          }
          elem = elem.parentElement;
      }
      event.preventDefault();

      if(searchAttributes.length === 1)
          return elem.getAttribute(searchAttributes[0]);

      results = {};
      for(let attr of searchAttributes)
          results[attr] = elem.getAttribute(attr);
      return results;
  }

  static getComputedStyle(elem) {
      return elem.ownerDocument.defaultView.getComputedStyle(elem);
  }

  static getComputedPropertyValues(elem, ...properties) {
      var style = DOMTool.getComputedStyle(elem)
        , result = []
        ;
      for(let p of properties) {
          result.push(style.getPropertyValue(p));
      }
      return result;
  }

  static getElementSizesInPx(elem, ...properties) {
    // At the moment asserting expecting all queried properties
    // to return "px" values.
    var result = [];
    for(let [i, vStr] of DOMTool.getComputedPropertyValues(elem, ...properties).entries()){
        let p = properties[i];
        if(vStr.slice(-2) !== 'px')
            throw new Error(`Computed style of "${p}" did not yield a "px" value: ${vStr}`);
        let val = parseFloat(vStr.slice(0, -2));
        if(val !== val)
            throw new Error(`Computed style of "${p}" did not parse to a float: ${vStr}`);
        result.push(val);
    }
    return result;
}


}

// static functions to methods, these don't require the `this` state
DOMTool.prototype.appendChildren = DOMTool.appendChildren;
DOMTool.prototype.isDOMElement = DOMTool.isDOMElement;
DOMTool.prototype.replaceNode = DOMTool.replaceNode;
DOMTool.prototype.removeNode = DOMTool.removeNode;
DOMTool.prototype.insertBefore = DOMTool.insertBefore;
DOMTool.prototype.insertAfter = DOMTool.insertAfter;
DOMTool.prototype.insert = DOMTool.insert;
DOMTool.prototype.getChildElementForSelector = DOMTool.getChildElementForSelector;
DOMTool.prototype.getMarkerComment = DOMTool.getMarkerComment;
DOMTool.prototype.insertAtMarkerComment = DOMTool.insertAtMarkerComment;
DOMTool.prototype.clear = DOMTool.clear;
DOMTool.prototype.validateChildEvent = DOMTool.validateChildEvent;
DOMTool.prototype.getElementSizesInPx = DOMTool.getElementSizesInPx;

export const getComputedStyle = DOMTool.getComputedStyle; // jshint ignore:line
export const getComputedPropertyValues = DOMTool.getComputedPropertyValues;
export const getElementSizesInPx = DOMTool.getElementSizesInPx;
