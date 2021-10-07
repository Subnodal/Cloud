/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.associations", function(exports) {
    var l10n = require("com.subnodal.subelements.l10n");

    var resources = require("com.subnodal.cloud.resources");
    var profiles = require("com.subnodal.cloud.profiles");
    var thumbnails = require("com.subnodal.cloud.thumbnails");

    exports.Association = class {
        constructor(extension, openUrl, namingScheme, thumbnailUrl = thumbnails.THUMBNAIL_DEFAULT_URL, creatable = true) {
            this.extension = extension;
            this.openUrl = openUrl;
            this.thumbnailUrl = thumbnailUrl;
            this.creatable = creatable;

            this.l10nFallbackLocaleCode = namingScheme.fallbackLocaleCode;
            this.l10nAppName = namingScheme.appName;
            this.l10nAppNameShort = namingScheme.appNameShort;
            this.l10nDocumentTypeName = namingScheme.documentTypeName;
        }

        matchesFilename(filename) {
            return filename.endsWith("." + this.extension);
        }

        get appName() {
            return this.l10nAppName[l10n.getLocaleCode()] || this.l10nAppName[this.l10nFallbackLocaleCode];
        }

        get appNameShort() {
            return this.l10nAppNameShort[l10n.getLocaleCode()] || this.l10nAppNameShort[this.l10nFallbackLocaleCode] || this.appName;
        }

        get documentTypeName() {
            return this.l10nDocumentTypeName[l10n.getLocaleCode()] || this.l10nDocumentTypeName[this.l10nFallbackLocaleCode] || _("defaultDocumentTypeName", {app: this.appNameShort});
        }

        getOpenUrlForItem(item) {
            return this.openUrl.replace(/{objectKey}/g, item.key);
        }

        serialise() {
            return {
                extension: this.extension,
                openUrl: this.openUrl,
                namingScheme: this.namingScheme,
                thumbnailUrl: this.thumbnailUrl,
                creatable: this.creatable
            };
        }

        static deserialise(data) {
            return new this(data.extension, data.openUrl, data.namingScheme, data.thumbnailUrl, data.creatable);
        }
    };

    exports.defaultList = [];

    exports.getList = function() {
        return exports.list || [];
    };

    exports.loadList = function(token = profiles.getSelectedProfileToken()) {
        return (function() {
            if (!navigator.onLine || token == null) {
                var data = [];

                try {
                    data = JSON.parse(localStorage.getItem("subnodalCloud_associations"));
                } catch (e) {}

                return Promise.resolve(data);
            }

            return resources.getProfileInfo(token).then(function(data) {
                var associations = data.fsAssociations || [];

                return Promise.resolve(associations);
            });
        })().then(function(data) {
            exports.list = data.map((associationData) => exports.Association.deserialise(associationData));

            // Add default associations in a way that doesn't interfere with the user's own associations priority
            exports.defaultList
                .map((associationData) => exports.Association.deserialise(associationData))
                .forEach(function(association) {
                    var index = exports.list.findIndex((item) => item.extension == association.extension && item.openUrl == association.openUrl);

                    if (index >= 0) {
                        exports.list[index] = association;
                    } else {
                        exports.list.push(association);
                    }
                })
            ;

            exports.saveList(true);

            return Promise.resolve();
        });
    };

    exports.saveList = function(offlineOnly, token = profiles.getSelectedProfileToken()) {
        var data = exports.list.map((association) => association.serialise());

        localStorage.setItem("subnodalCloud_associations", JSON.stringify(exports.list.map((association) => association.serialise())));

        if (!offlineOnly && token != null && navigator.onLine) {
            resources.setProfileInfo("fsAssociations", data);
        }
    };

    exports.findAssociationForExtension = function(extension) {
        for (var i = 0; i < exports.list.length; i++) {
            if (exports.list[i].extension == extension) {
                return exports.list[i];
            }
        }

        return null;
    };

    exports.findAssociationForFilename = function(filename) {
        for (var i = 0; i < exports.list.length; i++) {
            if (exports.list[i].matchesFilename(filename)) {
                return exports.list[i];
            }
        }

        return null;
    };

    exports.loadDefaultList = function() {
        return fetch("/res/defaultassociations.json").then(function(response) {
            return response.json();
        }).then(function(data) {
            exports.defaultList = data;

            return Promise.resolve();
        });
    };

    exports.init = function() {
        return exports.loadDefaultList().then(function() {
            return exports.loadList();
        });
    };
});