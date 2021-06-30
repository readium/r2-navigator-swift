//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import { getClientRectsNoOverlap } from "./rect";
import { isScrollModeEnabled, log, rangeFromLocator } from "./utils";

const debug = false;

const defaultBackgroundOpacity = 0.3;

const defaultBackgroundColor = {
  blue: 100,
  green: 50,
  red: 230,
};

let groups = new Map();
var lastGroupId = 0;

export function getDecorations(groupIdentifier) {
  var group = groups.get(groupIdentifier);
  if (!group) {
    let id = "r2-decoration-" + lastGroupId++;
    group = DecorationGroup(id);
    groups.set(groupIdentifier, group);
  }
  return group;
}

export function DecorationGroup(groupId) {
  var items = [];
  var lastItemId = 0;
  var container = null;

  function add(decoration) {
    let id = groupId + "-" + lastItemId++;

    let range = rangeFromLocator(decoration.locator);
    if (!range) {
      log("Can't locate DOM range for decoration", decoration);
      return;
    }

    let item = { id, decoration, range };
    items.push(item);
    layout(item);
  }

  function remove(decorationIdentifier) {
    let index = items.findIndex(
      (i) => i.decoration.identifier === decorationIdentifier
    );
    if (index === -1) {
      return;
    }

    let item = items[index];
    items.splice(index, 1);
    let itemContainer = document.getElementById(item.id);
    if (itemContainer) {
      itemContainer.remove();
      itemContainer = null;
    }
  }

  function update(decoration) {
    remove(decoration.identifier);
    add(decoration);
  }

  function clear() {
    clearContainer();
    items = [];
  }

  function requestLayout() {
    clearContainer();
    items.forEach((item) => layout(item));
  }

  function layout(item) {
    let scrollElement = document.scrollingElement;
    let groupContainer = requireContainer();
    let paginated = !isScrollModeEnabled();

    let itemContainer = document.createElement("div");
    itemContainer.setAttribute("id", item.id);
    itemContainer.style.setProperty("pointer-events", "none");
    if (item.pointerInteraction) {
      itemContainer.setAttribute("data-click", "1");
    }

    let bodyRect = document.body.getBoundingClientRect();
    let doNotMergeHorizontallyAlignedRects = false;
    let clientRects = getClientRectsNoOverlap(
      item.range,
      doNotMergeHorizontallyAlignedRects
    );
    let roundedCorner = 3;
    let color = defaultBackgroundColor;
    let opacity = defaultBackgroundOpacity;
    let extra = "";

    let xOffset = paginated ? -scrollElement.scrollLeft : bodyRect.left;
    let yOffset = paginated ? -scrollElement.scrollTop : bodyRect.top;

    for (let clientRect of clientRects) {
      const itemArea = document.createElement("div");
      if (debug) {
        const rgb = Math.round(0xffffff * Math.random());
        const r = rgb >> 16;
        const g = (rgb >> 8) & 255;
        const b = rgb & 255;
        extra = `outline-color: rgb(${r}, ${g}, ${b}); outline-style: solid; outline-width: 1px; outline-offset: -1px;`;
      }
      itemArea.setAttribute(
        "style",
        `border-radius: ${roundedCorner}px !important; background-color: rgba(${color.red}, ${color.green}, ${color.blue}, ${opacity}) !important; ${extra}`
      );
      itemArea.style.setProperty("pointer-events", "none");
      itemArea.style.position = "absolute";
      itemArea.scale = 1;
      itemArea.rect = {
        height: clientRect.height,
        left: clientRect.left - xOffset,
        top: clientRect.top - yOffset,
        width: clientRect.width,
      };

      itemArea.style.width = `${itemArea.rect.width}px`;
      itemArea.style.height = `${itemArea.rect.height}px`;
      itemArea.style.left = `${itemArea.rect.left}px`;
      itemArea.style.top = `${itemArea.rect.top}px`;
      itemContainer.append(itemArea);
    }

    const itemBounding = document.createElement("div");
    itemBounding.style.setProperty("pointer-events", "none");
    itemBounding.style.position = paginated ? "fixed" : "absolute";
    itemBounding.scale = 1;

    if (debug) {
      itemBounding.setAttribute(
        "style",
        `outline-color: magenta; outline-style: solid; outline-width: 1px; outline-offset: -1px;`
      );
    }

    const rangeBoundingClientRect = item.range.getBoundingClientRect();
    itemBounding.rect = {
      height: rangeBoundingClientRect.height,
      left: rangeBoundingClientRect.left - xOffset,
      top: rangeBoundingClientRect.top - yOffset,
      width: rangeBoundingClientRect.width,
    };

    itemBounding.style.width = `${itemBounding.rect.width}px`;
    itemBounding.style.height = `${itemBounding.rect.height}px`;
    itemBounding.style.left = `${itemBounding.rect.left}px`;
    itemBounding.style.top = `${itemBounding.rect.top}px`;

    itemContainer.append(itemBounding);
    groupContainer.append(itemContainer);
  }

  function requireContainer() {
    if (!container) {
      container = document.createElement("div");
      container.setAttribute("id", groupId);
      container.style.setProperty("pointer-events", "none");
      document.body.append(container);
    }
    return container;
  }

  function clearContainer() {
    if (container) {
      container.remove();
      container = null;
    }
  }

  return { add, remove, update, clear, requestLayout };
}

window.addEventListener(
  "load",
  function () {
    // on page load
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
