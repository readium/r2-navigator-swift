//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import Foundation
import R2Shared

public struct Decoration: Hashable {
    public typealias Identifier = String

    /// The identifier for this decoration. It must be unique in its group.
    public var identifier: Identifier
    public var style: Style
    public var locator: Locator
    public var userInfo: [AnyHashable: AnyHashable]

    public init(identifier: Identifier, style: Style, locator: Locator, userInfo: [AnyHashable: AnyHashable] = [:]) {
        self.identifier = identifier
        self.style = style
        self.locator = locator
        self.userInfo = userInfo
    }

    public struct Style: RawRepresentable, ExpressibleByStringLiteral, Hashable {
        public static let highlight: Style = "highlight"
        public static let underline: Style = "underline"
        public static let strikethrough: Style = "strikethrough"

        public let rawValue: String

        public init(rawValue: String) {
            self.rawValue = rawValue
        }

        public init(stringLiteral value: StringLiteralType) {
            self.init(rawValue: value)
        }
    }

    public var json: [String: Any] {
        [
            "identifier": identifier,
            "style": style.rawValue,
            "locator": locator.json,
        ]
    }

    public var jsonString: String? {
        serializeJSONString(json)
    }
}

public protocol DecorableNavigator: VisualNavigator {
    func apply(decorations: [Decoration], in group: String)
}
