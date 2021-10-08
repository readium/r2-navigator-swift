/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/approx-string-match/dist/index.js":
/*!********************************************************!*\
  !*** ./node_modules/approx-string-match/dist/index.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, exports) => {


/**
 * Implementation of Myers' online approximate string matching algorithm [1],
 * with additional optimizations suggested by [2].
 *
 * This has O((k/w) * n) complexity where `n` is the length of the text, `k` is
 * the maximum number of errors allowed (always <= the pattern length) and `w`
 * is the word size. Because JS only supports bitwise operations on 32 bit
 * integers, `w` is 32.
 *
 * As far as I am aware, there aren't any online algorithms which are
 * significantly better for a wide range of input parameters. The problem can be
 * solved faster using "filter then verify" approaches which first filter out
 * regions of the text that cannot match using a "cheap" check and then verify
 * the remaining potential matches. The verify step requires an algorithm such
 * as this one however.
 *
 * The algorithm's approach is essentially to optimize the classic dynamic
 * programming solution to the problem by computing columns of the matrix in
 * word-sized chunks (ie. dealing with 32 chars of the pattern at a time) and
 * avoiding calculating regions of the matrix where the minimum error count is
 * guaranteed to exceed the input threshold.
 *
 * The paper consists of two parts, the first describes the core algorithm for
 * matching patterns <= the size of a word (implemented by `advanceBlock` here).
 * The second uses the core algorithm as part of a larger block-based algorithm
 * to handle longer patterns.
 *
 * [1] G. Myers, “A Fast Bit-Vector Algorithm for Approximate String Matching
 * Based on Dynamic Programming,” vol. 46, no. 3, pp. 395–415, 1999.
 *
 * [2] Šošić, M. (2014). An simd dynamic programming c/c++ library (Doctoral
 * dissertation, Fakultet Elektrotehnike i računarstva, Sveučilište u Zagrebu).
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
function reverse(s) {
    return s
        .split("")
        .reverse()
        .join("");
}
/**
 * Given the ends of approximate matches for `pattern` in `text`, find
 * the start of the matches.
 *
 * @param findEndFn - Function for finding the end of matches in
 * text.
 * @return Matches with the `start` property set.
 */
function findMatchStarts(text, pattern, matches) {
    var patRev = reverse(pattern);
    return matches.map(function (m) {
        // Find start of each match by reversing the pattern and matching segment
        // of text and searching for an approx match with the same number of
        // errors.
        var minStart = Math.max(0, m.end - pattern.length - m.errors);
        var textRev = reverse(text.slice(minStart, m.end));
        // If there are multiple possible start points, choose the one that
        // maximizes the length of the match.
        var start = findMatchEnds(textRev, patRev, m.errors).reduce(function (min, rm) {
            if (m.end - rm.end < min) {
                return m.end - rm.end;
            }
            return min;
        }, m.end);
        return {
            start: start,
            end: m.end,
            errors: m.errors
        };
    });
}
/**
 * Return 1 if a number is non-zero or zero otherwise, without using
 * conditional operators.
 *
 * This should get inlined into `advanceBlock` below by the JIT.
 *
 * Adapted from https://stackoverflow.com/a/3912218/434243
 */
function oneIfNotZero(n) {
    return ((n | -n) >> 31) & 1;
}
/**
 * Block calculation step of the algorithm.
 *
 * From Fig 8. on p. 408 of [1], additionally optimized to replace conditional
 * checks with bitwise operations as per Section 4.2.3 of [2].
 *
 * @param ctx - The pattern context object
 * @param peq - The `peq` array for the current character (`ctx.peq.get(ch)`)
 * @param b - The block level
 * @param hIn - Horizontal input delta ∈ {1,0,-1}
 * @return Horizontal output delta ∈ {1,0,-1}
 */
function advanceBlock(ctx, peq, b, hIn) {
    var pV = ctx.P[b];
    var mV = ctx.M[b];
    var hInIsNegative = hIn >>> 31; // 1 if hIn < 0 or 0 otherwise.
    var eq = peq[b] | hInIsNegative;
    // Step 1: Compute horizontal deltas.
    var xV = eq | mV;
    var xH = (((eq & pV) + pV) ^ pV) | eq;
    var pH = mV | ~(xH | pV);
    var mH = pV & xH;
    // Step 2: Update score (value of last row of this block).
    var hOut = oneIfNotZero(pH & ctx.lastRowMask[b]) -
        oneIfNotZero(mH & ctx.lastRowMask[b]);
    // Step 3: Update vertical deltas for use when processing next char.
    pH <<= 1;
    mH <<= 1;
    mH |= hInIsNegative;
    pH |= oneIfNotZero(hIn) - hInIsNegative; // set pH[0] if hIn > 0
    pV = mH | ~(xV | pH);
    mV = pH & xV;
    ctx.P[b] = pV;
    ctx.M[b] = mV;
    return hOut;
}
/**
 * Find the ends and error counts for matches of `pattern` in `text`.
 *
 * Only the matches with the lowest error count are reported. Other matches
 * with error counts <= maxErrors are discarded.
 *
 * This is the block-based search algorithm from Fig. 9 on p.410 of [1].
 */
function findMatchEnds(text, pattern, maxErrors) {
    if (pattern.length === 0) {
        return [];
    }
    // Clamp error count so we can rely on the `maxErrors` and `pattern.length`
    // rows being in the same block below.
    maxErrors = Math.min(maxErrors, pattern.length);
    var matches = [];
    // Word size.
    var w = 32;
    // Index of maximum block level.
    var bMax = Math.ceil(pattern.length / w) - 1;
    // Context used across block calculations.
    var ctx = {
        P: new Uint32Array(bMax + 1),
        M: new Uint32Array(bMax + 1),
        lastRowMask: new Uint32Array(bMax + 1)
    };
    ctx.lastRowMask.fill(1 << 31);
    ctx.lastRowMask[bMax] = 1 << (pattern.length - 1) % w;
    // Dummy "peq" array for chars in the text which do not occur in the pattern.
    var emptyPeq = new Uint32Array(bMax + 1);
    // Map of UTF-16 character code to bit vector indicating positions in the
    // pattern that equal that character.
    var peq = new Map();
    // Version of `peq` that only stores mappings for small characters. This
    // allows faster lookups when iterating through the text because a simple
    // array lookup can be done instead of a hash table lookup.
    var asciiPeq = [];
    for (var i = 0; i < 256; i++) {
        asciiPeq.push(emptyPeq);
    }
    // Calculate `ctx.peq` - a map of character values to bitmasks indicating
    // positions of that character within the pattern, where each bit represents
    // a position in the pattern.
    for (var c = 0; c < pattern.length; c += 1) {
        var val = pattern.charCodeAt(c);
        if (peq.has(val)) {
            // Duplicate char in pattern.
            continue;
        }
        var charPeq = new Uint32Array(bMax + 1);
        peq.set(val, charPeq);
        if (val < asciiPeq.length) {
            asciiPeq[val] = charPeq;
        }
        for (var b = 0; b <= bMax; b += 1) {
            charPeq[b] = 0;
            // Set all the bits where the pattern matches the current char (ch).
            // For indexes beyond the end of the pattern, always set the bit as if the
            // pattern contained a wildcard char in that position.
            for (var r = 0; r < w; r += 1) {
                var idx = b * w + r;
                if (idx >= pattern.length) {
                    continue;
                }
                var match = pattern.charCodeAt(idx) === val;
                if (match) {
                    charPeq[b] |= 1 << r;
                }
            }
        }
    }
    // Index of last-active block level in the column.
    var y = Math.max(0, Math.ceil(maxErrors / w) - 1);
    // Initialize maximum error count at bottom of each block.
    var score = new Uint32Array(bMax + 1);
    for (var b = 0; b <= y; b += 1) {
        score[b] = (b + 1) * w;
    }
    score[bMax] = pattern.length;
    // Initialize vertical deltas for each block.
    for (var b = 0; b <= y; b += 1) {
        ctx.P[b] = ~0;
        ctx.M[b] = 0;
    }
    // Process each char of the text, computing the error count for `w` chars of
    // the pattern at a time.
    for (var j = 0; j < text.length; j += 1) {
        // Lookup the bitmask representing the positions of the current char from
        // the text within the pattern.
        var charCode = text.charCodeAt(j);
        var charPeq = void 0;
        if (charCode < asciiPeq.length) {
            // Fast array lookup.
            charPeq = asciiPeq[charCode];
        }
        else {
            // Slower hash table lookup.
            charPeq = peq.get(charCode);
            if (typeof charPeq === "undefined") {
                charPeq = emptyPeq;
            }
        }
        // Calculate error count for blocks that we definitely have to process for
        // this column.
        var carry = 0;
        for (var b = 0; b <= y; b += 1) {
            carry = advanceBlock(ctx, charPeq, b, carry);
            score[b] += carry;
        }
        // Check if we also need to compute an additional block, or if we can reduce
        // the number of blocks processed for the next column.
        if (score[y] - carry <= maxErrors &&
            y < bMax &&
            (charPeq[y + 1] & 1 || carry < 0)) {
            // Error count for bottom block is under threshold, increase the number of
            // blocks processed for this column & next by 1.
            y += 1;
            ctx.P[y] = ~0;
            ctx.M[y] = 0;
            var maxBlockScore = y === bMax ? pattern.length % w : w;
            score[y] =
                score[y - 1] +
                    maxBlockScore -
                    carry +
                    advanceBlock(ctx, charPeq, y, carry);
        }
        else {
            // Error count for bottom block exceeds threshold, reduce the number of
            // blocks processed for the next column.
            while (y > 0 && score[y] >= maxErrors + w) {
                y -= 1;
            }
        }
        // If error count is under threshold, report a match.
        if (y === bMax && score[y] <= maxErrors) {
            if (score[y] < maxErrors) {
                // Discard any earlier, worse matches.
                matches.splice(0, matches.length);
            }
            matches.push({
                start: -1,
                end: j + 1,
                errors: score[y]
            });
            // Because `search` only reports the matches with the lowest error count,
            // we can "ratchet down" the max error threshold whenever a match is
            // encountered and thereby save a small amount of work for the remainder
            // of the text.
            maxErrors = score[y];
        }
    }
    return matches;
}
/**
 * Search for matches for `pattern` in `text` allowing up to `maxErrors` errors.
 *
 * Returns the start, and end positions and error counts for each lowest-cost
 * match. Only the "best" matches are returned.
 */
