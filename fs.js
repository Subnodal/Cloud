/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.fs", function(exports) {
    var core = require("com.subnodal.subelements.core");
    var l10n = require("com.subnodal.subelements.l10n");

    var resources = require("com.subnodal.cloud.resources");
    var profiles = require("com.subnodal.cloud.profiles");
    var config = require("com.subnodal.cloud.config");

    exports.sortByAttributes = {
        NAME: 0,
        CREATED_AT: 1,
        LAST_MODIFIED: 2,
        SIZE: 3
    };

    exports.sizeUnits = {
        METRIC: 0, // SI style; radix 1,000
        IEC: 1 // IEC style; radix 1,024
    };

    exports.sizeRadices = {};

    exports.sizeRadices[exports.sizeUnits.METRIC] = 1_000;
    exports.sizeRadices[exports.sizeUnits.IEC] = 1_024;

    exports.fileOperationStates = {
        NOT_STARTED: 0,
        FINISHED: 1,
        RUNNING: 2,
        CANCELLED: 3,
        FAILED: -1
    };

    exports.ipfsNode = null;

    exports.FileOperation = class {
        constructor() {
            this.state = exports.fileOperationStates.NOT_STARTED;
            this.bytesProgress = 0;
            this.bytesTotal = 0;
        }

        start() {
            return Promise.reject("Operation not implemented on base class");
        }
        
        cancel() {
            return Promise.reject("Operation not implemented on base class");
        }
    };

    exports.IpfsFileUploadOperation = class extends exports.FileOperation {
        constructor(name, parentFolder, encryptionKey = core.generateKey(64), token = profiles.getSelectedProfileToken()) {
            super();

            this.name = name;
            this.parentFolder = parentFolder;
            this.encryptionKey = encryptionKey;
            this.token = token;

            this.fileData = null;
            this.contentsAddress = null;
            this.abortController = null;
        }

        static encrypt(fileData, encryptionKey) {
            if (encryptionKey == null) {
                return fileData;
            }

            var wordArray = CryptoJS.lib.WordArray.create(fileData);
            var encrypted = CryptoJS.AES.encrypt(wordArray, encryptionKey).toString();
            var blob = new Blob([encrypted]);

            return blob.arrayBuffer();
        }

        start(fileData) {
            this.state = exports.fileOperationStates.RUNNING;
            this.fileData = fileData;
            this.abortController = new AbortController();
            this.bytesProgress = 0;
            this.bytesTotal = fileData.byteLength;

            var thisScope = this;

            return exports.ipfsNode.add(this.constructor.encrypt(fileData, this.encryptionKey), {
                progress: function(bytesProgress) {
                    thisScope.bytesProgress = bytesProgress;
                },
                signal: this.abortController.signal
            }).then(function(result) {
                thisScope.state = exports.fileOperationStates.FINISHED;
                thisScope.contentsAddress = `ipfs:${result.cid.toString()}`;
                thisScope.bytesProgress = thisScope.bytesTotal;
            }).catch(function(error) {
                console.error(error);

                thisScope.state = exports.fileOperationStates.FAILED;
            });
        }

        cancel() {
            if (this.abortController == null) {
                return Promise.reject("Operation is not running");
            }

            this.abortController.abort();

            this.state = exports.fileOperationStates.CANCELLED;
            this.abortController = null;

            return Promise.resolve();
        }
    };

    function roundToDecimalPlaces(number, decimalPlaces) {
        return Math.round(number * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
    }

    exports.getSizeAsString = function(size, units = config.getSetting("cloud_sizeUnit", "number", exports.sizeUnits.METRIC), decimalPlaces = 1) {
        var radix = exports.sizeRadices[units];

        if (size < Math.pow(radix, 1)) {
            return _("space_bytes", {space: size});
        }

        if (size < Math.pow(radix, 2)) {
            return _(
                units == exports.sizeUnits.METRIC ? "space_kb" : "space_kib",
                {space: roundToDecimalPlaces(size / Math.pow(radix, 1), decimalPlaces)}
            );
        }

        if (size < Math.pow(radix, 3)) {
            return _(
                units == exports.sizeUnits.METRIC ? "space_mb" : "space_mib",
                {space: roundToDecimalPlaces(size / Math.pow(radix, 2), decimalPlaces)}
            );
        }

        if (size < Math.pow(radix, 4)) {
            return _(
                units == exports.sizeUnits.METRIC ? "space_gb" : "space_gib",
                {space: roundToDecimalPlaces(size / Math.pow(radix, 3), decimalPlaces)}
            );
        }

        return _(
            units == exports.sizeUnits.METRIC ? "space_tb" : "space_tib",
            {space: roundToDecimalPlaces(size / Math.pow(radix, 4), decimalPlaces)}
        );
    };

    exports.getRootObjectKeyFromProfile = function(token = profiles.getSelectedProfileToken()) {
        var key;

        if (token == null) {
            return Promise.resolve(null);
        }

        return resources.getProfileInfo(token).then(function(data) {
            key = data?.fsRootObject;

            return resources.getObject(data?.fsRootObject);
        }).then(function(object) {
            if (object == null) {
                var newObject = {
                    type: "folder",
                    name: _("rootFolderName"),
                    contents: {}
                };

                return resources.createObject(newObject, token).then(function(newKey) {
                    key = newKey;

                    return resources.setProfileInfo({fsRootObject: newKey}, token);
                }).then(function() {
                    return Promise.resolve(key);
                });
            }

            return Promise.resolve(key);
        });
    };

    exports.getItemDisplayName = function(item) {
        if (item.type == "file") {
            return item.name.replace(/\.[a-zA-Z0-9.]+$/, "");
        }

        return item.name;
    };

    exports.getItemDetails = function(item, matchSort = exports.sortByAttributes.NAME) {
        switch (matchSort) {
            case exports.sortByAttributes.NAME:
            case exports.sortByAttributes.LAST_MODIFIED:
            default:
                return typeof(item.lastModified) == "number" ? l10n.formatValue(new Date(item.lastModified)) : "";

            case exports.sortByAttributes.CREATED_AT:
                return typeof(item.createdAt) == "number" ? l10n.formatValue(new Date(item.createdAt)) : "";

            case exports.sortByAttributes.SIZE:
                return typeof(item.size) == "number" ? exports.getSizeAsString(item.size) : "";
        }
    };

    exports.createFolder = function(name, parentFolder, token = profiles.getSelectedProfileToken()) {
        var newFolderKey;

        return resources.createObject({
            type: "folder",
            name,
            contents: {}
        }, token).then(function(key) {
            newFolderKey = key;

            return resources.getObject(parentFolder);
        }).then(function(parentData) {
            if (parentData?.type != "folder") {
                return Promise.reject("Expected a folder as the parent, but got a file instead");
            }

            var parentContents = parentData.contents || {};

            if (Object.keys(parentContents).map((item) => item.name).includes(name)) {
                return Promise.reject("A file with the same name already exists in this folder");
            }

            parentContents[newFolderKey] = {
                type: "folder",
                name
            };

            return resources.setFolderObject(parentFolder, {contents: parentContents}, token);
        }).then(function() {
            return Promise.resolve(newFolderKey);
        });
    };

    exports.createFile = function(name, parentFolder, encryptionKey = core.generateKey(64), token = profiles.getSelectedProfileToken()) {
        var newFileKey;

        return resources.createObject({
            type: "file",
            name,
            size: 0,
            contentsAddress: null,
            encryptionKey
        }, token).then(function(key) {
            newFileKey = key;

            return resources.getObject(parentFolder);
        }).then(function(parentData) {
            if (parentData?.type != "folder") {
                return Promise.reject("Expected a folder as the parent, but got a file instead");
            }

            var parentContents = parentData.contents || {};

            if (Object.keys(parentContents).map((item) => item.name).includes(name)) {
                return Promise.reject("A file with the same name already exists in this folder");
            }

            parentContents[newFileKey] = {
                type: "file",
                name
            };

            return resources.setFolderObject(parentFolder, {contents: parentContents}, token);
        }).then(function() {
            return Promise.resolve(newFileKey);
        });
    };

    exports.renameItem = function(key, newName, parentFolder, token = profiles.getSelectedProfileToken()) {
        return resources.getObject(parentFolder).then(function(parentData) {
            if (parentData?.type != "folder") {
                return Promise.reject("Expected a folder as the parent, but got a file instead");
            }

            var parentContents = parentData.contents || {};

            if (Object.keys(parentContents).map((item) => item.name).includes(newName)) {
                return Promise.reject("A file with the same name already exists in this folder");
            }

            parentContents[key].name = newName;

            return resources.setFolderObject(parentFolder, {contents: parentContents}, token);
        }).then(function() {
            return resources.setObject(key, {name: newName}, token); // Doesn't need to be `setObjectFolder` since we're not manipulating folder contents
        });
    };

    exports.listFolder = function(folderKey, sortBy = exports.sortByAttributes.NAME, sortReverse = false, separateFolders = true, hardRefresh = false) {
        var listing = [];

        return resources.getObject(folderKey, !hardRefresh).then(function(data) {
            if (data == null || data?.deleted == true || data?.type != "folder") {
                return Promise.resolve(null);
            }

            var contents = data.contents || {};

            Object.keys(contents).forEach(function(key) {
                listing.push({...contents[key], key});
            });

            return Promise.all(listing.map(function(item) {
                return resources.getObject(item.key, !hardRefresh);
            }));
        }).then(function(objects) {
            if (objects == null) {
                return Promise.resolve(null);
            }

            for (var i = 0; i < listing.length; i++) {
                listing[i] = {...objects[i], ...listing[i]};
            }

            var sortMagnitude = sortReverse ? -1 : 1;
            var collator = new Intl.Collator(l10n.getLocaleCode().split("_")[0], {
                sensitivity: "base",
                numeric: true
            });

            return Promise.resolve(listing.sort(function(a, b) {
                if (separateFolders && a.type != b.type) {
                    if (a.type == "folder") {
                        return -1;
                    }

                    if (b.type == "folder") {
                        return 1;
                    }
                }

                switch (sortBy) {
                    case exports.sortByAttributes.NAME:
                    default:
                        return Math.min(Math.max(collator.compare(a.name, b.name), -1), 1);

                    case exports.sortByAttributes.CREATED_AT:
                        return (a.createdAt - b.createdAt) * sortMagnitude;

                    case exports.sortByAttributes.LAST_MODIFIED:
                        return (a.lastModified - b.lastModified) * sortMagnitude;

                    case exports.sortByAttributes.SIZE:
                        return (a.size - b.size) * sortMagnitude;
                }
            }));
        });
    };

    Ipfs.create().then(function(node) {
        exports.ipfsNode = node;
    });
});