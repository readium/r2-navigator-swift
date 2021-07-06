//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import Foundation
import SwiftSoup
import UIKit

public struct HTMLDecorationTemplate {
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

    public static func defaultStyles(
        defaultTint: UIColor = .yellow,
        lineWeight: Int = 2,
        cornerRadius: Int = 3,
        alpha: Double = 0.3,
        sidemarkWeight: Int = 5,
        sidemarkMargin: Int = 20
    ) -> [Decoration.Style.Id: HTMLDecorationTemplate] {
        [
            .highlight: .highlight(defaultTint: defaultTint, padding: .init(top: 0, left: 1, bottom: 0, right: 1), cornerRadius: cornerRadius, alpha: alpha),
            .underline: .underline(defaultTint: defaultTint, anchor: .baseline, lineWeight: lineWeight, cornerRadius: cornerRadius),
            .strikethrough: .strikethrough(defaultTint: defaultTint, lineWeight: lineWeight, cornerRadius: cornerRadius),
            .sidemark: .sidemark(defaultTint: defaultTint, lineWeight: sidemarkWeight, cornerRadius: cornerRadius, margin: sidemarkMargin),
            .text: .text(),
            .image: .image(),
        ]
    }

    public static func highlight(defaultTint: UIColor, padding: UIEdgeInsets, cornerRadius: Int, alpha: Double) -> HTMLDecorationTemplate {
        let className = makeUniqueClassName(key: "highlight")
        return HTMLDecorationTemplate(
            layout: .boxes,
            element: { decoration in
                let config = decoration.style.config as! Decoration.Style.HighlightConfig
                let tint = config.tint ?? defaultTint
                return "<div data-activable=\"1\" class=\"\(className)\" style=\"background-color: \(tint.cssValue(includingAlpha: false))\"/>"
            },
            stylesheet:
            """
            .\(className) {
                margin-left: \(-padding.left)px;
                padding-right: \(padding.left + padding.right)px;
                margin-top: \(-padding.top)px;
                padding-bottom: \(padding.top + padding.bottom)px;
                border-radius: \(cornerRadius)px;
                opacity: \(alpha);
            }
            """
        )
    }

    public static func underline(defaultTint: UIColor, anchor: UnderlineAnchor, lineWeight: Int, cornerRadius: Int) -> HTMLDecorationTemplate {
        let className = makeUniqueClassName(key: "underline")
        switch anchor {
        case .baseline:
            return HTMLDecorationTemplate(
                layout: .boxes,
                element: { decoration in
                    let config = decoration.style.config as! Decoration.Style.HighlightConfig
                    let tint = config.tint ?? defaultTint
                    return "<div><span class=\"\(className)\" style=\"background-color: \(tint.cssValue(includingAlpha: false))\"/></div>"
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
        case .box:
            return HTMLDecorationTemplate(
                layout: .boxes,
                element: { decoration in
                    let config = decoration.style.config as! Decoration.Style.HighlightConfig
                    let tint = config.tint ?? defaultTint
                    return "<div class=\"\(className)\" style=\"--tint: \(tint.cssValue(includingAlpha: false))\"/>"
                },
                stylesheet:
                """
                .\(className) {
                    box-sizing: border-box;
                    border-radius: \(cornerRadius)px;
                    border-bottom: \(lineWeight)px solid var(--tint);
                }
                """
            )
        }
    }

    public static func strikethrough(defaultTint: UIColor, lineWeight: Int, cornerRadius: Int) -> HTMLDecorationTemplate {
        let className = makeUniqueClassName(key: "strikethrough")
        return HTMLDecorationTemplate(
            layout: .boxes,
            element: { decoration in
                let config = decoration.style.config as! Decoration.Style.HighlightConfig
                let tint = config.tint ?? defaultTint
                return "<div><span class=\"\(className)\" style=\"--tint: \(tint.cssValue(includingAlpha: false))\"/></div>"
            },
            stylesheet:
            """
            .\(className) {
                display: inline-block;
                width: 100%;
                height: 20%;
                border-radius: \(cornerRadius)px;
                border-top: \(lineWeight)px solid var(--tint);
            }
            """
        )
    }

    public static func sidemark(defaultTint: UIColor, lineWeight: Int, cornerRadius: Int, margin: Int) -> HTMLDecorationTemplate {
        let className = makeUniqueClassName(key: "sidemark")
        return HTMLDecorationTemplate(
            layout: .bounds,
            width: .page,
            element: { decoration in
                let config = decoration.style.config as! Decoration.Style.HighlightConfig
                let tint = config.tint ?? defaultTint
                return "<div><div class=\"\(className)\" style=\"background-color: \(tint.cssValue(includingAlpha: false))\"/></div>"
            },
            stylesheet:
            """
            .\(className) {
                float: left;
                width: \(lineWeight)px;
                height: 100%;
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

    public static func text() -> HTMLDecorationTemplate {
        let className = makeUniqueClassName(key: "text")
        return HTMLDecorationTemplate(
            layout: .bounds,
            width: .page,
            element: { decoration in
                let config = decoration.style.config as! Decoration.Style.TextConfig
                return "<div><span class=\"\(className)\">\(config.text ?? "")</span></div>"
            },
            stylesheet:
            """
            .\(className) {
                font-weight: bold;
            }
            """
        )
    }

    public static func image() -> HTMLDecorationTemplate {
        let className = makeUniqueClassName(key: "image")
        return HTMLDecorationTemplate(
            layout: .bounds,
            width: .page,
            element: { decoration in
                let config = decoration.style.config as! Decoration.Style.ImageConfig
                let src: String? = {
                    guard let source = config.source else {
                        return nil
                    }
                    switch source {
                    case .url(let url):
                        return Entities.escape(url.absoluteString, .utf8)
                    case .bitmap(let bitmap):
                        guard let data = bitmap.pngData() else {
                            return nil
                        }
                        let b64 = data.base64EncodedString()
                        return "data:image/png;base64,\(b64)"
                    }
                }()
                return "<div><img class=\"\(className)\" src=\"\(src ?? "")\"/></div>"
            },
            stylesheet:
            """
            .\(className) {
                opacity: 0.5;
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

private extension UIColor {
    func cssValue(includingAlpha: Bool) -> String {
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var alpha: CGFloat = 0
        guard getRed(&r, green: &g, blue: &b, alpha: &alpha) else {
            return "black"
        }
        let red = Int(r * 255)
        let green = Int(g * 255)
        let blue = Int(b * 255)
        if includingAlpha {
            return "rgba(\(red), \(green), \(blue), \(alpha))"
        } else {
            return "rgb(\(red), \(green), \(blue))"
        }
    }
}