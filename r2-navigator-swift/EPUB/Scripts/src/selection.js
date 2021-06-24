//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import { log as logNative, logException } from "./utils";

const debug = true;

export function getSelectionRect() {
  try {
    let sel = window.getSelection();
    if (!sel) {
      return;
    }
    let range = sel.getRangeAt(0);

    const clientRect = range.getBoundingClientRect();

    return {
      screenWidth: window.outerWidth,
      screenHeight: window.outerHeight,
      left: clientRect.left,
      width: clientRect.width,
      top: clientRect.top,
      height: clientRect.height,
    };
  } catch (e) {
    logException(e);
    return null;
  }
}

export function getCurrentSelectionInfo() {
  const selection = window.getSelection();
  if (!selection) {
    return undefined;
  }
  if (selection.isCollapsed) {
    log("^^^ SELECTION COLLAPSED.");
    return undefined;
  }
  const rawText = selection.toString();
  const cleanText = rawText.trim().replace(/\n/g, " ").replace(/\s\s+/g, " ");
  if (cleanText.length === 0) {
    log("^^^ SELECTION TEXT EMPTY.");
    return undefined;
  }
  if (!selection.anchorNode || !selection.focusNode) {
    return undefined;
  }
  const range =
    selection.rangeCount === 1
      ? selection.getRangeAt(0)
      : createOrderedRange(
          selection.anchorNode,
          selection.anchorOffset,
          selection.focusNode,
          selection.focusOffset
        );
  if (!range || range.collapsed) {
    log("$$$$$$$$$$$$$$$$$ CANNOT GET NON-COLLAPSED SELECTION RANGE?!");
    return undefined;
  }
  const rangeInfo = convertRange(range, fullQualifiedSelector);
  if (!rangeInfo) {
    log("^^^ SELECTION RANGE INFO FAIL?!");
    return undefined;
  }

  return {
    locations: rangeInfo2Location(rangeInfo),
    text: {
      highlight: rawText,
    },
  };
}

function createOrderedRange(startNode, startOffset, endNode, endOffset) {
  const range = new Range();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  if (!range.collapsed) {
    return range;
  }
  log(">>> createOrderedRange COLLAPSED ... RANGE REVERSE?");
  const rangeReverse = new Range();
  rangeReverse.setStart(endNode, endOffset);
  rangeReverse.setEnd(startNode, startOffset);
  if (!rangeReverse.collapsed) {
    log(">>> createOrderedRange RANGE REVERSE OK.");
    return range;
  }
  log(">>> createOrderedRange RANGE REVERSE ALSO COLLAPSED?!");
  return undefined;
}

function convertRange(range, getCssSelector) {
  const startIsElement = range.startContainer.nodeType === Node.ELEMENT_NODE;
  const startContainerElement = startIsElement
    ? range.startContainer
    : range.startContainer.parentNode &&
      range.startContainer.parentNode.nodeType === Node.ELEMENT_NODE
    ? range.startContainer.parentNode
    : undefined;
  if (!startContainerElement) {
    return undefined;
  }
  const startContainerChildTextNodeIndex = startIsElement
    ? -1
    : Array.from(startContainerElement.childNodes).indexOf(
        range.startContainer
      );
  if (startContainerChildTextNodeIndex < -1) {
    return undefined;
  }
  const startContainerElementCssSelector = getCssSelector(
    startContainerElement
  );

  const endIsElement = range.endContainer.nodeType === Node.ELEMENT_NODE;
  const endContainerElement = endIsElement
    ? range.endContainer
    : range.endContainer.parentNode &&
      range.endContainer.parentNode.nodeType === Node.ELEMENT_NODE
    ? range.endContainer.parentNode
    : undefined;
  if (!endContainerElement) {
    return undefined;
  }
  const endContainerChildTextNodeIndex = endIsElement
    ? -1
    : Array.from(endContainerElement.childNodes).indexOf(range.endContainer);
  if (endContainerChildTextNodeIndex < -1) {
    return undefined;
  }
  const endContainerElementCssSelector = getCssSelector(endContainerElement);

  const commonElementAncestor = getCommonAncestorElement(
    range.startContainer,
    range.endContainer
  );
  if (!commonElementAncestor) {
    log("^^^ NO RANGE COMMON ANCESTOR?!");
    return undefined;
  }
  if (range.commonAncestorContainer) {
    const rangeCommonAncestorElement =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentNode;
    if (
      rangeCommonAncestorElement &&
      rangeCommonAncestorElement.nodeType === Node.ELEMENT_NODE
    ) {
      if (commonElementAncestor !== rangeCommonAncestorElement) {
        log(">>>>>> COMMON ANCESTOR CONTAINER DIFF??!");
        log(getCssSelector(commonElementAncestor));
        log(getCssSelector(rangeCommonAncestorElement));
      }
    }
  }
  return {
    endContainerChildTextNodeIndex,
    endContainerElementCssSelector,
    endOffset: range.endOffset,
    startContainerChildTextNodeIndex,
    startContainerElementCssSelector,
    startOffset: range.startOffset,
  };
}

