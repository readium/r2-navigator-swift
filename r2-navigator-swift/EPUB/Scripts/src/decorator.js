//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import { getClientRectsNoOverlap } from "./rect";
import {
  isScrollModeEnabled,
  log,
  logErrorMessage,
  rangeFromLocator,
} from "./utils";

let styles = new Map();
let groups = new Map();
var lastGroupId = 0;

export function registerStyles(newStyles) {
  var stylesheet = "";

  for (const [id, style] of Object.entries(newStyles)) {
    try {
      let template = document.createElement("template");
      template.innerHTML = style.element.trim();
      style.element = template;
      styles.set(id, style);

      if (style.stylesheet) {
        stylesheet += style.stylesheet + "\n";
      }
    } catch (error) {
      logErrorMessage(`Invalid decoration style "${id}": ${error.message}`);
    }
  }

  if (stylesheet) {
    let styleElement = document.createElement("style");
    styleElement.innerHTML = stylesheet;
    document.getElementsByTagName("head")[0].appendChild(styleElement);
  }
}

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
    let groupContainer = requireContainer();

    let style = styles.get(item.decoration.style);
    if (!style) {
      logErrorMessage(`Unknown decoration style: ${item.decoration.style}`);
      return;
    }

    let itemContainer = document.createElement("div");
    itemContainer.setAttribute("id", item.id);
    itemContainer.style.setProperty("pointer-events", "none");
    if (item.pointerInteraction) {
      itemContainer.setAttribute("data-click", "1");
    }
    let tint = item.decoration.tint;
    if (tint) {
      itemContainer.style.setProperty(
        "--r2-decoration-tint",
        `rgb(${tint.red}, ${tint.green}, ${tint.blue})`
      );
    }

    let doNotMergeHorizontallyAlignedRects = true;
    let clientRects = getClientRectsNoOverlap(
      item.range,
      doNotMergeHorizontallyAlignedRects
    );

    let paginated = !isScrollModeEnabled();
    let scrollingElement = document.scrollingElement;
    let bodyRect = document.body.getBoundingClientRect();
    let xOffset = paginated ? -scrollingElement.scrollLeft : bodyRect.left;
    let yOffset = paginated ? -scrollingElement.scrollTop : bodyRect.top;

    function positionElement(element, rect) {
      element.style.position = "absolute";
      element.style.width = `${rect.width}px`;
      element.style.height = `${rect.height}px`;
      element.style.left = `${rect.left - xOffset}px`;
      element.style.top = `${rect.top - yOffset}px`;
    }

    for (let clientRect of clientRects) {
      const itemArea = style.element.content.firstElementChild.cloneNode(true);
      itemArea.style.setProperty("pointer-events", "none");
      positionElement(itemArea, clientRect);
      itemContainer.append(itemArea);
    }

    // const itemBounding = document.createElement("div");
    // itemBounding.style.setProperty("pointer-events", "none");
    // itemBounding.style.position = "absolute";
    // positionElement(itemBounding, item.range.getBoundingClientRect());
    //
    // itemContainer.append(itemBounding);
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
