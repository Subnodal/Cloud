/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.apibridge", function(exports) {
    var subElements = require("com.subnodal.subelements");
    var l10n = require("com.subnodal.subelements.l10n");
    var dialogs = require("com.subnodal.subui.dialogs");

    var resources = require("com.subnodal.cloud.resources");
    var profiles = require("com.subnodal.cloud.profiles");
    var config = require("com.subnodal.cloud.config");
    var fs = require("com.subnodal.cloud.fs");
    var associations = require("com.subnodal.cloud.associations");
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

    embed.registerEventDescriptor("getUid", function(data, respond) {
        profiles.getUidFromToken(profiles.getSelectedProfileToken()).then(function(uid) {
            respond({
                status: "ok",
                result: "received",
                uid
            });
        });
    }, true);

    embed.registerEventDescriptor("setLocale", function(data, respond) {
        if (typeof(data?.localeCode) != "string" && data?.localeCode != null) {
            respond({
                status: "error",
                result: "prerequisite",
                message: "No locale code was specified"
            })

            return;
        }

        l10n.switchToLocale(data.localeCode == null ? localStorage.getItem("subnodalCloud_locale") : data.localeCode);

        subElements.render();
        embed.getSaveOpenFolderView().render();

        respond({
            status: "ok",
            result: "set"
        });
    });

    embed.registerEventDescriptor("getLocale", function(data, respond) {
        respond({
            status: "ok",
            result: "received",
            localeCode: l10n.getLocaleCode()
        });
    });

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

            document.querySelector("#saveOpenFileName").value = item.name.replace(fs.RE_FILE_EXTENSION_MATCH, "");
        };

        embed.getSaveOpenFolderView().handleFileOpen = function(item) {
            if (item.type != "file") {
                return;
            }

            exports.finishSaveOpen();
        };

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

    embed.registerEventDescriptor("readFile", function(data, respond) {
        if (!data.hasOwnProperty("key")) {
            respond({
                status: "error",
                result: "precondition",
                message: "No object key was provided to read the file"
            });

            return;
        }

        var shouldRespondGenericError = true;

        resources.getObject(data.key).then(function(item) {
            if (item == null || item.deleted) {
                respond({
                    status: "error",
                    result: "notFound",
                    message: "The requested file was not found"
                });

                shouldRespondGenericError = false;

                return Promise.reject();
            }

            if (item.type != "file") {
                respond({
                    status: "error",
                    result: "typeMismatch",
                    message: "The key belongs to an item that is not a file"
                });

                shouldRespondGenericError = false;

                return Promise.reject();
            }

            return fs.FileDownloadOperation.createSpecificOperation(data.key).start();
        }).then(function(data) {
            respond({
                status: "ok",
                result: "read",
                data
            });
        }).catch(function(error) {
            if (!shouldRespondGenericError) {
                return;
            }

            console.error(error);

            respond({
                status: "error",
                result: "generic",
                message: "The requested file could not be read from"
            });
        });
    });

    embed.registerEventDescriptor("writeFile", function(data, respond) {
        if (!data.hasOwnProperty("key")) {
            respond({
                status: "error",
                result: "precondition",
                message: "No object key was provided to write to the file"
            });

            return;
        }

        if (!data.hasOwnProperty("data")) {
            respond({
                status: "error",
                result: "precondition",
                message: "No data was provided to write to the file"
            });

            return;
        }

        var shouldRespondGenericError = true;

        resources.getObject(data.key).then(function(item) {
            if (item == null || item.deleted) {
                respond({
                    status: "error",
                    result: "notFound",
                    message: "The requested file was not found"
                });

                shouldRespondGenericError = false;

                return Promise.reject();
            }

            if (item.type != "file") {
                respond({
                    status: "error",
                    result: "typeMismatch",
                    message: "The key belongs to an item that is not a file"
                });

                shouldRespondGenericError = false;

                return Promise.reject();
            }

            return fs.getItemPermissions(data.key);
        }).then(function(permissions) {
            if (!permissions.write) {
                respond({
                    status: "error",
                    result: "permissionDenied",
                    message: "Write permission is denied for this file"
                });

                shouldRespondGenericError = false;

                dialogs.open(document.querySelector("#permissionDeniedDialog"));

                return Promise.reject();
            }

            var operation = fs.FileUploadOperation.createSpecificOperation(null, null, undefined, data.key);

            operation.extraObjectData = {
                suggestedOpenUrl: embed.getManifest().suggestedOpenUrl
            };

            operation.fileData = data.data;

            return operation.start();
        }).then(function() {
            respond({
                status: "ok",
                result: "written"
            });

            embed.getManifest().associations.forEach(function(data) {
                if (typeof(data.namingScheme?.appName) != "object") {
                    return;
                }

                associations.register(associations.Association.deserialise(data));
            });

            associations.saveList();
        }).catch(function(error) {
            if (!shouldRespondGenericError) {
                return;
            }

            console.error(error);

            respond({
                status: "error",
                result: "generic",
                message: "The requested file could not be written to"
            });
        });
    }, true);

    embed.registerEventDescriptor("configGetSetting", function(data, respond) {
        if (typeof(data.setting) != "string") {
            respond({
                status: "error",
                result: "precondition",
                message: "The requested setting is not a string"
            });

            return;
        }

        respond({
            status: "ok",
            result: "received",
            data: config.getSetting(data.setting)
        });
    }, false, true);

    embed.registerEventDescriptor("configSetSetting", function(data, respond) {
        if (typeof(data.setting) != "string") {
            respond({
                status: "error",
                result: "precondition",
                message: "The requested setting is not a string"
            });

            return;
        }

        config.setSetting(data.setting, data.data || null);

        respond({
            status: "ok",
            result: "set"
        });
    }, false, true);

    subElements.ready(function() {
        document.querySelector("#saveOpenFileName").addEventListener("keydown", function(event) {
            if (event.key == "Enter") {
                exports.finishSaveOpen();
            }
        });
    });
});