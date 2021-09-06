/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.index", function(exports) {
    var subElements = require("com.subnodal.subelements");
    var elements = require("com.subnodal.subelements.elements");
    var l10n = require("com.subnodal.subelements.l10n");
    var menus = require("com.subnodal.subui.menus");
    var views = require("com.subnodal.subui.views");
    var dialogs = require("com.subnodal.subui.dialogs");

    var resources = require("com.subnodal.cloud.resources");
    var profiles = require("com.subnodal.cloud.profiles");
    var config = require("com.subnodal.cloud.config");
    var fs = require("com.subnodal.cloud.fs");
    var associations = require("com.subnodal.cloud.associations");
    var thumbnails = require("com.subnodal.cloud.thumbnails");

    const LIVE_REFRESH_INTERVAL = 5 * 1_000; // 5 seconds
    const OPERATIONS_PROGRESS_INFO_UPDATE = 100; // 100 milliseconds
    const POST_UPLOAD_CLEANUP_DELAY = 5 * 1_000; // 5 seconds

    var firstLoad = true;
    var accounts = {};
    var rootFolderKey = null;
    var currentFolderKey = null;
    var currentPath = [];
    var forwardPath = [];
    var currentListing = [];
    var listingIsLoading = true;
    var dataUnavailableWhileOffline = false;
    var dataNotFound = false;
    var renameDuplicateIsFolder = false;
    var cleanUpDelayStarted = false;

    window.index = exports;
    window.l10n = l10n;
    window.profiles = profiles;
    window.config = config;
    window.fs = fs;
    window.associations = associations;
    window.thumbnails = thumbnails;

    exports.getAccounts = function() {
        return accounts;
    };

    exports.getRootFolderKey = function() {
        return rootFolderKey;
    };

    exports.getCurrentPath = function() {
        return currentPath;
    };

    exports.getCurrentListing = function() {
        return currentListing;
    };

    exports.getListingIsLoading = function() {
        return listingIsLoading;
    };

    exports.getDataUnavailableWhileOffline = function() {
        return dataUnavailableWhileOffline;
    };

    exports.getDataNotFound = function() {
        return dataNotFound;
    };

    exports.getListingIsUnavailable = function() {
        return !exports.getListingIsLoading() && (exports.getDataUnavailableWhileOffline() || exports.getDataNotFound());
    };

    exports.getListingIsAvailable = function() {
        return !exports.getListingIsLoading() && !exports.getDataUnavailableWhileOffline() && !exports.getDataNotFound();
    };

    exports.getRenameDuplicateIsFolder = function() {
        return renameDuplicateIsFolder;
    };

    exports.populateAccounts = function() {
        var tokens = profiles.listProfiles();

        Promise.all(tokens.map(function(token) {
            return resources.getProfileInfo(token);
        })).then(function(profilesData) {
            for (var i = 0; i < tokens.length; i++) {
                if (profilesData[i] == null) {
                    continue;
                }

                accounts[tokens[i]] = profilesData[i];
            }

            subElements.render();
        });
    };

    exports.populateFolderView = function(key = currentFolderKey, hardRefresh = false, refreshInBackground = false) {
        if (key == null) {
            return Promise.reject("Key is null");
        }

        views.deselectList(document.querySelector("#currentFolderView"));

        listingIsLoading = !refreshInBackground;

        subElements.render();

        if (!navigator.onLine && !resources.getObjectCache().hasOwnProperty(key)) {
            listingIsLoading = false;
            dataUnavailableWhileOffline = true;

            subElements.render();

            return Promise.reject("Data unavailable while offline");
        } else {
            dataUnavailableWhileOffline = false;
        }

        return fs.listFolder(
            key,
            config.getSetting("cloud_sortBy", "number", fs.sortByAttributes.NAME),
            config.getSetting("cloud_sortReverse", "boolean", false),
            config.getSetting("cloud_separateFolders", "boolean", true),
            hardRefresh
        ).then(function(listing) {
            if (listing == null) {
                dataNotFound = true;
                listingIsLoading = false;

                subElements.render();

                return Promise.reject("Data not found");
            }

            currentListing = listing;
            listingIsLoading = false;
            dataNotFound = false;

            subElements.render();

            var isFolderOpening = false;

            document.querySelectorAll("ul#currentFolderView li").forEach(function(element) {
                views.attachListItemOpenEvent(element, function() {
                    var item = exports.getItemFromCurrentListing(element.getAttribute("data-key"));
        
                    if (item == null || isFolderOpening) {
                        return;
                    }

                    forwardPath = [];
        
                    if (item.type == "folder") {
                        isFolderOpening = true;

                        exports.navigate(item.key).then(function() {
                            document.querySelector("#currentFolderView li")?.focus();
                        });
        
                        return;
                    }

                    if (item.type == "file") {
                        var association = associations.findAssociationForFilename(item.name);

                        if (association == null) {
                            return;
                        }

                        window.open(association.getOpenUrlForItem(item));

                        return;
                    }
                });
            });

            return Promise.resolve(listing);
        });
    };

    exports.navigate = function(key, replaceRoot = false) {
        if (replaceRoot) {
            currentPath = [];
        }

        currentFolderKey = key;

        return resources.getObject(key).then(function(data) {
            currentPath.push({...data, key});

            return exports.populateFolderView(key);
        });
    };

    exports.goBack = function(toKey = currentPath[currentPath.length - 2]?.key) {
        if (typeof(toKey) != "string") {
            return; // Tries to find ancestor of root
        }

        while (currentPath[currentPath.length - 1]?.key != toKey) {
            forwardPath.push(currentPath.pop());

            if (currentPath.length <= 1) {
                break;
            }
        }

        currentFolderKey = toKey;

        return exports.populateFolderView(toKey);
    };

    exports.goForward = function() {
        if (forwardPath.length == 0) {
            return; // Cannot go forward any further
        }

        return exports.navigate(forwardPath.pop().key);
    };

    exports.getItemFromCurrentListing = function(key) {
        for (var i = 0; i < currentListing.length; i++) {
            if (currentListing[i].key == key) {
                return currentListing[i];
            }
        }

        return null;
    };

    exports.selectAll = function() {
        document.querySelectorAll("#currentFolderView li").forEach((element) => element.setAttribute("aria-selected", true));
    };

    exports.invertSelection = function() {
        document.querySelectorAll("#currentFolderView li").forEach(function(element) {
            if (element.hasAttribute("aria-selected")) {
                element.removeAttribute("aria-selected");
            } else {
                element.setAttribute("aria-selected", true);
            }
        });
    };

    exports.nameTaken = function(name, skipKey = null, extraNames = []) {
        if (extraNames.includes(name)) {
            return true;
        }

        for (var i = 0; i < currentListing.length; i++) {
            if (currentListing[i].key == skipKey) {
                continue;
            }

            if (currentListing[i].name == name) {
                return true;
            }
        }

        return false;
    };

    exports.findNextAvailableName = function(originalName, append = "", skipKey = null, extraNames = []) {
        var copyNumber = 1;
        var newName = originalName;

        if (!exports.nameTaken(originalName + append, skipKey, extraNames)) {
            return originalName + append;
        }

        do {
            copyNumber++;
            newName = _("duplicateDocumentCopyMark", {name: originalName, number: copyNumber}) + append;
        } while (exports.nameTaken(newName, skipKey, extraNames))

        return newName;
    };

    exports.renameItemByInput = function(input) {
        var key = input.closest("li").getAttribute("data-key");
        var appendExtension = "";

        if (input.value.trim() == "") {
            exports.populateFolderView(); // Revert the rename input

            return;
        }

        return resources.getObject(key).then(function(data) {
            if (data == null) {
                exports.populateFolderView(); // Item might have been deleted

                return;
            }

            var extensionMatch = (data?.name || "").match(/(\.[a-zA-Z0-9.]+)$/);

            if (extensionMatch && data?.type == "file") {
                appendExtension = extensionMatch[1]; // Add original extension back on if it was hidden
            }

            if (exports.nameTaken(input.value.trim() + appendExtension, key)) {
                renameDuplicateIsFolder = data?.type == "folder";

                dialogs.open(document.querySelector("#renameDuplicateDialog"));

                exports.populateFolderView(); // Revert the rename input

                return Promise.resolve();
            }

            return fs.renameItem(key, input.value.trim() + appendExtension, currentFolderKey);
        });
    };

    exports.selectItemForRenaming = function(key) {
        document.querySelectorAll("#currentFolderView li").forEach(function(element) {
            if (element.getAttribute("data-key") != key) {
                return;
            }

            views.selectListItem(element, views.selectionModes.SINGLE);

            setTimeout(function() {
                element.querySelector("input").focus();
                element.querySelector("input").select();
            });
        });
    };

    exports.selectFirstItemForRenaming = function() {
        var selectedItem = views.getSelectedListItems(document.querySelector("#currentFolderView"))[0];

        if (!(selectedItem instanceof Node)) {
            return;
        }

        exports.selectItemForRenaming(selectedItem.getAttribute("data-key"));
    };

    exports.createFileFromNewMenu = function(element) {
        var extension = element.getAttribute("data-extension");
        var association = associations.findAssociationForExtension(extension);
        var newFileKey;

        return fs.createFile(exports.findNextAvailableName(association.documentTypeName, "." + extension), currentFolderKey).then(function(key) {
            newFileKey = key;

            return exports.populateFolderView(currentFolderKey, true);
        }).then(function() {
            exports.selectItemForRenaming(newFileKey);

            return Promise.resolve();
        });
    };

    exports.requestFileToUpload = function() {
        document.querySelector("#fileUpload").click();
    };

    exports.uploadChosenFiles = function() {
        var otherNames = [];
        var operations = [];
        var promiseChain = Promise.resolve();

        [...document.querySelector("#fileUpload").files].forEach(function(file) {
            var operation = new fs.IpfsFileUploadOperation(exports.findNextAvailableName(
                file.name.replace(/\.[a-zA-Z0-9.]+$/, ""),
                file.name.match(/(\.[a-zA-Z0-9.]+)$/)[1] || "",
                null,
                otherNames
            ), currentFolderKey);

            fs.addToFileOperationsQueue(operation);
            operations.push(operation);

            operation.setFile(file, false).then(function() {
                promiseChain = promiseChain.then(function() {
                    subElements.render();

                    return operation.start();
                });
            });

            otherNames.push(operation.name);
        });

        promiseChain.then(function() {
            exports.populateFolderView(currentFolderKey, true, true);
        });

        return operations;
    };

    exports.getItemToDownload = function(key, type) {
        var operation = null;

        console.log(key);

        if (type == "file") {
            operation = new fs.IpfsFileDownloadOperation(key);
        }

        if (type == "folder") {
            operation = new fs.FolderDownloadOperation(key);
        }

        if (operation == null) {
            return Promise.reject("Item has an unknown type");
        }

        fs.addToFileOperationsQueue(operation);

        return operation.start().then(function() {
            return Promise.resolve(operation);
        });
    };

    exports.downloadSelectedItems = function() {
        var selectedItems = views.getSelectedListItems(document.querySelector("#currentFolderView"));

        if (selectedItems.length == 0) {
            return Promise.resolve();
        }

        if (selectedItems.length == 1) {
            return exports.getItemToDownload(
                selectedItems[0].getAttribute("data-key"),
                selectedItems[0].getAttribute("data-type")
            ).then(function(operation) {
                return operation.download();
            });
        }

        var promises = [];

        selectedItems.forEach(function(selectedItem) {
            promises.push(exports.getItemToDownload(
                selectedItem.getAttribute("data-key"),
                selectedItem.getAttribute("data-type")
            ));
        });

        var zip = new JSZip();

        Promise.all(promises).then(function(operations) {
            operations.forEach(function(operation) {
                operation.zip(zip);
            });

            return zip.generateAsync({type: "blob"}).then(function(blob) {
                var link = document.createElement("a");

                link.href = URL.createObjectURL(blob);
                link.download = operations[0].name.replace(/\.[a-zA-Z0-9.]+$/, "") + ".zip";

                link.click();
            });
        });
    };

    exports.performLiveRefresh = function() {
        if (!document.hasFocus()) {
            return Promise.resolve(false); // Minimise bandwidth used for other applications
        }

        if (exports.getListingIsLoading() || exports.getListingIsUnavailable()) {
            return Promise.resolve(false); // Don't interfere with any current loading events
        }

        var inputFocused = false;

        document.querySelectorAll("#currentFolderView li input").forEach(function(input) {
            if (document.activeElement.isSameNode(input)) {
                inputFocused = true;
            }
        });

        if (inputFocused || document.activeElement.matches("#currentFolderView li")) {
            return Promise.resolve(false); // Don't interfere with focus
        }

        if (views.getSelectedListItems(document.querySelector("#currentFolderView")).length > 0) {
            return Promise.resolve(false); // Don't interfere with user's selection
        }

        return exports.populateFolderView(currentFolderKey, true, true).then(function() {
            return Promise.resolve(true);
        });
    };

    exports.reload = function() {
        config.init();

        exports.populateAccounts();

        fs.cancelAndClearFileOperationsQueue();

        resources.syncOfflineUpdatedObjects().then(function() {
            return fs.getRootObjectKeyFromProfile();
        }).then(function(key) {
            if (key == null) {
                return;
            }

            rootFolderKey = key;
            currentFolderKey = key;

            exports.navigate(currentFolderKey, true);

            exports.populateFolderView(); // Syncing may have caused a few files to change
        });

        listingIsLoading = true;

        if (!firstLoad) {
            subElements.render();
        }

        firstLoad = false;
    };

    exports.setSettingAndRepopulate = function(setting, data) {
        config.setSetting(setting, data);

        exports.populateFolderView();
    }

    subElements.ready(function() {
        exports.reload();

        thumbnails.startThemeDetection(function() {
            exports.populateFolderView();
        });

        setInterval(function() {
            exports.performLiveRefresh().then(function(refreshed) {
                if (refreshed) {
                    console.log("Live refresh performed");
                } else {
                    console.log("Live refresh cancelled");
                }
            });
        }, LIVE_REFRESH_INTERVAL);

        setInterval(function() {
            subElements.render(document.querySelector("#progressInfo"));

            if (
                fs.getFileOperationsQueueProgress().bytesTotal > 0 &&
                fs.getFileOperationsQueueProgress().bytesProgress == fs.getFileOperationsQueueProgress().bytesTotal &&
                !cleanUpDelayStarted
            ) {
                cleanUpDelayStarted = true;

                setTimeout(function() {
                    fs.cleanUpFileOperationsQueue();

                    cleanUpDelayStarted = false;
                }, POST_UPLOAD_CLEANUP_DELAY);
            }
        }, OPERATIONS_PROGRESS_INFO_UPDATE);

        document.querySelector("#mobileMenuButton").addEventListener("click", function(event) {
            menus.toggleMenu(document.querySelector("#mobileMenu"), elements.findAncestor(event.target, "button"));
        });

        document.querySelectorAll("#accountButton, #mobileAccountButton").forEach(function(element) {
            element.addEventListener("click", function(event) {
                menus.toggleMenu(document.querySelector("#accountsMenu"), event.target);
            });
        });

        document.querySelector("#addAccountButton").addEventListener("click", function() {
            window.location.href = profiles.ADD_PROFILE_REDIRECT_URL;
        });

        document.querySelector("#backButton").addEventListener("click", function() {
            exports.goBack();
        });

        document.querySelector("#forwardButton").addEventListener("click", function() {
            exports.goForward();
        });

        document.querySelectorAll("#newButton, #mobileNewButton").forEach(function(element) {
            element.addEventListener("click", function(event) {
                menus.toggleMenu(document.querySelector("#newMenu"), elements.findAncestor(event.target, "button"), true);
            });
        });

        document.querySelector("#createFolderButton").addEventListener("click", function() {
            var newFolderKey;

            fs.createFolder(exports.findNextAvailableName(_("newFolderName")), currentFolderKey).then(function(key) {
                newFolderKey = key;
    
                return exports.populateFolderView(currentFolderKey, true);
            }).then(function() {
                exports.selectItemForRenaming(newFolderKey);
            });
        });

        document.querySelectorAll("#uploadButton, #mobileUploadButton").forEach(function(element) {
            element.addEventListener("click", function() {
                document.querySelector("#fileUpload").value = ""; // Clear first to allow for repeatedly uploading same file

                document.querySelector("#fileUpload").click();
            });
        });

        document.querySelector("#downloadButton").addEventListener("click", function() {
            exports.downloadSelectedItems();
        });

        document.querySelectorAll("#viewMenuButton, #mobileViewMenuButton").forEach(function(element) {
            element.addEventListener("click", function(event) {
                menus.toggleMenu(document.querySelector("#viewMenu"), elements.findAncestor(event.target, "button"), true);
            });
        });

        document.querySelector("#viewOfflineRetryButton").addEventListener("click", function() {
            exports.populateFolderView(currentFolderKey, true);
        });

        elements.attachSelectorEvent("click", "#accountsMenuList button", function(element) {
            var token = element.getAttribute("data-token");

            if (!profiles.listProfiles().includes(token)) {
                return;
            }

            profiles.setSelectedProfileToken(token);

            setTimeout(function() {
                exports.reload();
            }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500);
        });

        elements.attachSelectorEvent("contextmenu", "#currentFolderView", function(element, event) {
            if (event.target != element) {
                return;
            }
    
            menus.toggleContextMenu(document.querySelector("#viewContextMenu"), element);
        });

        elements.attachSelectorEvent("contextmenu", "#currentFolderView li", function(element) {
            if (element.getAttribute("aria-selected") != "true") {
                views.selectListItem(element, views.selectionModes.SINGLE);
            }

            menus.toggleContextMenu(document.querySelector("#itemContextMenu"), element);
        });

        document.querySelector("#fileUpload").addEventListener("change", function() {
            exports.uploadChosenFiles();
        });
    });
});