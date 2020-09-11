/**
 * @param {any} n
 * @returns {boolean}
 * @memberof Core
 */
function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 * Extend properties of an object
 * @param {object} target
 * @returns {object}
 * @memberof Core
 */
function extend(target) {
  var sources = [].slice.call(arguments, 1);
  sources.forEach(function (source) {
    if (!source) return;
    Object.getOwnPropertyNames(source).forEach(function (propName) {
      Object.defineProperty(target, propName, Object.getOwnPropertyDescriptor(source, propName));
    });
  });
  return target;
}

/**
 * Find direct decendents of an element
 * @param {element} el
 * @returns {element[]} children
 * @memberof Core
 */
function findChildren(el) {
  var result = [];
  var childNodes = el.childNodes;
  for (var i = 0; i < childNodes.length; i++) {
    let node = childNodes[i];
    if (node.nodeType === 1) {
      result.push(node);
    }
  }
  return result;
}

/**
 * Get type of an object
 * @param {object} obj
 * @returns {string} type
 * @memberof Core
 */
function type(obj) {
  return Object.prototype.toString.call(obj).slice(8, -1);
}

/**
 * Find all parents (ancestors) of an element
 * @param {element} node
 * @returns {element[]} parents
 * @memberof Core
 */
function parents(node) {
  const nodes = [node];
  for (; node; node = node.parentNode) {
    nodes.unshift(node);
  }
  return nodes;
}

/**
 * Lightweight Polyfill for DOM Range
 * @class
 * @memberof Core
 */
class RangeObject {
  constructor() {
    this.collapsed = false;
    this.commonAncestorContainer = undefined;
    this.endContainer = undefined;
    this.endOffset = undefined;
    this.startContainer = undefined;
    this.startOffset = undefined;
  }

  setStart(startNode, startOffset) {
    this.startContainer = startNode;
    this.startOffset = startOffset;

    if (!this.endContainer) {
      this.collapse(true);
    } else {
      this.commonAncestorContainer = this._commonAncestorContainer();
    }

    this._checkCollapsed();
  }

  setEnd(endNode, endOffset) {
    this.endContainer = endNode;
    this.endOffset = endOffset;

    if (!this.startContainer) {
      this.collapse(false);
    } else {
      this.collapsed = false;
      this.commonAncestorContainer = this._commonAncestorContainer();
    }

    this._checkCollapsed();
  }

  collapse(toStart) {
    this.collapsed = true;
    if (toStart) {
      this.endContainer = this.startContainer;
      this.endOffset = this.startOffset;
      this.commonAncestorContainer = this.startContainer.parentNode;
    } else {
      this.startContainer = this.endContainer;
      this.startOffset = this.endOffset;
      this.commonAncestorContainer = this.endOffset.parentNode;
    }
  }

  selectNode(referenceNode) {
    let parent = referenceNode.parentNode;
    let index = Array.prototype.indexOf.call(parent.childNodes, referenceNode);
    this.setStart(parent, index);
    this.setEnd(parent, index + 1);
  }

  selectNodeContents(referenceNode) {
    const endIndex = (referenceNode.nodeType === 3) ? referenceNode.textContent.length : parent.childNodes.length;
    this.setStart(referenceNode, 0);
    this.setEnd(referenceNode, endIndex);
  }

  _commonAncestorContainer(startContainer, endContainer) {
    const startParents = parents(startContainer || this.startContainer);
    const endParents = parents(endContainer || this.endContainer);

    if (startParents[0] != endParents[0]) return undefined;

    for (let i = 0; i < startParents.length; i++) {
      if (startParents[i] != endParents[i]) {
        return startParents[i - 1];
      }
    }
  }

  _checkCollapsed() {
    this.collapsed = this.startContainer === this.endContainer && this.startOffset === this.endOffset;
  }