function search(text, pattern, maxErrors) {
    var matches = findMatchEnds(text, pattern, maxErrors);
    return findMatchStarts(text, pattern, matches);
}
exports.default = search;


/***/ }),

/***/ "./src/decorator.js":
/*!**************************!*\
  !*** ./src/decorator.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "registerTemplates": () => (/* binding */ registerTemplates),
/* harmony export */   "getDecorations": () => (/* binding */ getDecorations),
/* harmony export */   "handleDecorationClickEvent": () => (/* binding */ handleDecorationClickEvent),
/* harmony export */   "DecorationGroup": () => (/* binding */ DecorationGroup)
/* harmony export */ });
/* harmony import */ var _rect__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./rect */ "./src/rect.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils */ "./src/utils.js");
//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//




let styles = new Map();
let groups = new Map();
var lastGroupId = 0;

/**
 * Registers a list of additional supported Decoration Templates.
 *
 * Each template object is indexed by the style ID.
 */
function registerTemplates(newStyles) {
  var stylesheet = "";

  for (const [id, style] of Object.entries(newStyles)) {
    styles.set(id, style);
    if (style.stylesheet) {
      stylesheet += style.stylesheet + "\n";
    }
  }

  if (stylesheet) {
    let styleElement = document.createElement("style");
    styleElement.innerHTML = stylesheet;
    document.getElementsByTagName("head")[0].appendChild(styleElement);
  }
}

/**
 * Returns an instance of DecorationGroup for the given group name.
 */
function getDecorations(groupName) {
  var group = groups.get(groupName);
  if (!group) {
    let id = "r2-decoration-" + lastGroupId++;
    group = DecorationGroup(id, groupName);
    groups.set(groupName, group);
  }
  return group;
}

/**
 * Handles click events on a Decoration.
 * Returns whether a decoration matched this event.
 */
function handleDecorationClickEvent(event, clickEvent) {
  if (groups.size === 0) {
    return false;
  }

  function findTarget() {
    for (const [group, groupContent] of groups) {
      if (!groupContent.isActivable()) {
        continue;
      }

      for (const item of groupContent.items.reverse()) {
        if (!item.clickableElements) {
          continue;
        }
        for (const element of item.clickableElements) {
          let rect = element.getBoundingClientRect().toJSON();
          if ((0,_rect__WEBPACK_IMPORTED_MODULE_0__.rectContainsPoint)(rect, event.clientX, event.clientY, 1)) {
            return { group, item, element, rect };
          }
        }
      }
    }
  }

  let target = findTarget();
  if (!target) {
    return false;
  }
  webkit.messageHandlers.decorationActivated.postMessage({
    id: target.item.decoration.id,
    group: target.group,
    rect: (0,_rect__WEBPACK_IMPORTED_MODULE_0__.toNativeRect)(target.item.range.getBoundingClientRect()),
    click: clickEvent,
  });
  return true;
}

/**
 * Creates a DecorationGroup object from a unique HTML ID and its name.
 */
function DecorationGroup(groupId, groupName) {
  var items = [];
  var lastItemId = 0;
  var container = null;
  var activable = false;

  function isActivable() {
    return activable;
  }

  function setActivable() {
    activable = true;
  }

  /**
   * Adds a new decoration to the group.
   */
  function add(decoration) {
    let id = groupId + "-" + lastItemId++;

    let range = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.rangeFromLocator)(decoration.locator);
    if (!range) {
      (0,_utils__WEBPACK_IMPORTED_MODULE_1__.log)("Can't locate DOM range for decoration", decoration);
      return;
    }

    let item = { id, decoration, range };
    items.push(item);
    layout(item);
  }

  /**
   * Removes the decoration with given ID from the group.
   */
  function remove(decorationId) {
    let index = items.findIndex((i) => i.decoration.id === decorationId);
    if (index === -1) {
      return;
    }

    let item = items[index];
    items.splice(index, 1);
    item.clickableElements = null;
    if (item.container) {
      item.container.remove();
      item.container = null;
    }
  }

  /**
   * Notifies that the given decoration was modified and needs to be updated.
   */
  function update(decoration) {
    remove(decoration.id);
    add(decoration);
  }

  /**
   * Removes all decorations from this group.
   */
  function clear() {
    clearContainer();
    items.length = 0;
  }

  /**
   * Recreates the decoration elements.
   *
   * To be called after reflowing the resource, for example.
   */
  function requestLayout() {
    clearContainer();
    items.forEach((item) => layout(item));
  }

  /**
   * Layouts a single Decoration item.
   */
  function layout(item) {
    let groupContainer = requireContainer();

    let style = styles.get(item.decoration.style);
    if (!style) {
      (0,_utils__WEBPACK_IMPORTED_MODULE_1__.logErrorMessage)(`Unknown decoration style: ${item.decoration.style}`);
      return;
    }

    let itemContainer = document.createElement("div");
    itemContainer.setAttribute("id", item.id);
    itemContainer.setAttribute("data-style", item.decoration.style);
    itemContainer.style.setProperty("pointer-events", "none");

    let viewportWidth = window.innerWidth;
    let columnCount = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue(
        "column-count"
      )
    );
    let pageWidth = viewportWidth / (columnCount || 1);
    let scrollingElement = document.scrollingElement;
    let xOffset = scrollingElement.scrollLeft;
    let yOffset = scrollingElement.scrollTop;

    function positionElement(element, rect, boundingRect) {
      element.style.position = "absolute";

      if (style.width === "wrap") {
        element.style.width = `${rect.width}px`;
        element.style.height = `${rect.height}px`;
        element.style.left = `${rect.left + xOffset}px`;
        element.style.top = `${rect.top + yOffset}px`;
      } else if (style.width === "viewport") {
        element.style.width = `${viewportWidth}px`;
        element.style.height = `${rect.height}px`;
        let left = Math.floor(rect.left / viewportWidth) * viewportWidth;
        element.style.left = `${left + xOffset}px`;
        element.style.top = `${rect.top + yOffset}px`;
      } else if (style.width === "bounds") {
        element.style.width = `${boundingRect.width}px`;
        element.style.height = `${rect.height}px`;
        element.style.left = `${boundingRect.left + xOffset}px`;
        element.style.top = `${rect.top + yOffset}px`;
      } else if (style.width === "page") {
        element.style.width = `${pageWidth}px`;
        element.style.height = `${rect.height}px`;
        let left = Math.floor(rect.left / pageWidth) * pageWidth;
        element.style.left = `${left + xOffset}px`;
        element.style.top = `${rect.top + yOffset}px`;
      }
    }

    let boundingRect = item.range.getBoundingClientRect();

    let elementTemplate;
    try {
      let template = document.createElement("template");
      template.innerHTML = item.decoration.element.trim();
      elementTemplate = template.content.firstElementChild;
    } catch (error) {
      (0,_utils__WEBPACK_IMPORTED_MODULE_1__.logErrorMessage)(
        `Invalid decoration element "${item.decoration.element}": ${error.message}`
      );
      return;
    }

    if (style.layout === "boxes") {
      let doNotMergeHorizontallyAlignedRects = true;
      let clientRects = (0,_rect__WEBPACK_IMPORTED_MODULE_0__.getClientRectsNoOverlap)(
        item.range,
        doNotMergeHorizontallyAlignedRects
      );

      clientRects = clientRects.sort((r1, r2) => {
        if (r1.top < r2.top) {
          return -1;
        } else if (r1.top > r2.top) {
          return 1;
        } else {
          return 0;
        }
      });

      for (let clientRect of clientRects) {
        const line = elementTemplate.cloneNode(true);
        line.style.setProperty("pointer-events", "none");
        positionElement(line, clientRect, boundingRect);
        itemContainer.append(line);
      }
    } else if (style.layout === "bounds") {
      const bounds = elementTemplate.cloneNode(true);
      bounds.style.setProperty("pointer-events", "none");
      positionElement(bounds, boundingRect, boundingRect);

      itemContainer.append(bounds);
    }

    groupContainer.append(itemContainer);
    item.container = itemContainer;
    item.clickableElements = Array.from(
      itemContainer.querySelectorAll("[data-activable='1']")
    );
    if (item.clickableElements.length === 0) {
      item.clickableElements = Array.from(itemContainer.children);
    }
  }

  /**
   * Returns the group container element, after making sure it exists.
   */
  function requireContainer() {
    if (!container) {
      container = document.createElement("div");
      container.setAttribute("id", groupId);
      container.setAttribute("data-group", groupName);
      container.style.setProperty("pointer-events", "none");
      document.body.append(container);
    }
    return container;
  }

  /**
   * Removes the group container.
   */
  function clearContainer() {
    if (container) {
      container.remove();
      container = null;
    }
  }

  return {
    add,
    remove,
    update,
    clear,
    items,
    requestLayout,
    isActivable,
    setActivable,
  };
}

