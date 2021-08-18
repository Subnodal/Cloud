/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.fs", function(exports) {
    var core = require("com.subnodal.subelements.core");

    var profiles = require("com.subnodal.cloud.profiles");
    var resources = require("com.subnodal.cloud.resources");

    exports.sortByAttributes = {
        NAME: 0,
        CREATED_AT: 1,
        LAST_MODIFIED: 2,
        SIZE: 3
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

            return resources.setObject(parentFolder, {contents: parentContents}, token);
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

            return resources.setObject(parentFolder, {contents: parentContents}, token);
        }).then(function() {
            return Promise.resolve(newFileKey);
        });
    };

    exports.listFolder = function(folderKey, sortBy = exports.sortByAttributes.NAME, sortReverse = false, seperateFolders = true) {
        var listing = [];

        return resources.getObject(folderKey).then(function(data) {
            if (data?.type != "folder") {
                return Promise.reject("The requested directory is not a folder");
            }

            var contents = data.contents || {};

            Object.keys(contents).forEach(function(key) {
                listing.push({...contents[key], key});
            });

            return Promise.all(listing.map(function(item) {
                return resources.getObject(item.key);
            }));
        }).then(function(objects) {
            for (var i = 0; i < listing.length; i++) {
                listing[i] = {...objects[i], ...listing[i]};
            }

            var sortMagnitude = sortReverse ? -1 : 1;

            return Promise.resolve(listing.sort(function(a, b) {
                if (seperateFolders && a.type != b.type) {
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
                        if (a.name < b.name) {
                            return -1 * sortMagnitude;
                        }

                        if (a.name > b.name) {
                            return sortMagnitude;
                        }

                        return 0;

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
});