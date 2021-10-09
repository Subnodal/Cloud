/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

// @namespace com.subnodal.cloud.appsapi
namespace("com.subnodal.cloud.appsapi", function(exports) {
    exports.rootElement = null;
    exports.bridgeEmbed = null;
    exports.bridgeHostUrl = null;
    exports.bridgeResponses = {};
    exports.readyCallbacks = [];

    exports.applyBridgeStyling = function() {
        exports.bridgeEmbed.setAttribute("style", `
            all: initial;
            position: fixed;
            display: none;
            top: 0;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100vw;
            height: 100vh;
            height: -webkit-fill-available;
            margin: 0;
            padding: 0;
            border: 0;
            z-index: ${(Math.pow(2, 32) / 2) - 1};
        `);
    };

    exports.showBridge = function() {
        exports.bridgeEmbed.style.display = "block";
    };

    exports.hideBridge = function() {
        exports.bridgeEmbed.style.display = "none";
    };

    exports.attachBridge = function() {
        exports.bridgeEmbed = document.createElement("iframe");
        exports.bridgeEmbed.src = exports.bridgeHostUrl;

        window.addEventListener("message", function(event) {
            if (event.origin != new URL(exports.bridgeHostUrl).origin) {
                return;
            }

            switch (event.data?.type) {
                case "ready":
                    exports.readyCallbacks.forEach((callback) => callback());
                    return;

                case "response":
                    exports.bridgeResponses[event.data?.eventToken] = event.data.data;
                    return;

                case "show":
                    exports.showBridge();
                    return;

                case "hide":
                    exports.hideBridge();
                    return;

                default:
                    console.warn("Unknown response type:", event.data?.type);
                    return;
            }
        });

        exports.applyBridgeStyling();

        exports.rootElement.append(exports.bridgeEmbed);
    };

    exports.sendBridgeEventDescriptor = function(eventDescriptor, data = {}) {
        return new Promise(function(resolve, reject) {
            var eventToken = String(new Date().getTime()); // Use current timestamp as token

            var responseCheckInterval = setInterval(function() {
                if (!exports.bridgeResponses.hasOwnProperty(eventToken)) {
                    return;
                }

                clearInterval(responseCheckInterval);

                var data = exports.bridgeResponses[eventToken];

                delete exports.bridgeResponses[eventToken];

                resolve(data);
            });

            exports.bridgeEmbed.contentWindow.postMessage({
                eventDescriptor,
                data,
                eventToken
            });
        });
    };

    exports.init = function(options) {
        options = options || {};

        exports.rootElement = options.rootElement || document.body;
        exports.bridgeHostUrl = options.bridgeHostUrl || "https://cloud.subnodal.com/embed.html";

        exports.attachBridge();
    };

    exports.ready = function(callback) {
        exports.readyCallbacks.push(callback);
    };
});
// @endnamespace