// swift-tools-version:5.3
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "R2Navigator",
    defaultLocalization: "en",
    platforms: [.iOS(.v10), .macOS("10.11"), .tvOS(.v9)],
    products: [
        // Products define the executables and libraries a package produces, and make them visible to other packages.
        .library(
            name: "R2Navigator",
            targets: ["R2Navigator"]),
    ],
    dependencies: [
        .package(url: "https://github.com/scinfu/SwiftSoup.git", .exact("2.3.2")),
        .package(name: "R2Shared", path: "../r2-shared-swift")
    ],
    targets: [
        // Targets are the basic building blocks of a package. A target can define a module or a test suite.
        // Targets can depend on other targets in this package, and on products in packages this package depends on.
        .target(
            name: "R2Navigator",
            dependencies: ["SwiftSoup", "R2Shared"],
            path: "./r2-navigator-swift/",
            exclude: ["Info.plist"],
            resources: [
                .copy("EPUB/Resources")
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
