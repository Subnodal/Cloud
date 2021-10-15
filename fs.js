/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.fs", function(exports) {
    var core = require("com.subnodal.subelements.core");
    var l10n = require("com.subnodal.subelements.l10n");

    var resources = require("com.subnodal.cloud.resources");
    var profiles = require("com.subnodal.cloud.profiles");
    var config = require("com.subnodal.cloud.config");
    var search = require("com.subnodal.cloud.search");

    exports.sortByAttributes = {
        NAME: 0,
        CREATED_AT: 1,
        LAST_MODIFIED: 2,
        SIZE: 3
    };

    exports.sizeUnits = {
        METRIC: 0, // SI style; radix 1,000
        IEC: 1 // IEC style; radix 1,024
    };

    exports.sizeRadices = {};

    exports.sizeRadices[exports.sizeUnits.METRIC] = 1_000;
    exports.sizeRadices[exports.sizeUnits.IEC] = 1_024;

    exports.fileOperationStates = {
        NOT_STARTED: 0,
        FINISHED: 1,
        RUNNING: 2,
        CANCELLED: 3,
        FAILED: -1
    };

    exports.ipfsNode = null;

    exports.fileOperationsQueue = [];

    exports.FileOperation = class {
        constructor() {
            this.state = exports.fileOperationStates.NOT_STARTED;
            this.bytesProgress = 0;
            this.bytesTotal = 0;
        }

        start() {
            return Promise.reject("Operation not implemented on base class");
        }

        cancel() {
            return Promise.reject("Operation not implemented on base class");
        }
    };

    exports.FileUploadOperation = class extends exports.FileOperation {
        constructor(name = null, parentFolder = null, encryptionKey = null, objectKey = null) {
            super();

            this.name = name;
            this.parentFolder = parentFolder;
            this.encryptionKey = encryptionKey;
            this.objectKey = objectKey;

            this.fileData = null;
            this.contentsAddress = null;
        }

        static createSpecificOperation(name = undefined, parentFolder = undefined, encryptionKey = undefined, objectKey = undefined, token = undefined) {
            // All file upload operation instantiaton should happen here so as to select the appropriate subclass for the parent folder

            return new exports.IpfsFileUploadOperation(name, parentFolder, encryptionKey, objectKey, token);
        }

        static encrypt(fileData, encryptionKey) {
            if (encryptionKey == null) {
                return fileData;
            }

            return new Promise(function(resolve, reject) {
                var worker = new Worker("/workers/encryption.js");

                worker.addEventListener("message", function(event) {
                    worker.terminate();

                    resolve(event.data.data);
                });

                worker.postMessage({operation: "encrypt", args: [fileData, encryptionKey]});
            });
        }

        setFile(file, useUploadedFilenames = true) {
            var thisScope = this;
            var reader = new FileReader();

            if (useUploadedFilenames) {
                this.name = file.name;
            }

            return new Promise(function(resolve, reject) {
                reader.addEventListener("loadend", function(event) {
                    thisScope.fileData = event.target.result;
                    thisScope.bytesTotal = thisScope.fileData.byteLength;

                    resolve();
                });

                reader.readAsArrayBuffer(file);
            });
        }

        upload(element, useUploadedFilename = true) {
            return this.setFile(element.files[0], useUploadedFilename);
        }
    };

    exports.IpfsFileUploadOperation = class extends exports.FileUploadOperation {
        constructor(name = null, parentFolder = null, encryptionKey = core.generateKey(64), objectKey = null, token = profiles.getSelectedProfileToken()) {
            super(name, parentFolder, encryptionKey, objectKey);
            this.token = token;

            this.fileData = null;
            this.extraObjectData = {};
            this.abortController = null;
        }

        start() {
            if (this.fileData == null) {
                return Promise.reject("No file has been added");
            }

            if (this.objectKey == null && this.parentFolder == null) {
                return Promise.reject("No parent folder was chosen to upload the file into");
            }

            if (this.objectKey == null && this.name == null) {
                return Promise.reject("No filename was chosen");
            }

            this.state = exports.fileOperationStates.RUNNING;
            this.abortController = new AbortController();
            this.bytesProgress = 0;
            this.bytesTotal = this.fileData.byteLength;

            var thisScope = this;
            var encryptedData;

            return this.constructor.encrypt(this.fileData, this.encryptionKey).then(function(data) {
                encryptedData = data;

                return exports.ipfsNode.add(encryptedData, {
                    progress: function(bytesProgress) {
                        thisScope.bytesProgress = bytesProgress;
                    },
                    signal: thisScope.abortController.signal
                });
            }).then(function(result) {
                thisScope.contentsAddress = `ipfs:${result.cid.toString()}`;
                thisScope.bytesProgress = thisScope.bytesTotal;

                if (thisScope.objectKey == null) { // Create instead of overwrite
                    return exports.createFile(thisScope.name, thisScope.parentFolder, {
                        ...thisScope.extraObjectData,
                        size: encryptedData.byteLength,
                        contentsAddress: thisScope.contentsAddress,
                        encryptionKey: thisScope.encryptionKey
                    }, thisScope.token);
                }

                return resources.setObject(thisScope.objectKey, {
                    ...thisScope.extraObjectData,
                    size: encryptedData.byteLength,
                    contentsAddress: thisScope.contentsAddress,
                    encryptionKey: thisScope.encryptionKey
                }, thisScope.token).then(function() {
                    return Promise.resolve(thisScope.objectKey);
                });
            }).then(function(key) {
                if (thisScope.state != exports.fileOperationStates.CANCELLED) {
                    thisScope.state = exports.fileOperationStates.FINISHED;
                }

                thisScope.objectKey = key;

                return Promise.resolve(key);
            }).catch(function(error) {
                if (thisScope.state == exports.fileOperationStates.CANCELLED) {
                    return Promise.resolve();
                }

                console.error(error);

                thisScope.state = exports.fileOperationStates.FAILED;

                return Promise.reject(error);
            });
        }

        cancel() {
            if (this.abortController == null) {
                return Promise.resolve();
            }

            this.abortController.abort();

            this.state = exports.fileOperationStates.CANCELLED;
            this.abortController = null;

            return Promise.resolve();
        }
    };

    exports.FileDownloadOperation = class extends exports.FileOperation {
        constructor(objectKey) {
            super();

            this.objectKey = objectKey;

            this.fileData = null;
        }

        static createSpecificOperation(objectKey) {
            // All file download operation instantiaton should happen here so as to select the appropriate subclass for the parent folder

            return new exports.IpfsFileDownloadOperation(objectKey);
        }

        get name() {
            return Promise.reject("Operation not implemented on base class");
        }

        get encryptionKey() {
            return Promise.reject("Operation not implemented on base class");
        }

        get contentsAddress() {
            return Promise.reject("Operation not implemented on base class");
        }

        static decrypt(fileData, encryptionKey) {
            if (encryptionKey == null) {
                return fileData;
            }

            return new Promise(function(resolve, reject) {
                var worker = new Worker("/workers/encryption.js");

                worker.addEventListener("message", function(event) {
                    worker.terminate();

                    resolve(event.data.data);
                });

                worker.postMessage({operation: "decrypt", args: [fileData, encryptionKey]});
            });
        }

        zip(zipParent) {
            if (this.state != exports.fileOperationStates.FINISHED || this.fileData == null) {
                return Promise.reject("File data is not yet available");
            }

            zipParent.file(this.name, this.fileData);
        }
    };

    exports.IpfsFileDownloadOperation = class extends exports.FileDownloadOperation {
        constructor(objectKey) {
            super(objectKey);

            this.object = null;
            this.abortController = null;
        }

        get name() {
            return this.object?.name || null;
        }

        get encryptionKey() {
            return this.object?.encryptionKey || null;
        }

        get contentsAddress() {
            return this.object?.contentsAddress || null;
        }

        getObject() {
            var thisScope = this;

            return resources.getObject(this.objectKey).then(function(object) {
                if (object.type != "file") {
                    return Promise.reject("Expected a file, but got something else instead");
                }

                thisScope.object = object;
            });
        }

        start() {
            this.state = exports.fileOperationStates.RUNNING;
            this.abortController = new AbortController();
            this.bytesProgress = 0;
            this.bytesTotal = 0;

            var thisScope = this;

            return this.getObject().then(async function() {
                thisScope.bytesTotal = thisScope.object.size;

                if (thisScope.object.size == 0) {
                    thisScope.state = exports.fileOperationStates.FINISHED;
                    thisScope.fileData = new Uint8Array(0).buffer;

                    return Promise.resolve(thisScope.fileData);
                }

                if (!thisScope.contentsAddress.match(/^ipfs:(.+)/)) {
                    return Promise.reject("File is not available on IPFS");
                }

                var array = new Uint8Array(thisScope.bytesTotal);

                for await (var chunk of exports.ipfsNode.cat(thisScope.contentsAddress.match(/ipfs:(.+)/)[1], {
                    signal: thisScope.abortController.signal
                })) {
                    for (var i = 0; i < chunk.length; i++) {
                        array[thisScope.bytesProgress++] = chunk[i];

                        if (thisScope.bytesProgress > thisScope.bytesTotal) {
                            thisScope.bytesTotal = thisScope.bytesProgress;
                        }
                    }
                }

                if (thisScope.state == exports.fileOperationStates.CANCELLED) {
                    return Promise.reject();
                }

                thisScope.state = exports.fileOperationStates.FINISHED;
                thisScope.bytesProgress = thisScope.bytesTotal;

                return thisScope.constructor.decrypt(array.buffer, thisScope.encryptionKey);
            }).then(function(data) {
                thisScope.fileData = data;

                return Promise.resolve(data);
            }).catch(function(error) {
                if (thisScope.state == exports.fileOperationStates.CANCELLED) {
                    return Promise.resolve();
                }

                console.error(error);

                thisScope.state = exports.fileOperationStates.FAILED;

                return Promise.reject(error);
            });
        }

        download() {
            if (this.state != exports.fileOperationStates.FINISHED || this.fileData == null) {
                return Promise.reject("File data is not yet available");
            }

            var blob = new Blob([this.fileData]);
            var link = document.createElement("a");

            link.href = URL.createObjectURL(blob);
            link.download = this.name;

            link.click();

            return Promise.resolve();
        }

        cancel() {
            if (this.abortController == null) {
                return Promise.resolve();
            }

            this.abortController.abort();

            this.state = exports.fileOperationStates.CANCELLED;
            this.abortController = null;

            return Promise.resolve();
        }
    };

    exports.FolderDownloadOperation = class extends exports.FileOperation {
        constructor(objectKey) {
            super();

            this.objectKey = objectKey;
            this.object = null;
            this.subOperations = [];
        }

        get name() {
            return this.object?.name || null;
        }

        get contentsAddress() {
            return this.object?.contentsAddress || null;
        }

        getObject() {
            var thisScope = this;

            return resources.getObject(this.objectKey).then(function(object) {
                if (object.type != "folder") {
                    return Promise.reject("Expected a folder, but got something else instead");
                }

                thisScope.object = object;
                thisScope.subOperations = [];

                Object.keys(thisScope.object.contents || []).forEach(function(subObjectKey) {
                    var subObject = thisScope.object.contents[subObjectKey];

                    if (subObject.type == "file") {
                        thisScope.subOperations.push(exports.FileDownloadOperation.createSpecificOperation(subObjectKey));

                        return;
                    }

                    if (subObject.type == "folder") {
                        thisScope.subOperations.push(new exports.FolderDownloadOperation(subObjectKey));

                        return;
                    }
                });
            });
        }

        start() {
            this.state = exports.fileOperationStates.RUNNING;
            this.bytesProgress = 0;
            this.bytesTotal = 0;

            var thisScope = this;

            setInterval(function progressCheck() {
                if (thisScope.state != exports.fileOperationStates.RUNNING) {
                    clearInterval(progressCheck);
                }

                thisScope.bytesProgress = 0;
                thisScope.bytesTotal = 0;

                thisScope.subOperations.forEach(function(subOperation) {
                    thisScope.bytesProgress += subOperation.bytesProgress;
                    thisScope.bytesTotal += subOperation.bytesTotal;
                });
            });

            return this.getObject().then(function() {
                var promises = [];

                thisScope.subOperations.forEach(function(subOperation) {
                    promises.push(subOperation.start());
                });

                return Promise.all(promises);
            }).then(function() {
                if (thisScope.state == exports.fileOperationStates.CANCELLED) {
                    return Promise.reject();
                }

                thisScope.state = exports.fileOperationStates.FINISHED;

                return Promise.resolve();
            }).catch(function(error) {
                if (thisScope.state == exports.fileOperationStates.CANCELLED) {
                    return Promise.resolve();
                }

                console.error(error);

                thisScope.state = exports.fileOperationStates.FAILED;

                return Promise.reject(error);
            });
        }

        zip(zipParent) {
            if (this.state != exports.fileOperationStates.FINISHED) {
                return Promise.reject("Folder data is not yet available");
            }

            this.subOperations.forEach(function(subOperation) {
                if (subOperation instanceof exports.FileDownloadOperation) {
                    subOperation.zip(zipParent);

                    return;
                }

                if (subOperation instanceof exports.FolderDownloadOperation) {
                    subOperation.zip(zipParent.folder(subOperation.name));

                    return;
                }
            });
        }

        download() {
            if (this.state != exports.fileOperationStates.FINISHED) {
                return Promise.reject("Folder data is not yet available");
            }

            var thisScope = this;
            var zip = new JSZip();

            this.zip(zip);

            return zip.generateAsync({type: "blob"}).then(function(blob) {
                var link = document.createElement("a");

                link.href = URL.createObjectURL(blob);
                link.download = thisScope.name;

                link.click();
            });
        }

        cancel() {
            this.state = exports.fileOperationStates.CANCELLED;

            return Promise.all(this.subOperations.map(function(subOperation) {
                return subOperation.cancel();
            }));
        }
    };

    exports.CopyOperation = class extends exports.FileOperation {
        constructor(objectKey, parentFolder, newName = null, token = profiles.getSelectedProfileToken()) {
            super();

            this.objectKey = objectKey;
            this.parentFolder = parentFolder;
            this.newName = newName;
            this.token = token;

            this.object = null;
            this.progressInterval = null;
        }

        get defaultName() {
            return this.object?.name || null;
        }

        get name() {
            return this.newName || this.defaultName;
        }

        getObject() {
            var thisScope = this;

            return resources.getObject(this.objectKey).then(function(object) {
                thisScope.object = object;
                thisScope.bytesTotal = object.size * 2;
            });
        }

        start() {
            var thisScope = this;

            this.state = exports.fileOperationStates.RUNNING;
            this.bytesProgress = 0;

            return this.getObject().then(function() {
                if (thisScope.object.type == "file") {
                    var fileDownloadOperation = exports.FileDownloadOperation.createSpecificOperation(thisScope.objectKey);

                    var fileUploadOperation = exports.FileUploadOperation.createSpecificOperation(
                        thisScope.name,
                        thisScope.parentFolder,
                        thisScope.token
                    );

                    thisScope.progressInterval = setInterval(function() {
                        thisScope.bytesProgress = fileDownloadOperation.bytesProgress + fileUploadOperation.bytesProgress;
                        thisScope.bytesTotal = fileDownloadOperation.bytesProgress * 2; // Upload will be same as download, but upload has no value yet, so multiply by 2

                        if (thisScope.state == exports.fileOperationStates.CANCELLED) {
                            fileUploadOperation.cancel();
                            fileDownloadOperation.cancel();

                            clearInterval(thisScope.progressInterval);
                        }
                    });

                    return fileDownloadOperation.start().then(function(data) {
                        fileUploadOperation.fileData = data;

                        return fileUploadOperation.start();
                    }).then(function(key) {
                        clearInterval(thisScope.progressInterval);

                        return Promise.resolve(key);
                    });
                }

                if (thisScope.object.type == "folder") {
                    var copyOperations = [];

                    return exports.createFolder(thisScope.name, thisScope.parentFolder, thisScope.token).then(function(parentFolderKey) {
                        var promiseChain = Promise.resolve();

                        thisScope.progressInterval = setInterval(function() {
                            thisScope.bytesProgress = copyOperations.reduce(function(accumulator, item) {
                                return accumulator + item.bytesProgress
                            }, 0);

                            thisScope.bytesTotal = copyOperations.reduce(function(accumulator, item) {
                                return accumulator + item.bytesTotal
                            }, 0);

                            if (thisScope.state == exports.fileOperationStates.CANCELLED) {
                                copyOperations.forEach((operation) => operation.cancel());
    
                                clearInterval(thisScope.progressInterval);
                            }
                        });

                        Object.keys(thisScope.object.contents || []).forEach(function(objectKey) {
                            var operation = new exports.CopyOperation(
                                objectKey,
                                parentFolderKey,
                                null,
                                thisScope.token
                            );
                            
                            copyOperations.push(operation);

                            operation.getObject(); // So that we can find a `bytesTotal` value for the root `CopyOperation`

                            promiseChain = promiseChain.then(function() {
                                if (thisScope.state == exports.fileOperationStates.CANCELLED) {
                                    return Promise.reject("Operation was cancelled");
                                }

                                return operation.start();
                            });
                        });

                        return promiseChain.then(function() {
                            return Promise.resolve(parentFolderKey);
                        });
                    });
                }
            }).then(function(key) {
                thisScope.state = exports.fileOperationStates.FINISHED;

                return Promise.resolve(key);
            });
        }

        cancel() {
            this.state = exports.fileOperationStates.CANCELLED;

            return Promise.resolve();
        }
    };

    exports.DeleteOperation = class extends exports.FileOperation {
        constructor(objectKey, parentFolder, token = profiles.getSelectedProfileToken()) {
            super();

            this.objectKey = objectKey;
            this.parentFolder = parentFolder;
            this.token = token;

            this.object = null;
            this.progressInterval = null;
        }

        get name() {
            return this.object?.name || null;
        }

        getObject() {
            var thisScope = this;

            return resources.getObject(this.objectKey).then(function(object) {
                thisScope.object = object;
            });
        }

        start() {
            var thisScope = this;

            this.state = exports.fileOperationStates.RUNNING;
            this.bytesProgress = 0;
            this.bytesTotal = 1;

            return this.getObject().then(function() {
                return resources.getObject(thisScope.parentFolder);
            }).then(function(parentData) {
                var parentContents = parentData.contents || {};
    
                if (!Object.keys(parentContents).includes(thisScope.objectKey)) {
                    console.warn("Item doesn't exist in parent folder; deleting anyway");

                    return Promise.resolve();
                }
    
                parentContents[thisScope.objectKey] = null;

                return resources.setFolderObject(thisScope.parentFolder, {contents: parentContents}, thisScope.token);
            }).then(function() {
                if (thisScope.object.type == "folder") {
                    var deleteOperations = [];
                    var promiseChain = Promise.resolve();

                    Object.keys(thisScope.object.contents || []).forEach(function(objectKey) {
                        var operation = new exports.DeleteOperation(
                            objectKey,
                            thisScope.objectKey,
                            thisScope.token
                        );

                        deleteOperations.push(operation);

                        promiseChain = promiseChain.then(function() {
                            if (thisScope.state == exports.fileOperationStates.CANCELLED) {
                                return Promise.reject("Operation was cancelled");
                            }
    
                            return operation.start();
                        });
                    });

                    return promiseChain;
                }

                return Promise.resolve();
            }).then(function() {
                return resources.setObject(thisScope.objectKey, {
                    name: null,
                    deleted: true,
                    contentsAddress: null,
                    encryptionKey: null,
                    size: 0
                });
            }).then(function() {
                thisScope.state = exports.fileOperationStates.FINISHED;
                thisScope.bytesProgress = 1;

                return Promise.resolve();
            });
        }

        cancel() {
            this.state = exports.fileOperationStates.CANCELLED;

            return Promise.resolve();
        }
    };

    function roundToDecimalPlaces(number, decimalPlaces) {
        return Math.round(number * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
    }

    exports.getIpfsNode = function() {
        return exports.ipfsNode;
    };

    exports.getSizeAsString = function(size, units = config.getSetting("cloud_sizeUnit", "number", exports.sizeUnits.METRIC), decimalPlaces = 1) {
        var radix = exports.sizeRadices[units];

        if (size < Math.pow(radix, 1)) {
            return _("space_bytes", {space: size});
        }

        if (size < Math.pow(radix, 2)) {
            return _(
                units == exports.sizeUnits.METRIC ? "space_kb" : "space_kib",
                {space: roundToDecimalPlaces(size / Math.pow(radix, 1), decimalPlaces)}
            );
        }

        if (size < Math.pow(radix, 3)) {
            return _(
                units == exports.sizeUnits.METRIC ? "space_mb" : "space_mib",
                {space: roundToDecimalPlaces(size / Math.pow(radix, 2), decimalPlaces)}
            );
        }

        if (size < Math.pow(radix, 4)) {
            return _(
                units == exports.sizeUnits.METRIC ? "space_gb" : "space_gib",
                {space: roundToDecimalPlaces(size / Math.pow(radix, 3), decimalPlaces)}
            );
        }

        return _(
            units == exports.sizeUnits.METRIC ? "space_tb" : "space_tib",
            {space: roundToDecimalPlaces(size / Math.pow(radix, 4), decimalPlaces)}
        );
    };

    exports.getRootObjectKeyFromProfile = function(token = profiles.getSelectedProfileToken()) {
        var key;

        if (token == null) {
            return Promise.resolve(null);
        }

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

    exports.getSharedObjectKeysFromProfile = function(token = profiles.getSelectedProfileToken()) {
        if (token == null) {
            return Promise.resolve([]);
        }

        return resources.getProfileInfo(token).then(function(data) {
            return Promise.resolve(data?.fsSharedObjects || []);
        });
    };

    exports.getItemDisplayName = function(item) {
        if (item.type == "file") {
            return item.name.replace(/\.[a-zA-Z0-9.]+$/, "");
        }

        return item.name;
    };

    exports.getItemDetails = function(item, matchSort = exports.sortByAttributes.NAME) {
        switch (matchSort) {
            case exports.sortByAttributes.NAME:
            case exports.sortByAttributes.LAST_MODIFIED:
            default:
                return typeof(item.lastModified) == "number" ? l10n.formatValue(new Date(item.lastModified)) : "";

            case exports.sortByAttributes.CREATED_AT:
                return typeof(item.createdAt) == "number" ? l10n.formatValue(new Date(item.createdAt)) : "";

            case exports.sortByAttributes.SIZE:
                return typeof(item.size) == "number" ? exports.getSizeAsString(item.size) : "";
        }
    };

    exports.getItemPermissions = function(key, profile = undefined, uid = undefined, preferCache = false) {
        return (function() {
            if (uid != undefined) {
                return Promise.resolve(uid);
            }

            if (!profiles.isGuestMode()) {
                return profiles.getUidFromToken(profile);
            } else {
                return Promise.resolve(null);
            }
        })().then(function(resolvedUid) {
            uid = resolvedUid;

            return resources.getObject(key, preferCache);
        }).then(function(item) {
            var permissions = {
                write: false
            };

            if (uid != null) {
                permissions.write ||= item.owner == uid;
                permissions.write ||= item.permissions[uid] == "write";
            }

            return Promise.resolve(permissions);
        });
    };

    exports.getFileOperationsQueue = function() {
        return exports.fileOperationsQueue;
    };

    exports.addToFileOperationsQueue = function(operation) {
        exports.fileOperationsQueue.push(operation);
    };

    exports.cleanUpFileOperationsQueue = function() {
        exports.fileOperationsQueue = exports.fileOperationsQueue.filter(function(operation) {
            if ([
                exports.fileOperationStates.FINISHED,
                exports.fileOperationStates.CANCELLED,
                exports.fileOperationStates.FAILED
            ].includes(operation.state)) {
                return false;
            }

            return true;
        });
    };

    exports.cancelAndClearFileOperationsQueue = function() {
        return Promise.all(exports.fileOperationsQueue.map((operation) => operation.cancel())).then(function() {
            exports.fileOperationsQueue = [];
        });
    };

    exports.getFileOperationsQueueProgress = function() {
        var progress = {
            bytesProgress: 0,
            bytesTotal: 0,
            filesProgress: 0,
            filesTotal: 0,
            containsUpload: false,
            containsDownload: false,
            containsCopy: false,
            containsDelete: false,
            combinedAction: null
        };

        exports.fileOperationsQueue.forEach(function(operation) {
            if ([
                exports.fileOperationStates.CANCELLED,
                exports.fileOperationStates.FAILED
            ].includes(operation.state)) {
                return;
            }

            progress.bytesProgress += operation.bytesProgress;
            progress.bytesTotal += operation.bytesTotal;

            if (operation.state == exports.fileOperationStates.FINISHED) {
                progress.filesProgress++;
            }

            progress.filesTotal++;

            if (operation instanceof exports.FileUploadOperation) {
                progress.containsUpload = true;

                if (progress.combinedAction != "upload") {
                    progress.combinedAction = progress.combinedAction == null ? "upload" : "multiple";
                }
            }

            if (operation instanceof exports.FileDownloadOperation || operation instanceof exports.FolderDownloadOperation) {
                progress.containsDownload = true;

                if (progress.combinedAction != "download") {
                    progress.combinedAction = progress.combinedAction == null ? "download" : "multiple";
                }
            }

            if (operation instanceof exports.CopyOperation) {
                progress.containsCopy = true;

                if (progress.combinedAction != "copy") {
                    progress.combinedAction = progress.combinedAction == null ? "copy" : "multiple";
                }
            }

            if (operation instanceof exports.DeleteOperation) {
                progress.containsDelete = true;

                if (progress.combinedAction != "delete") {
                    progress.combinedAction = progress.combinedAction == null ? "delete" : "multiple";
                }
            }
        });

        return progress;
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
                return Promise.reject("Expected a folder as the parent, but got something else instead");
            }

            var parentContents = parentData.contents || {};

            if (Object.keys(parentContents).map((key) => parentContents[key].name).includes(name)) {
                return Promise.reject("A file with the same name already exists in this folder");
            }

            parentContents[newFolderKey] = {
                type: "folder",
                name
            };

            return resources.setFolderObject(parentFolder, {contents: parentContents}, token);
        }).then(function() {
            return search.indexCreatedItem(newFolderKey, name, token);
        }).then(function() {
            return Promise.resolve(newFolderKey);
        });
    };

    exports.createFile = function(name, parentFolder, data = {encryptionKey: core.generateKey(64)}, token = profiles.getSelectedProfileToken()) {
        var newFileKey;

        return resources.createObject({
            type: "file",
            name,
            size: 0,
            contentsAddress: null,
            ...data
        }, token).then(function(key) {
            newFileKey = key;

            return resources.getObject(parentFolder);
        }).then(function(parentData) {
            if (parentData?.type != "folder") {
                return Promise.reject("Expected a folder as the parent, but got a file instead");
            }

            var parentContents = parentData.contents || {};

            if (Object.keys(parentContents).map((key) => parentContents[key].name).includes(name)) {
                return Promise.reject("A file with the same name already exists in this folder");
            }

            parentContents[newFileKey] = {
                type: "file",
                name
            };

            return resources.setFolderObject(parentFolder, {contents: parentContents}, token);
        }).then(function() {
            return search.indexCreatedItem(newFileKey, name, token);
        }).then(function() {
            return Promise.resolve(newFileKey);
        });
    };

    exports.renameItem = function(key, newName, parentFolder, token = profiles.getSelectedProfileToken()) {
        var oldName;

        return resources.getObject(parentFolder).then(function(parentData) {
            if (parentData?.type != "folder") {
                return Promise.reject("Expected a folder as the parent, but got something else instead");
            }

            var parentContents = parentData.contents || {};

            oldName = parentContents[key]?.name || "";

            if (Object.keys(parentContents).map((key) => parentContents[key].name).includes(newName)) {
                return Promise.reject("A file with the same name already exists in this folder");
            }

            parentContents[key].name = newName;

            return resources.setFolderObject(parentFolder, {contents: parentContents}, token);
        }).then(function() {
            return resources.setObject(key, {name: newName}, token);
        }).then(function() {
            return search.indexRenamedItem(key, oldName, newName, token);
        });
    };

    exports.moveItem = function(key, oldParentFolder, newParentFolder, newName = null, token = profiles.getSelectedProfileToken()) {
        var oldParentContents = {};
        var oldName;
        var newParentContents = {};

        if (oldParentFolder == newParentFolder) {
            return Promise.resolve();
        }

        return resources.getObject(oldParentFolder).then(function(oldParentData) {
            oldParentContents = oldParentData.contents || {};

            if (!Object.keys(oldParentContents).includes(key)) {
                return Promise.reject("The item does not exist in the old parent folder");
            }

            oldName = oldParentContents[key].name;

            if (newName == oldName) {
                newName = null;
            }

            return resources.getObject(newParentFolder);
        }).then(function(newParentData) {
            if (newParentData?.type != "folder") {
                return Promise.reject("Expected a folder as the new parent, but got something else instead");
            }

            newParentContents = newParentData.contents || {};

            if (Object.keys(newParentContents).map((key) => newParentContents[key].name).includes(newName || oldName)) {
                return Promise.reject("A file with the same name already exists in this folder");
            }

            newParentContents[key] = {...oldParentContents[key]};

            if (newName != null) {
                newParentContents[key].name = newName;
            }

            oldParentContents[key] = null;

            return resources.setFolderObject(oldParentFolder, {contents: oldParentContents}, token);
        }).then(function() {
            return resources.setFolderObject(newParentFolder, {contents: newParentContents}, token);
        }).then(function() {
            if (newName == null) {
                return Promise.resolve();
            }

            return resources.setObject(key, {name: newName}, token).then(function() {
                return search.indexRenamedItem(key, oldName, newName, token);
            });
        });
    };

    exports.copyItem = function(key, newParentFolder, newName = null, token = profiles.getSelectedProfileToken()) {
        var operation = new exports.CopyOperation(key, newParentFolder, newName, token);

        exports.addToFileOperationsQueue(operation);

        return operation.start();
    };

    exports.listFolder = function(folderKey, sortBy = exports.sortByAttributes.NAME, sortReverse = false, separateFolders = true, hardRefresh = false) {
        var listing = [];

        return resources.getObject(folderKey, !hardRefresh).then(function(data) {
            if (data == null || data?.deleted == true || data?.type != "folder") {
                return Promise.resolve(null);
            }

            objectData = data || {};

            var contents = data.contents || {};

            Object.keys(contents).forEach(function(key) {
                listing.push({...contents[key], key});
            });

            return Promise.all(listing.map(function(item) {
                return resources.getObject(item.key, !hardRefresh);
            }));
        }).then(function(objects) {
            if (objects == null) {
                return Promise.resolve(null);
            }

            for (var i = 0; i < listing.length; i++) {
                listing[i] = {...objects[i], ...listing[i]};
            }

            var sortMagnitude = sortReverse ? -1 : 1;
            var collator = new Intl.Collator(l10n.getLocaleCode().split("_")[0], {
                sensitivity: "base",
                numeric: true
            });

            return Promise.resolve(listing.sort(function(a, b) {
                if (separateFolders && a.type != b.type) {
                    if (a.type == "folder") {
                        return -1;
                    }

                    if (b.type == "folder") {
                        return 1;
                    }
                }

                switch (sortBy) {
                    case exports.sortByAttributes.NAME:
                    default:
                        return Math.min(Math.max(collator.compare(a.name, b.name), -1), 1);

                    case exports.sortByAttributes.CREATED_AT:
                        return (a.createdAt - b.createdAt) * sortMagnitude;

                    case exports.sortByAttributes.LAST_MODIFIED:
                        return (a.lastModified - b.lastModified) * sortMagnitude;

                    case exports.sortByAttributes.SIZE:
                        return (a.size - b.size) * sortMagnitude;
                }
            }));
        });
    };

    Ipfs.create().then(function(node) {
        exports.ipfsNode = node;
    });
});