window.addEventListener(
  "load",
  function () {
    // Will relayout all the decorations when the document body is resized.
    const body = document.body;
    var lastSize = { width: 0, height: 0 };
    const observer = new ResizeObserver(() => {
      if (
        lastSize.width === body.clientWidth &&
        lastSize.height === body.clientHeight
      ) {
        return;
      }
      lastSize = {
        width: body.clientWidth,
        height: body.clientHeight,
      };

      groups.forEach(function (group) {
        group.requestLayout();
      });
    });
    observer.observe(body);
  },
  false
);


/***/ }),

/***/ "./src/gestures.js":
/*!*************************!*\
  !*** ./src/gestures.js ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _decorator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./decorator */ "./src/decorator.js");
/* harmony import */ var _rect__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./rect */ "./src/rect.js");
//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//




window.addEventListener("DOMContentLoaded", function () {
  // If we don't set the CSS cursor property to pointer, then the click events are not triggered pre-iOS 13.
  document.body.style.cursor = "pointer";

  document.addEventListener("click", onClick, false);
});

function onClick(event) {
  if (!getSelection().isCollapsed) {
    // There's an on-going selection, the tap will dismiss it so we don't forward it.
    return;
  }

  let point = (0,_rect__WEBPACK_IMPORTED_MODULE_1__.adjustPointToViewport)({ x: event.clientX, y: event.clientY });
  let clickEvent = {
    defaultPrevented: event.defaultPrevented,
    x: point.x,
    y: point.y,
    targetElement: event.target.outerHTML,
    interactiveElement: nearestInteractiveElement(event.target),
  };

  if ((0,_decorator__WEBPACK_IMPORTED_MODULE_0__.handleDecorationClickEvent)(event, clickEvent)) {
    return;
  }

  // Send the tap data over the JS bridge even if it's been handled
  // within the webview, so that it can be preserved and used
  // by the WKNavigationDelegate if needed.
  webkit.messageHandlers.tap.postMessage(clickEvent);

  // We don't want to disable the default WebView behavior as it breaks some features without bringing any value.
  // event.stopPropagation();
  // event.preventDefault();
}

// See. https://github.com/JayPanoz/architecture/tree/touch-handling/misc/touch-handling
function nearestInteractiveElement(element) {
  var interactiveTags = [
    "a",
    "audio",
    "button",
    "canvas",
    "details",
    "input",
    "label",
    "option",
    "select",
    "submit",
    "textarea",
    "video",
  ];
  if (interactiveTags.indexOf(element.nodeName.toLowerCase()) !== -1) {
    return element.outerHTML;
  }

  // Checks whether the element is editable by the user.
  if (
    element.hasAttribute("contenteditable") &&
    element.getAttribute("contenteditable").toLowerCase() != "false"
  ) {
    return element.outerHTML;
  }

  // Checks parents recursively because the touch might be for example on an <em> inside a <a>.
  if (element.parentElement) {
    return nearestInteractiveElement(element.parentElement);
  }

  return null;
}


/***/ }),

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _gestures__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./gestures */ "./src/gestures.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils */ "./src/utils.js");
/* harmony import */ var _decorator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./decorator */ "./src/decorator.js");
//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

// Base script used by both reflowable and fixed layout resources.





// Public API used by the navigator.
window.readium = {
  // utils
  scrollToId: _utils__WEBPACK_IMPORTED_MODULE_1__.scrollToId,
  scrollToPosition: _utils__WEBPACK_IMPORTED_MODULE_1__.scrollToPosition,
  scrollToText: _utils__WEBPACK_IMPORTED_MODULE_1__.scrollToText,
  scrollLeft: _utils__WEBPACK_IMPORTED_MODULE_1__.scrollLeft,
  scrollRight: _utils__WEBPACK_IMPORTED_MODULE_1__.scrollRight,
  setProperty: _utils__WEBPACK_IMPORTED_MODULE_1__.setProperty,
  removeProperty: _utils__WEBPACK_IMPORTED_MODULE_1__.removeProperty,

  // decoration
  registerDecorationTemplates: _decorator__WEBPACK_IMPORTED_MODULE_2__.registerTemplates,
  getDecorations: _decorator__WEBPACK_IMPORTED_MODULE_2__.getDecorations,
};


/***/ }),

/***/ "./src/rect.js":
/*!*********************!*\
  !*** ./src/rect.js ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "toNativeRect": () => (/* binding */ toNativeRect),
/* harmony export */   "adjustPointToViewport": () => (/* binding */ adjustPointToViewport),
/* harmony export */   "getClientRectsNoOverlap": () => (/* binding */ getClientRectsNoOverlap),
/* harmony export */   "rectContainsPoint": () => (/* binding */ rectContainsPoint)
/* harmony export */ });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils */ "./src/utils.js");
//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//



const debug = false;

/**
 * Converts a DOMRect into a JSON object understandable by the native side.
 */
function toNativeRect(rect) {
  let point = adjustPointToViewport({ x: rect.left, y: rect.top });

  const width = rect.width;
  const height = rect.height;
  const left = point.x;
  const top = point.y;
  const right = left + width;
  const bottom = top + height;
  return { width, height, left, top, right, bottom };
}

/**
 * Adjusts the given coordinates to the viewport for FXL resources.
 */
function adjustPointToViewport(point) {
  if (!frameElement) {
    return point;
  }
  let frameRect = frameElement.getBoundingClientRect();
  if (!frameRect) {
    return point;
  }

  let topScrollingElement = window.top.document.documentElement;
  return {
    x: point.x + frameRect.x + topScrollingElement.scrollLeft,
    y: point.y + frameRect.y + topScrollingElement.scrollTop,
  };
}

function getClientRectsNoOverlap(
  range,
  doNotMergeHorizontallyAlignedRects
) {
  let clientRects = range.getClientRects();

  const tolerance = 1;
  const originalRects = [];
  for (const rangeClientRect of clientRects) {
    originalRects.push({
      bottom: rangeClientRect.bottom,
      height: rangeClientRect.height,
      left: rangeClientRect.left,
      right: rangeClientRect.right,
      top: rangeClientRect.top,
      width: rangeClientRect.width,
    });
  }
  const mergedRects = mergeTouchingRects(
    originalRects,
    tolerance,
    doNotMergeHorizontallyAlignedRects
  );
  const noContainedRects = removeContainedRects(mergedRects, tolerance);
  const newRects = replaceOverlapingRects(noContainedRects);
  const minArea = 2 * 2;
  for (let j = newRects.length - 1; j >= 0; j--) {
    const rect = newRects[j];
    const bigEnough = rect.width * rect.height > minArea;
    if (!bigEnough) {
      if (newRects.length > 1) {
        log("CLIENT RECT: remove small");
        newRects.splice(j, 1);
      } else {
        log("CLIENT RECT: remove small, but keep otherwise empty!");
        break;
      }
    }
  }
  log(`CLIENT RECT: reduced ${originalRects.length} --> ${newRects.length}`);
  return newRects;
}

function mergeTouchingRects(
  rects,
  tolerance,
  doNotMergeHorizontallyAlignedRects
) {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const rect1 = rects[i];
      const rect2 = rects[j];
      if (rect1 === rect2) {
        log("mergeTouchingRects rect1 === rect2 ??!");
        continue;
      }
      const rectsLineUpVertically =
        almostEqual(rect1.top, rect2.top, tolerance) &&
        almostEqual(rect1.bottom, rect2.bottom, tolerance);
      const rectsLineUpHorizontally =
        almostEqual(rect1.left, rect2.left, tolerance) &&
        almostEqual(rect1.right, rect2.right, tolerance);
      const horizontalAllowed = !doNotMergeHorizontallyAlignedRects;
      const aligned =
        (rectsLineUpHorizontally && horizontalAllowed) ||
        (rectsLineUpVertically && !rectsLineUpHorizontally);
      const canMerge = aligned && rectsTouchOrOverlap(rect1, rect2, tolerance);
      if (canMerge) {
        log(
          `CLIENT RECT: merging two into one, VERTICAL: ${rectsLineUpVertically} HORIZONTAL: ${rectsLineUpHorizontally} (${doNotMergeHorizontallyAlignedRects})`
        );
        const newRects = rects.filter((rect) => {
          return rect !== rect1 && rect !== rect2;
        });
        const replacementClientRect = getBoundingRect(rect1, rect2);
        newRects.push(replacementClientRect);
        return mergeTouchingRects(
          newRects,
          tolerance,
          doNotMergeHorizontallyAlignedRects
        );
      }
    }
  }
  return rects;
}

