

// WARNING: iOS 9 requires ES5

var readium = (function() {
    // Catch JS errors to log them in the app.
    window.addEventListener("error", function(event) {
        webkit.messageHandlers.logError.postMessage({
            "message": event.message,
            "filename": event.filename,
            "line": event.lineno
        });
    }, false);
    
    // Notify native code that the page has loaded.
    window.addEventListener("load", function(){ // on page load
        window.addEventListener("orientationchange", function() {
            orientationChanged();
            snapCurrentPosition();
        });
        orientationChanged();
    }, false);

    var last_known_scrollX_position = 0;
    var last_known_scrollY_position = 0;
    var ticking = false;
    var maxScreenX = 0;

    // Position in range [0 - 1].
    function update(position) {
        var positionString = position.toString()
        webkit.messageHandlers.progressionChanged.postMessage(positionString);
    }

    function getFrameRect() {
      return {
         left: 0,
         right: window.innerWidth,
         top: 0,
         bottom: window.innerHeight
      };
    }

    function getCurrentPartialCfis() {
        return JSON.stringify(getFirstAndLastVisiblePartialCfis(getFrameRect()));
    }

    window.addEventListener('scroll', function(e) {
        last_known_scrollY_position = window.scrollY / document.scrollingElement.scrollHeight;
        // Using Math.abs because for RTL books, the value will be negative.
        last_known_scrollX_position = Math.abs(window.scrollX / document.scrollingElement.scrollWidth);
       
        // Window is hidden
        if (document.scrollingElement.scrollWidth === 0 || document.scrollingElement.scrollHeight === 0) {
            return;
        }
                            
        if (!ticking) {
            window.requestAnimationFrame(function() {
                update(isScrollModeEnabled() ? last_known_scrollY_position : last_known_scrollX_position);
                ticking = false;
            });
        }
        ticking = true;
    });

    document.addEventListener('selectionchange', debounce(50, function() {
        var info = {}
        var selection = document.getSelection();
        if (selection && selection.rangeCount > 0) {
            var rect = selection.getRangeAt(0).getBoundingClientRect();
            info['text'] = selection.toString().trim();
            info['frame'] = {
                'x': rect.left,
                'y': rect.top,
                'width': rect.width,
                'height': rect.height
            };
        }

        webkit.messageHandlers.selectionChanged.postMessage(info);
    }));

    function orientationChanged() {
        maxScreenX = (window.orientation === 0 || window.orientation == 180) ? screen.width : screen.height;
    }

    function isScrollModeEnabled() {
        return document.documentElement.style.getPropertyValue("--USER__scroll").toString().trim() == 'readium-scroll-on';
    }

    // Scroll to the given TagId in document and snap.
    function scrollToId(id) {
        var element = document.getElementById(id);
        if (!element) {
            return;
        }
        element.scrollIntoView();
        
        if (!isScrollModeEnabled()) {
            var currentOffset = window.scrollX;
            var pageWidth = window.innerWidth;
            // Adds half a page to make sure we don't snap to the previous page.
            document.scrollingElement.scrollLeft = snapOffset(currentOffset + (pageWidth / 2));
        }
    }

    // Position must be in the range [0 - 1], 0-100%.
    function scrollToPosition(position, dir) {
        console.log("ScrollToPosition");
        if ((position < 0) || (position > 1)) {
            console.log("InvalidPosition");
            return;
        }

        if (isScrollModeEnabled()) {
            var offset = document.scrollingElement.scrollHeight * position;
            document.scrollingElement.scrollTop = offset;
            // window.scrollTo(0, offset);
        } else {
            var documentWidth = document.scrollingElement.scrollWidth;
            var factor = (dir == 'rtl') ? -1 : 1;
            var offset = documentWidth * position * factor;
            document.scrollingElement.scrollLeft = snapOffset(offset);
        }
    }

    // Returns false if the page is already at the left-most scroll offset.
    function scrollLeft(dir) {
        var isRTL = (dir == "rtl");
        var documentWidth = document.scrollingElement.scrollWidth;
        var pageWidth = window.innerWidth;
        var offset = window.scrollX - pageWidth;
        var minOffset = isRTL ? -(documentWidth - pageWidth) : 0;
        return scrollToOffset(Math.max(offset, minOffset));
    }

    // Returns false if the page is already at the right-most scroll offset.
    function scrollRight(dir) {
        var isRTL = (dir == "rtl");
        var documentWidth = document.scrollingElement.scrollWidth;
        var pageWidth = window.innerWidth;
        var offset = window.scrollX + pageWidth;
        var maxOffset = isRTL ? 0 : (documentWidth - pageWidth);
        return scrollToOffset(Math.min(offset, maxOffset));
    }

    // Scrolls to the given left offset.
    // Returns false if the page scroll position is already close enough to the given offset.
    function scrollToOffset(offset) {
        var currentOffset = window.scrollX;
        var pageWidth = window.innerWidth;
        document.scrollingElement.scrollLeft = offset;
        // In some case the scrollX cannot reach the position respecting to innerWidth
        var diff = Math.abs(currentOffset - offset) / pageWidth;
        return (diff > 0.01);
    }

    // Snap the offset to the screen width (page width).
    function snapOffset(offset) {
        var value = offset + 1;

        return value - (value % maxScreenX);
    }

    function snapCurrentPosition() {
        if (isScrollModeEnabled()) {
            return;
        }
        var currentOffset = window.scrollX;
        var currentOffsetSnapped = snapOffset(currentOffset + 1);
        
        document.scrollingElement.scrollLeft = currentOffsetSnapped;
    }
                                                                         
    function scrollToPartialCfi(partialCfi) {
       console.log("ScrollToPartialCfi " + partialCfi);
       var epubCfi = new EpubCFI("epubcfi(/6/2!" + partialCfi + ")");
       var element = document.querySelector(epubCfi.generateHtmlQuery());
       if (element) {
         var textPosition = parseInt(EpubCFI.getCharacterOffsetComponent(partialCfi), 10);
         scrollToElement(element, textPosition);
       } else {
         console.log("Partial CFI element not found");
       }
    }
                                                                               
    function scrollToElement(element, textPosition) {
        console.log("ScrollToElement " + element.tagName + (textPosition ? (" (offset: " + textPosition + ")") : ""));
        var windowWidth = window.innerWidth;
        var elementScreenLeftOffset = element.getBoundingClientRect().left;

        if (window.scrollX % windowWidth === 0 && (elementScreenLeftOffset >= 0 && elementScreenLeftOffset <= windowWidth)) {
          return;
        }

        var page = getPageForElement(element, elementScreenLeftOffset, textPosition);
        document.scrollingElement.scrollLeft = page * windowWidth;
    }
                                                                               
    function getPageForElement(element, elementScreenLeftOffset, textOffset) {
       if (!textOffset) {
           return Math.ceil((window.scrollX + elementScreenLeftOffset) / window.innerWidth) - 1;
       }

       const position = textOffset / element.textContent.length;
       const rects = Array.from(element.getClientRects()).map(function (rect) {
           return {
               rect,
               offset: Math.floor(rect.left / window.innerWidth),
               surface: rect.width * rect.height
           }
       });
       const textTotalSurface = rects.reduce(function (total, current) { return total + current.surface; }, 0);

       const rectToDisplay = rects.map(function(rect, index) {
           if (index === 0) {
               rect.start = 0;
               rect.end = rect.surface / textTotalSurface;
           } else {
               rect.start = rects[index - 1].end;
               rect.end = rect.start + (rect.surface / textTotalSurface);
           }
           return rect;
       }).find(function (rect) {
           return position >= rect.start && position < rect.end;
       });

       return rectToDisplay ? rectToDisplay.offset : 0;
    }
               
    /// User Settings.

    // For setting user setting.
    function setProperty(key, value) {
        var root = document.documentElement;

        root.style.setProperty(key, value);
    }

    // For removing user setting.
    function removeProperty(key) {
        var root = document.documentElement;

        root.style.removeProperty(key);
    }


    /// Toolkit

    function debounce(delay, func) {
        var timeout;
        return function() {
            var self = this;
            var args = arguments;
            function callback() {
                func.apply(self, args);
                timeout = null;
            }
            clearTimeout(timeout);
            timeout = setTimeout(callback, delay);
        };
    }


    // Public API used by the navigator.

    return {
        'scrollToId': scrollToId,
        'scrollToPosition': scrollToPosition,
        'scrollLeft': scrollLeft,
        'scrollRight': scrollRight,
        'scrollToPartialCfi': scrollToPartialCfi,
        'setProperty': setProperty,
        'getCurrentPartialCfis': getCurrentPartialCfis,
        'removeProperty': removeProperty
    };

})();
