//
//  NavigatorViewController.swift
//  r2-navigator-swift
//
//  Created by Winnie Quinn, Alexandre Camilleri on 8/23/17.
//
//  Copyright 2018 Readium Foundation. All rights reserved.
//  Use of this source code is governed by a BSD-style license which is detailed
//  in the LICENSE file present in the project repository where this source code is maintained.
//

import UIKit
import R2Shared
import WebKit
import SafariServices

public protocol NavigatorDelegate: class {
    func middleTapHandler()
    func willExitPublication(documentIndex: Int, progression: Double?)
    /// invoked when publication's content change to another page of 'document', slide to next chapter for example
    /// It changes when html file resource changed
    func didChangedDocumentPage(currentDocumentIndex: Int)
    func didChangedPaginatedDocumentPage(currentPage: Int, documentTotalPage: Int)
    func didNavigateViaInternalLinkTap(to documentIndex: Int)
    func didTapExternalUrl(_ : URL)
}

public extension NavigatorDelegate {
  func didChangedDocumentPage(currentDocumentIndex: Int) {
    // optional
  }
  
  func didChangedPaginatedDocumentPage(currentPage: Int, documentTotalPage: Int) {
    // optional
  }
  func didNavigateViaInternalLinkTap(to documentIndex: Int) {
    // optional
  }

  func didTapExternalUrl(_ url: URL) {
    // optional
    // TODO following lines have been moved from the original implementation and might need to be revisited at some point
    let view = SFSafariViewController(url: url)

    UIApplication.shared.keyWindow?.rootViewController?.present(view,
                                                                animated: true,
                                                                completion: nil)
  }
}

open class NavigatorViewController: UIViewController {
    private let delegatee: Delegatee!
    fileprivate let triptychView: TriptychView
    public var userSettings: UserSettings
    fileprivate var initialProgression: Double?
    //
    public let publication: Publication
    public weak var delegate: NavigatorDelegate?

    public let pageTransition: PageTransition
    public let editingActions: [EditingAction]
    public let disableDragAndDrop: Bool

    /// - Parameters:
    ///   - publication: The publication.
    ///   - initialIndex: Inital index of -1 will open the publication's at the end.
    public init(for publication: Publication, initialIndex: Int, initialProgression: Double?, pageTransition: PageTransition = .none, disableDragAndDrop: Bool = false, editingActions: [EditingAction] = []) {
        self.publication = publication
        self.initialProgression = initialProgression
        self.pageTransition = pageTransition
        self.disableDragAndDrop = disableDragAndDrop
        self.editingActions = editingActions

        userSettings = UserSettings()
        publication.userProperties.properties = userSettings.userProperties.properties
        delegatee = Delegatee()
        var index = initialIndex

        if initialIndex == -1 {
            index = publication.spine.count
        }
        triptychView = TriptychView(frame: CGRect.zero,
                                    viewCount: publication.spine.count,
                                    initialIndex: index,
                                    pageDirection:publication.metadata.direction)
        
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    open override func viewDidLoad() {
        super.viewDidLoad()
        delegatee.parent = self
        view.backgroundColor = .clear
        triptychView.backgroundColor = .clear
        triptychView.delegate = delegatee
        triptychView.frame = view.bounds
        triptychView.autoresizingMask = [.flexibleHeight, .flexibleWidth]
        view.addSubview(triptychView)
    }
    
    public var currentPosition:(Int, Double) {
        get {
            let progression = triptychView.getCurrentDocumentProgression()
            let index = triptychView.getCurrentDocumentIndex()
            return (index, progression ?? 0)
        }
    }

    open override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        // Save the currently opened document index and progression.
        if navigationController == nil {
            let progression = triptychView.getCurrentDocumentProgression()
            let index = triptychView.getCurrentDocumentIndex()

            delegate?.willExitPublication(documentIndex: index, progression: progression)
        }
    }
}

extension NavigatorViewController {

    /// Display the spine item at `index`.
    ///
    /// - Parameter index: The index of the spine item to display.
    public func displaySpineItem(at index: Int) {
        guard publication.spine.indices.contains(index) else {
            return
        }
        performTriptychViewTransition {
            self.triptychView.moveTo(index: index)
        }
    }
    
    /// Display the spine item at `index` with scroll `progression`
    ///
    /// - Parameter index: The index of the spine item to display.
    public func displaySpineItem(at index: Int, progression: Double) {
        guard publication.spine.indices.contains(index) else {
            return
        }
        
        performTriptychViewTransitionDelayed {
            // This is so the webview will move to it's correct progression if it's not loaded into the triptych view
            self.initialProgression = progression
            self.triptychView.moveTo(index: index)
            if let webView = self.triptychView.currentView as? WebView {
                // This is needed for when the webView is loaded into the triptychView
                webView.scrollAt(position: progression)
            }
        }
    }
    
    /// Load resource with the corresponding href.
    ///
    /// - Parameter href: The href of the resource to load. Can contain a tag id.
    /// - Returns: The spine index for the link
    public func displaySpineItem(with href: String) -> Int? {
        // remove id if any
        let components = href.components(separatedBy: "#")
        guard let href = components.first else {
            return nil
        }
        guard let index = publication.spine.index(where: { $0.href?.contains(href) ?? false }) else {
            return nil
        }
        // If any id found, set the scroll position to it, else to the
        // beggining of the document.
        let id = (components.count > 1 ? components.last : "")

        // Jumping set to true to avoid clamping.
        performTriptychViewTransition {
            self.triptychView.moveTo(index: index, id: id)
        }
        return index
    }

