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
    exports.manifest = {};
    exports.bridgeResponses = {};
    exports.readyCallbacks = [];

    var focusReturnElement = null;

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
                case "sendManifest":
                    exports.sendBridgeEventDescriptor("setManifest", exports.manifest);
                    return;

                case "ready":
                    exports.readyCallbacks.forEach((callback) => callback());
                    return;

                case "response":
                    exports.bridgeResponses[event.data?.eventToken] = event.data.data;
                    return;

                case "show":
                    if (focusReturnElement == null) {
                        focusReturnElement = document.activeElement;
                    }

                    exports.showBridge();

                    return;

                case "hide":
                    exports.hideBridge();

                    if (focusReturnElement instanceof Node) {
                        focusReturnElement.focus();

                        focusReturnElement = null;
                    }

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

    /*
        @name showSaveFileDialog
        Present the save file dialog to the user so that they can choose a
        folder to save their file to and a filename to save their file as.
        @param defaultName <String | undefined = undefined> The default filename to populate if no filename is chosen (is the localised version of "Untitled" if argument isn't specified)
        @returns <Promise> A `Promise` that is resolved as an object with the newly-created file's object key as key `key`.
    */
    exports.showSaveFileDialog = function(defaultName = undefined) {
        return exports.sendBridgeEventDescriptor("showSaveFileDialog", {name: defaultName});
    };

    /*
        @name showOpenFileDialog
        Present the open file dialog to the user so that they can choose a file
        to open.
        @returns <Promise> A `Promise` that is resolved as an object with the selected file's object key as key `key`.
    */
    exports.showOpenFileDialog = function() {
        return exports.sendBridgeEventDescriptor("showOpenFileDialog");
    };

    /*
        @name init
        Initialise the Cloud Apps API. Once initialised, `ready` callbacks will
        be called.
            ~~~~
            Available options are:
            * `rootElement`: The element to append the Cloud Apps API Bridge
              iframe to to allow for communications between the target app and
              API.
            * `appName`: An object containing locale translations for the target
              app's name.
            * `fallbackLocaleCode` The locale code to use when the current
              locale is not supported by the target app.
            * `associations`: An array of objects that represent file
              associations:
              - `extension`: The file extension to associate with.
              - `documentTypeName`: An object containing locale translations for
                the association's document type name (such as
                `"Text document"`).
              - `thumbnailUrl`: The URL to the thumbnail to use in Subnodal
                Cloud to represent the file association.
            * `openUrl`: The URL to redirect to when a file is opened.
              `{objectKey}` is substituted with the object key of the file to
              open.
        @param options <Object = {}> The options to specify when initialising the Cloud Apps API
    */
    exports.init = function(options = {}) {
        exports.rootElement = options.rootElement || document.body;
        exports.bridgeHostUrl = options.bridgeHostUrl || "https://cloud.subnodal.com/embed.html";

        exports.manifest = {
            associations: (options.associations || []).map((association) => ({
                extension: association.extension,
                openUrl: options.openUrl || window.location.href,
                namingScheme: {
                    appName: options.appName,
                    documentTypeName: association.documentTypeName,
                    fallbackLocaleCode: options.fallbackLocaleCode
                },
                thumbnailUrl: association.thumbnailUrl,
                creatable: association.creatable == false ? false : true
            }))
        };

        exports.attachBridge();
    };

    /*
        @name ready
        Call the given callback when the Cloud Apps API is ready to be used.
        @param callback <Function> The callback to call when ready
    */
    exports.ready = function(callback) {
        exports.readyCallbacks.push(callback);
    };
});
// @endnamespace