//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import Foundation
import UIKit
import R2Shared

public struct Decoration: Hashable {
    public typealias Identifier = String

    /// The identifier for this decoration. It must be unique in its group.
    public var identifier: Identifier
    public var locator: Locator
    public var style: Style
    public var tint: UIColor?
    public var userInfo: [AnyHashable: AnyHashable]

    public init(identifier: Identifier, locator: Locator, style: Style, tint: UIColor? = nil, userInfo: [AnyHashable: AnyHashable] = [:]) {
        self.identifier = identifier
        self.style = style
        self.locator = locator
        self.tint = tint
        self.userInfo = userInfo
    }

    public struct Style: RawRepresentable, ExpressibleByStringLiteral, Hashable {
        public static let highlight: Style = "highlight"
        public static let underline: Style = "underline"
        public static let strikethrough: Style = "strikethrough"
        public static let sidemark: Style = "sidemark"

        public let rawValue: String

        public init(rawValue: String) {
            self.rawValue = rawValue
        }

        public init(stringLiteral value: StringLiteralType) {
            self.init(rawValue: value)
        }
    }

    public var json: [String: Any] {
        var tintJSON: [String: Any]?
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        if let tint = tint, tint.getRed(&r, green: &g, blue: &b, alpha: &a) {
            tintJSON = [
                "red": Int(r * 255),
                "green": Int(g * 255),
                "blue": Int(b * 255),
                "alpha": a,
            ]
        }

        return [
            "identifier": identifier,
            "locator": locator.json,
            "style": style.rawValue,
            "tint": tintJSON,
        ]
    }
}

public protocol DecorableNavigator: VisualNavigator {
    func apply(decorations: [Decoration], in group: String)
}
