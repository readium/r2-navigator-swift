//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import Foundation

public struct HTMLDecorationStyle {
    public enum Layout: String {
        case bounds, lines
    }
    public enum Width: String {
        case wrap, bounds, viewport, page
    }

    let layout: Layout
    let width: Width
    let element: String
    let stylesheet: String?
    let applyScript: String?

    public init(layout: Layout, width: Width = .wrap, element: String = "<div/>", stylesheet: String? = nil, applyScript: String? = nil) {
        self.layout = layout
        self.width = width
        self.element = element
        self.stylesheet = stylesheet
        self.applyScript = applyScript
    }

    public var json: [String: Any] {
        [
            "layout": layout.rawValue,
            "width": width.rawValue,
            "element": element,
            "stylesheet": stylesheet as Any,
            "applyScript": applyScript as Any,
        ]
    }

    public static func defaultStyles(
        lineWeight: Int = 2,
        cornerRadius: Int = 3,
        highlightOpacity: Double = 0.3,
        sidemarkWeight: Int = 5,
        sidemarkMargin: Int = 20
    ) -> [Decoration.Style: HTMLDecorationStyle] {
        [
            .highlight: .highlight(cornerRadius: cornerRadius, opacity: highlightOpacity),
            .underline: .underline(lineWeight: lineWeight, cornerRadius: cornerRadius),
            .strikethrough: .strikethrough(lineWeight: lineWeight, cornerRadius: cornerRadius),
            .sidemark: .sidemark(lineWeight: sidemarkWeight, cornerRadius: cornerRadius, margin: sidemarkMargin),
        ]
    }

    public static func highlight(cornerRadius: Int, opacity: Double) -> HTMLDecorationStyle {
        HTMLDecorationStyle(
            layout: .lines,
            element: #"<div class="r2-highlight"/>"#,
            stylesheet:
            """
            .r2-highlight {
                border-radius: \(cornerRadius)px;
                background-color: var(--r2-decoration-tint);
                opacity: \(opacity);
            }
            """
        )
    }

    public static func underline(lineWeight: Int, cornerRadius: Int) -> HTMLDecorationStyle {
        HTMLDecorationStyle(
            layout: .lines,
            element: #"<div><span class="r2-underline"/></div>"#,
            stylesheet:
            """
            .r2-underline {
                display: inline-block;
                width: 100%;
                height: \(lineWeight)px;
                border-radius: \(cornerRadius)px;
                background-color: var(--r2-decoration-tint);
                vertical-align: sub;
            }
            """
        )
    }

    public static func strikethrough(lineWeight: Int, cornerRadius: Int) -> HTMLDecorationStyle {
        HTMLDecorationStyle(
            layout: .lines,
            element: #"<div><span class="r2-strikethrough"/></div>"#,
            stylesheet:
            """
            .r2-strikethrough {
                display: inline-block;
                width: 100%;
                height: 20%;
                border-radius: \(cornerRadius)px;
                border-top: \(lineWeight)px solid var(--r2-decoration-tint);
            }
            """
        )
    }

    public static func sidemark(lineWeight: Int, cornerRadius: Int, margin: Int) -> HTMLDecorationStyle {
        HTMLDecorationStyle(
            layout: .bounds,
            width: .page,
            element: #"<div><div class="r2-sidemark"/></div>"#,
            stylesheet:
            """
            .r2-sidemark {
                float: left;
                width: \(lineWeight)px;
                height: 100%;
                background-color: var(--r2-decoration-tint);
                margin-left: \(margin)px;
                border-radius: \(cornerRadius)px;
            }
            [dir=rtl] .r2-sidemark {
                float: right;
                margin-left: 0px;
                margin-right: \(margin)px;
            }
            """
        )
    }
}