function getBoundingRect(rect1, rect2) {
  const left = Math.min(rect1.left, rect2.left);
  const right = Math.max(rect1.right, rect2.right);
  const top = Math.min(rect1.top, rect2.top);
  const bottom = Math.max(rect1.bottom, rect2.bottom);
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
}

function removeContainedRects(rects, tolerance) {
  const rectsToKeep = new Set(rects);
  for (const rect of rects) {
    const bigEnough = rect.width > 1 && rect.height > 1;
    if (!bigEnough) {
      log("CLIENT RECT: remove tiny");
      rectsToKeep.delete(rect);
      continue;
    }
    for (const possiblyContainingRect of rects) {
      if (rect === possiblyContainingRect) {
        continue;
      }
      if (!rectsToKeep.has(possiblyContainingRect)) {
        continue;
      }
      if (rectContains(possiblyContainingRect, rect, tolerance)) {
        log("CLIENT RECT: remove contained");
        rectsToKeep.delete(rect);
        break;
      }
    }
  }
  return Array.from(rectsToKeep);
}

function rectContains(rect1, rect2, tolerance) {
  return (
    rectContainsPoint(rect1, rect2.left, rect2.top, tolerance) &&
    rectContainsPoint(rect1, rect2.right, rect2.top, tolerance) &&
    rectContainsPoint(rect1, rect2.left, rect2.bottom, tolerance) &&
    rectContainsPoint(rect1, rect2.right, rect2.bottom, tolerance)
  );
}

function rectContainsPoint(rect, x, y, tolerance) {
  return (
    (rect.left < x || almostEqual(rect.left, x, tolerance)) &&
    (rect.right > x || almostEqual(rect.right, x, tolerance)) &&
    (rect.top < y || almostEqual(rect.top, y, tolerance)) &&
    (rect.bottom > y || almostEqual(rect.bottom, y, tolerance))
  );
}

function replaceOverlapingRects(rects) {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const rect1 = rects[i];
      const rect2 = rects[j];
      if (rect1 === rect2) {
        log("replaceOverlapingRects rect1 === rect2 ??!");
        continue;
      }
      if (rectsTouchOrOverlap(rect1, rect2, -1)) {
        let toAdd = [];
        let toRemove;
        const subtractRects1 = rectSubtract(rect1, rect2);
        if (subtractRects1.length === 1) {
          toAdd = subtractRects1;
          toRemove = rect1;
        } else {
          const subtractRects2 = rectSubtract(rect2, rect1);
          if (subtractRects1.length < subtractRects2.length) {
            toAdd = subtractRects1;
            toRemove = rect1;
          } else {
            toAdd = subtractRects2;
            toRemove = rect2;
          }
        }
        log(`CLIENT RECT: overlap, cut one rect into ${toAdd.length}`);
        const newRects = rects.filter((rect) => {
          return rect !== toRemove;
        });
        Array.prototype.push.apply(newRects, toAdd);
        return replaceOverlapingRects(newRects);
      }
    }
  }
  return rects;
}

function rectSubtract(rect1, rect2) {
  const rectIntersected = rectIntersect(rect2, rect1);
  if (rectIntersected.height === 0 || rectIntersected.width === 0) {
    return [rect1];
  }
  const rects = [];
  {
    const rectA = {
      bottom: rect1.bottom,
      height: 0,
      left: rect1.left,
      right: rectIntersected.left,
      top: rect1.top,
      width: 0,
    };
    rectA.width = rectA.right - rectA.left;
    rectA.height = rectA.bottom - rectA.top;
    if (rectA.height !== 0 && rectA.width !== 0) {
      rects.push(rectA);
    }
  }
  {
    const rectB = {
      bottom: rectIntersected.top,
      height: 0,
      left: rectIntersected.left,
      right: rectIntersected.right,
      top: rect1.top,
      width: 0,
    };
    rectB.width = rectB.right - rectB.left;
    rectB.height = rectB.bottom - rectB.top;
    if (rectB.height !== 0 && rectB.width !== 0) {
      rects.push(rectB);
    }
  }
  {
    const rectC = {
      bottom: rect1.bottom,
      height: 0,
      left: rectIntersected.left,
      right: rectIntersected.right,
      top: rectIntersected.bottom,
      width: 0,
    };
    rectC.width = rectC.right - rectC.left;
    rectC.height = rectC.bottom - rectC.top;
    if (rectC.height !== 0 && rectC.width !== 0) {
      rects.push(rectC);
    }
  }
  {
    const rectD = {
      bottom: rect1.bottom,
      height: 0,
      left: rectIntersected.right,
      right: rect1.right,
      top: rect1.top,
      width: 0,
    };
    rectD.width = rectD.right - rectD.left;
    rectD.height = rectD.bottom - rectD.top;
    if (rectD.height !== 0 && rectD.width !== 0) {
      rects.push(rectD);
    }
  }
  return rects;
}

function rectIntersect(rect1, rect2) {
  const maxLeft = Math.max(rect1.left, rect2.left);
  const minRight = Math.min(rect1.right, rect2.right);
  const maxTop = Math.max(rect1.top, rect2.top);
  const minBottom = Math.min(rect1.bottom, rect2.bottom);
  return {
    bottom: minBottom,
    height: Math.max(0, minBottom - maxTop),
    left: maxLeft,
    right: minRight,
    top: maxTop,
    width: Math.max(0, minRight - maxLeft),
  };
}

function rectsTouchOrOverlap(rect1, rect2, tolerance) {
  return (
    (rect1.left < rect2.right ||
      (tolerance >= 0 && almostEqual(rect1.left, rect2.right, tolerance))) &&
    (rect2.left < rect1.right ||
      (tolerance >= 0 && almostEqual(rect2.left, rect1.right, tolerance))) &&
    (rect1.top < rect2.bottom ||
      (tolerance >= 0 && almostEqual(rect1.top, rect2.bottom, tolerance))) &&
    (rect2.top < rect1.bottom ||
      (tolerance >= 0 && almostEqual(rect2.top, rect1.bottom, tolerance)))
  );
}

function almostEqual(a, b, tolerance) {
  return Math.abs(a - b) <= tolerance;
}

function log() {
  if (debug) {
    _utils__WEBPACK_IMPORTED_MODULE_0__.log.apply(null, arguments);
  }
}


/***/ }),

/***/ "./src/selection.js":
/*!**************************!*\
  !*** ./src/selection.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getCurrentSelection": () => (/* binding */ getCurrentSelection),
/* harmony export */   "convertRangeInfo": () => (/* binding */ convertRangeInfo),
/* harmony export */   "location2RangeInfo": () => (/* binding */ location2RangeInfo)
/* harmony export */ });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils */ "./src/utils.js");
/* harmony import */ var _rect__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./rect */ "./src/rect.js");
/* harmony import */ var _vendor_hypothesis_anchoring_text_range__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./vendor/hypothesis/anchoring/text-range */ "./src/vendor/hypothesis/anchoring/text-range.js");
//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//





const debug = true;

function getCurrentSelection() {
  if (!readium.link) {
    return null;
  }
  const href = readium.link.href;
  if (!href) {
    return null;
  }
  const text = getCurrentSelectionText();
  if (!text) {
    return null;
  }
  const rect = getSelectionRect();
  return { href, text, rect };
}

function getSelectionRect() {
  try {
    let sel = window.getSelection();
    if (!sel) {
      return;
    }
    let range = sel.getRangeAt(0);

    return (0,_rect__WEBPACK_IMPORTED_MODULE_1__.toNativeRect)(range.getBoundingClientRect());
  } catch (e) {
    (0,_utils__WEBPACK_IMPORTED_MODULE_0__.logError)(e);
    return null;
  }
}

