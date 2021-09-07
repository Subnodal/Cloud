/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.associations", function(exports) {
    var l10n = require("com.subnodal.subelements.l10n");

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
    };

    // TODO: Add actual `openUrl`s for these apps once they've been created
    // TODO: Retrieve this info from a database which will contain information about third-party apps
    exports.list = [
        new exports.Association("writer", "https://subnodal.com/?app=writer&objectKey={objectKey}", {
            appName: {
                "en_GB": "Subnodal Writer",
                "fr_FR": "Sousnœud Rédacteur",
                "zh_CN": "次结·写"
            },
            appNameShort: {
                "en_GB": "Writer",
                "fr_FR": "Rédacteur",
                "zh_CN": "写"
            },
            documentTypeName: {
                "en_GB": "Writer document",
                "fr_FR": "Document Rédacteur",
                "zh_CN": "写文档"
            },
            fallbackLocaleCode: "en_GB"
        }, "/media/thumbnails/writer.svg"),
        new exports.Association("sigma", "https://subnodal.com/?app=sigma&objectKey={objectKey}", {
            appName: {
                "en_GB": "Subnodal Sigma",
                "fr_FR": "Sousnœud Sigma",
                "zh_CN": "次结·西格玛"
            },
            appNameShort: {
                "en_GB": "Sigma",
                "fr_FR": "Sigma",
                "zh_CN": "西格玛"
            },
            documentTypeName: {
                "en_GB": "Sigma spreadsheet",
                "fr_FR": "Tableur Sigma",
                "zh_CN": "西格玛电子表格"
            },
            fallbackLocaleCode: "en_GB"
        }, "/media/thumbnails/sigma.svg"),
        new exports.Association("presenter", "https://subnodal.com/?app=presenter&objectKey={objectKey}", {
            appName: {
                "en_GB": "Subnodal Presenter",
                "fr_FR": "Sousnœud Présentateur",
                "zh_CN": "次结·展示"
            },
            appNameShort: {
                "en_GB": "Presenter",
                "fr_FR": "Présentateur",
                "zh_CN": "展示"
            },
            documentTypeName: {
                "en_GB": "Presenter presentation",
                "fr_FR": "Présentation Présentateur",
                "zh_CN": "展示演示文稿"
            },
            fallbackLocaleCode: "en_GB"
        }, "/media/thumbnails/presenter.svg"),
        new exports.Association("png", "https://subnodal.com/?app=photos&objectKey={objectKey}", {
            appName: {
                "en_GB": "Photos",
                "fr_FR": "Photos",
                "zh_CN": "照片"
            },
            documentTypeName: {
                "en_GB": "PNG photo",
                "fr_FR": "Photo PNG",
                "zh_CN": "PNG照片"
            },
            fallbackLocaleCode: "en_GB"
        }, "/media/thumbnails/photo.svg", false),
        new exports.Association("jpeg", "https://subnodal.com/?app=photos&objectKey={objectKey}", {
            appName: {
                "en_GB": "Photos",
                "fr_FR": "Photos",
                "zh_CN": "照片"
            },
            documentTypeName: {
                "en_GB": "JPEG photo",
                "fr_FR": "Photo JPEG",
                "zh_CN": "JPEG照片"
            },
            fallbackLocaleCode: "en_GB"
        }, "/media/thumbnails/photo.svg", false),
        new exports.Association("jpg", "https://subnodal.com/?app=photos&objectKey={objectKey}", {
            appName: {
                "en_GB": "Photos",
                "fr_FR": "Photos",
                "zh_CN": "照片"
            },
            documentTypeName: {
                "en_GB": "JPEG photo",
                "fr_FR": "Photo JPEG",
                "zh_CN": "JPEG照片"
            },
            fallbackLocaleCode: "en_GB"
        }, "/media/thumbnails/photo.svg", false),
        new exports.Association("svg", "https://subnodal.com/?app=photos&objectKey={objectKey}", {
            appName: {
                "en_GB": "Photos",
                "fr_FR": "Photos",
                "zh_CN": "照片"
            },
            documentTypeName: {
                "en_GB": "SVG photo",
                "fr_FR": "Graphique SVG",
                "zh_CN": "SVG图形"
            },
            fallbackLocaleCode: "en_GB"
        }, "/media/thumbnails/photo.svg", false),
        new exports.Association("gif", "https://subnodal.com/?app=photos&objectKey={objectKey}", {
            appName: {
                "en_GB": "Photos",
                "fr_FR": "Photos",
                "zh_CN": "照片"
            },
            documentTypeName: {
                "en_GB": "GIF animation",
                "fr_FR": "Animation GIF",
                "zh_CN": "GIF动画"
            },
            fallbackLocaleCode: "en_GB"
        }, "/media/thumbnails/photo.svg", false)
    ];

    exports.getList = function() {
        return exports.list;
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
});