  toString() {
    // TODO: implement walking between start and end to find text
  }
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_NODE = 9;

/**
 * Parsing and creation of EpubCFIs: http://www.idpf.org/epub/linking/cfi/epub-cfi.html

 * Implements:
 * - Character Offset: epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)
 * - Simple Ranges : epubcfi(/6/4[chap01ref]!/4[body01]/10[para05],/2/1:1,/3:4)

 * Does Not Implement:
 * - Temporal Offset (~)
 * - Spatial Offset (@)
 * - Temporal-Spatial Offset (~ + @)
 * - Text Location Assertion ([)
 * @class
 @param {string | Range | Node } [cfiFrom]
 @param {string | object} [base]
 @param {string} [ignoreClass] class to ignore when parsing DOM
 */
class EpubCFI {
  constructor(cfiFrom, base, ignoreClass) {
    var type;

    this.str = "";

    this.base = {};
    this.spinePos = 0; // For compatibility

    this.range = false; // true || false;

    this.path = {};
    this.start = null;
    this.end = null;

    // Allow instantiation without the "new" keyword
    if (!(this instanceof EpubCFI)) {
      return new EpubCFI(cfiFrom, base, ignoreClass);
    }

    if (typeof base === "string") {
      this.base = EpubCFI.parseComponent(base);
    } else if (typeof base === "object" && base.steps) {
      this.base = base;
    }

    type = this.checkType(cfiFrom);


    if (type === "string") {
      this.str = cfiFrom;
      return extend(this, EpubCFI.parse(cfiFrom));
    } else if (type === "range") {
      return extend(this, this.fromRange(cfiFrom, this.base, ignoreClass));
    } else if (type === "node") {
      return extend(this, this.fromNode(cfiFrom, this.base, ignoreClass));
    } else if (type === "EpubCFI" && cfiFrom.path) {
      return cfiFrom;
    } else if (!cfiFrom) {
      return this;
    } else {
      throw new TypeError("not a valid argument for EpubCFI");
    }

  }

  /**
   * Check the type of constructor input
   * @private
   */
  checkType(cfi) {

    if (this.isCfiString(cfi)) {
      return "string";
      // Is a range object
    } else if (cfi && typeof cfi === "object" && (type(cfi) === "Range" || typeof (cfi.startContainer) != "undefined")) {
      return "range";
    } else if (cfi && typeof cfi === "object" && typeof (cfi.nodeType) != "undefined") { // || typeof cfi === "function"
      return "node";
    } else if (cfi && typeof cfi === "object" && cfi instanceof EpubCFI) {
      return "EpubCFI";
    } else {
      return false;
    }
  }

  /**
   * Parse a cfi string to a CFI object representation
   * @param {string} cfiStr
   * @returns {object} cfi
   */
  static parse(cfiStr) {
    const cfi = {
      spinePos: -1,
      range: false,
      base: {},
      path: {},
      start: null,
      end: null
    };
    let baseComponent, pathComponent, range;

    if (typeof cfiStr !== "string") {
      return {spinePos: -1};
    }

    if (cfiStr.indexOf("epubcfi(") === 0 && cfiStr[cfiStr.length - 1] === ")") {
      // Remove intial epubcfi( and ending )
      cfiStr = cfiStr.slice(8, cfiStr.length - 1);
    }

    baseComponent = EpubCFI.getChapterComponent(cfiStr);

    // Make sure this is a valid cfi or return
    if (!baseComponent) {
      return {spinePos: -1};
    }

    cfi.base = EpubCFI.parseComponent(baseComponent);
    cfi.chapterComponent = baseComponent;

    pathComponent = EpubCFI.getPathComponent(cfiStr);
    cfi.path = EpubCFI.parseComponent(pathComponent);
    cfi.pathComponent = pathComponent;

    range = EpubCFI.getRange(cfiStr);

    if (range) {
      cfi.range = true;
      cfi.start = EpubCFI.parseComponent(range[0]);
      cfi.end = EpubCFI.parseComponent(range[1]);
    }

    // Get spine node position
    // cfi.spineSegment = cfi.base.steps[1];

    // Chapter segment is always the second step
    cfi.spinePos = cfi.base.steps[1].index;

    return cfi;
  }

