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

    exports.getRootObjectKeyFromProfile = function(token = profiles.getSelectedProfileToken()) {
        var key;

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

    exports.createFile = function(name, mimeType, parentFolder, encryptionKey = core.generateKey(64), token = profiles.getSelectedProfileToken()) {
        var newFileKey;

        return resources.createObject({
            type: "file",
            mimeType,
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
                mimeType,
                name
            };

            return resources.setObject(parentFolder, {contents: parentContents}, token);
        }).then(function() {
            return Promise.resolve(newFileKey);
        });
    };
});