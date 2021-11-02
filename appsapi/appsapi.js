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

                (data?.status == "ok" ? resolve : reject)(data);
            });

            exports.bridgeEmbed.contentWindow.postMessage({
                eventDescriptor,
                data,
                eventToken
            });
        });
    };

    /*
        @name Revision
        @type class
        A single revision, containing diffed data changes.
        @param author <String | null = null> The UID of the author, or `null` if not yet apparent
        @param lastModified <Date = new Date()> The default date at which the revision was last modified
    */
    /*
        @name Revision.lastModified
        @type prop <Date>
        The date at which the revision was last modified
    */
    /*
        @name Revision.changes
        @type prop <[{path: [String], data: *}]>
        A list of changes that have occurred in this revision
    */
    /*
        @name Revision.author
        @type prop <String | null>
        The UID of the author, or `null` if not yet apparent
    */
    /*
        @name Revision.timestamp
        @type prop <Number>
        The timestamp at which the revision was last modified.
            ~~~~
            This is usually used as the key in an object containing
            revisions.
    */
    exports.Revision = class {
        constructor(author = null, lastModified = new Date()) {
            this.lastModified = lastModified;
            this.changes = [];
            this.author = author;
        }

        /*
            @name Revision.assignData
            @type method
            Find the diff of two data versions and store the changes in this
            revision.
            @param current <*> The previous data that was in place before this revision
            @param incoming <*> The new data that is to be tracked under this revision
        */
        assignData(current, incoming) {
            this.changes = revisions.diffObjectPaths(
                revisions.deflateObject(current),
                revisions.deflateObject(incoming)
            );

            this.lastModified = new Date();
        }

        /*
            @name Revision.applyData
            @type method
            Apply the changes in this revision to the given data.
            @param current <*> The data to use as a basis for applying the changes under this revision
            @returns <*> The resulting data from applying the changes to the base data
        */
        applyData(current) {
            return revisions.inflateObject(revisions.applyDiffToObjectPaths(
                revisions.deflateObject(current),
                this.changes
            ));
        }

        get timestamp() {
            return this.lastModified.getTime();
        }

        /*
            @name Revision.serialise
            @type method
            Convert this revision into a revision object.
            @returns <{*}> The serialised revision
        */
        serialise() {
            return {
                changes: this.changes,
                author: this.author
            };
        }

        /*
            @name Revision.deserialise
            @type static method
            Convert a given revision object into an instance of the `Revision`
            class.
            @param timestamp <Number> The timestamp to apply to the revision instance
            @param data <{*}> The revision object to deserialise
            @returns <CollaborativeDocument> The new revision instance from the given revision object
        */
        static deserialise(timestamp, data) {
            var instance = new this(data.author, new Date(timestamp));

            instance.changes = data.changes;

            return instance;
        }
    };

    /*
        @name CollaborativeDocument
        @type class
        The manager for a revision-based document that supports collaboration.
        @param defaultData <*> The default data that serves as the first revision for the document
    */
    /*
        @name CollaborativeDocument.objectKey
        @type prop <String | null>
        The object key of the document to save or open with.
    */
    /*
        @name CollaborativeDocument.revisions
        @type prop <[Revision]>
        All of the revisions stored under this document.
    */
    /*
        @name CollaborativeDocument.mergeSettled
        @type prop <Boolean>
        Whether the opened version of this document reflects the version of this
        document before opening. If `true`, then it is necessary to save this
        document to include all merged changes.
    */
    /*
        @name CollaborativeDocument.previousRevision
        @type prop <Revision>
        The revision before the most recent revision.
    */
    /*
        @name CollaborativeDocument.currentRevision
        @type prop <Revision>
        The most recent revision, which contains the current working changes.
    */
    /*
        @name CollaborativeDocument.data
        @type prop <*>
        The data stored in the document, reflective of the document's revisions.
            ~~~~
            Changes made to this property will be stored in the current
            revision. New revisions are made when the document is saved.
    */
    /*
        @name CollaborativeDocument.dataBeforeChanges
        @type prop <*>
        The data stored in the document, excluding the current changes.
    */
    /*
        @name CollaborativeDocument.hasUnsavedChanges
        @type prop <Boolean>
        Whether the current revision has changes that have not yet been saved.
    */
    exports.CollaborativeDocument = class {
        constructor(defaultData = {}) {
            var firstRevision = new exports.Revision();

            firstRevision.assignData({}, defaultData);

            this.objectKey = null;
            this.revisions = [firstRevision, new exports.Revision()];
            this.mergeSettled = false;
        }

        get previousRevision() {
            return this.revisions[this.revisions.length - 2] || null;
        }

        get currentRevision() {
            return this.revisions[this.revisions.length - 1];
        }

        /*
            @anme CollaborativeDocument.buildDataToRevision
            @type method
            Get the data representative of the revisions up to and including the
            revision at the given index.
            @param index <Number> The revision to build the data up to
            @returns <*> The built data from revisions up to and including the given index
        */
        buildDataToRevision(index) {
            var builtData = {};

            this.revisions.slice(0, index + 1).forEach(function(revision) {
                builtData = revision.applyData(builtData);
            });

            return builtData;
        }

        get dataBeforeChanges() {
            return this.buildDataToRevision(this.revisions.length - 2);
        }

        get data() {
            return this.buildDataToRevision(this.revisions.length - 1);
        }

        set data(value) {
            this.currentRevision.assignData(this.dataBeforeChanges, value);
        }

        get hasUnsavedChanges() {
            return this.currentRevision.changes.length > 0;
        }

        /*
            @name CollaborativeDocument.cleanRevisions
            @type method
            Remove all revisions from this document that have no changes (such
            as when the document is saved but no changes have been made).
        */
        cleanRevisions() {
            this.revisions = this.revisions.filter((revision, i) => i == 0 || revision.changes.length > 0);
        }

        /*
            @name CollaborativeDocument.serialise
            @type method
            Convert this document into a document object.
            @returns <{*}> The serialised document
        */
        serialise() {
            var serialisedRevisions = {};

            this.revisions.forEach(function(revision) {
                serialisedRevisions[String(Math.floor(revision.timestamp))] = revision.serialise();
            });

            return {
                revisions: serialisedRevisions
            };
        }

        /*
            @name CollaborativeDocument.deserialise
            @type static method
            Convert a given document object into an instance of the
            `CollaborativeDocument` class.
            @param data <{*}> The document object to deserialise
            @returns <CollaborativeDocument> The new document instance from the given document object
        */
        static deserialise(data) {
            var instance = new this({});

            instance.revisions = Object.keys(data.revisions || {}).map(function(timestamp) {
                return exports.Revision.deserialise(Number(timestamp), data.revisions[timestamp]);
            });

            return instance;
        }

        static readRevisionData(key) {
            return exports.readFile(key).then(function(result) {
                var readData = {};

                if (result.data.byteLength != 0) {
                    try {
                        readData = BSON.deserialize(result.data);
                    } catch (e) {
                        return Promise.reject({
                            status: "error",
                            result: "badFormatting",
                            message: "The read document has bad formatting"
                        });
                    }
                }

                readData.revisions ||= {};

                return Promise.resolve(readData);
            });
        }

        /*
            @name CollaborativeDocument.open
            @type method
            Open the document by its object key and update this document
            instance with any new changes.
            @param key <String = this.objectKey> The object key of the document to open
            @param keepCurrentChanges <Boolean = false> Whether to merge the current revision into the opened document revisions
            @returns <Promise> A `Promise` that is resolved as an object with the opened document's data (including current changes, if chosen) when the document has been opened as key `data`
        */
        open(key = this.objectKey, keepCurrentChanges = false) {
            var thisScope = this;

            this.objectKey = key;

            return this.constructor.readRevisionData(key).then(function(revisionData) {
                var previousRevisionData = {...revisionData};

                if (keepCurrentChanges) {
                    revisions.merge(revisionData, thisScope.serialise());
                }

                thisScope.mergeSettled = JSON.stringify(previousRevisionData) == JSON.stringify(revisionData);

                thisScope.revisions = thisScope.constructor.deserialise(revisionData).revisions;

                return Promise.resolve({
                    status: "ok",
                    result: "opened",
                    data: thisScope.data
                });
            });
        }

        /*
            @name CollaborativeDocument.save
            @type method
            Save the revisions of this document instance into a document by its
            object key.
            @param key <String = this.objectKey> The object key of the document to save
            @returns <Promise> A `Promise` that is resolved when the document has been saved
        */
        save(key = this.objectKey) {
            var thisScope = this;

            if (key == null) {
                return Promise.reject({
                    status: "error",
                    result: "precondition",
                    message: "The object key has not yet been assigned"
                });
            }

            this.cleanRevisions();

            return exports.getUid().then(function(result) {
                thisScope.revisions.forEach(function(revision) {
                    if (revision.author == null) {
                        revision.author = result.uid; // Assign currently signed-in user's UID to revisions that don't have an assigned author
                    }
                });

                return thisScope.open(key, true);
            }).then(function() {
                return exports.writeFile(key, BSON.serialize(thisScope.serialise()));
            }).then(function() {
                thisScope.revisions.push(new exports.Revision());

                return Promise.resolve({
                    status: "ok",
                    result: "saved"
                });
            });
        }

        /*
            @name CollaborativeDocument.sync
            @type method
            Sync the changes between this version of the document and the
            changes made on Subnodal Cloud.
                ~~~~
                This method can be called on a regular basis to implement an
                autosave/live update system.
            @returns <Promise> A `Promise` that is resolved when the document has been synced
        */
        sync() {
            var thisScope = this;

            if (this.objectKey == null) {
                return Promise.reject({
                    status: "error",
                    result: "precondition",
                    message: "This document has not yet been saved"
                });
            }

            return this.open(this.objectKey, true).then(function() {
                if (thisScope.mergeSettled) {
                    return Promise.resolve({
                        status: "ok",
                        result: "noActionTaken"
                    });
                }

                return this.save(this.objectKey);
            })
        }
    };

    /*
        @name getLocaleCode
        Get the current user interface locale code.
        @returns <Promise> A `Promise` that is resolved as an object with the current locale code string as key `localeCode`
    */
    exports.getLocaleCode = function() {
        return exports.sendBridgeEventDescriptor("getLocale");
    };

    /*
        @name setLocaleCode
        Set the current user interface locale code, or reset it to what the user
        chose in the main Subnodal Cloud user interface.
        @param localeCode <String | null = null> The locale code to select, or `null` if reverting to default
        @returns <Promise> A `Promise` that is resolved when the locale code has been chosen
    */
        exports.setLocaleCode = function(localeCode) {
            return exports.sendBridgeEventDescriptor("setLocale", {localeCode});
        };

    /*
        @name getUid
        Get the currently signed-in user's unique identifier.
        @returns <Promise> A `Promise` that is resolved as an object with the user's unique identifier string as key `uid`
    */
    exports.getUid = function() {
        return exports.sendBridgeEventDescriptor("getUid");
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