  static parseComponent(componentStr) {
    var component = {
      steps: [],
      terminal: {
        offset: null,
        assertion: null
      }
    };
    var parts = componentStr.split(":");
    var steps = parts[0].split("/");
    var terminal;

    if (parts.length > 1) {
      terminal = parts[1];
      component.terminal = EpubCFI.parseTerminal(terminal);
    }

    if (steps[0] === "") {
      steps.shift(); // Ignore the first slash
    }

    component.steps = steps.map(EpubCFI.parseStep);

    return component;
  }

  static parseStep(stepStr) {
    var type, num, index, has_brackets, id;

    has_brackets = stepStr.match(/\[(.*)\]/);
    if (has_brackets && has_brackets[1]) {
      id = has_brackets[1];
    }

    //-- Check if step is a text node or element
    num = parseInt(stepStr);

    if (isNaN(num)) {
      return;
    }

    if (num % 2 === 0) { // Even = is an element
      type = "element";
      index = num / 2 - 1;
    } else {
      type = "text";
      index = (num - 1) / 2;
    }

    return {
      "type": type,
      "index": index,
      "id": id || null
    };
  }

  static parseTerminal(termialStr) {
    var characterOffset, textLocationAssertion;
    var assertion = termialStr.match(/\[(.*)\]/);

    if (assertion && assertion[1]) {
      characterOffset = parseInt(termialStr.split("[")[0]);
      textLocationAssertion = assertion[1];
    } else {
      characterOffset = parseInt(termialStr);
    }

    if (!isNumber(characterOffset)) {
      characterOffset = null;
    }

    return {
      offset: characterOffset,
      assertion: textLocationAssertion
    };

  }

  static getChapterComponent(cfiStr) {
    const indirection = cfiStr.split('!');
    return indirection[0];
  }

  static getPathComponent(cfiStr) {
    const indirection = cfiStr.split('!');

    if (indirection[1]) {
      let ranges = indirection[1].split(',');
      return ranges[0];
    }
  }

  static getRange(cfiStr) {
    const ranges = cfiStr.split(',');

    if (ranges.length === 3) {
      return [
        ranges[1],
        ranges[2]
      ];
    }

    return false;
  }

  static getCharecterOffsetComponent(cfiStr) {
    const splitStr = cfiStr.split(':');
    return splitStr[1] || '';
  }

  joinSteps(steps) {
    if (!steps) {
      return '';
    }

    return steps.map(function (part) {
      var segment = "";

      if (part.type === "element") {
        segment += (part.index + 1) * 2;
      }

      if (part.type === "text") {
        segment += 1 + (2 * part.index); // TODO: double check that this is odd
      }

      if (part.id) {
        segment += "[" + part.id + "]";
      }

      return segment;

    }).join("/");

  }

  segmentString(segment) {
    var segmentString = "/";

    segmentString += this.joinSteps(segment.steps);

    if (segment.terminal && segment.terminal.offset != null) {
      segmentString += ":" + segment.terminal.offset;
    }

    if (segment.terminal && segment.terminal.assertion != null) {
      segmentString += "[" + segment.terminal.assertion + "]";
    }

    return segmentString;
  }

  /**
   * Convert CFI to a epubcfi(...) string
   * @returns {string} epubcfi
   */
  toString() {
    var cfiString = "epubcfi(";

    cfiString += this.segmentString(this.base);

    cfiString += "!";
    cfiString += this.segmentString(this.path);

    // Add Range, if present
    if (this.range && this.start) {
      cfiString += ",";
      cfiString += this.segmentString(this.start);
    }

    if (this.range && this.end) {
      cfiString += ",";
      cfiString += this.segmentString(this.end);
    }

    cfiString += ")";

    return cfiString;
  }


