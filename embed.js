/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.embed", function(exports) {
    var elements = require("com.subnodal.subelements.elements");
    var dialogs = require("com.subnodal.subui.dialogs");

    var profiles = require("com.subnodal.cloud.profiles");

    window.embed = exports;

    var authenticationConfirmUrl = null;

    exports.eventDescriptors = {};

    exports.isEmbedded = function() {
        return window.location.pathname == "/embed.html";
    };

    exports.openDialog = function(element) {
        window.parent.postMessage({type: "show"}, "*");

        setTimeout(function() {
            dialogs.open(element);
        });
    };

    exports.closeDialog = function(element) {
        dialogs.close(element);

        setTimeout(function() {
            window.parent.postMessage({type: "hide"}, "*");
        }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500);
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

            return profiles.checkCurrentProfileState(window.open);
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

                callback(...mainArguments);
            });
        };
    };

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

            exports.closeDialog(document.querySelector("#confirmAuthenticationDialog"));
        });

        document.querySelectorAll("dialog").forEach(function(element) {
            element.addEventListener("cancel", function(event) {
                exports.closeDialog(element);

                event.preventDefault();
                event.stopPropagation();
            });
        });

        document.querySelectorAll("dialog [sui-action='close']").forEach(function(element) {
            element.addEventListener("click", function() {
                exports.closeDialog(elements.findAncestor(element, "dialog"));                
            });
        });

        window.parent.postMessage({type: "ready"}, "*");
    };
});