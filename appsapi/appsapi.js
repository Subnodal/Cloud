/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

// @namespace com.subnodal.cloud.appsapi
namespace("com.subnodal.cloud.appsapi", function(exports) {
    var revisions = require("com.subnodal.cloud.appsapi.revisions");

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

    exports.Revision = class {
        constructor(author = null, lastModified = new Date().getTime()) {
            this.lastModified = lastModified;
            this.changes = [];
            this.author = author;
        }

        assignData(current, incoming) {
            this.changes = revisions.diffObjectPaths(
                revisions.deflateObject(current),
                revisions.deflateObject(incoming)
            );

            this.lastModified = new Date();
        }

        applyData(current) {
            return revisions.inflateObject(revisions.applyDiffToObjectPaths(
                revisions.deflateObject(current),
                this.changes
            ));
        }

        get timestamp() {
            return this.lastModified.getTime();
        }

        static deserialise(timestamp, data) {
            this.lastModified = new Date(timestamp);
            this.changes = data.changes;
            this.author = data.author;
        }

        serialise() {
            return {
                changes: this.changes,
                author: this.author
            };
        }
    };

    exports.CollaborativeDocument = class {
        constructor(defaultData = {}) {
            var firstRevision = new exports.Revision();

            firstRevision.assignData(defaultData);

            this.objectKey = null;
            this.revisions = [firstRevision, new exports.Revision()];
        }

        get previousRevision() {
            return this.revisions[this.revisions.length - 2] || null;
        }

        get currentRevision() {
            return this.revisions[this.revisions.length - 1];
        }

        get data() {
            var currentData = {};

            this.revisions.forEach(function(revision) {
                currentData = revision.applyData(currentData);
            });

            return currentData;
        }

        set data(value) {
            this.currentRevision.assignData(this.data, value);
        }

        get hasUnsavedChanges() {
            return this.currentRevision.changes.length > 0;
        }

        open(key = this.objectKey, keepCurrentChanges = false) {
            var thisScope = this;

            this.objectKey = key;

            return exports.readFile(key).then(function(data) {
                var readData = {};

                try {
                    readData = JSON.parse(new TextDecoder().decode(data));
                } catch (e) {}

                var stashedRevision = this.currentRevision;
                var shouldApplyStashedRevision = keepCurrentChanges && this.hasUnsavedChanges;

                thisScope.revisions = Object.keys(readData.revisions || {}).map(function(timestamp) {
                    return exports.Revision.deserialise(Number(timestamp, readData.revisions[timestamp]));
                });

                if (shouldApplyStashedRevision) {
                    thisScope.revisions.push(stashedRevision);
                }

                return Promise.resolve(thisScope.data);
            });
        }

        save(key = this.objectKey) {
            var serialisedRevisions = {};

            if (!this.hasUnsavedChanges) {
                return Promise.resolve();
            }

            this.revisions.forEach(function(revision) {
                serialisedRevisions[String(Math.floor(revision.timestamp))] = revision.serialise();
            });

            // TODO: Apply author UID to latest revision

            return this.open(key, true).then(function() {
                return exports.writeFile(key, JSON.stringify({
                    revisions: serialisedRevisions
                }));
            });
        }
    };

    /*
        @name showSaveFileDialog
        Present the save file dialog to the user so that they can choose a
        folder to save their file to and a filename to save their file as.
        @param defaultName <String | undefined = undefined> The default filename to populate if no filename is chosen (is the localised version of "Untitled" if argument isn't specified)
        @returns <Promise> A `Promise` that is resolved as an object with the newly-created file's object key as key `key`
    */
    exports.showSaveFileDialog = function(defaultName = undefined) {
        return exports.sendBridgeEventDescriptor("showSaveFileDialog", {name: defaultName});
    };

    /*
        @name showOpenFileDialog
        Present the open file dialog to the user so that they can choose a file
        to open.
        @param filterExtensions <[String] | null = manifest.associations*.extension | null> An array of extensions to only list the files of. Will list all files if `null`
        @returns <Promise> A `Promise` that is resolved as an object with the selected file's object key as key `key`
    */
    exports.showOpenFileDialog = function(filterExtensions = exports.manifest.associations?.length > 0 ? exports.manifest.associations.map((association) => association.extension) : null) {
        return exports.sendBridgeEventDescriptor("showOpenFileDialog", {filterExtensions});
    };

    /*
        @name readFile
        Read the data from a file with a given object key.
        @param key <String> The object key of the file to read from
        @returns <Promise> A `Promise` that is resolved as an object with the read data as key `data`, in `ArrayBuffer` form
    */
    exports.readFile = function(key) {
        return exports.sendBridgeEventDescriptor("readFile", {key});
    };

    /*
        @name writeFile
        Write data to a file with a given object key.
        @param key <String> The object key of the file to write to
        @param data <ArrayBuffer | TypedArray | String | *> The data to write; an `ArrayBuffer` is preferred, but typed arrays are accepted, and so are strings (other objects will be converted to strings)
        @returns <Promise> A `Promise` that is resolved when the data has been written to the file
    */
    exports.writeFile = function(key, data) {
        if (ArrayBuffer.isView(data)) {
            data = data.buffer;
        } else if (!(data instanceof ArrayBuffer)) {
            data = new TextEncoder().encode(String(data)).buffer;
        }

        return exports.sendBridgeEventDescriptor("writeFile", {key, data});
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
            suggestedOpenUrl: options.openUrl || window.location.href,
            associations: (options.associations || []).map((association) => ({
                extension: association.extension,
                openUrl: options.openUrl || window.location.href,
                namingScheme: {
                    appName: options.appName,
                    appNameShort: options.appNameShort || options.appName,
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