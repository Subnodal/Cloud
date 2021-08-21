/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.thumbnails", function(exports) {
    var associations = require("com.subnodal.cloud.associations");

    exports.THUMBNAIL_DEFAULT_URL = "/media/thumbnails/default.svg";
    exports.THUMBNAIL_EMPTY_FOLDER_URL = "/media/thumbnails/emptyFolder_{theme}.svg";
    exports.THUMBNAIL_FILLED_FOLDER_URL = "/media/thumbnails/filledFolder_{theme}.svg";

    exports.getThemeVariant = function() {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    };

    exports.formatUrl = function(url) {
        return url.replace(/{theme}/g, exports.getThemeVariant());
    };

    exports.getThumbnailForAssociation = function(association) {
        return exports.formatUrl(association?.thumbnailUrl || exports.THUMBNAIL_DEFAULT_URL);
    };

    exports.getThumbnailForItem = function(item) {
        if (item.type == "folder") {
            if (Object.keys(item.contents || {}).length > 0) {
                return exports.formatUrl(exports.THUMBNAIL_FILLED_FOLDER_URL);
            } else {
                return exports.formatUrl(exports.THUMBNAIL_EMPTY_FOLDER_URL);
            }
        } else {
            return exports.getThumbnailForAssociation(associations.findAssociationForFilename(item.name));
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