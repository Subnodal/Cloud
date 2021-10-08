/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.embed", function(exports) {
    var dialogs = require("com.subnodal.subui.dialogs");

    var cloud = require("com.subnodal.cloud");
    var profiles = require("com.subnodal.cloud.profiles");

    window.embed = exports;

    var authenticationConfirmUrl = null;

    exports.eventDescriptors = {};

    exports.isEmbedded = function() {
        return window.location.pathname == "/embed.html";
    };

    function confirmAuthentication(url) {
        authenticationConfirmUrl = url;

        dialogs.open(document.querySelector("#confirmAuthenticationDialog"));
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

            dialogs.close(document.querySelector("#confirmAuthenticationDialog"));
        });
    };
});