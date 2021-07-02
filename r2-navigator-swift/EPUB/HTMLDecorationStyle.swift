//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import Foundation
import UIKit

public struct HTMLDecorationStyle {
    public enum Layout: String {
        case bounds, boxes
    }
    public enum Width: String {
        case wrap, bounds, viewport, page
    }
    public enum UnderlineAnchor {
        case baseline, box
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
        opacity: Double = 0.3,
        sidemarkWeight: Int = 5,
        sidemarkMargin: Int = 20
    ) -> [Decoration.Style: HTMLDecorationStyle] {
        [
            .highlight: .highlight(padding: .init(top: 0, left: 1, bottom: 0, right: 1), cornerRadius: cornerRadius, opacity: opacity),
            .underline: .underline(anchor: .baseline, lineWeight: lineWeight, cornerRadius: cornerRadius),
            .strikethrough: .strikethrough(lineWeight: lineWeight, cornerRadius: cornerRadius),
            .sidemark: .sidemark(lineWeight: sidemarkWeight, cornerRadius: cornerRadius, margin: sidemarkMargin),
        ]
    }

    public static func highlight(padding: UIEdgeInsets, cornerRadius: Int, opacity: Double) -> HTMLDecorationStyle {
        let className = makeUniqueClassName(key: "highlight")
        return HTMLDecorationStyle(
            layout: .boxes,
            element: "<div class=\"\(className)\"/>",
            stylesheet:
            """
            .\(className) {
                margin-left: \(-padding.left)px;
                padding-right: \(padding.left + padding.right)px;
                margin-top: \(-padding.top)px;
                padding-bottom: \(padding.top + padding.bottom)px;
                border-radius: \(cornerRadius)px;
                background-color: var(--r2-decoration-tint);
                opacity: \(opacity);
            }
            """
        )
    }

    public static func underline(anchor: UnderlineAnchor, lineWeight: Int, cornerRadius: Int) -> HTMLDecorationStyle {
        let className = makeUniqueClassName(key: "underline")
        switch anchor {
        case .baseline:
            return HTMLDecorationStyle(
                layout: .boxes,
                element: "<div><span class=\"\(className)\"/></div>",
                stylesheet:
                """
                .\(className) {
                    display: inline-block;
                    width: 100%;
                    height: \(lineWeight)px;
                    border-radius: \(cornerRadius)px;
                    background-color: var(--r2-decoration-tint);
                    vertical-align: sub;
                }
                """
            )
        case .box:
            return HTMLDecorationStyle(
                layout: .boxes,
                element: "<div class=\"\(className)\"/>",
                stylesheet:
                """
                .\(className) {
                    box-sizing: border-box;
                    border-radius: \(cornerRadius)px;
                    border-bottom: \(lineWeight)px solid var(--r2-decoration-tint);
                }
                """
            )
        }
    }

    public static func strikethrough(lineWeight: Int, cornerRadius: Int) -> HTMLDecorationStyle {
        let className = makeUniqueClassName(key: "strikethrough")
        return HTMLDecorationStyle(
            layout: .boxes,
            element: "<div><span class=\"\(className)\"/></div>",
            stylesheet:
            """
            .\(className) {
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
        let className = makeUniqueClassName(key: "sidemark")
        return HTMLDecorationStyle(
            layout: .bounds,
            width: .page,
            element: "<div><div class=\"\(className)\"/></div>",
            stylesheet:
            """
            .\(className) {
                float: left;
                width: \(lineWeight)px;
                height: 100%;
                background-color: var(--r2-decoration-tint);
                margin-left: \(margin)px;
                border-radius: \(cornerRadius)px;
            }
            [dir=rtl] .\(className) {
                float: right;
                margin-left: 0px;
                margin-right: \(margin)px;
            }
            """
        )
    }

    public static let image = HTMLDecorationStyle(
        layout: .bounds,
        width: .page,
        element: #"<div><img class="r2-image" src="https://lea.verou.me/mark.svg"/></div>"#,
        stylesheet:
        """
        .r2-image {
            opacity: 0.5;
        }
        """
    )

    private static var classNamesId = 0;
    private static func makeUniqueClassName(key: String) -> String {
        classNamesId += 1
        return "r2-\(key)-\(classNamesId)"
    }
}
