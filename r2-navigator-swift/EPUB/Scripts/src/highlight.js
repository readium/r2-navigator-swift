//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import { convertRangeInfo, location2RangeInfo } from "./selection";
import { getClientRectsNoOverlap } from "./rect";
import { isScrollModeEnabled, log } from "./utils";

const debug = false;

const ID_HIGHLIGHTS_CONTAINER = "R2_ID_HIGHLIGHTS_CONTAINER";
const CLASS_HIGHLIGHT_CONTAINER = "R2_CLASS_HIGHLIGHT_CONTAINER";
const CLASS_HIGHLIGHT_AREA = "R2_CLASS_HIGHLIGHT_AREA";
const CLASS_HIGHLIGHT_BOUNDING_AREA = "R2_CLASS_HIGHLIGHT_BOUNDING_AREA";

const _highlights = [];
let _highlightsContainer;

const defaultBackgroundOpacity = 0.3;

const defaultBackgroundColor = {
  blue: 100,
  green: 50,
  red: 230,
};

window.addEventListener(
  "load",
  function () {
    // on page load
    const body = document.body;
    var lastSize = { width: 0, height: 0 };
    const observer = new ResizeObserver(() => {
      log(body.clientWidth, body.clientHeight);
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
      resetHighlights();
    });
    observer.observe(body);
  },
  false
);

export function rectForHighlightWithID(id) {
  const clientRects = frameForHighlightWithID(id);

  return {
    screenWidth: window.outerWidth,
    screenHeight: window.outerHeight,
    left: clientRects[0].left,
    width: clientRects[0].width,
    top: clientRects[0].top,
    height: clientRects[0].height,
  };
}

export function destroyAllHighlights() {
  hideAllHighlights();
  _highlights.splice(0, _highlights.length);
}

function hideAllHighlights() {
  if (_highlightsContainer) {
    _highlightsContainer.remove();
    _highlightsContainer = null;
  }
}

function resetHighlights() {
  hideAllHighlights();

  for (const highlight of _highlights) {
    createHighlightDOM(highlight);
  }
}

export function createHighlightRange(range) {
  // FIXME: Use user-provided ID.
  let id = "R2_HIGHLIGHT_" + Date.now();

  destroyHighlight(id);

  const highlight = {
    color: defaultBackgroundColor,
    id,
    pointerInteraction: true,
    range: range,
  };
  _highlights.push(highlight);
  createHighlightDOM(highlight);

  return highlight;
}

export function createHighlight(locations, color, pointerInteraction) {
  const rangeInfo = location2RangeInfo(locations);

  // FIXME: Use user-provided ID.
  let id = "R2_HIGHLIGHT_" + Date.now();

  destroyHighlight(id);

  const highlight = {
    color: color ? color : defaultBackgroundColor,
    id,
    pointerInteraction,
    range: convertRangeInfo(document, rangeInfo),
  };
  _highlights.push(highlight);
  createHighlightDOM(highlight);

  return highlight;
}

function destroyHighlight(id) {
  let i = -1;
  let _document = window.document;
  const highlight = _highlights.find((h, j) => {
    i = j;
    return h.id === id;
  });
  if (highlight && i >= 0 && i < _highlights.length) {
    _highlights.splice(i, 1);
  }
  const highlightContainer = _document.getElementById(id);
  if (highlightContainer) {
    highlightContainer.remove();
  }
}