function getCurrentSelectionText() {
  const selection = window.getSelection();
  if (!selection) {
    return undefined;
  }
  if (selection.isCollapsed) {
    return undefined;
  }
  const highlight = selection.toString();
  const cleanHighlight = highlight
    .trim()
    .replace(/\n/g, " ")
    .replace(/\s\s+/g, " ");
  if (cleanHighlight.length === 0) {
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

  const text = document.body.textContent;
  const textRange = _vendor_hypothesis_anchoring_text_range__WEBPACK_IMPORTED_MODULE_2__.TextRange.fromRange(range).relativeTo(document.body);
  const start = textRange.start.offset;
  const end = textRange.end.offset;

  const snippetLength = 200;

  // Compute the text before the highlight, ignoring the first "word", which might be cut.
  let before = text.slice(Math.max(0, start - snippetLength), start);
  let firstWordStart = before.search(/\P{L}\p{L}/gu);
  if (firstWordStart !== -1) {
    before = before.slice(firstWordStart + 1);
  }

  // Compute the text after the highlight, ignoring the last "word", which might be cut.
  let after = text.slice(end, Math.min(text.length, end + snippetLength));
  let lastWordEnd = Array.from(after.matchAll(/\p{L}\P{L}/gu)).pop();
  if (lastWordEnd !== undefined && lastWordEnd.index > 1) {
    after = after.slice(0, lastWordEnd.index + 1);
  }

  return { highlight, before, after };
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

function convertRangeInfo(document, rangeInfo) {
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

function location2RangeInfo(location) {
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

function log() {
  if (debug) {
    _utils__WEBPACK_IMPORTED_MODULE_0__.log.apply(null, arguments);
  }
}


/***/ }),

/***/ "./src/utils.js":
/*!**********************!*\
  !*** ./src/utils.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "isScrollModeEnabled": () => (/* binding */ isScrollModeEnabled),
/* harmony export */   "scrollToId": () => (/* binding */ scrollToId),
/* harmony export */   "scrollToPosition": () => (/* binding */ scrollToPosition),
/* harmony export */   "scrollToText": () => (/* binding */ scrollToText),
/* harmony export */   "scrollLeft": () => (/* binding */ scrollLeft),
/* harmony export */   "scrollRight": () => (/* binding */ scrollRight),
/* harmony export */   "rangeFromLocator": () => (/* binding */ rangeFromLocator),
/* harmony export */   "setProperty": () => (/* binding */ setProperty),
/* harmony export */   "removeProperty": () => (/* binding */ removeProperty),
/* harmony export */   "log": () => (/* binding */ log),
/* harmony export */   "logErrorMessage": () => (/* binding */ logErrorMessage),
/* harmony export */   "logError": () => (/* binding */ logError)
/* harmony export */ });
/* harmony import */ var _vendor_hypothesis_anchoring_types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./vendor/hypothesis/anchoring/types */ "./src/vendor/hypothesis/anchoring/types.js");
/* harmony import */ var _selection__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./selection */ "./src/selection.js");
//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

// Catch JS errors to log them in the app.




window.addEventListener(
  "error",
  function (event) {
    webkit.messageHandlers.logError.postMessage({
      message: event.message,
      filename: event.filename,
      line: event.lineno,
    });
  },
  false
);

// Notify native code that the page has loaded.
window.addEventListener(
  "load",
  function () {
    // on page load
    window.addEventListener("orientationchange", function () {
      orientationChanged();
      snapCurrentPosition();
    });
    orientationChanged();
  },
  false
);

var last_known_scrollX_position = 0;
var last_known_scrollY_position = 0;
var ticking = false;
var maxScreenX = 0;

// Position in range [0 - 1].
function update(position) {
  var positionString = position.toString();
  webkit.messageHandlers.progressionChanged.postMessage(positionString);
}

window.addEventListener("scroll", function () {
  last_known_scrollY_position =
    window.scrollY / document.scrollingElement.scrollHeight;
  // Using Math.abs because for RTL books, the value will be negative.
  last_known_scrollX_position = Math.abs(
    window.scrollX / document.scrollingElement.scrollWidth
  );

  // Window is hidden
  if (
    document.scrollingElement.scrollWidth === 0 ||
    document.scrollingElement.scrollHeight === 0
  ) {
    return;
  }

  if (!ticking) {
    window.requestAnimationFrame(function () {
      update(
        isScrollModeEnabled()
          ? last_known_scrollY_position
          : last_known_scrollX_position
      );
      ticking = false;
    });
  }
  ticking = true;
});

document.addEventListener(
  "selectionchange",
  debounce(50, function () {
    webkit.messageHandlers.selectionChanged.postMessage((0,_selection__WEBPACK_IMPORTED_MODULE_1__.getCurrentSelection)());
  })
);

function orientationChanged() {
  maxScreenX =
    window.orientation === 0 || window.orientation == 180
      ? screen.width
      : screen.height;
}

function isScrollModeEnabled() {
  return (
    document.documentElement.style
      .getPropertyValue("--USER__scroll")
      .toString()
      .trim() === "readium-scroll-on"
  );
}

// Scroll to the given TagId in document and snap.
function scrollToId(id) {
  let element = document.getElementById(id);
  if (!element) {
    return false;
  }

  scrollToRect(element.getBoundingClientRect());
  return true;
}

// Position must be in the range [0 - 1], 0-100%.
function scrollToPosition(position, dir) {
  console.log("ScrollToPosition");
  if (position < 0 || position > 1) {
    console.log("InvalidPosition");
    return;
  }

  if (isScrollModeEnabled()) {
    let offset = document.scrollingElement.scrollHeight * position;
    document.scrollingElement.scrollTop = offset;
    // window.scrollTo(0, offset);
  } else {
    var documentWidth = document.scrollingElement.scrollWidth;
    var factor = dir == "rtl" ? -1 : 1;
    let offset = documentWidth * position * factor;
    document.scrollingElement.scrollLeft = snapOffset(offset);
  }
}

// Scrolls to the first occurrence of the given text snippet.
//
// The expected text argument is a Locator Text object, as defined here:
// https://readium.org/architecture/models/locators/
function scrollToText(text) {
  let range = rangeFromLocator({ text });
  if (!range) {
    return false;
  }
  scrollToRange(range);
  return true;
}

function scrollToRange(range) {
  scrollToRect(range.getBoundingClientRect());
}

function scrollToRect(rect) {
  if (isScrollModeEnabled()) {
    document.scrollingElement.scrollTop =
      rect.top + window.scrollY - window.innerHeight / 2;
  } else {
    document.scrollingElement.scrollLeft = snapOffset(
      rect.left + window.scrollX
    );
  }
}

// Returns false if the page is already at the left-most scroll offset.
function scrollLeft(dir) {
  var isRTL = dir == "rtl";
  var documentWidth = document.scrollingElement.scrollWidth;
  var pageWidth = window.innerWidth;
  var offset = window.scrollX - pageWidth;
  var minOffset = isRTL ? -(documentWidth - pageWidth) : 0;
  return scrollToOffset(Math.max(offset, minOffset));
}

// Returns false if the page is already at the right-most scroll offset.
function scrollRight(dir) {
  var isRTL = dir == "rtl";
  var documentWidth = document.scrollingElement.scrollWidth;
  var pageWidth = window.innerWidth;
  var offset = window.scrollX + pageWidth;
  var maxOffset = isRTL ? 0 : documentWidth - pageWidth;
  return scrollToOffset(Math.min(offset, maxOffset));
}

// Scrolls to the given left offset.
// Returns false if the page scroll position is already close enough to the given offset.
function scrollToOffset(offset) {
  var currentOffset = window.scrollX;
  var pageWidth = window.innerWidth;
  document.scrollingElement.scrollLeft = offset;
  // In some case the scrollX cannot reach the position respecting to innerWidth
  var diff = Math.abs(currentOffset - offset) / pageWidth;
  return diff > 0.01;
}

// Snap the offset to the screen width (page width).
function snapOffset(offset) {
  var value = offset + 1;

  return value - (value % maxScreenX);
}

function snapCurrentPosition() {
  if (isScrollModeEnabled()) {
    return;
  }
  var currentOffset = window.scrollX;
  var currentOffsetSnapped = snapOffset(currentOffset + 1);

  document.scrollingElement.scrollLeft = currentOffsetSnapped;
}

function rangeFromLocator(locator) {
  let text = locator.text;
  if (!text || !text.highlight) {
    return null;
  }
  try {
    let anchor = new _vendor_hypothesis_anchoring_types__WEBPACK_IMPORTED_MODULE_0__.TextQuoteAnchor(document.body, text.highlight, {
      prefix: text.before,
      suffix: text.after,
    });
    return anchor.toRange();
  } catch (e) {
    logError(e);
    return null;
  }
}

/// User Settings.

// For setting user setting.
function setProperty(key, value) {
  var root = document.documentElement;

  root.style.setProperty(key, value);
}

// For removing user setting.
function removeProperty(key) {
  var root = document.documentElement;

  root.style.removeProperty(key);
}

/// Toolkit

function debounce(delay, func) {
  var timeout;
  return function () {
    var self = this;
    var args = arguments;
    function callback() {
      func.apply(self, args);
      timeout = null;
    }
    clearTimeout(timeout);
    timeout = setTimeout(callback, delay);
  };
}

function log() {
  var message = Array.prototype.slice.call(arguments).join(" ");
  webkit.messageHandlers.log.postMessage(message);
}

function logErrorMessage(msg) {
  logError(new Error(msg));
}

function logError(e) {
  webkit.messageHandlers.logError.postMessage({
    message: e.message,
  });
}


/***/ }),

/***/ "./src/vendor/hypothesis/anchoring/match-quote.js":
/*!********************************************************!*\
  !*** ./src/vendor/hypothesis/anchoring/match-quote.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "matchQuote": () => (/* binding */ matchQuote)
