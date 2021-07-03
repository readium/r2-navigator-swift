//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import Foundation
import UIKit
import R2Shared

public protocol DecorableNavigator: VisualNavigator {
    var supportedDecorationStyles: Set<Decoration.Style.Id> { get }

    func apply(decorations: [Decoration], in group: String)
}

public struct Decoration: Hashable {
    public typealias Id = String

    /// The identifier for this decoration. It must be unique in its group.
    public var id: Id
    public var locator: Locator
    public var style: Style
    public var userInfo: [AnyHashable: AnyHashable]

    public init(id: Id, locator: Locator, style: Style, userInfo: [AnyHashable: AnyHashable] = [:]) {
        self.id = id
        self.style = style
        self.locator = locator
        self.userInfo = userInfo
    }

    public enum State {
        case active
    }

    public struct Style: Hashable {
        public struct Id: RawRepresentable, ExpressibleByStringLiteral, Hashable {
            public static let highlight: Id = "highlight"
            public static let underline: Id = "underline"
            public static let strikethrough: Id = "strikethrough"
            public static let sidemark: Id = "sidemark"
            public static let text: Id = "text"
            public static let image: Id = "image"

            public let rawValue: String
            public init(rawValue: String) {
                self.rawValue = rawValue
            }
            public init(stringLiteral value: StringLiteralType) {
                self.init(rawValue: value)
            }
        }

        public static func highlight(tint: UIColor? = nil) -> Style {
            .init(id: .highlight, config: HighlightConfig(tint: tint))
        }

        public static func text(_ text: String? = nil) -> Style {
            .init(id: .text, config: TextConfig(text: text))
        }

        public static func image(url: URL) -> Style {
            .init(id: .image, config: ImageConfig(source: .url(url)))
        }

        public static func image(_ image: UIImage?) -> Style {
            .init(id: .image, config: ImageConfig(source: image.map { .bitmap($0) }))
        }

        public struct HighlightConfig: Hashable {
            public var tint: UIColor?
            public init(tint: UIColor? = nil) {
                self.tint = tint
            }
        }

        public struct TextConfig: Hashable {
            public var text: String?
            public init(text: String?) {
                self.text = text
            }
        }

        public struct ImageConfig: Hashable {
            public enum Source: Hashable {
                case url(URL)
                case bitmap(UIImage)
            }
            public var source: Source?
            public init(source: Source?) {
                self.source = source
            }
        }

        let id: Id
        let config: AnyHashable?

        public init(id: Id, config: AnyHashable? = nil) {
            self.id = id
            self.config = config
        }
    }

    public var json: [String: Any] {
        [
            "id": id,
            "locator": locator.json,
            "style": style.id.rawValue,
        ]
    }
}
