//
//  SelectableNavigator.swift
//  r2-navigator-swift
//
//  Created by Mickaël Menu on 28.05.19.
//
//  Copyright 2019 Readium Foundation. All rights reserved.
//  Use of this source code is governed by a BSD-style license which is detailed
//  in the LICENSE file present in the project repository where this source code is maintained.
//

import Foundation
import R2Shared


/// A navigator that allows the user to select content.
/// FIXME: Editing actions, copy, etc. should be exposed through this protocol.
public protocol SelectableNavigator: Navigator {
    
    /// Locator to the currently selected content, if any.
    var currentSelection: Locator? { get }
    
}
