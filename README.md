[![BSD-3](https://img.shields.io/badge/License-BSD--3-brightgreen.svg)](https://opensource.org/licenses/BSD-3-Clause)
[![Carthage compatible](https://img.shields.io/badge/Carthage-compatible-4BC51D.svg?style=flat)](https://github.com/Carthage/Carthage)
# r2-navigator-swift

A Swift implementation of the R2 Navigator

[Changes and releases are documented in the Changelog](CHANGELOG.md)

## Adding the library to your iOS project

> _Note:_ requires Swift 4.2 (and Xcode 10.1).

### Carthage

[Carthage][] is a simple, decentralized dependency manager for Cocoa. To
install R2Navigator with Carthage:

 1. Make sure Carthage is [installed][Carthage Installation].

 2. Update your Cartfile to include the following:

    ```ruby
    github "readium/r2-navigator-swift" "develop"
    ```
    
 3. Run:
    * [`mkdir -p Carthage/Build/iOS`](https://github.com/Carthage/Carthage/issues/3122#issuecomment-784865551)
    * `carthage update --use-xcframeworks`

 4. [Add the appropriate framework][Carthage Usage].


[Carthage]: https://github.com/Carthage/Carthage
[Carthage Installation]: https://github.com/Carthage/Carthage#installing-carthage
[Carthage Usage]: https://github.com/Carthage/Carthage#adding-frameworks-to-an-application


##### Import

In your Swift files :

```Swift
// Swift source file

import R2Navigator
```

## Dependencies in this module

  - [R2Shared](https://github.com/readium/r2-shared-swift) : Contains the definitions of shared custom types used across the readium-2 Swift projects.