  /**
   * Compare which of two CFIs is earlier in the text
   * @returns {number} First is earlier = -1, Second is earlier = 1, They are equal = 0
   */
  static compare(cfiOne, cfiTwo) {
    let stepsA, stepsB;
    let terminalA, terminalB;

    if (typeof cfiOne === "string") {
      cfiOne = new EpubCFI(cfiOne);
    }
    if (typeof cfiTwo === "string") {
      cfiTwo = new EpubCFI(cfiTwo);
    }
    // Compare Spine Positions
    if (cfiOne.spinePos > cfiTwo.spinePos) {
      return 1;
    }
    if (cfiOne.spinePos < cfiTwo.spinePos) {
      return -1;
    }

    if (cfiOne.range) {
      stepsA = cfiOne.path.steps.concat(cfiOne.start.steps);
      terminalA = cfiOne.start.terminal;
    } else {
      stepsA = cfiOne.path.steps;
      terminalA = cfiOne.path.terminal;
    }

    if (cfiTwo.range) {
      stepsB = cfiTwo.path.steps.concat(cfiTwo.start.steps);
      terminalB = cfiTwo.start.terminal;
    } else {
      stepsB = cfiTwo.path.steps;
      terminalB = cfiTwo.path.terminal;
    }

    // Compare Each Step in the First item
    for (let i = 0; i < stepsA.length; i++) {
      if (!stepsA[i]) {
        return -1;
      }
      if (!stepsB[i]) {
        return 1;
      }
      if (stepsA[i].index > stepsB[i].index) {
        return 1;
      }
      if (stepsA[i].index < stepsB[i].index) {
        return -1;
      }
      // Otherwise continue checking
    }

    // All steps in First equal to Second and First is Less Specific
    if (stepsA.length < stepsB.length) {
      return 1;
    }

    // Compare the character offset of the text node
    if (terminalA.offset > terminalB.offset) {
      return 1;
    }
    if (terminalA.offset < terminalB.offset) {
      return -1;
    }

    // CFI's are equal
    return 0;
  }

  step(node) {
    var nodeType = (node.nodeType === TEXT_NODE) ? "text" : "element";

    return {
      "id": node.id,
      "tagName": node.tagName,
      "type": nodeType,
      "index": this.position(node)
    };
  }

  filteredStep(node, ignoreClass) {
    var filteredNode = this.filter(node, ignoreClass);
    var nodeType;

    // Node filtered, so ignore
    if (!filteredNode) {
      return;
    }

    // Otherwise add the filter node in
    nodeType = (filteredNode.nodeType === TEXT_NODE) ? "text" : "element";

    return {
      "id": filteredNode.id,
      "tagName": filteredNode.tagName,
      "type": nodeType,
      "index": this.filteredPosition(filteredNode, ignoreClass)
    };
  }

  pathTo(node, offset, ignoreClass) {
    var segment = {
      steps: [],
      terminal: {
        offset: null,
        assertion: null
      }
    };
    var currentNode = node;
    var step;

    while (currentNode && currentNode.parentNode && currentNode.parentNode.nodeType != DOCUMENT_NODE) {

      if (ignoreClass) {
        step = this.filteredStep(currentNode, ignoreClass);
      } else {
        step = this.step(currentNode);
      }

      if (step) {
        segment.steps.unshift(step);
      }

      currentNode = currentNode.parentNode;
    }

    if (offset != null && offset >= 0) {

      segment.terminal.offset = offset;

      // Make sure we are getting to a textNode if there is an offset
      if (segment.steps[segment.steps.length - 1].type != "text") {
        segment.steps.push({
          "type": "text",
          "index": 0
        });
      }

    }

    return segment;
  }

  equalStep(stepA, stepB) {
    if (!stepA || !stepB) {
      return false;
    }

    if (stepA.index === stepB.index &&
      stepA.id === stepB.id &&
      stepA.type === stepB.type) {
      return true;
    }

    return false;
  }