/* harmony export */ });
/* harmony import */ var approx_string_match__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! approx-string-match */ "./node_modules/approx-string-match/dist/index.js");


/**
 * @typedef {import('approx-string-match').Match} StringMatch
 */

/**
 * @typedef Match
 * @prop {number} start - Start offset of match in text
 * @prop {number} end - End offset of match in text
 * @prop {number} score -
 *   Score for the match between 0 and 1.0, where 1.0 indicates a perfect match
 *   for the quote and context.
 */

/**
 * Find the best approximate matches for `str` in `text` allowing up to `maxErrors` errors.
 *
 * @param {string} text
 * @param {string} str
 * @param {number} maxErrors
 * @return {StringMatch[]}
 */
function search(text, str, maxErrors) {
  // Do a fast search for exact matches. The `approx-string-match` library
  // doesn't currently incorporate this optimization itself.
  let matchPos = 0;
  let exactMatches = [];
  while (matchPos !== -1) {
    matchPos = text.indexOf(str, matchPos);
    if (matchPos !== -1) {
      exactMatches.push({
        start: matchPos,
        end: matchPos + str.length,
        errors: 0,
      });
      matchPos += 1;
    }
  }
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  // If there are no exact matches, do a more expensive search for matches
  // with errors.
  return (0,approx_string_match__WEBPACK_IMPORTED_MODULE_0__.default)(text, str, maxErrors);
}

/**
 * Compute a score between 0 and 1.0 for the similarity between `text` and `str`.
 *
 * @param {string} text
 * @param {string} str
 */
function textMatchScore(text, str) {
  /* istanbul ignore next - `scoreMatch` will never pass an empty string */
  if (str.length === 0 || text.length === 0) {
    return 0.0;
  }
  const matches = search(text, str, str.length);

  // prettier-ignore
  return 1 - (matches[0].errors / str.length);
}

/**
 * Find the best approximate match for `quote` in `text`.
 *
 * Returns `null` if no match exceeding the minimum quality threshold was found.
 *
 * @param {string} text - Document text to search
 * @param {string} quote - String to find within `text`
 * @param {Object} context -
 *   Context in which the quote originally appeared. This is used to choose the
 *   best match.
 *   @param {string} [context.prefix] - Expected text before the quote
 *   @param {string} [context.suffix] - Expected text after the quote
 *   @param {number} [context.hint] - Expected offset of match within text
 * @return {Match|null}
 */
function matchQuote(text, quote, context = {}) {
  if (quote.length === 0) {
    return null;
  }

  // Choose the maximum number of errors to allow for the initial search.
  // This choice involves a tradeoff between:
  //
  //  - Recall (proportion of "good" matches found)
  //  - Precision (proportion of matches found which are "good")
  //  - Cost of the initial search and of processing the candidate matches [1]
  //
  // [1] Specifically, the expected-time complexity of the initial search is
  //     `O((maxErrors / 32) * text.length)`. See `approx-string-match` docs.
  const maxErrors = Math.min(256, quote.length / 2);

  // Find closest matches for `quote` in `text` based on edit distance.
  const matches = search(text, quote, maxErrors);

  if (matches.length === 0) {
    return null;
  }

  /**
   * Compute a score between 0 and 1.0 for a match candidate.
   *
   * @param {StringMatch} match
   */
  const scoreMatch = match => {
    const quoteWeight = 50; // Similarity of matched text to quote.
    const prefixWeight = 20; // Similarity of text before matched text to `context.prefix`.
    const suffixWeight = 20; // Similarity of text after matched text to `context.suffix`.
    const posWeight = 2; // Proximity to expected location. Used as a tie-breaker.

    const quoteScore = 1 - match.errors / quote.length;

    const prefixScore = context.prefix
      ? textMatchScore(
          text.slice(Math.max(0, match.start - context.prefix.length), match.start),
          context.prefix
        )
      : 1.0;
    const suffixScore = context.suffix
      ? textMatchScore(
          text.slice(match.end, match.end + context.suffix.length),
          context.suffix
        )
      : 1.0;

    let posScore = 1.0;
    if (typeof context.hint === 'number') {
      const offset = Math.abs(match.start - context.hint);
      posScore = 1.0 - offset / text.length;
    }

    const rawScore =
      quoteWeight * quoteScore +
      prefixWeight * prefixScore +
      suffixWeight * suffixScore +
      posWeight * posScore;
    const maxScore = quoteWeight + prefixWeight + suffixWeight + posWeight;
    const normalizedScore = rawScore / maxScore;

    return normalizedScore;
  };

  // Rank matches based on similarity of actual and expected surrounding text
  // and actual/expected offset in the document text.
  const scoredMatches = matches.map(m => ({
    start: m.start,
    end: m.end,
    score: scoreMatch(m),
  }));

  // Choose match with highest score.
  scoredMatches.sort((a, b) => b.score - a.score);
  return scoredMatches[0];
}


/***/ }),

/***/ "./src/vendor/hypothesis/anchoring/text-range.js":
/*!*******************************************************!*\
  !*** ./src/vendor/hypothesis/anchoring/text-range.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "RESOLVE_FORWARDS": () => (/* binding */ RESOLVE_FORWARDS),
/* harmony export */   "RESOLVE_BACKWARDS": () => (/* binding */ RESOLVE_BACKWARDS),
/* harmony export */   "TextPosition": () => (/* binding */ TextPosition),
/* harmony export */   "TextRange": () => (/* binding */ TextRange)
/* harmony export */ });
/**
 * Return the combined length of text nodes contained in `node`.
 *
 * @param {Node} node
 */
function nodeTextLength(node) {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
    case Node.TEXT_NODE:
      // nb. `textContent` excludes text in comments and processing instructions
      // when called on a parent element, so we don't need to subtract that here.

      return /** @type {string} */ (node.textContent).length;
    default:
      return 0;
  }
}

/**
 * Return the total length of the text of all previous siblings of `node`.
 *
 * @param {Node} node
 */
function previousSiblingsTextLength(node) {
  let sibling = node.previousSibling;
  let length = 0;
  while (sibling) {
    length += nodeTextLength(sibling);
    sibling = sibling.previousSibling;
  }
  return length;
}

/**
 * Resolve one or more character offsets within an element to (text node, position)
 * pairs.
 *
 * @param {Element} element
 * @param {number[]} offsets - Offsets, which must be sorted in ascending order
 * @return {{ node: Text, offset: number }[]}
 */
function resolveOffsets(element, ...offsets) {
  let nextOffset = offsets.shift();
  const nodeIter = /** @type {Document} */ (
    element.ownerDocument
  ).createNodeIterator(element, NodeFilter.SHOW_TEXT);
  const results = [];

  let currentNode = nodeIter.nextNode();
  let textNode;
  let length = 0;

  // Find the text node containing the `nextOffset`th character from the start
  // of `element`.
  while (nextOffset !== undefined && currentNode) {
    textNode = /** @type {Text} */ (currentNode);
    if (length + textNode.data.length > nextOffset) {
      results.push({ node: textNode, offset: nextOffset - length });
      nextOffset = offsets.shift();
    } else {
      currentNode = nodeIter.nextNode();
      length += textNode.data.length;
    }
  }

  // Boundary case.
  while (nextOffset !== undefined && textNode && length === nextOffset) {
    results.push({ node: textNode, offset: textNode.data.length });
    nextOffset = offsets.shift();
  }

  if (nextOffset !== undefined) {
    throw new RangeError('Offset exceeds text length');
  }

  return results;
}

let RESOLVE_FORWARDS = 1;
let RESOLVE_BACKWARDS = 2;

/**
 * Represents an offset within the text content of an element.
 *
 * This position can be resolved to a specific descendant node in the current
 * DOM subtree of the element using the `resolve` method.
 */
class TextPosition {
  /**
   * Construct a `TextPosition` that refers to the text position `offset` within
   * the text content of `element`.
   *
   * @param {Element} element
   * @param {number} offset
   */
  constructor(element, offset) {
    if (offset < 0) {
      throw new Error('Offset is invalid');
    }

    /** Element that `offset` is relative to. */
    this.element = element;

    /** Character offset from the start of the element's `textContent`. */
    this.offset = offset;
  }

  /**
   * Return a copy of this position with offset relative to a given ancestor
   * element.
   *
   * @param {Element} parent - Ancestor of `this.element`
   * @return {TextPosition}
   */
  relativeTo(parent) {
    if (!parent.contains(this.element)) {
      throw new Error('Parent is not an ancestor of current element');
    }

    let el = this.element;
    let offset = this.offset;
    while (el !== parent) {
      offset += previousSiblingsTextLength(el);
      el = /** @type {Element} */ (el.parentElement);
    }

    return new TextPosition(el, offset);
  }