function getCommonAncestorElement(node1, node2) {
  if (node1.nodeType === Node.ELEMENT_NODE && node1 === node2) {
    return node1;
  }
  if (node1.nodeType === Node.ELEMENT_NODE && node1.contains(node2)) {
    return node1;
  }
  if (node2.nodeType === Node.ELEMENT_NODE && node2.contains(node1)) {
    return node2;
  }
  const node1ElementAncestorChain = [];
  let parent = node1.parentNode;
  while (parent && parent.nodeType === Node.ELEMENT_NODE) {
    node1ElementAncestorChain.push(parent);
    parent = parent.parentNode;
  }
  const node2ElementAncestorChain = [];
  parent = node2.parentNode;
  while (parent && parent.nodeType === Node.ELEMENT_NODE) {
    node2ElementAncestorChain.push(parent);
    parent = parent.parentNode;
  }
  let commonAncestor = node1ElementAncestorChain.find(
    (node1ElementAncestor) => {
      return node2ElementAncestorChain.indexOf(node1ElementAncestor) >= 0;
    }
  );
  if (!commonAncestor) {
    commonAncestor = node2ElementAncestorChain.find((node2ElementAncestor) => {
      return node1ElementAncestorChain.indexOf(node2ElementAncestor) >= 0;
    });
  }
  return commonAncestor;
}

export function convertRangeInfo(document, rangeInfo) {
  const startElement = document.querySelector(
    rangeInfo.startContainerElementCssSelector
  );
  if (!startElement) {
    log("^^^ convertRangeInfo NO START ELEMENT CSS SELECTOR?!");
    return undefined;
  }
  let startContainer = startElement;
  if (rangeInfo.startContainerChildTextNodeIndex >= 0) {
    if (
      rangeInfo.startContainerChildTextNodeIndex >=
      startElement.childNodes.length
    ) {
      log(
        "^^^ convertRangeInfo rangeInfo.startContainerChildTextNodeIndex >= startElement.childNodes.length?!"
      );
      return undefined;
    }
    startContainer =
      startElement.childNodes[rangeInfo.startContainerChildTextNodeIndex];
    if (startContainer.nodeType !== Node.TEXT_NODE) {
      log("^^^ convertRangeInfo startContainer.nodeType !== Node.TEXT_NODE?!");
      return undefined;
    }
  }
  const endElement = document.querySelector(
    rangeInfo.endContainerElementCssSelector
  );
  if (!endElement) {
    log("^^^ convertRangeInfo NO END ELEMENT CSS SELECTOR?!");
    return undefined;
  }
  let endContainer = endElement;
  if (rangeInfo.endContainerChildTextNodeIndex >= 0) {
    if (
      rangeInfo.endContainerChildTextNodeIndex >= endElement.childNodes.length
    ) {
      log(
        "^^^ convertRangeInfo rangeInfo.endContainerChildTextNodeIndex >= endElement.childNodes.length?!"
      );
      return undefined;
    }
    endContainer =
      endElement.childNodes[rangeInfo.endContainerChildTextNodeIndex];
    if (endContainer.nodeType !== Node.TEXT_NODE) {
      log("^^^ convertRangeInfo endContainer.nodeType !== Node.TEXT_NODE?!");
      return undefined;
    }
  }
  return createOrderedRange(
    startContainer,
    rangeInfo.startOffset,
    endContainer,
    rangeInfo.endOffset
  );
}

