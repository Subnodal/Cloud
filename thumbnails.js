/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.thumbnails", function(exports) {
    var subElements = require("com.subnodal.subelements");

    exports.getThemeVariant = function() {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    };

    exports.formatUrl = function(url) {
        return url.replace(/{theme}/g, exports.getThemeVariant());
    };

    exports.getThumbnailForItem = function(item) {
        if (item.type == "folder") {
            if (Object.keys(item.contents || {}).length > 0) {
                return exports.formatUrl("/media/thumbnails/filledFolder_{theme}.svg");
            } else {
                return exports.formatUrl("/media/thumbnails/emptyFolder_{theme}.svg");
            }
        } else {
            // TODO: Determine thumbnail to use from file extension
            return exports.formatUrl("https://cdn.subnodal.com/lib/subui/media/account.svg"); // This is a placeholder for now
        }
    };

    exports.startThemeDetection = function(callback) {
        var lastState = false;

        setInterval(function() {
            var currentState = window.matchMedia("(prefers-color-scheme: dark)").matches;

            if (lastState != currentState) {
                lastState = currentState;

                callback();
            }
        });
    };
});