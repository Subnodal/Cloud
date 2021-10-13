/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.embed", function(exports) {
    var elements = require("com.subnodal.subelements.elements");
    var dialogs = require("com.subnodal.subui.dialogs");

    var resources = require("com.subnodal.cloud.resources");
    var profiles = require("com.subnodal.cloud.profiles");
    var config = require("com.subnodal.cloud.config");
    var fs = require("com.subnodal.cloud.fs");
    var associations = require("com.subnodal.cloud.associations");
    var thumbnails = require("com.subnodal.cloud.thumbnails");
    var folderViews = require("com.subnodal.cloud.folderviews");

    window.embed = exports;
    window.config = config;
    window.fs = fs;
    window.thumbnails = thumbnails;

    var authenticationConfirmUrl = null;
    var manifest = {};
    var rootObjectKey = null;
    var saveOpenFolderView = null;
    var saveOpenIsSave = false;

    exports.eventDescriptors = {};

    exports.isEmbedded = function() {
        return window.location.pathname == "/embed.html";
    };

    exports.getManifest = function() {
        return manifest;
    };

    exports.getRootObjectKey = function() { // Our personal root object
        return rootObjectKey;
    };

    exports.getSaveOpenIsSave = function() {
        return saveOpenIsSave;
    };

    exports.setSaveOpenIsSave = function(value) {
        saveOpenIsSave = value;
    };

    exports.getSaveOpenFolderView = function() {
        return saveOpenFolderView;
    };

    exports.openDialog = function(element) {
        window.parent.postMessage({type: "show"}, "*");

        setTimeout(function() {
            dialogs.open(element);
        });

        return Promise.resolve();
    };

    exports.closeDialog = function(element) {
        dialogs.close(element);

        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                window.parent.postMessage({type: "hide"}, "*");

                resolve();
            }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500);
        });
    };

    function confirmAuthentication(url) {
        authenticationConfirmUrl = url;

        exports.openDialog(document.querySelector("#confirmAuthenticationDialog"));
    }

    exports.checkAuthentication = function() {
        return profiles.checkProfilesState({embed: true}, confirmAuthentication).then(function(profileOkay) {
            if (!profileOkay) {
                return Promise.resolve(false);
            }

            return profiles.checkCurrentProfileState(window.open).then(function(currentProfileOkay) {
                if (!currentProfileOkay) {
                    return Promise.resolve(false);
                }

                return resources.syncOfflineUpdatedObjects().then(function() {
                    return fs.getRootObjectKeyFromProfile();
                }).then(function(key) {
                    rootObjectKey = key;

                    return config.init();
                }).then(function() {
                    return associations.init();
                }).then(function() {
                    return Promise.resolve(true);
                });
            });
        });
    };

    exports.registerEventDescriptor = function(descriptor, callback, requiresAuthentication = false) {
        exports.eventDescriptors[descriptor] = function() {
            var mainArguments = arguments;
            var authenticationPromise = requiresAuthentication ? exports.checkAuthentication() : Promise.resolve(true);

            authenticationPromise.then(function(authenticated) {
                if (!authenticated) {
                    window.addEventListener("focus", function focusCheck() {
                        exports.eventDescriptors[descriptor](...mainArguments);

                        window.removeEventListener("focus", focusCheck);
                    });

                    return;
                }

                exports.closeDialog(document.querySelector("#confirmAuthenticationDialog")).then(function() {
                    callback(...mainArguments);
                });
            });
        };
    };

    exports.registerEventDescriptor("setManifest", function(data, respond) {
        manifest = data;

        window.parent.postMessage({type: "ready"}, "*");
    });

    exports.init = function() {
        window.addEventListener("message", function(event) {
            if (event.data.hasOwnProperty("eventDescriptor")) {
                (exports.eventDescriptors[event.data.eventDescriptor] || function() {
                    console.warn(`Unknown event descriptor: ${event.data.eventDescriptor}`);
                })(
                    event.data.data || {},
                    function(data) {
                        event.source.postMessage({
                            type: "response",
                            eventToken: event.data.eventToken,
                            data
                        }, event.origin);
                    }
                );
            }
        });

        document.querySelector("#confirmAuthenticationButton").addEventListener("click", function() {
            var popupLocation = `top=${(screen.height / 2) - (600 / 2)},left=${(screen.width / 2) - (550 / 2)},width=550,height=600`;

            window.open(authenticationConfirmUrl, "popUpWindow", popupLocation);
        });

        document.querySelectorAll("dialog").forEach(function(element) {
            element.addEventListener("cancel", function(event) {
                if (document.querySelectorAll("dialog[open]").length > 1) {
                    return; // Is stack of dialogs
                }

                exports.closeDialog(element);

                event.preventDefault();
                event.stopPropagation();
            });
        });

        document.querySelectorAll("dialog [sui-action='close']").forEach(function(element) {
            element.addEventListener("click", function() {
                if (document.querySelectorAll("dialog[open]").length > 1) {
                    return; // Is stack of dialogs
                }

                exports.closeDialog(elements.findAncestor(element, "dialog"));                
            });
        });

        saveOpenFolderView = new folderViews.FolderView(
            document.querySelector("#saveOpenFolderView"),
            document.querySelector("#saveOpenFileDialog")
        );

        window.parent.postMessage({type: "sendManifest"}, "*");
    };
});