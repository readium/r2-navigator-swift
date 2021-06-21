(function() {
    const debug = false;

    // Exports
    readium.createHighlight = createHighlight;
    readium.destroyAllHighlights = destroyAllHighlights;
    readium.rectForHighlightWithID = rectForHighlightWithID;

    const ID_HIGHLIGHTS_CONTAINER = "R2_ID_HIGHLIGHTS_CONTAINER";
    const CLASS_HIGHLIGHT_CONTAINER = "R2_CLASS_HIGHLIGHT_CONTAINER";
    const CLASS_HIGHLIGHT_AREA = "R2_CLASS_HIGHLIGHT_AREA";
    const CLASS_HIGHLIGHT_BOUNDING_AREA = "R2_CLASS_HIGHLIGHT_BOUNDING_AREA";

    const _highlights = [];
    let _highlightsContainer;

    const defaultBackgroundOpacity = 0.3;

    const defaultBackgroundColor = {
        blue: 100,
        green: 50,
        red: 230,
    };

    function rectForHighlightWithID(id) {
        const clientRects = frameForHighlightWithID(id);

        return {
            screenWidth: window.outerWidth,
            screenHeight: window.outerHeight,
            left: clientRects[0].left,
            width: clientRects[0].width,
            top: clientRects[0].top,
            height: clientRects[0].height
        };
    }

    function destroyAllHighlights() {
        hideAllHighlights();
        _highlights.splice(0, _highlights.length);
    }

    function hideAllHighlights() {
        if (_highlightsContainer) {
            _highlightsContainer.remove();
            _highlightsContainer = null;
        }
    }

    function createHighlight(selectionInfo, color, pointerInteraction) {
        return _createHighlight(selectionInfo, color, pointerInteraction, ID_HIGHLIGHTS_CONTAINER)
    }

    function _createHighlight(locations, color, pointerInteraction, type) {
        const rangeInfo = readium._location2RangeInfo(locations)

        // FIXME: Use user-provided ID.
        let id = Date.now();
        if (type === ID_HIGHLIGHTS_CONTAINER) {
            id = "R2_HIGHLIGHT_" + id;
        } else {
            id = "R2_ANNOTATION_" + id;
        }

        destroyHighlight(id);

        const highlight = {
            color: color ? color : defaultBackgroundColor,
            id,
            pointerInteraction,
            rangeInfo
        };
        _highlights.push(highlight);
        createHighlightDom(window, highlight);

        return highlight;
    }

    function destroyHighlight(id) {
        let i = -1;
        let _document = window.document
        const highlight = _highlights.find((h, j) => {
            i = j;
            return h.id === id;
        });
        if (highlight && i >= 0 && i < _highlights.length) {
            _highlights.splice(i, 1);
        }
        const highlightContainer = _document.getElementById(id);
        if (highlightContainer) {
            highlightContainer.remove();
        }
    }

    function createHighlightDom(win, highlight) {

        const document = win.document;

        const scale = 1 / ((win.READIUM2 && win.READIUM2.isFixedLayout) ? win.READIUM2.fxlViewportScale : 1);

        const scrollElement = document.scrollingElement;

        const range = readium._convertRangeInfo(document, highlight.rangeInfo);
        if (!range) {
            return undefined;
        }

        const paginated = !isScrollModeEnabled()
        const highlightsContainer = ensureContainer(win);
        const highlightParent = document.createElement("div");

        highlightParent.setAttribute("id", highlight.id);
        highlightParent.setAttribute("class", CLASS_HIGHLIGHT_CONTAINER);

        highlightParent.style.setProperty("pointer-events", "none");
        if (highlight.pointerInteraction) {
            highlightParent.setAttribute("data-click", "1");
        }

        const bodyRect = document.body.getBoundingClientRect();
        const drawUnderline = false;
        const drawStrikeThrough = false;
        const doNotMergeHorizontallyAlignedRects = drawUnderline || drawStrikeThrough;
        const clientRects = readium._getClientRectsNoOverlap(range, doNotMergeHorizontallyAlignedRects);
        const roundedCorner = 3;
        const underlineThickness = 2;
        const strikeThroughLineThickness = 3;
        const opacity = defaultBackgroundOpacity;
        let extra = "";

        let xOffset;
        let yOffset;

        // if (navigator.userAgent.match(/Android/i)) {
        xOffset = paginated ? (-scrollElement.scrollLeft) : bodyRect.left;
        yOffset = paginated ? (-scrollElement.scrollTop) : bodyRect.top;
        // } else if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
        //     xOffset = paginated ? 0 : (-scrollElement.scrollLeft);
        //     yOffset = paginated ? 0 : (bodyRect.top);
        //     annotationOffset = parseInt((rangeAnnotationBoundingClientRect.right/window.innerWidth) + 1);
        // }

        for (const clientRect of clientRects) {
            const highlightArea = document.createElement("div");

            highlightArea.setAttribute("class", CLASS_HIGHLIGHT_AREA);

            if (debug) {
                const rgb = Math.round(0xffffff * Math.random());
                const r = rgb >> 16;
                const g = rgb >> 8 & 255;
                const b = rgb & 255;
                extra = `outline-color: rgb(${r}, ${g}, ${b}); outline-style: solid; outline-width: 1px; outline-offset: -1px;`;
            } else {
                if (drawUnderline) {
                    extra += `border-bottom: ${underlineThickness * scale}px solid rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important`;
                }
            }
            highlightArea.setAttribute("style", `border-radius: ${roundedCorner}px !important; background-color: rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important; ${extra}`);
            highlightArea.style.setProperty("pointer-events", "none");
            highlightArea.style.position = !paginated ? "fixed" : "absolute";
            highlightArea.scale = scale;
            /*
             highlightArea.rect = {
             height: clientRect.height,
             left: clientRect.left - xOffset,
             top: clientRect.top - yOffset,
             width: clientRect.width,
             };
             */
            highlightArea.rect = {
                height: clientRect.height,
                left: clientRect.left - xOffset,
                top: clientRect.top - yOffset,
                width: clientRect.width
            };

            highlightArea.style.width = `${highlightArea.rect.width * scale}px`;
            highlightArea.style.height = `${highlightArea.rect.height * scale}px`;
            highlightArea.style.left = `${highlightArea.rect.left * scale}px`;
            highlightArea.style.top = `${highlightArea.rect.top * scale}px`;
            highlightParent.append(highlightArea);
            if (!debug && drawStrikeThrough) {
                //if (drawStrikeThrough) {
                const highlightAreaLine = document.createElement("div");
                highlightAreaLine.setAttribute("class", CLASS_HIGHLIGHT_AREA);

                highlightAreaLine.setAttribute("style", `background-color: rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important;`);
                highlightAreaLine.style.setProperty("pointer-events", "none");
                highlightAreaLine.style.position = paginated ? "fixed" : "absolute";
                highlightAreaLine.scale = scale;
                /*
                 highlightAreaLine.rect = {
                 height: clientRect.height,
                 left: clientRect.left - xOffset,
                 top: clientRect.top - yOffset,
                 width: clientRect.width,
                 };
                 */

                highlightAreaLine.rect = {
                    height: clientRect.height,
                    left: clientRect.left - xOffset,
                    top: clientRect.top - yOffset,
                    width: clientRect.width
                };

                highlightAreaLine.style.width = `${highlightAreaLine.rect.width * scale}px`;
                highlightAreaLine.style.height = `${strikeThroughLineThickness * scale}px`;
                highlightAreaLine.style.left = `${highlightAreaLine.rect.left * scale}px`;
                highlightAreaLine.style.top = `${(highlightAreaLine.rect.top + (highlightAreaLine.rect.height / 2) - (strikeThroughLineThickness / 2)) * scale}px`;
                highlightParent.append(highlightAreaLine);
            }
        }

        const highlightBounding = document.createElement("div");
        highlightBounding.setAttribute("class", CLASS_HIGHLIGHT_BOUNDING_AREA);

        highlightBounding.style.setProperty("pointer-events", "none");
        highlightBounding.style.position = paginated ? "fixed" : "absolute";
        highlightBounding.scale = scale;

        if (debug) {
            highlightBounding.setAttribute("style", `outline-color: magenta; outline-style: solid; outline-width: 1px; outline-offset: -1px;`);
        }

        const rangeBoundingClientRect = range.getBoundingClientRect();
        highlightBounding.rect = {
            height: rangeBoundingClientRect.height,
            left: rangeBoundingClientRect.left - xOffset,
            top: rangeBoundingClientRect.top - yOffset,
            width: rangeBoundingClientRect.width
        };

        highlightBounding.style.width = `${highlightBounding.rect.width * scale}px`;
        highlightBounding.style.height = `${highlightBounding.rect.height * scale}px`;
        highlightBounding.style.left = `${highlightBounding.rect.left * scale}px`;
        highlightBounding.style.top = `${highlightBounding.rect.top * scale}px`;

        highlightParent.append(highlightBounding);
        highlightsContainer.append(highlightParent);

        return highlightParent;
    }

    function isScrollModeEnabled() {
        return document.documentElement.style.getPropertyValue("--USER__scroll").toString().trim() === 'readium-scroll-on';
    }

    function ensureContainer(win) {
        const document = win.document;

        if (!_highlightsContainer) {
            _highlightsContainer = document.createElement("div");
            _highlightsContainer.setAttribute("id", ID_HIGHLIGHTS_CONTAINER);

            _highlightsContainer.style.setProperty("pointer-events", "none");
            document.body.append(_highlightsContainer);
        }

        return _highlightsContainer;
    }

    function frameForHighlightWithID(id) {
        const highlight = highlightWithID(id);
        if (!highlight)
            return;

        const document = window.document;
        const range = readium._convertRangeInfo(document, highlight.rangeInfo);
        if (!range) {
            return undefined;
        }


        const drawUnderline = false;
        const drawStrikeThrough = false;
        const doNotMergeHorizontallyAlignedRects = drawUnderline || drawStrikeThrough;
        return readium._getClientRectsNoOverlap(range, doNotMergeHorizontallyAlignedRects);
    }

    function highlightWithID(id) {
        let i = -1;
        return _highlights.find((h, j) => {
            i = j;
            return h.id === id;
        })
    }

})();