  /**
   * Resolve the position to a specific text node and offset within that node.
   *
   * Throws if `this.offset` exceeds the length of the element's text. In the
   * case where the element has no text and `this.offset` is 0, the `direction`
   * option determines what happens.
   *
   * Offsets at the boundary between two nodes are resolved to the start of the
   * node that begins at the boundary.
   *
   * @param {Object} [options]
   *   @param {RESOLVE_FORWARDS|RESOLVE_BACKWARDS} [options.direction] -
   *     Specifies in which direction to search for the nearest text node if
   *     `this.offset` is `0` and `this.element` has no text. If not specified
   *     an error is thrown.
   * @return {{ node: Text, offset: number }}
   * @throws {RangeError}
   */
  resolve(options = {}) {
    try {
      return resolveOffsets(this.element, this.offset)[0];
    } catch (err) {
      if (this.offset === 0 && options.direction !== undefined) {
        const tw = document.createTreeWalker(
          this.element.getRootNode(),
          NodeFilter.SHOW_TEXT
        );
        tw.currentNode = this.element;
        const forwards = options.direction === RESOLVE_FORWARDS;
        const text = /** @type {Text|null} */ (
          forwards ? tw.nextNode() : tw.previousNode()
        );
        if (!text) {
          throw err;
        }
        return { node: text, offset: forwards ? 0 : text.data.length };
      } else {
        throw err;
      }
    }
  }

  /**
   * Construct a `TextPosition` that refers to the `offset`th character within
   * `node`.
   *
   * @param {Node} node
   * @param {number} offset
   * @return {TextPosition}
   */
  static fromCharOffset(node, offset) {
    switch (node.nodeType) {
      case Node.TEXT_NODE:
        return TextPosition.fromPoint(node, offset);
      case Node.ELEMENT_NODE:
        return new TextPosition(/** @type {Element} */ (node), offset);
      default:
        throw new Error('Node is not an element or text node');
    }
  }

  /**
   * Construct a `TextPosition` representing the range start or end point (node, offset).
   *
   * @param {Node} node - Text or Element node
   * @param {number} offset - Offset within the node.
   * @return {TextPosition}
   */
  static fromPoint(node, offset) {
    switch (node.nodeType) {
      case Node.TEXT_NODE: {
        if (offset < 0 || offset > /** @type {Text} */ (node).data.length) {
          throw new Error('Text node offset is out of range');
        }

        if (!node.parentElement) {
          throw new Error('Text node has no parent');
        }

        // Get the offset from the start of the parent element.
        const textOffset = previousSiblingsTextLength(node) + offset;

        return new TextPosition(node.parentElement, textOffset);
      }
      case Node.ELEMENT_NODE: {
        if (offset < 0 || offset > node.childNodes.length) {
          throw new Error('Child node offset is out of range');
        }

        // Get the text length before the `offset`th child of element.
        let textOffset = 0;
        for (let i = 0; i < offset; i++) {
          textOffset += nodeTextLength(node.childNodes[i]);
        }

        return new TextPosition(/** @type {Element} */ (node), textOffset);
      }
      default:
        throw new Error('Point is not in an element or text node');
    }
  }
}

/**
 * Represents a region of a document as a (start, end) pair of `TextPosition` points.
 *
 * Representing a range in this way allows for changes in the DOM content of the
 * range which don't affect its text content, without affecting the text content
 * of the range itself.
 */
class TextRange {
  /**
   * Construct an immutable `TextRange` from a `start` and `end` point.
   *
   * @param {TextPosition} start
   * @param {TextPosition} end
   */
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  /**
   * Return a copy of this range with start and end positions relative to a
   * given ancestor. See `TextPosition.relativeTo`.
   *
   * @param {Element} element
   */
  relativeTo(element) {
    return new TextRange(
      this.start.relativeTo(element),
      this.end.relativeTo(element)
    );
  }

  /**
   * Resolve the `TextRange` to a DOM range.
   *
   * The resulting DOM Range will always start and end in a `Text` node.
   * Hence `TextRange.fromRange(range).toRange()` can be used to "shrink" a
   * range to the text it contains.
   *
   * May throw if the `start` or `end` positions cannot be resolved to a range.
   *
   * @return {Range}
   */
  toRange() {
    let start;
    let end;

    if (
      this.start.element === this.end.element &&
      this.start.offset <= this.end.offset
    ) {
      // Fast path for start and end points in same element.
      [start, end] = resolveOffsets(
        this.start.element,
        this.start.offset,
        this.end.offset
      );
    } else {
      start = this.start.resolve({ direction: RESOLVE_FORWARDS });
      end = this.end.resolve({ direction: RESOLVE_BACKWARDS });
    }

    const range = new Range();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return range;
  }

  /**
   * Convert an existing DOM `Range` to a `TextRange`
   *
   * @param {Range} range
   * @return {TextRange}
   */
  static fromRange(range) {
    const start = TextPosition.fromPoint(
      range.startContainer,
      range.startOffset
    );
    const end = TextPosition.fromPoint(range.endContainer, range.endOffset);
    return new TextRange(start, end);
  }

  /**
   * Return a `TextRange` from the `start`th to `end`th characters in `root`.
   *
   * @param {Element} root
   * @param {number} start
   * @param {number} end
   */
  static fromOffsets(root, start, end) {
    return new TextRange(
      new TextPosition(root, start),
      new TextPosition(root, end)
    );
  }
}


/***/ }),

/***/ "./src/vendor/hypothesis/anchoring/types.js":
/*!**************************************************!*\
  !*** ./src/vendor/hypothesis/anchoring/types.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "RangeAnchor": () => (/* binding */ RangeAnchor),
/* harmony export */   "TextPositionAnchor": () => (/* binding */ TextPositionAnchor),
/* harmony export */   "TextQuoteAnchor": () => (/* binding */ TextQuoteAnchor)
/* harmony export */ });
/* harmony import */ var _match_quote__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./match-quote */ "./src/vendor/hypothesis/anchoring/match-quote.js");
/* harmony import */ var _text_range__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./text-range */ "./src/vendor/hypothesis/anchoring/text-range.js");
/* harmony import */ var _xpath__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./xpath */ "./src/vendor/hypothesis/anchoring/xpath.js");
/**
 * This module exports a set of classes for converting between DOM `Range`
 * objects and different types of selectors. It is mostly a thin wrapper around a
 * set of anchoring libraries. It serves two main purposes:
 *
 *  1. Providing a consistent interface across different types of anchors.
 *  2. Insulating the rest of the code from API changes in the underlying anchoring
 *     libraries.
 */





/**
 * @typedef {import('../../types/api').RangeSelector} RangeSelector
 * @typedef {import('../../types/api').TextPositionSelector} TextPositionSelector
 * @typedef {import('../../types/api').TextQuoteSelector} TextQuoteSelector
 */

/**
 * Converts between `RangeSelector` selectors and `Range` objects.
 */
class RangeAnchor {
  /**
   * @param {Node} root - A root element from which to anchor.
   * @param {Range} range -  A range describing the anchor.
   */
  constructor(root, range) {
    this.root = root;
    this.range = range;
  }

  /**
   * @param {Node} root -  A root element from which to anchor.
   * @param {Range} range -  A range describing the anchor.
   */
  static fromRange(root, range) {
    return new RangeAnchor(root, range);
  }

  /**
   * Create an anchor from a serialized `RangeSelector` selector.
   *
   * @param {Element} root -  A root element from which to anchor.
   * @param {RangeSelector} selector
   */
  static fromSelector(root, selector) {
    const startContainer = (0,_xpath__WEBPACK_IMPORTED_MODULE_2__.nodeFromXPath)(selector.startContainer, root);
    if (!startContainer) {
      throw new Error('Failed to resolve startContainer XPath');
    }

    const endContainer = (0,_xpath__WEBPACK_IMPORTED_MODULE_2__.nodeFromXPath)(selector.endContainer, root);
    if (!endContainer) {
      throw new Error('Failed to resolve endContainer XPath');
    }

    const startPos = _text_range__WEBPACK_IMPORTED_MODULE_1__.TextPosition.fromCharOffset(
      startContainer,
      selector.startOffset
    );
    const endPos = _text_range__WEBPACK_IMPORTED_MODULE_1__.TextPosition.fromCharOffset(
      endContainer,
      selector.endOffset
    );

    const range = new _text_range__WEBPACK_IMPORTED_MODULE_1__.TextRange(startPos, endPos).toRange();
    return new RangeAnchor(root, range);
  }

  toRange() {
    return this.range;
  }

  /**
   * @return {RangeSelector}
   */
  toSelector() {
    // "Shrink" the range so that it tightly wraps its text. This ensures more
    // predictable output for a given text selection.
    const normalizedRange = _text_range__WEBPACK_IMPORTED_MODULE_1__.TextRange.fromRange(this.range).toRange();

    const textRange = _text_range__WEBPACK_IMPORTED_MODULE_1__.TextRange.fromRange(normalizedRange);
    const startContainer = (0,_xpath__WEBPACK_IMPORTED_MODULE_2__.xpathFromNode)(textRange.start.element, this.root);
    const endContainer = (0,_xpath__WEBPACK_IMPORTED_MODULE_2__.xpathFromNode)(textRange.end.element, this.root);

    return {
      type: 'RangeSelector',
      startContainer,
      startOffset: textRange.start.offset,
      endContainer,
      endOffset: textRange.end.offset,
    };
  }
}