function rangeInfo2Location(rangeInfo) {
  return {
    cssSelector: rangeInfo.startContainerElementCssSelector,
    domRange: {
      start: {
        cssSelector: rangeInfo.startContainerElementCssSelector,
        textNodeIndex: rangeInfo.startContainerChildTextNodeIndex,
        offset: rangeInfo.startOffset,
      },
      end: {
        cssSelector: rangeInfo.endContainerElementCssSelector,
        textNodeIndex: rangeInfo.endContainerChildTextNodeIndex,
        offset: rangeInfo.endOffset,
      },
    },
  };
}

export function location2RangeInfo(location) {
  const locations = location.locations;
  const domRange = locations.domRange;
  const start = domRange.start;
  const end = domRange.end;

  return {
    endContainerChildTextNodeIndex: end.textNodeIndex,
    endContainerElementCssSelector: end.cssSelector,
    endOffset: end.offset,
    startContainerChildTextNodeIndex: start.textNodeIndex,
    startContainerElementCssSelector: start.cssSelector,
    startOffset: start.offset,
  };
}

function fullQualifiedSelector(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return (
      (node.localName && node.localName.toLowerCase()) ||
      node.nodeName.toLowerCase()
    );
  }
  //return cssPath(node, justSelector);
  return cssPath(node, true);
}

function cssPath(node, optimized) {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const steps = [];
  let contextNode = node;
  while (contextNode) {
    const step = _cssPathStep(contextNode, !!optimized, contextNode === node);
    if (!step) {
      break; // Error - bail out early.
    }
    steps.push(step.value);
    if (step.optimized) {
      break;
    }
    contextNode = contextNode.parentNode;
  }
  steps.reverse();
  return steps.join(" > ");
}

