/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.associations", function(exports) {
    var thumbnails = require("com.subnodal.cloud.thumbnails");

    exports.Association = class {
        constructor(extension, openUrl, thumbnailUrl = thumbnails.THUMBNAIL_DEFAULT_URL) {
            this.extension = extension;
            this.openUrl = openUrl;
            this.thumbnailUrl = thumbnailUrl;
        }

        matchesFilename(filename) {
            return filename.endsWith("." + this.extension);
        }
    };

    // TODO: Add actual `openUrl`s for these apps once they've been created
    exports.list = [
        new exports.Association("writer", "https://subnodal.com", "/media/thumbnails/writer.svg"),
        new exports.Association("sigma", "https://subnodal.com", "/media/thumbnails/sigma.svg"),
        new exports.Association("presenter", "https://subnodal.com", "/media/thumbnails/presenter.svg")
    ];

    exports.findAssociationForFilename = function(filename) {
        for (var i = 0; i < exports.list.length; i++) {
            if (exports.list[i].matchesFilename(filename)) {
                return exports.list[i];
            }
        }

        return null;
    };
});