    public func getSpine() -> [Link] {
        return publication.spine
    }

    public func getTableOfContents() -> [Link] {
        return publication.tableOfContents
    }

    public func updateUserSettingStyle() {
        guard let views = triptychView.views?.array else {
            return
        }
        for view in views {
            let webview = view as? WebView

            webview?.applyUserSettingsStyle()
        }
    }
}

extension NavigatorViewController: ViewDelegate {
    
    func willAnimatePageChange() {
        triptychView.isUserInteractionEnabled = false
    }
    
    func didEndPageAnimation() {
        triptychView.isUserInteractionEnabled = true
    }
    
    func handleTapOnLink(with url: URL) {
        delegate?.didTapExternalUrl(url)
    }
    
    func handleTapOnInternalLink(with href: String) {
        guard let index = displaySpineItem(with: href) else { return }
        delegate?.didNavigateViaInternalLinkTap(to: index)
    }
    
    func documentPageDidChanged(webview: WebView, currentPage: Int, totalPage: Int) {
        if triptychView.currentView == webview {
            delegate?.didChangedPaginatedDocumentPage(currentPage: currentPage, documentTotalPage: totalPage)
        }
    }
    
    /// Display next spine item (spine item).
    public func displayRightDocument() {
        let delta = triptychView.direction == .rtl ? -1:1
        self.displaySpineItem(at: self.triptychView.index + delta)
    }

    /// Display previous document (spine item).
    public func displayLeftDocument() {
        let delta = triptychView.direction == .rtl ? -1:1
        self.displaySpineItem(at: self.triptychView.index - delta)
    }

    /// Returns the currently presented Publication's identifier.
    ///
    /// - Returns: The publication identifier.
    public func publicationIdentifier() -> String? {
        return publication.metadata.identifier
    }

    public func publicationBaseUrl() -> URL? {
        return publication.baseUrl
    }

    internal func handleCenterTap() {
        delegate?.middleTapHandler()
    }

}

/// Used to hide conformance to package-private delegate protocols.
private final class Delegatee: NSObject {
    weak var parent: NavigatorViewController!
    fileprivate var firstView = true
}

extension Delegatee: TriptychViewDelegate {

    public func triptychView(_ view: TriptychView, viewForIndex index: Int,
                             location: BinaryLocation) -> UIView {
        
        let webView = WebView(frame: view.bounds, initialLocation: location, pageTransition: parent.pageTransition, disableDragAndDrop: parent.disableDragAndDrop, editingActions: parent.editingActions)
        webView.direction = view.direction
        
        let link = parent.publication.spine[index]

        if let url = parent.publication.uriTo(link: link) {
            let urlRequest = URLRequest(url: url)

            webView.viewDelegate = parent
            webView.load(urlRequest)
            webView.userSettings = parent.userSettings

            // Load last saved regionIndex for the first view.
            if parent.initialProgression != nil {
                webView.progression = parent.initialProgression
                parent.initialProgression = nil
            }
            // Check if link is FXL.
            if (parent.publication.metadata.rendition.layout == .fixed
                && link.properties.layout == nil)
                || link.properties.layout == "fixed"{
                webView.scrollView.isPagingEnabled = false
                webView.scrollView.minimumZoomScale = 1
                webView.scrollView.maximumZoomScale = 5
                webView.presentingFixedLayoutContent = true
            }
        }
        return webView
    }
    
    func viewsDidUpdate(documentIndex: Int) {
        // notice that you should set the delegate before you load views
        // otherwise, when open the publication, you may miss the first invocation
        parent.delegate?.didChangedDocumentPage(currentDocumentIndex: documentIndex)
        if let currentView = parent.triptychView.currentView {
            let cw = currentView as! WebView
            if let pages = cw.totalPages {
                parent.delegate?.didChangedPaginatedDocumentPage(currentPage: cw.currentPage(), documentTotalPage: pages)
            }
        }
    }
}


extension NavigatorViewController {
    
    public var contentView: UIView {
        return triptychView
    }
    
    func performTriptychViewTransition(commitTransition: @escaping () -> ()) {
        switch pageTransition {
        case .none:
            commitTransition()
        case .animated:
            fadeTriptychView(alpha: 0) {
                commitTransition()
                self.fadeTriptychView(alpha: 1, completion: { })
            }
        }
    }
    
    /*
     This is used when we want to jump to a document with proression. The rendering is sometimes very slow in this case so we have a generous delay before we show the view again.
     */
    func performTriptychViewTransitionDelayed(commitTransition: @escaping () -> ()) {
        switch pageTransition {
        case .none:
            commitTransition()
        case .animated:
            fadeTriptychView(alpha: 0) {
                commitTransition()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: {
                    self.fadeTriptychView(alpha: 1, completion: { })
                })
            }
        }
    }
    
    private func fadeTriptychView(alpha: CGFloat, completion: @escaping () -> ()) {
        UIView.animate(withDuration: 0.15, animations: {
            self.triptychView.alpha = alpha
        }) { _ in
            completion()
        }
    }
}

