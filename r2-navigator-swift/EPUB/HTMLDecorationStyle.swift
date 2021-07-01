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
    public enum Fit: String {
        case wrap, bounds, viewport, page
    }

    let layout: Layout
    let width: Fit
    let element: String
    let stylesheet: String?
    let applyScript: String?

    public init(layout: Layout, width: Fit = .wrap, element: String = "<div/>", stylesheet: String? = nil, applyScript: String? = nil) {
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

    public static let highlight = HTMLDecorationStyle(
        layout: .lines,
        element: #"<div class="r2-highlight"/>"#,
        stylesheet:
        """
        .r2-highlight {
            border-radius: 3px;
            background-color: var(--r2-decoration-tint);
            opacity: 0.3;
        }
        .r2-highlight:hover {
            opacity: 0.6;
        }
        """
    )

    public static let underline = HTMLDecorationStyle(
        layout: .lines,
        element: #"<div><span class="r2-underline"/></div>"#,
        stylesheet:
        """
        .r2-underline {
            display: inline-block;
            width: 100%;
            height: 3px;
            background-color: var(--r2-decoration-tint);
            vertical-align: sub;
        }
        """
    )

    public static let strikethrough = HTMLDecorationStyle(
        layout: .lines,
        element: #"<div><span class="r2-strikethrough"/></div>"#,
        stylesheet:
        """
        .r2-strikethrough {
            display: inline-block;
            width: 100%;
            height: 20%;
            border-top: 3px solid var(--r2-decoration-tint);
        }
        """
    )

    public static let sidemark = HTMLDecorationStyle(
        layout: .bounds,
        element: #"<div class="r2-sidemark"/>"#,
        stylesheet:
        """
        .r2-sidemark {
            margin-left: -20px;
            border-left: 3px solid var(--r2-decoration-tint);
        }
        [dir=rtl] .r2-sidemark {
            margin-left: 20px;
            border-left: none;
            border-right: 3px solid var(--r2-decoration-tint);
        }
        """
    )
}
