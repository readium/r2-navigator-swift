//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

// Base script used by both reflowable and fixed layout resources.

import "./gestures";
import {
  removeProperty,
  scrollLeft,
  scrollRight,
  scrollToId,
  scrollToPosition,
  scrollToText,
  setProperty,
} from "./utils";
import { getCurrentSelectionInfo, getSelectionRect } from "./selection";
import { clearHighlights, highlight } from "./highlight";

// Public API used by the navigator.
window.readium = {
  // utils
  scrollToId: scrollToId,
  scrollToPosition: scrollToPosition,
  scrollToText: scrollToText,
  scrollLeft: scrollLeft,
  scrollRight: scrollRight,
  setProperty: setProperty,
  removeProperty: removeProperty,

  // selection
  getSelectionRect: getSelectionRect,
  getCurrentSelectionInfo: getCurrentSelectionInfo,

  // highlights
  highlight: highlight,
  clearHighlights: clearHighlights,
};