// https://chromium.googlesource.com/chromium/blink/+/master/Source/devtools/front_end/components/DOMPresentationUtils.js#316
function _cssPathStep(node, optimized, isTargetNode) {
  function idSelector(idd) {
    return "#" + escapeIdentifierIfNeeded(idd);
  }

  function escapeIdentifierIfNeeded(ident) {
    if (isCSSIdentifier(ident)) {
      return ident;
    }

    const shouldEscapeFirst = /^(?:[0-9]|-[0-9-]?)/.test(ident);
    const lastIndex = ident.length - 1;
    return ident.replace(/./g, function (c, ii) {
      return (shouldEscapeFirst && ii === 0) || !isCSSIdentChar(c)
        ? escapeAsciiChar(c, ii === lastIndex)
        : c;
    });
  }

  function isCSSIdentifier(value) {
    return /^-?[a-zA-Z_][a-zA-Z0-9_-]*$/.test(value);
  }

  function isCSSIdentChar(c) {
    if (/[a-zA-Z0-9_-]/.test(c)) {
      return true;
    }
    return c.charCodeAt(0) >= 0xa0;
  }

  function escapeAsciiChar(c, isLast) {
    return "\\" + toHexByte(c) + (isLast ? "" : " ");
  }

  function toHexByte(c) {
    let hexByte = c.charCodeAt(0).toString(16);
    if (hexByte.length === 1) {
      hexByte = "0" + hexByte;
    }
    return hexByte;
  }

  function prefixedElementClassNames(nd) {
    const classAttribute = nd.getAttribute("class");
    if (!classAttribute) {
      return [];
    }

    return classAttribute
      .split(/\s+/g)
      .filter(Boolean)
      .map((nm) => {
        // The prefix is required to store "__proto__" in a object-based map.
        return "$" + nm;
      });
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return undefined;
  }
  const lowerCaseName =
    (node.localName && node.localName.toLowerCase()) ||
    node.nodeName.toLowerCase();

  const element = node;

  const id = element.getAttribute("id");

  if (optimized) {
    if (id) {
      return {
        optimized: true,
        value: idSelector(id),
      };
    }
    if (
      lowerCaseName === "body" ||
      lowerCaseName === "head" ||
      lowerCaseName === "html"
    ) {
      return {
        optimized: true,
        value: lowerCaseName, // node.nodeNameInCorrectCase(),
      };
    }
  }

  const nodeName = lowerCaseName; // node.nodeNameInCorrectCase();
  if (id) {
    return {
      optimized: true,
      value: nodeName + idSelector(id),
    };
  }

  const parent = node.parentNode;

  if (!parent || parent.nodeType === Node.DOCUMENT_NODE) {
    return {
      optimized: true,
      value: nodeName,
    };
  }

  const prefixedOwnClassNamesArray_ = prefixedElementClassNames(element);

  const prefixedOwnClassNamesArray = []; // .keySet()
  prefixedOwnClassNamesArray_.forEach((arrItem) => {
    if (prefixedOwnClassNamesArray.indexOf(arrItem) < 0) {
      prefixedOwnClassNamesArray.push(arrItem);
    }
  });

  let needsClassNames = false;
  let needsNthChild = false;
  let ownIndex = -1;
  let elementIndex = -1;
  const siblings = parent.children;

  for (
    let i = 0;
    (ownIndex === -1 || !needsNthChild) && i < siblings.length;
    ++i
  ) {
    const sibling = siblings[i];
    if (sibling.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }
    elementIndex += 1;
    if (sibling === node) {
      ownIndex = elementIndex;
      continue;
    }
    if (needsNthChild) {
      continue;
    }

    // sibling.nodeNameInCorrectCase()
    const siblingName =
      (sibling.localName && sibling.localName.toLowerCase()) ||
      sibling.nodeName.toLowerCase();
    if (siblingName !== nodeName) {
      continue;
    }
    needsClassNames = true;

    const ownClassNames = [];
    prefixedOwnClassNamesArray.forEach((arrItem) => {
      ownClassNames.push(arrItem);
    });
    let ownClassNameCount = ownClassNames.length;

    if (ownClassNameCount === 0) {
      needsNthChild = true;
      continue;
    }
    const siblingClassNamesArray_ = prefixedElementClassNames(sibling);
    const siblingClassNamesArray = []; // .keySet()
    siblingClassNamesArray_.forEach((arrItem) => {
      if (siblingClassNamesArray.indexOf(arrItem) < 0) {
        siblingClassNamesArray.push(arrItem);
      }
    });

    for (const siblingClass of siblingClassNamesArray) {
      const ind = ownClassNames.indexOf(siblingClass);
      if (ind < 0) {
        continue;
      }

      ownClassNames.splice(ind, 1); // delete ownClassNames[siblingClass];

      if (!--ownClassNameCount) {
        needsNthChild = true;
        break;
      }
    }
  }

  let result = nodeName;
  if (
    isTargetNode &&
    nodeName === "input" &&
    element.getAttribute("type") &&
    !element.getAttribute("id") &&
    !element.getAttribute("class")
  ) {
    result += '[type="' + element.getAttribute("type") + '"]';
  }
  if (needsNthChild) {
    result += ":nth-child(" + (ownIndex + 1) + ")";
  } else if (needsClassNames) {
    for (const prefixedName of prefixedOwnClassNamesArray) {
      result += "." + escapeIdentifierIfNeeded(prefixedName.substr(1));
    }
  }

  return {
    optimized: false,
    value: result,
  };
}

function log() {
  if (debug) {
    logNative.apply(null, arguments);
  }
}