/**
 * Converts between `TextPositionSelector` selectors and `Range` objects.
 */
class TextPositionAnchor {
  /**
   * @param {Element} root
   * @param {number} start
   * @param {number} end
   */
  constructor(root, start, end) {
    this.root = root;
    this.start = start;
    this.end = end;
  }

  /**
   * @param {Element} root
   * @param {Range} range
   */
  static fromRange(root, range) {
    const textRange = _text_range__WEBPACK_IMPORTED_MODULE_1__.TextRange.fromRange(range).relativeTo(root);
    return new TextPositionAnchor(
      root,
      textRange.start.offset,
      textRange.end.offset
    );
  }
  /**
   * @param {Element} root
   * @param {TextPositionSelector} selector
   */
  static fromSelector(root, selector) {
    return new TextPositionAnchor(root, selector.start, selector.end);
  }

  /**
   * @return {TextPositionSelector}
   */
  toSelector() {
    return {
      type: 'TextPositionSelector',
      start: this.start,
      end: this.end,
    };
  }

  toRange() {
    return _text_range__WEBPACK_IMPORTED_MODULE_1__.TextRange.fromOffsets(this.root, this.start, this.end).toRange();
  }
}

/**
 * @typedef QuoteMatchOptions
 * @prop {number} [hint] - Expected position of match in text. See `matchQuote`.
 */

/**
 * Converts between `TextQuoteSelector` selectors and `Range` objects.
 */
class TextQuoteAnchor {
  /**
   * @param {Element} root - A root element from which to anchor.
   * @param {string} exact
   * @param {Object} context
   *   @param {string} [context.prefix]
   *   @param {string} [context.suffix]
   */
  constructor(root, exact, context = {}) {
    this.root = root;
    this.exact = exact;
    this.context = context;
  }

  /**
   * Create a `TextQuoteAnchor` from a range.
   *
   * Will throw if `range` does not contain any text nodes.
   *
   * @param {Element} root
   * @param {Range} range
   */
  static fromRange(root, range) {
    const text = /** @type {string} */ (root.textContent);
    const textRange = _text_range__WEBPACK_IMPORTED_MODULE_1__.TextRange.fromRange(range).relativeTo(root);

    const start = textRange.start.offset;
    const end = textRange.end.offset;

    // Number of characters around the quote to capture as context. We currently
    // always use a fixed amount, but it would be better if this code was aware
    // of logical boundaries in the document (paragraph, article etc.) to avoid
    // capturing text unrelated to the quote.
    //
    // In regular prose the ideal content would often be the surrounding sentence.
    // This is a natural unit of meaning which enables displaying quotes in
    // context even when the document is not available. We could use `Intl.Segmenter`
    // for this when available.
    const contextLen = 32;

    return new TextQuoteAnchor(root, text.slice(start, end), {
      prefix: text.slice(Math.max(0, start - contextLen), start),
      suffix: text.slice(end, Math.min(text.length, end + contextLen)),
    });
  }

  /**
   * @param {Element} root
   * @param {TextQuoteSelector} selector
   */
  static fromSelector(root, selector) {
    const { prefix, suffix } = selector;
    return new TextQuoteAnchor(root, selector.exact, { prefix, suffix });
  }

  /**
   * @return {TextQuoteSelector}
   */
  toSelector() {
    return {
      type: 'TextQuoteSelector',
      exact: this.exact,
      prefix: this.context.prefix,
      suffix: this.context.suffix,
    };
  }

  /**
   * @param {QuoteMatchOptions} [options]
   */
  toRange(options = {}) {
    return this.toPositionAnchor(options).toRange();
  }

  /**
   * @param {QuoteMatchOptions} [options]
   */
  toPositionAnchor(options = {}) {
    const text = /** @type {string} */ (this.root.textContent);
    const match = (0,_match_quote__WEBPACK_IMPORTED_MODULE_0__.matchQuote)(text, this.exact, {
      ...this.context,
      hint: options.hint,
    });
    if (!match) {
      throw new Error('Quote not found');
    }
    return new TextPositionAnchor(this.root, match.start, match.end);
  }
}


/***/ }),

/***/ "./src/vendor/hypothesis/anchoring/xpath.js":
/*!**************************************************!*\
  !*** ./src/vendor/hypothesis/anchoring/xpath.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "xpathFromNode": () => (/* binding */ xpathFromNode),
/* harmony export */   "nodeFromXPath": () => (/* binding */ nodeFromXPath)
/* harmony export */ });
/**
 * Get the node name for use in generating an xpath expression.
 *
 * @param {Node} node
 */
function getNodeName(node) {
  const nodeName = node.nodeName.toLowerCase();
  let result = nodeName;
  if (nodeName === '#text') {
    result = 'text()';
  }
  return result;
}

/**
 * Get the index of the node as it appears in its parent's child list
 *
 * @param {Node} node
 */
function getNodePosition(node) {
  let pos = 0;
  /** @type {Node|null} */
  let tmp = node;
  while (tmp) {
    if (tmp.nodeName === node.nodeName) {
      pos += 1;
    }
    tmp = tmp.previousSibling;
  }
  return pos;
}

function getPathSegment(node) {
  const name = getNodeName(node);
  const pos = getNodePosition(node);
  return `${name}[${pos}]`;
}

/**
 * A simple XPath generator which can generate XPaths of the form
 * /tag[index]/tag[index].
 *
 * @param {Node} node - The node to generate a path to
 * @param {Node} root - Root node to which the returned path is relative
 */
function xpathFromNode(node, root) {
  let xpath = '';

  /** @type {Node|null} */
  let elem = node;
  while (elem !== root) {
    if (!elem) {
      throw new Error('Node is not a descendant of root');
    }
    xpath = getPathSegment(elem) + '/' + xpath;
    elem = elem.parentNode;
  }
  xpath = '/' + xpath;
  xpath = xpath.replace(/\/$/, ''); // Remove trailing slash

  return xpath;
}

/**
 * Return the `index`'th immediate child of `element` whose tag name is
 * `nodeName` (case insensitive).
 *
 * @param {Element} element
 * @param {string} nodeName
 * @param {number} index
 */
function nthChildOfType(element, nodeName, index) {
  nodeName = nodeName.toUpperCase();

  let matchIndex = -1;
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i];
    if (child.nodeName.toUpperCase() === nodeName) {
      ++matchIndex;
      if (matchIndex === index) {
        return child;
      }
    }
  }

  return null;
}

/**
 * Evaluate a _simple XPath_ relative to a `root` element and return the
 * matching element.
 *
 * A _simple XPath_ is a sequence of one or more `/tagName[index]` strings.
 *
 * Unlike `document.evaluate` this function:
 *
 *  - Only supports simple XPaths
 *  - Is not affected by the document's _type_ (HTML or XML/XHTML)
 *  - Ignores element namespaces when matching element names in the XPath against
 *    elements in the DOM tree
 *  - Is case insensitive for all elements, not just HTML elements
 *
 * The matching element is returned or `null` if no such element is found.
 * An error is thrown if `xpath` is not a simple XPath.
 *
 * @param {string} xpath
 * @param {Element} root
 * @return {Element|null}
 */
function evaluateSimpleXPath(xpath, root) {
  const isSimpleXPath =
    xpath.match(/^(\/[A-Za-z0-9-]+(\[[0-9]+\])?)+$/) !== null;
  if (!isSimpleXPath) {
    throw new Error('Expression is not a simple XPath');
  }

  const segments = xpath.split('/');
  let element = root;

  // Remove leading empty segment. The regex above validates that the XPath
  // has at least two segments, with the first being empty and the others non-empty.
  segments.shift();

  for (let segment of segments) {
    let elementName;
    let elementIndex;

    const separatorPos = segment.indexOf('[');
    if (separatorPos !== -1) {
      elementName = segment.slice(0, separatorPos);

      const indexStr = segment.slice(separatorPos + 1, segment.indexOf(']'));
      elementIndex = parseInt(indexStr) - 1;
      if (elementIndex < 0) {
        return null;
      }
    } else {
      elementName = segment;
      elementIndex = 0;
    }

    const child = nthChildOfType(element, elementName, elementIndex);
    if (!child) {
      return null;
    }

    element = child;
  }

  return element;
}

/**
 * Finds an element node using an XPath relative to `root`
 *
 * Example:
 *   node = nodeFromXPath('/main/article[1]/p[3]', document.body)
 *
 * @param {string} xpath
 * @param {Element} [root]
 * @return {Node|null}
 */
function nodeFromXPath(xpath, root = document.body) {
  try {
    return evaluateSimpleXPath(xpath, root);
  } catch (err) {
    return document.evaluate(
      '.' + xpath,
      root,

      // nb. The `namespaceResolver` and `result` arguments are optional in the spec
      // but required in Edge Legacy.
      null /* namespaceResolver */,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null /* result */
    ).singleNodeValue;
  }
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!****************************!*\
  !*** ./src/index-fixed.js ***!
  \****************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _index__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./index */ "./src/index.js");
//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

// Script used for fixed layouts resources.



})();

/******/ })()
;