  /**
   * Create a CFI object from a Range
   * @param {Range} range
   * @param {string | object} base
   * @param {string} [ignoreClass]
   * @returns {object} cfi
   */
  fromRange(range, base, ignoreClass) {
    var cfi = {
      range: false,
      base: {},
      path: {},
      start: null,
      end: null
    };

    var start = range.startContainer;
    var end = range.endContainer;

    var startOffset = range.startOffset;
    var endOffset = range.endOffset;

    var needsIgnoring = false;

    if (ignoreClass) {
      // Tell pathTo if / what to ignore
      needsIgnoring = (start.ownerDocument.querySelector("." + ignoreClass) != null);
    }


    if (typeof base === "string") {
      cfi.base = EpubCFI.parseComponent(base);
      cfi.spinePos = cfi.base.steps[1].index;
    } else if (typeof base === "object") {
      cfi.base = base;
    }

    if (range.collapsed) {
      if (needsIgnoring) {
        startOffset = this.patchOffset(start, startOffset, ignoreClass);
      }
      cfi.path = this.pathTo(start, startOffset, ignoreClass);
    } else {
      cfi.range = true;

      if (needsIgnoring) {
        startOffset = this.patchOffset(start, startOffset, ignoreClass);
      }

      cfi.start = this.pathTo(start, startOffset, ignoreClass);
      if (needsIgnoring) {
        endOffset = this.patchOffset(end, endOffset, ignoreClass);
      }

      cfi.end = this.pathTo(end, endOffset, ignoreClass);

      // Create a new empty path
      cfi.path = {
        steps: [],
        terminal: null
      };

      // Push steps that are shared between start and end to the common path
      var len = cfi.start.steps.length;
      var i;

      for (i = 0; i < len; i++) {
        if (this.equalStep(cfi.start.steps[i], cfi.end.steps[i])) {
          if (i === len - 1) {
            // Last step is equal, check terminals
            if (cfi.start.terminal === cfi.end.terminal) {
              // CFI's are equal
              cfi.path.steps.push(cfi.start.steps[i]);
              // Not a range
              cfi.range = false;
            }
          } else {
            cfi.path.steps.push(cfi.start.steps[i]);
          }

        } else {
          break;
        }
      }

      cfi.start.steps = cfi.start.steps.slice(cfi.path.steps.length);
      cfi.end.steps = cfi.end.steps.slice(cfi.path.steps.length);

      // TODO: Add Sanity check to make sure that the end if greater than the start
    }

    return cfi;
  }

  /**
   * Create a CFI object from a Node
   * @param {Node} anchor
   * @param {string | object} base
   * @param {string} [ignoreClass]
   * @returns {object} cfi
   */
  fromNode(anchor, base, ignoreClass) {
    var cfi = {
      range: false,
      base: {},
      path: {},
      start: null,
      end: null
    };

    if (typeof base === "string") {
      cfi.base = EpubCFI.parseComponent(base);
      cfi.spinePos = cfi.base.steps[1].index;
    } else if (typeof base === "object") {
      cfi.base = base;
    }

    cfi.path = this.pathTo(anchor, null, ignoreClass);

    return cfi;
  }

  filter(anchor, ignoreClass) {
    var needsIgnoring;
    var sibling; // to join with
    var parent, previousSibling, nextSibling;
    var isText = false;

    if (anchor.nodeType === TEXT_NODE) {
      isText = true;
      parent = anchor.parentNode;
      needsIgnoring = anchor.parentNode.classList.contains(ignoreClass);
    } else {
      isText = false;
      needsIgnoring = anchor.classList.contains(ignoreClass);
    }

    if (needsIgnoring && isText) {
      previousSibling = parent.previousSibling;
      nextSibling = parent.nextSibling;

      // If the sibling is a text node, join the nodes
      if (previousSibling && previousSibling.nodeType === TEXT_NODE) {
        sibling = previousSibling;
      } else if (nextSibling && nextSibling.nodeType === TEXT_NODE) {
        sibling = nextSibling;
      }

      if (sibling) {
        return sibling;
      } else {
        // Parent will be ignored on next step
        return anchor;
      }

    } else if (needsIgnoring && !isText) {
      // Otherwise just skip the element node
      return false;
    } else {
      // No need to filter
      return anchor;
    }

  }

  patchOffset(anchor, offset, ignoreClass) {
    if (anchor.nodeType != TEXT_NODE) {
      throw new Error("Anchor must be a text node");
    }

    var curr = anchor;
    var totalOffset = offset;

    // If the parent is a ignored node, get offset from it's start
    if (anchor.parentNode.classList.contains(ignoreClass)) {
      curr = anchor.parentNode;
    }

    while (curr.previousSibling) {
      if (curr.previousSibling.nodeType === ELEMENT_NODE) {
        // Originally a text node, so join
        if (curr.previousSibling.classList.contains(ignoreClass)) {
          totalOffset += curr.previousSibling.textContent.length;
        } else {
          break; // Normal node, dont join
        }
      } else {
        // If the previous sibling is a text node, join the nodes
        totalOffset += curr.previousSibling.textContent.length;
      }

      curr = curr.previousSibling;
    }

    return totalOffset;

  }

