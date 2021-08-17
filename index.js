/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.index", function(exports) {
    var subElements = require("com.subnodal.subelements");
    var elements = require("com.subnodal.subui.elements");
    var menus = require("com.subnodal.subui.menus");

    var profiles = require("com.subnodal.cloud.profiles");
    var resources = require("com.subnodal.cloud.resources");
    var fs = require("com.subnodal.cloud.fs");

    var accounts = {};
    var currentFolderKey = null;
    var currentListing = [];

    window.index = exports;
    window.profiles = profiles;

    exports.getAccounts = function() {
        return accounts;
    };

    exports.getCurrentListing = function() {
        return currentListing;
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

        fs.listFolder(key).then(function(listing) {
            currentListing = listing;

            subElements.render();
        });
    };

    exports.reload = function() {
        exports.populateAccounts();
    };

    subElements.ready(function() {
        exports.reload();

        document.querySelector("#mobileMenuButton").addEventListener("click", function(event) {
            menus.toggleMenu(document.querySelector("#mobileMenu"), event.target);
        });

        document.querySelector("#mobileAccountButton").addEventListener("click", function(event) {
            menus.toggleMenu(document.querySelector("#accountsMenu"), event.target);
        });

        document.querySelector("#accountButton").addEventListener("click", function(event) {
            menus.toggleMenu(document.querySelector("#accountsMenu"), event.target);
        });

        document.querySelector("#addAccountButton").addEventListener("click", function() {
            window.location.href = profiles.ADD_PROFILE_REDIRECT_URL;
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
            currentFolderKey = key;

            exports.populateFolderView();
        });
    });
});