function createHighlightDOM(highlight) {
  if (!highlight.range) {
    return undefined;
  }

  const scrollElement = document.scrollingElement;

  const paginated = !isScrollModeEnabled();
  const highlightsContainer = ensureContainer(window);
  const highlightParent = document.createElement("div");

  highlightParent.setAttribute("id", highlight.id);
  highlightParent.setAttribute("class", CLASS_HIGHLIGHT_CONTAINER);

  highlightParent.style.setProperty("pointer-events", "none");
  if (highlight.pointerInteraction) {
    highlightParent.setAttribute("data-click", "1");
  }

  const bodyRect = document.body.getBoundingClientRect();
  const drawUnderline = false;
  const drawStrikeThrough = false;
  const doNotMergeHorizontallyAlignedRects = drawUnderline || drawStrikeThrough;
  const clientRects = getClientRectsNoOverlap(
    highlight.range,
    doNotMergeHorizontallyAlignedRects
  );
  const roundedCorner = 3;
  const underlineThickness = 2;
  const strikeThroughLineThickness = 3;
  const opacity = defaultBackgroundOpacity;
  let extra = "";

  let xOffset = paginated ? -scrollElement.scrollLeft : bodyRect.left;
  let yOffset = paginated ? -scrollElement.scrollTop : bodyRect.top;

  for (const clientRect of clientRects) {
    const highlightArea = document.createElement("div");

    highlightArea.setAttribute("class", CLASS_HIGHLIGHT_AREA);

    if (debug) {
      const rgb = Math.round(0xffffff * Math.random());
      const r = rgb >> 16;
      const g = (rgb >> 8) & 255;
      const b = rgb & 255;
      extra = `outline-color: rgb(${r}, ${g}, ${b}); outline-style: solid; outline-width: 1px; outline-offset: -1px;`;
    } else {
      if (drawUnderline) {
        extra += `border-bottom: ${underlineThickness}px solid rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important`;
      }
    }
    highlightArea.setAttribute(
      "style",
      `border-radius: ${roundedCorner}px !important; background-color: rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important; ${extra}`
    );
    highlightArea.style.setProperty("pointer-events", "none");
    highlightArea.style.position = "absolute";
    highlightArea.scale = 1;
    /*
         highlightArea.rect = {
         height: clientRect.height,
         left: clientRect.left - xOffset,
         top: clientRect.top - yOffset,
         width: clientRect.width,
         };
         */
    highlightArea.rect = {
      height: clientRect.height,
      left: clientRect.left - xOffset,
      top: clientRect.top - yOffset,
      width: clientRect.width,
    };

    highlightArea.style.width = `${highlightArea.rect.width}px`;
    highlightArea.style.height = `${highlightArea.rect.height}px`;
    highlightArea.style.left = `${highlightArea.rect.left}px`;
    highlightArea.style.top = `${highlightArea.rect.top}px`;
    highlightParent.append(highlightArea);
    if (!debug && drawStrikeThrough) {
      //if (drawStrikeThrough) {
      const highlightAreaLine = document.createElement("div");
      highlightAreaLine.setAttribute("class", CLASS_HIGHLIGHT_AREA);

      highlightAreaLine.setAttribute(
        "style",
        `background-color: rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important;`
      );
      highlightAreaLine.style.setProperty("pointer-events", "none");
      highlightAreaLine.style.position = paginated ? "fixed" : "absolute";
      highlightAreaLine.scale = 1;
      /*
             highlightAreaLine.rect = {
             height: clientRect.height,
             left: clientRect.left - xOffset,
             top: clientRect.top - yOffset,
             width: clientRect.width,
             };
             */

      highlightAreaLine.rect = {
        height: clientRect.height,
        left: clientRect.left - xOffset,
        top: clientRect.top - yOffset,
        width: clientRect.width,
      };

      highlightAreaLine.style.width = `${highlightAreaLine.rect.width}px`;
      highlightAreaLine.style.height = `${strikeThroughLineThickness}px`;
      highlightAreaLine.style.left = `${highlightAreaLine.rect.left}px`;
      highlightAreaLine.style.top = `${
        highlightAreaLine.rect.top +
        highlightAreaLine.rect.height / 2 -
        strikeThroughLineThickness / 2
      }px`;
      highlightParent.append(highlightAreaLine);
    }
  }

  const highlightBounding = document.createElement("div");
  highlightBounding.setAttribute("class", CLASS_HIGHLIGHT_BOUNDING_AREA);

  highlightBounding.style.setProperty("pointer-events", "none");
  highlightBounding.style.position = paginated ? "fixed" : "absolute";
  highlightBounding.scale = 1;

  if (debug) {
    highlightBounding.setAttribute(
      "style",
      `outline-color: magenta; outline-style: solid; outline-width: 1px; outline-offset: -1px;`
    );
  }

  const rangeBoundingClientRect = highlight.range.getBoundingClientRect();
  highlightBounding.rect = {
    height: rangeBoundingClientRect.height,
    left: rangeBoundingClientRect.left - xOffset,
    top: rangeBoundingClientRect.top - yOffset,
    width: rangeBoundingClientRect.width,
  };

  highlightBounding.style.width = `${highlightBounding.rect.width}px`;
  highlightBounding.style.height = `${highlightBounding.rect.height}px`;
  highlightBounding.style.left = `${highlightBounding.rect.left}px`;
  highlightBounding.style.top = `${highlightBounding.rect.top}px`;

  highlightParent.append(highlightBounding);
  highlightsContainer.append(highlightParent);

  return highlightParent;
}

function ensureContainer(win) {
  const document = win.document;

  if (!_highlightsContainer) {
    _highlightsContainer = document.createElement("div");
    _highlightsContainer.setAttribute("id", ID_HIGHLIGHTS_CONTAINER);

    _highlightsContainer.style.setProperty("pointer-events", "none");
    document.body.append(_highlightsContainer);
  }

  return _highlightsContainer;
}

function frameForHighlightWithID(id) {
  const highlight = highlightWithID(id);
  if (!highlight) return;

  if (!highlight.range) {
    return undefined;
  }

  const drawUnderline = false;
  const drawStrikeThrough = false;
  const doNotMergeHorizontallyAlignedRects = drawUnderline || drawStrikeThrough;
  return getClientRectsNoOverlap(
    highlight.range,
    doNotMergeHorizontallyAlignedRects
  );
}

function highlightWithID(id) {
  return _highlights.find((h) => {
    return h.id === id;
  });
}
