/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.thumbnails", function(exports) {
    var associations = require("com.subnodal.cloud.associations");
    var fs = require("com.subnodal.cloud.fs");

    exports.THUMBNAIL_DEFAULT_URL = "/media/thumbnails/default.svg";
    exports.THUMBNAIL_EMPTY_FOLDER_URL = "/media/thumbnails/emptyFolder_{theme}.svg";
    exports.THUMBNAIL_FILLED_FOLDER_URL = "/media/thumbnails/filledFolder_{theme}.svg";
    exports.THUMBNAIL_GENERIC_IMAGE = "/media/thumbnails/photo.svg";

    exports.IMAGE_THUMBNAIL_SIZE_LIMIT = 4 * Math.pow(1_024, 2); // 4 MiB

    exports.THUMBNAIL_IMAGE_MIME_TYPES = {
        "png": "image/png",
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "svg": "image/svg+xml",
        "gif": "image/gif"
    };

    exports.imageThumbnailsCache = {};
    exports.invalidImageThumbnailKeys = [];

    exports.cacheImageThumbnail = function(key, thumbnailUrl) {
        exports.imageThumbnailsCache[key] = thumbnailUrl;
    };

    exports.findImageThumbnailMimeType = function(name) {
        var foundExtension = Object.keys(exports.THUMBNAIL_IMAGE_MIME_TYPES).find((extension) => name.endsWith("." + extension));

        if (!foundExtension) {
            return null;
        }

        return exports.THUMBNAIL_IMAGE_MIME_TYPES[foundExtension];
    };

    exports.getImageThumbnailFromCache = function(key) {
        if (exports.imageThumbnailsCache.hasOwnProperty(key)) {
            return Promise.resolve(exports.imageThumbnailsCache[key]);
        }
    };

    exports.markImageThumbnailAsInvalid = function(key) {
        if (exports.invalidImageThumbnailKeys.includes(key)) {
            return;
        }

        exports.invalidImageThumbnailKeys.push(key);
    };

    exports.getImageThumbnail = function(key, allowFromCache = true) {
        var cachedThumbnail = exports.getImageThumbnailFromCache(key);

        if (allowFromCache && cachedThumbnail != null) {
            return Promise.resolve(cachedThumbnail);
        }

        if (!navigator.onLine) {
            return Promise.resolve(null);
        }

        var operation = fs.FileDownloadOperation.createSpecificOperation(key);

        return operation.start().then(function() {
            var mimeType = exports.findImageThumbnailMimeType(operation.name);

            if (mimeType == null) {
                return Promise.reject("File is not an image");
            }

            var url = URL.createObjectURL(new Blob([operation.fileData], {type: mimeType}));
            var invalidImageThumbnailPosition = exports.invalidImageThumbnailKeys.indexOf(key);

            if (invalidImageThumbnailPosition > -1) {
                exports.invalidImageThumbnailKeys.splice(invalidImageThumbnailPosition, 1);
            }

            exports.cacheImageThumbnail(key, url);

            return Promise.resolve(url);
        }).catch(function() {
            return Promise.resolve(null);
        });
    };

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
        } else if (exports.imageThumbnailsCache.hasOwnProperty(item.key) && !exports.invalidImageThumbnailKeys.includes(item.key)) {
            return exports.imageThumbnailsCache[item.key];
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