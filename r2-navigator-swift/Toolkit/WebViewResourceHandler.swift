//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import Foundation
import R2Shared
import WebKit

@available(iOS 11.0, *)
final class WebViewResourceHandler: NSObject, WKURLSchemeHandler, Loggable {

    enum HandlerError: Error {
        case noURLProvided
        case unsupportedScheme(String?)
        case taskNotStarted(WKURLSchemeTask)
    }

    private let scheme: String
    private let publication: Publication
    private var tasks: [ObjectIdentifier: Task] = [:]

    init(scheme: String, publication: Publication) {
        self.scheme = scheme
        self.publication = publication
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(HandlerError.noURLProvided)
            return
        }
        guard url.scheme == scheme else {
            urlSchemeTask.didFailWithError(HandlerError.unsupportedScheme(url.scheme))
            return
        }

        let href = url.absoluteString.removingPrefix(scheme + "://")
        let resource = publication.get(href)
        let task = Task(url: url, task: urlSchemeTask, resource: resource)
        tasks[ObjectIdentifier(urlSchemeTask)] = task
        task.start()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        guard let task = tasks[ObjectIdentifier(urlSchemeTask)] else {
            urlSchemeTask.didFailWithError(HandlerError.taskNotStarted(urlSchemeTask))
            return
        }

        task.cancel()
    }

    private final class Task {
        private let url: URL
        private let task: WKURLSchemeTask
        private let resource: Resource
        private var isCancelled = false
        private let isCancelledQueue = DispatchQueue(label: "org.readium.r2-navigator-swift.WebViewResourceHandler.Task")

        init(url: URL, task: WKURLSchemeTask, resource: Resource) {
            self.url = url
            self.task = task
            self.resource = resource
        }

        func start() {
            DispatchQueue.global(qos: .userInitiated).async {
                let href = self.resource.link.href
                do {
                    log(.info, "Will serve \(href), headers: \(self.task.request.allHTTPHeaderFields ?? [:])")
                    let length = try self.resource.length.get()
                    let response = URLResponse(
                        url: self.url,
                        mimeType: self.resource.link.type,
                        expectedContentLength: Int(length),
                        textEncodingName: nil
                    )
                    self.ifNotCancelled {
                        self.task.didReceive(response)
                    }

                    var available = length
                    var offset: UInt64 = 0
                    var data: Data = Data()
                    repeat {
                        let upperBound = offset + min(available, 32 * 1024)
                        data = try self.resource.read(range: offset..<upperBound).get()

                        offset += UInt64(data.count)
                        available -= UInt64(data.count)

                        self.ifNotCancelled {
                            self.task.didReceive(data)
                        }
                    } while available > 0 && !self.isCancelled

                    self.ifNotCancelled {
                        self.task.didFinish()
                    }

                } catch {
                    log(.error, "Failed to serve \(href): \(error.localizedDescription)")
                    self.ifNotCancelled {
                        self.task.didFailWithError(error)
                    }
                }

                self.resource.close()
            }
        }

        func cancel() {
            ifNotCancelled {
                isCancelled = true
            }
        }

        func ifNotCancelled(callback: () -> Void) {
            isCancelledQueue.sync {
                if !isCancelled {
                    callback()
                }
            }
        }
    }

}
