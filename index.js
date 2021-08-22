/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.index", function(exports) {
    var subElements = require("com.subnodal.subelements");
    var l10n = require("com.subnodal.subelements.l10n");
    var elements = require("com.subnodal.subui.elements");
    var menus = require("com.subnodal.subui.menus");
    var views = require("com.subnodal.subui.views");
    var dialogs = require("com.subnodal.subui.dialogs");

    var profiles = require("com.subnodal.cloud.profiles");
    var resources = require("com.subnodal.cloud.resources");
    var fs = require("com.subnodal.cloud.fs");
    var associations = require("com.subnodal.cloud.associations");
    var thumbnails = require("com.subnodal.cloud.thumbnails");

    const LIVE_REFRESH_INTERVAL = 5 * 1000; // 5 seconds

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

    window.index = exports;
    window.l10n = l10n;
    window.profiles = profiles;
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

        // TODO: Set these args according to user preference (eg. if they want to sort by date)
        return fs.listFolder(key, undefined, false, true, hardRefresh).then(function(listing) {
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

                        exports.navigate(item.key);
        
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

        resources.getObject(key).then(function(data) {
            currentPath.push({...data, key});

            exports.populateFolderView(key);
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

        exports.populateFolderView(toKey);
    };

    exports.goForward = function() {
        if (forwardPath.length == 0) {
            return; // Cannot go forward any further
        }

        exports.navigate(forwardPath.pop().key);
    };

    exports.getItemFromCurrentListing = function(key) {
        for (var i = 0; i < currentListing.length; i++) {
            if (currentListing[i].key == key) {
                return currentListing[i];
            }
        }

        return null;
    };

    exports.nameTaken = function(name, skipKey = null) {
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

    exports.findNextAvailableName = function(originalName, append = "", skipKey = null) {
        var copyNumber = 1;
        var newName = originalName;

        if (!exports.nameTaken(originalName + append, skipKey)) {
            return originalName;
        }

        do {
            copyNumber++;
            newName = _("duplicateDocumentCopyMark", {name: originalName, number: copyNumber}) + append;
        } while (exports.nameTaken(newName, skipKey))

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

            element.querySelector("input").focus();
            element.querySelector("input").select();
        });
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
        exports.populateAccounts();

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

        document.querySelector("#mobileMenuButton").addEventListener("click", function(event) {
            menus.toggleMenu(document.querySelector("#mobileMenu"), event.target);
        });

        document.querySelectorAll("#accountButton, #mobileAccountButton").forEach(function(element) {
            element.addEventListener("click", function(event) {
                menus.toggleMenu(document.querySelector("#accountsMenu"), event.target);
            });
        });

        document.querySelector("#accountButton").addEventListener("click", function(event) {
            menus.toggleMenu(document.querySelector("#accountsMenu"), event.target);
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
    });
});