  normalizedMap(children, nodeType, ignoreClass) {
    var output = {};
    var prevIndex = -1;
    var i, len = children.length;
    var currNodeType;
    var prevNodeType;

    for (i = 0; i < len; i++) {

      currNodeType = children[i].nodeType;

      // Check if needs ignoring
      if (currNodeType === ELEMENT_NODE &&
        children[i].classList.contains(ignoreClass)) {
        currNodeType = TEXT_NODE;
      }

      if (i > 0 &&
        currNodeType === TEXT_NODE &&
        prevNodeType === TEXT_NODE) {
        // join text nodes
        output[i] = prevIndex;
      } else if (nodeType === currNodeType) {
        prevIndex = prevIndex + 1;
        output[i] = prevIndex;
      }

      prevNodeType = currNodeType;

    }

    return output;
  }

  position(anchor) {
    var children, index;
    if (anchor.nodeType === ELEMENT_NODE) {
      children = anchor.parentNode.children;
      if (!children) {
        children = findChildren(anchor.parentNode);
      }
      index = Array.prototype.indexOf.call(children, anchor);
    } else {
      children = this.textNodes(anchor.parentNode);
      index = children.indexOf(anchor);
    }

    return index;
  }

  filteredPosition(anchor, ignoreClass) {
    var children, index, map;

    if (anchor.nodeType === ELEMENT_NODE) {
      children = anchor.parentNode.children;
      map = this.normalizedMap(children, ELEMENT_NODE, ignoreClass);
    } else {
      children = anchor.parentNode.childNodes;
      // Inside an ignored node
      if (anchor.parentNode.classList.contains(ignoreClass)) {
        anchor = anchor.parentNode;
        children = anchor.parentNode.childNodes;
      }
      map = this.normalizedMap(children, TEXT_NODE, ignoreClass);
    }


    index = Array.prototype.indexOf.call(children, anchor);

    return map[index];
  }

  stepsToXpath(steps) {
    var xpath = [".", "*"];

    steps.forEach(function (step) {
      var position = step.index + 1;

      if (step.id) {
        xpath.push("*[position()=" + position + " and @id='" + step.id + "']");
      } else if (step.type === "text") {
        xpath.push("text()[" + position + "]");
      } else {
        xpath.push("*[" + position + "]");
      }
    });

    return xpath.join("/");
  }


  /*

  To get the last step if needed:

  // Get the terminal step
  lastStep = steps[steps.length-1];
  // Get the query string
  query = this.stepsToQuery(steps);
  // Find the containing element
  startContainerParent = doc.querySelector(query);
  // Find the text node within that element
  if(startContainerParent && lastStep.type == "text") {
    container = startContainerParent.childNodes[lastStep.index];
  }
  */
  stepsToQuerySelector(steps) {
    var query = ["html"];

    steps.forEach(function (step) {
      var position = step.index + 1;

      if (step.id) {
        query.push("#" + step.id);
      } else if (step.type === "text") {
        // unsupported in querySelector
        // query.push("text()[" + position + "]");
      } else {
        query.push("*:nth-child(" + position + ")");
      }
    });

    return query.join(">");

  }

  textNodes(container, ignoreClass) {
    return Array.prototype.slice.call(container.childNodes).filter(function (node) {
      if (node.nodeType === TEXT_NODE) {
        return true;
      } else if (ignoreClass && node.classList.contains(ignoreClass)) {
        return true;
      }
      return false;
    });
  }

  walkToNode(steps, _doc, ignoreClass) {
    var doc = _doc || document;
    var container = doc.documentElement;
    var children;
    var step;
    var len = steps.length;
    var i;

    for (i = 0; i < len; i++) {
      step = steps[i];

      if (step.type === "element") {
        //better to get a container using id as some times step.index may not be correct
        //For ex.https://github.com/futurepress/epub.js/issues/561
        if (step.id) {
          container = doc.getElementById(step.id);
        } else {
          children = container.children || findChildren(container);
          container = children[step.index];
        }
      } else if (step.type === "text") {
        container = this.textNodes(container, ignoreClass)[step.index];
      }
      if (!container) {
        //Break the for loop as due to incorrect index we can get error if
        //container is undefined so that other functionailties works fine
        //like navigation
        break;
      }

    }

    return container;
  }

