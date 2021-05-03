
function elementGetComposititionInfo(elem) {
    columnCount
    columnWidht

    // the info here is crucial to get e.g. the x of a line start and
    // the x of a line end, taking into account the column setup
    // we want to know if we left the column.



}
getMaxLineLength(node) {
    // I'm thinking here, node should be a text-node or an inline-element
    // it will go up it's ancestry until it finds it's forst block element
    // parent.
    // form that we can get the total available space for text,
    // that is blockParent.clientWidth - blockParent.paddingLeft - blockParent.paddingRight
    // NOTE: clientWidth:  property is zero for inline elements ... It includes padding
    //
    // Then, we're also dealing with column layouts
    // one of our assumptions is that the contents are laid out, according
    // to the column setup, browsers can mess this up to their liking if
    // the content does not fit the column-width, but I don't want to dive
    // into that now.
    // column spec is column width, columns count, coulumn gap
    // if we know column width, that's our line length
    // otherwise, it's the available space.

    // here also another thing becomes important: within columns, e.g. <ul><li>
    // contents will have paddings, so columnWidth is insufficient, because
    // we lose space there!


    // max line length is also crucial to make the line contents as wide as
    // possible. And since we use


    offsetParent =

function getClosestBlockParent(node) {
  // if node is a block it will be returned
  let elem;
  if(node.type === Node.ELEMENT_NODE)
    elem = node;
  else
    elem = node.parentElement;

  while(true){
      // Used to identify a block element, elem.clientWidth is 0 for inline
      // elements. To futher distinguish, elem.getBoundlingClientRect()
      // would return for an inline and a block element a width, that is
      // also for an inline element not 0 (unless is may be empty?).
      if(elem.clientWidth !== 0)
      // got a block
      return elem
    elem = elem.parentNode;
  }
}

function getMaxLineWidth(node) {
  let block = getClosestBlock(node)
    , width = block.clientWidth // boo!
    , style = block.ownerDocument.defaultView.getComputedStyle(block)
    , paddingLeft = parseFloat(style.getPropertyValue('padding-left'))
    , paddingRight =  parseFloat(style.getPropertyValue('padding-right'))
    , rawLine = width - paddingLeft - paddingRight
    ;
  console.log(
`rawLine ${rawLine}
width ${width}
paddingLeft ${paddingLeft} paddingRight ${paddingRight}
`,
  block);

}


//window.clickProxy = e=>window.clickHandler(e)
//document.body.addEventListener('click',window.clickProxy, true);
function clickHandler(e){
    e.preventDefault();
    console.log(e.target, e.x, e.y  );

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(e.clientX, e.clientY);
    textNode = range.startContainer;
    offset = range.startOffset;
  } else if (document.caretPositionFromPoint) {
    range = document.caretPositionFromPoint(e.clientX, e.clientY);
    textNode = range.offsetNode;
    offset = range.offset;
  }
  console.log(textNode, offset)
  let r = new Range()
	r.setStart(textNode, 0)
  r.setEnd(textNode, textNode.data.length)
  console.log(r.getBoundingClientRect());
  getMaxLineWidth(textNode)
}

 findLines()
window.clickHandler = clickHandler;



var elem = document.querySelector('.mw-parser-output')
  , style = getComputedStyle(elem);

for(let k of ['column-width', 'column-gap', 'column-count'])
	console.log(`${k}:`, style.getPropertyValue(k))

column-width: 320px
column-gap: 16px
column-count: 4

spanning four colums:
<p>.getClientRects()
DOMRectList
​
0: DOMRect { x: 219.39999389648438, y: 39.41667175292969, width: 321.25, … }
1: DOMRect { x: 556.6500244140625, y: 39.41667175292969, width: 321.25, … }
2: DOMRect { x: 893.9000244140625, y: 39.41667175292969, width: 321.25, … }
3: DOMRect { x: 1231.1500244140625, y: 39.41667175292969, width: 321.25, … }

length: 4
​
}

// FIXME: need to refine how these basic infos are gathered.
    var computed = elem.ownerDocument.defaultView.getComputedStyle(elem)
      , getStylesAsFloat =(...props)=>props.map(
                    prop=>parseFloat(computed.getPropertyValue(prop)))
      , [columnWidth, columnGap, columnCount,
         paddingLeft, paddingRight
        ] = getStylesAsFloat('column-width', 'column-gap', 'column-count',
                             'padding-left', 'padding-right')
      , availableWidth = elem.getBoundingClientRect().width - paddingLeft - paddingRight

    if(computed.getPropertyValue('column-count') === 'auto'){
        columnWidth = availableWidth;
        columnGap = 0;
        columnCount = 1;
    }
