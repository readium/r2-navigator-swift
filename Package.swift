// swift-tools-version:5.3
//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import PackageDescription

let package = Package(
    name: "R2Navigator",
    defaultLocalization: "en",
    platforms: [.iOS(.v10)],
    products: [
        .library(
            name: "R2Navigator",
            targets: ["R2Navigator"]),
    ],
    dependencies: [
        .package(url: "https://github.com/scinfu/SwiftSoup.git", .exact("2.3.2")),
        .package(name: "R2Shared", url: "https://github.com/readium/r2-shared-swift.git", .branch("develop")),
    ],
    targets: [
        .target(
            name: "R2Navigator",
            dependencies: ["SwiftSoup", "R2Shared"],
            path: "./r2-navigator-swift/",
            exclude: ["Info.plist"],
            resources: [
                .copy("EPUB/Assets")
            ]
        ),
        .testTarget(
            name: "r2-navigator-swiftTests",
            dependencies: ["R2Navigator"],
            path: "./r2-navigator-swiftTests/",
            exclude: ["Info.plist"]
        )
    ]
)
