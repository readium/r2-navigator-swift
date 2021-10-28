//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

// Base script used by both reflowable and fixed layout resources.

import "./gestures";
import {
  getExtraLocationInfos,
  removeProperty,
  scrollLeft,
  scrollRight,
  scrollToId,
  scrollToPartialCfi,
  scrollToPosition,
  scrollToText,
  setProperty,
} from "./utils";
import { getDecorations, registerTemplates } from "./decorator";

// Public API used by the navigator.
window.readium = {
  // utils
  scrollToId: scrollToId,
  scrollToPosition: scrollToPosition,
  scrollToPartialCfi: scrollToPartialCfi,
  scrollToText: scrollToText,
  scrollLeft: scrollLeft,
  scrollRight: scrollRight,
  setProperty: setProperty,
  removeProperty: removeProperty,
  getExtraLocationInfos: getExtraLocationInfos,

  // decoration
  registerDecorationTemplates: registerTemplates,
  getDecorations: getDecorations,
};
