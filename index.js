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

    var profiles = require("com.subnodal.cloud.profiles");
    var resources = require("com.subnodal.cloud.resources");
    var fs = require("com.subnodal.cloud.fs");

    var accounts = {};
    var rootFolderKey = null;
    var currentFolderKey = null;
    var currentPath = [];
    var forwardPath = [];
    var currentListing = [];
    var listingIsLoading = true;

    window.index = exports;
    window.l10n = l10n;
    window.profiles = profiles;

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

    exports.populateFolderView = function(key = currentFolderKey) {
        if (key == null) {
            return;
        }

        listingIsLoading = true;

        subElements.render();

        fs.listFolder(key).then(function(listing) {
            currentListing = listing;
            listingIsLoading = false;

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
                });
            });
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

    exports.goBack = function(toKey = currentPath[currentPath.length - 2].key) {
        if (typeof(toKey) != "string") {
            return; // Tries to find ancestor of root
        }

        while (currentPath[currentPath.length - 1].key != toKey) {
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

    exports.reload = function() {
        exports.populateAccounts();
    };

    subElements.ready(function() {
        exports.reload();

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
            fs.createFolder(`Test ${Math.floor(Math.random() * 1000)}`, currentFolderKey).then(function() {
                exports.populateFolderView();
            });
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

        fs.getRootObjectKeyFromProfile().then(function(key) {
            rootFolderKey = key;
            currentFolderKey = key;

            exports.navigate(currentFolderKey, true);
        });
    });
});