  findNode(steps, _doc, ignoreClass) {
    var doc = _doc || document;
    var container;
    var xpath;

    if (!ignoreClass && typeof doc.evaluate != "undefined") {
      xpath = this.stepsToXpath(steps);
      container = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } else if (ignoreClass) {
      container = this.walkToNode(steps, doc, ignoreClass);
    } else {
      container = this.walkToNode(steps, doc);
    }

    return container;
  }

  fixMiss(steps, offset, _doc, ignoreClass) {
    var container = this.findNode(steps.slice(0, -1), _doc, ignoreClass);
    var children = container.childNodes;
    var map = this.normalizedMap(children, TEXT_NODE, ignoreClass);
    var child;
    var len;
    var lastStepIndex = steps[steps.length - 1].index;

    for (let childIndex in map) {
      if (!map.hasOwnProperty(childIndex)) return;

      if (map[childIndex] === lastStepIndex) {
        child = children[childIndex];
        len = child.textContent.length;
        if (offset > len) {
          offset = offset - len;
        } else {
          if (child.nodeType === ELEMENT_NODE) {
            container = child.childNodes[0];
          } else {
            container = child;
          }
          break;
        }
      }
    }

    return {
      container: container,
      offset: offset
    };

  }

  /**
   * Creates a DOM range representing a CFI
   * @param {document} _doc document referenced in the base
   * @param {string} [ignoreClass]
   * @return {Range}
   */
  toRange(_doc, ignoreClass) {
    var doc = _doc || document;
    var range;
    var start, end, startContainer, endContainer;
    var cfi = this;
    var startSteps, endSteps;
    var needsIgnoring = ignoreClass ? (doc.querySelector("." + ignoreClass) != null) : false;
    var missed;

    if (typeof (doc.createRange) !== "undefined") {
      range = doc.createRange();
    } else {
      range = new RangeObject();
    }

    if (cfi.range) {
      start = cfi.start;
      startSteps = cfi.path.steps.concat(start.steps);
      startContainer = this.findNode(startSteps, doc, needsIgnoring ? ignoreClass : null);
      end = cfi.end;
      endSteps = cfi.path.steps.concat(end.steps);
      endContainer = this.findNode(endSteps, doc, needsIgnoring ? ignoreClass : null);
    } else {
      start = cfi.path;
      startSteps = cfi.path.steps;
      startContainer = this.findNode(cfi.path.steps, doc, needsIgnoring ? ignoreClass : null);
    }

    if (startContainer) {
      try {

        if (start.terminal.offset != null) {
          range.setStart(startContainer, start.terminal.offset);
        } else {
          range.setStart(startContainer, 0);
        }

      } catch (e) {
        missed = this.fixMiss(startSteps, start.terminal.offset, doc, needsIgnoring ? ignoreClass : null);
        range.setStart(missed.container, missed.offset);
      }
    } else {
      console.log("No startContainer found for", this.toString());
      // No start found
      return null;
    }

    if (endContainer) {
      try {

        if (end.terminal.offset != null) {
          range.setEnd(endContainer, end.terminal.offset);
        } else {
          range.setEnd(endContainer, 0);
        }

      } catch (e) {
        missed = this.fixMiss(endSteps, cfi.end.terminal.offset, doc, needsIgnoring ? ignoreClass : null);
        range.setEnd(missed.container, missed.offset);
      }
    }


    // doc.defaultView.getSelection().addRange(range);
    return range;
  }

  /**
   * Check if a string is wrapped with "epubcfi()"
   * @param {string} str
   * @returns {boolean}
   */
  isCfiString(str) {
    if (typeof str === "string" &&
      str.indexOf("epubcfi(") === 0 &&
      str[str.length - 1] === ")") {
      return true;
    }

    return false;
  }

