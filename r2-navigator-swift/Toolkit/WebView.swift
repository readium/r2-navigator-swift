//
//  Copyright 2019 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import Foundation
import WebKit

/// A custom web view which:
///  - Forwards copy: menu action to an EditingActionsController.
final class WebView: WKWebView {
    
    private let editingActions: EditingActionsController

    init(editingActions: EditingActionsController) {
        self.editingActions = editingActions

        let config = WKWebViewConfiguration()

        // This is equivalent to a private browsing session. We need this to prevent caching publication resources,
        // which could pose a security threat for protected content.
        config.websiteDataStore = .nonPersistent()

        super.init(frame: .zero, configuration: config)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    func dismissUserSelection() {
        evaluateJavaScript("window.getSelection().removeAllRanges()")
        // Before iOS 12, we also need to disable user interaction to get rid of the selection overlays.
        isUserInteractionEnabled = false
        isUserInteractionEnabled = true
    }

    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        return super.canPerformAction(action, withSender: sender)
            && editingActions.canPerformAction(action)
    }
    
    override func copy(_ sender: Any?) {
        editingActions.copy()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        setupDragAndDrop()
    }

    private func setupDragAndDrop() {
        if !editingActions.canCopy {
            guard #available(iOS 11.0, *),
                let webScrollView = subviews.first(where: { $0 is UIScrollView }),
                let contentView = webScrollView.subviews.first(where: { $0.interactions.count > 1 }),
                let dragInteraction = contentView.interactions.first(where: { $0 is UIDragInteraction }) else
            {
                return
            }
            contentView.removeInteraction(dragInteraction)
        }
    }
    
}
