//
//  Copyright 2021 Readium Foundation. All rights reserved.
//  Use of this source code is governed by the BSD-style license
//  available in the top-level LICENSE file of the project.
//

import Foundation

public enum MediaPlaybackState {
    case paused
    case loading
    case playing
}

public struct MediaPlaybackInfo {
    
    /// Index of the current resource in the `readingOrder`.
    public let resourceIndex: Int
    
    /// Index in the reading order of the current resource being played.
    /// Link of the current resource being played.
    /// Returns whether the resource is currently playing or not.
    public let state: MediaPlaybackState
    
    /// Current playback position in seconds.
    public let time: Double
    
    /// Duration in seconds of the resource currently being played, if known.
    public let duration: Double?

    public var progress: Double {
        guard let duration = duration else {
            return 0
        }
        return time / duration
    }

}

public protocol MediaNavigator: Navigator {
    
    /// Current playback position in seconds.
    var currentTime: Double { get }
    
    /// Total duration in the publication, if known.
    var totalDuration: Double? { get }
    
    /// Volume of playback, from 0.0 to 1.0.
    var volume: Double { get set }
    
    /// Speed of playback.
    /// Default is 1.0
    var rate: Double { get set }

    /// Returns whether the resource is currently playing or not.
    var state: MediaPlaybackState { get }

    /// Resumes or start the playback.
    func play()
    
    /// Pauses the playback.
    func pause()
    
    /// Seeks to the given time in the current resource.
    func seek(to time: Double)
    
    /// Seeks relatively from the current time in the current resource.
    func seek(relatively delta: Double)
    
}

public extension MediaNavigator {
    
    /// Toggles the playback.
    func togglePlayback() {
        switch state {
        case .loading, .playing:
            pause()
        case .paused:
            play()
        }
    }
    
}

public protocol MediaNavigatorDelegate: NavigatorDelegate {
    
    /// Called when the playback changes.
    func navigator(_ navigator: MediaNavigator, playbackDidChange info: MediaPlaybackInfo)
    
    /// Called when the navigator finished playing the current resource.
    /// Returns whether the next resource should played, default is true.
    func navigator(_ navigator: MediaNavigator, shouldPlayNextResource info: MediaPlaybackInfo) -> Bool
    
    /// Called when the ranges of buffered media data change. They may be discontinuous.
    func navigator(_ navigator: MediaNavigator, loadedTimeRangesDidChange ranges: [Range<Double>])

}

public extension MediaNavigatorDelegate {
    
    func navigator(_ navigator: MediaNavigator, playbackDidChange info: MediaPlaybackInfo) {
    }
    
    func navigator(_ navigator: MediaNavigator, shouldPlayNextResource info: MediaPlaybackInfo) -> Bool {
        return true
    }
    
    func navigator(_ navigator: MediaNavigator, loadedTimeRangesDidChange ranges: [Range<Double>]) {
    }

}
