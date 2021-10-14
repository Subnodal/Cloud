/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.apibridge", function(exports) {
    var subElements = require("com.subnodal.subelements");
    var dialogs = require("com.subnodal.subui.dialogs");

    var embed = require("com.subnodal.cloud.embed");

    window.apiBridge = exports;

    var saveOpenRespond = null;
    var saveOpenExtension = null;
    var targetItemName = null;

    exports.getTargetItemName = function() {
        return targetItemName;
    };

    exports.finishSaveOpen = function() {
        if (embed.getSaveOpenFolderView().currentFolderKey == null) {
            return; // Is root folder listing, so cannot save/open there
        }

        if (embed.getSaveOpenIsSave()) {
            var name = document.querySelector("#saveOpenFileName").value.trim();
            var fullName = saveOpenExtension == "" ? name : name + "." + saveOpenExtension;

            if (name == "") {
                return;
            }

            fs.getItemPermissions(embed.getSaveOpenFolderView().currentFolderKey).then(function(permissions) {
                if (!permissions.write) {
                    dialogs.open(document.querySelector("#permissionDeniedDialog"));

                    return;
                }

                var foundItem = embed.getSaveOpenFolderView().listing.find((item) => item.name == fullName);

                if (foundItem != undefined && foundItem.type != "file") {
                    dialogs.open(document.querySelector("#saveNameTakenDialog"));

                    return;
                } else if (foundItem != undefined) {
                    targetItemName = name;

                    subElements.render(document.querySelector("#saveOverwriteFileDialog"));
                    dialogs.open(document.querySelector("#saveOverwriteFileDialog"));

                    return;
                }

                fs.createFile(fullName, embed.getSaveOpenFolderView().currentFolderKey).then(function(key) {
                    saveOpenRespond({
                        status: "ok",
                        result: "selected",
                        key
                    });
                });

                embed.closeDialog(document.querySelector("#saveOpenFileDialog"));
            });
        } else {
            var selectedKey = embed.getSaveOpenFolderView().selectedItemKey;

            if (selectedKey == null) {
                return;
            }

            saveOpenRespond({
                status: "ok",
                result: "selected",
                key: selectedKey
            });

            embed.closeDialog(document.querySelector("#saveOpenFileDialog"));
        }
    };

    exports.finishSaveOverwrite = function() {
        var name = document.querySelector("#saveOpenFileName").value.trim();
        var fullName = saveOpenExtension == "" ? name : name + "." + saveOpenExtension;

        fs.getItemPermissions(embed.getSaveOpenFolderView().currentFolderKey).then(function(permissions) {
            if (!permissions.write) {
                dialogs.open(document.querySelector("#permissionDeniedDialog"));

                return;
            }

            var foundItem = embed.getSaveOpenFolderView().listing.find((item) => item.name == fullName);

            if (!foundItem) {
                exports.finishSaveOpen(); // Call this again, just in case the file to overwrite has been since deleted
            }

            saveOpenRespond({
                status: "ok",
                result: "selected",
                key: foundItem.key
            });

            dialogs.close(document.querySelector("#saveOverwriteFileDialog"));

            embed.closeDialog(document.querySelector("#saveOpenFileDialog"));
        });
    };

    embed.registerEventDescriptor("ensureAuthentication", function(data, respond) {
        respond({status: "ok", result: "authenticated"});
    }, true);

    function showSaveOpenFileDialog() {
        embed.getSaveOpenFolderView().navigate(embed.getRootObjectKey(), true);

        return embed.openDialog(document.querySelector("#saveOpenFileDialog"));
    }

    function filterExtensionsFactory(extensions) {
        return function(item) {
            if (item.type != "file") {
                return true;
            }
    
            for (var i = 0; i < extensions.length; i++) {
                if (item.name.endsWith("." + extensions[i])) {
                    return true;
                }
            }
    
            return false;
        };
    }

    embed.registerEventDescriptor("showSaveFileDialog", function(data, respond) {
        embed.setSaveOpenIsSave(true);

        document.querySelector("#saveOpenFileName").value = data.name || _("untitledName");

        saveOpenRespond = respond;
        saveOpenExtension = data.extension || embed.getManifest().associations[0]?.extension || "";

        embed.getSaveOpenFolderView().handleFileSelect = function(item) {
            if (item.type != "file") {
                return;
            }

            document.querySelector("#saveOpenFileName").value = item.name.replace(/\.[a-zA-Z0-9.]+$/, "");
        };

        embed.getSaveOpenFolderView().handleFileOpen = function(item) {};

        embed.getSaveOpenFolderView().listingFilter =
            typeof(embed.getManifest().associations[0]?.extension) == "string" ?
            filterExtensionsFactory([embed.getManifest().associations[0]?.extension]) :
            (item) => true
        ;

        showSaveOpenFileDialog().then(function() {
            setTimeout(function() {
                document.querySelector("#saveOpenFileName").select();
                document.querySelector("#saveOpenFileName").focus();
            });
        });
    }, true);

    embed.registerEventDescriptor("showOpenFileDialog", function(data, respond) {
        embed.setSaveOpenIsSave(false);

        saveOpenRespond = respond;

        embed.getSaveOpenFolderView().handleFileSelect = function(item) {};

        embed.getSaveOpenFolderView().handleFileOpen = function(item) {
            if (item.type != "file") {
                return;
            }

            exports.finishSaveOpen();
        };

        embed.getSaveOpenFolderView().listingFilter =
            data.filterExtensions != null && data.filterExtensions.length > 0 ?
            filterExtensionsFactory(data.filterExtensions) :
            (item) => true
        ;

        showSaveOpenFileDialog();
    }, true);
});