  generateChapterComponent(_spineNodeIndex, _pos, id) {
    var pos = parseInt(_pos),
      spineNodeIndex = (_spineNodeIndex + 1) * 2,
      cfi = "/" + spineNodeIndex + "/";

    cfi += (pos + 1) * 2;

    if (id) {
      cfi += "[" + id + "]";
    }

    return cfi;
  }

  /**
   * Collapse a CFI Range to a single CFI Position
   * @param {boolean} [toStart=false]
   */
  collapse(toStart) {
    if (!this.range) {
      return;
    }

    this.range = false;

    if (toStart) {
      this.path.steps = this.path.steps.concat(this.start.steps);
      this.path.terminal = this.start.terminal;
    } else {
      this.path.steps = this.path.steps.concat(this.end.steps);
      this.path.terminal = this.end.terminal;
    }

  }
}

function isValidTextNode(node) {
  if (!node) {
    return false;
  }
  if (node.nodeType === Node.TEXT_NODE) {
    return isValidTextNodeContent(node.nodeValue);
  }

  return false;
}

function isValidTextNodeContent(text) {
  // Heuristic to find a text node with actual text
  // If we don't do this, we may get a reference to a node that doesn't get rendered
  // (such as for example a node that has tab character and a bunch of spaces)
  // this is would be bad! ask me why.
  return !!text.trim().length;
}

function isRectVisible(rect, frameRect) {
  // Text nodes without printable text don't have client rectangles
  if (!rect) {
    return false;
  }
  // Sometimes we get client rects that are "empty" and aren't supposed to be visible
  if (rect.left === 0 && rect.right === 0 && rect.top === 0 && rect.bottom === 0) {
    return false;
  }

  return intersectRect(rect, frameRect);
}

function computeCharacterOffset(textNode, frameRect) {
  const range = document.createRange();
  range.selectNode(textNode);
  let textTotalSurface = 0, textVisibleSurface = 0;
  Array.from(range.getClientRects()).forEach((current) => {
    const surface = current.width * current.height;
    textTotalSurface += surface;
    if (intersectRect(current, frameRect)) {
      textVisibleSurface += surface;
    }
  });

  const ratio = 1 - (textVisibleSurface / textTotalSurface);
  return Math.round(textNode.wholeText.length * ratio);
}

function isNodeElementVisible(node, frameRect) {
  if (node.nodeType === Node.TEXT_NODE) {
    const range = document.createRange();
    range.selectNode(node);
    const clientRectList = range.getClientRects();
    return Array.from(clientRectList).some(rect => isRectVisible(rect, frameRect));
  } else {
    const elementRect = node.getBoundingClientRect();
    return isRectVisible(elementRect, frameRect);
  }
}

function intersectRect(r1, r2) {
  return !(r2.left >= r1.right ||
    r2.right <= r1.left ||
    r2.top >= r1.bottom ||
    r2.bottom <= r1.top);
}

function findVisibleElements(viewport) {
  const bodyElement = document.body;

  if (!bodyElement) {
    return null;
  }

  const visibleElements = [];

  const treeWalker = document.createTreeWalker(
    bodyElement,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    function (node) {
      if (node.nodeType === Node.TEXT_NODE && !isValidTextNode(node)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
    false
  );

  while (treeWalker.nextNode()) {
    const node = treeWalker.currentNode;

    if (isNodeElementVisible(node, viewport)) {
      visibleElements.push(node);
      if (node.nodeType === Node.TEXT_NODE) {
        break;
      }
    }
  }

  return visibleElements;
}

function getFirstVisiblePartialCfi(viewport) {
  const elements = findVisibleElements(viewport);
  if (elements.length === 0) {
    return null;
  }

  let cfiElementFrom = null;
  const textNode = elements.find(el => el.nodeType === Node.TEXT_NODE);
  if (textNode) {
    cfiElementFrom = document.createRange();
    cfiElementFrom.setStart(textNode, computeCharacterOffset(textNode, viewport));
  } else {
    cfiElementFrom = elements.pop();
  }

  const cfi = new EpubCFI(cfiElementFrom, '/6/2').toString();
  return cfi.substring(13, cfi.length - 1);
}
