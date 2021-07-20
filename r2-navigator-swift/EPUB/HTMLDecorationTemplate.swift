//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import Foundation
import SwiftSoup
import UIKit

/// An `HTMLDecorationTemplate` renders a `Decoration` into a set of HTML elements and associated stylesheet.
public struct HTMLDecorationTemplate {

    /// Determines the number of created HTML elements and their position relative to the matching DOM range.
    public enum Layout: String {
        /// A single HTML element covering the smallest region containing all CSS border boxes.
        case bounds
        /// One HTML element for each CSS border box (e.g. line of text).
        case boxes
    }

    /// Indicates how the width of each created HTML element expands in the viewport.
    public enum Width: String {
        /// Smallest width fitting the CSS border box.
        case wrap
        /// Fills the bounds layout.
        case bounds
        /// Fills the anchor page, useful for dual page.
        case viewport
        /// Fills the whole viewport.
        case page
    }

    let layout: Layout
    let width: Width
    let element: (Decoration) -> String
    let stylesheet: String?

    public init(layout: Layout, width: Width = .wrap, element: @escaping (Decoration) -> String = { _ in "<div/>" }, stylesheet: String? = nil) {
        self.layout = layout
        self.width = width
        self.element = element
        self.stylesheet = stylesheet
    }

    public init(layout: Layout, width: Width = .wrap, element: String = "<div/>", stylesheet: String? = nil) {
        self.init(layout: layout, width: width, element: { _ in element }, stylesheet: stylesheet)
    }

    public var json: [String: Any] {
        [
            "layout": layout.rawValue,
            "width": width.rawValue,
            "stylesheet": stylesheet as Any,
        ]
    }

    /// Creates the default list of decoration styles with associated HTML templates.
    public static func defaultTemplates(
        defaultTint: UIColor = .yellow,
        lineWeight: Int = 2,
        cornerRadius: Int = 3,
        alpha: Double = 0.3
    ) -> [Decoration.Style.Id: HTMLDecorationTemplate] {
        [
            .highlight: .highlight(defaultTint: defaultTint, padding: .init(top: 0, left: 1, bottom: 0, right: 1), cornerRadius: cornerRadius, alpha: alpha),
            .underline: .underline(defaultTint: defaultTint, lineWeight: lineWeight, cornerRadius: cornerRadius),
        ]
    }

    /// Creates a new decoration template for the `highlight` style.
    public static func highlight(defaultTint: UIColor, padding: UIEdgeInsets, cornerRadius: Int, alpha: Double) -> HTMLDecorationTemplate {
        let className = makeUniqueClassName(key: "highlight")
        return HTMLDecorationTemplate(
            layout: .boxes,
            element: { decoration in
                let config = decoration.style.config as! Decoration.Style.HighlightConfig
                let tint = config.tint ?? defaultTint
                var extraStyle = ""
                if config.isActive {
                    extraStyle += " border-bottom: 2px solid \(tint.cssValue());"
                }
                return "<div class=\"\(className)\" style=\"background-color: \(tint.cssValue(alpha: alpha)) !important; \(extraStyle)\"/>"
            },
            stylesheet:
            """
            .\(className) {
                margin-left: \(-padding.left)px;
                padding-right: \(padding.left + padding.right)px;
                margin-top: \(-padding.top)px;
                padding-bottom: \(padding.top + padding.bottom)px;
                border-radius: \(cornerRadius)px;
                box-sizing: border-box;
            }
            """
        )
    }

    /// Creates a new decoration template for the `underline` style.
    public static func underline(defaultTint: UIColor, lineWeight: Int, cornerRadius: Int) -> HTMLDecorationTemplate {
        let className = makeUniqueClassName(key: "underline")
        return HTMLDecorationTemplate(
            layout: .boxes,
            element: { decoration in
                let config = decoration.style.config as! Decoration.Style.HighlightConfig
                let tint = config.tint ?? defaultTint
                return "<div><span class=\"\(className)\" style=\"background-color: \(tint.cssValue())\"/></div>"
            },
            stylesheet:
            """
            .\(className) {
                display: inline-block;
                width: 100%;
                height: \(lineWeight)px;
                border-radius: \(cornerRadius)px;
                vertical-align: sub;
            }
            """
        )
    }

    private static var classNamesId = 0;
    private static func makeUniqueClassName(key: String) -> String {
        classNamesId += 1
        return "r2-\(key)-\(classNamesId)"
    }
}