//
//  Created by Mickaël Menu on 20/07/2021.
//  Copyright © 2021 Readium. All rights reserved.
//

import UIKit

extension CGRect {
    init?(json: Any?) {
        guard let json = json as? [String: Any] else {
            return nil
        }
        self.init(
            x: json["left"] as? CGFloat ?? 0,
            y: json["top"] as? CGFloat ?? 0,
            width: json["width"] as? CGFloat ?? 0,
            height: json["height"] as? CGFloat ?? 0
        )
    }
}