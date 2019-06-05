//
//  HighlightableNavigator.swift
//  r2-navigator-swift
//
//  Created by Mickaël Menu on 28.05.19.
//
//  Copyright 2019 Readium Foundation. All rights reserved.
//  Use of this source code is governed by a BSD-style license which is detailed
//  in the LICENSE file present in the project repository where this source code is maintained.
//

import Foundation
import UIKit
import R2Shared


public protocol HighlightableNavigator: SelectableNavigator, VisualNavigator {
    
    /// Adds a highlight to be displayed by the navigator.
    /// If a highlight with the same ID is already displayed, then it is updated.
    func showHighlight(_ highlight: Highlight)
    
    /// Adds several highlights to be displayed by the navigator.
    /// If a highlight with the same ID is already displayed, then it is updated.
    func showHighlights(_ highlights: [Highlight])
    
    /// Hides the highlight with given ID.
    func hideHighlightWithID(_ id: String)
    
    /// Hides all the highlights.
    func hideAllHighlights()
    
    /// If the highlight with given ID is currently visible on screen, returns the visible portion rectangle, in the absolute coordinate of the navigator's view.
    /// You can use this information, for example, to display a view on top of the navigator around the highlight.
    func frameForHighlightWithID(_ id: String) -> CGRect?
    
    /// If the highlight with given ID is currently visible on screen, returns the visible portion rectangle of the annotation mark, in the absolute coordinate of the navigator's view.
    /// You can use this information, for example, to animate a pop-up from the annotation mark.
    func frameForHighlightAnnotationMarkWithID(_ id: String) -> CGRect?
    
    /// Registers a new style (or annotation mark style) to be used for a `Highlight`.
    /// The style is highly dependent of the format, so it should actually be customized by each navigator implementation. For example, the EPUB navigator can use CSS to register the style.
    /// The host app will be responsible for registering all the desired styles after creating each navigator.
    /// func registerHighlightStyle(_ name: String, ...)
    /// func registerHighlightAnnotationMarkStyle(_ name: String, ...)
    
}


public protocol HighlightableNavigatorDelegate: VisualNavigatorDelegate {
    
    /// Called when the user tapped a highlight.
    func navigator(_ navigator: HighlightableNavigator, didActivate highlight: Highlight)
    
    /// Called when the user tapped a highlight's annotation mark.
    func navigator(_ navigator: HighlightableNavigator, didActivateAnnotationMarkOf highlight: Highlight)
    
}


/// View model for a highlight displayed by a HighlightableNavigator.
public struct Highlight {
    
    /// Unique identifier provided by the app for this highlight (eg. the database ID).
    let id: String
    
    /// The selection range locator.
    let locator: Locator

    /// Style name.
    /// The style must be registered to the navigator with `HighlightableNavigator.registerHighlightStyle`.
    let style: String
    
    /// Custom color to be used with the highlight style, if relevant.
    /// It must have 100% opacity, because the transparency is handled by the navigator itself.
    let color: UIColor?

    /// Style of the annotation mark to be displayed next to the highlight, if there's any.
    /// The style must be registered to the navigator with `HighlightableNavigator.registerHighlightAnnotationMarkStyle`.
    let annotationMarkStyle: String?
    
    init(id: String, locator: Locator, style: String, color: UIColor? = nil, annotationMarkStyle: String? = nil) {
        self.id = id
        self.locator = locator
        self.style = style
        self.color = color
        self.annotationMarkStyle = annotationMarkStyle
    }
    
}
