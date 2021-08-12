/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.index", function(exports) {
    var subElements = require("com.subnodal.subelements");
    var menus = require("com.subnodal.subui.menus");

    var profiles = require("com.subnodal.cloud.profiles");
    var resources = require("com.subnodal.cloud.resources");

    exports.populateAccountsMenu = function() {
        var tokens = profiles.listProfiles();

        Promise.all(tokens.map(function(token) {
            return resources.getProfileInfo(token);
        })).then(function(profilesData) {
            document.querySelector("#accountsMenuList").innerHTML = "";

            for (var i = 0; i < tokens.length; i++) {
                var accountEntry = document.createElement("button");
                var accountSelectedIcon = document.createElement("sui-icon");
                var accountProfileName = document.createElement("strong");
                var accountProfileEmail = document.createElement("span");

                if (tokens[i] == profiles.getSelectedProfileToken()) {
                    accountSelectedIcon.textContent = "done";
                }

                accountProfileName.textContent = profilesData[i].name;
                accountProfileEmail.textContent = profilesData[i].email;

                accountEntry.appendChild(accountSelectedIcon);
                accountEntry.appendChild(document.createTextNode(" "));
                accountEntry.appendChild(accountProfileName);
                accountEntry.appendChild(document.createElement("br"));
                accountEntry.appendChild(document.createElement("sui-icon"));
                accountEntry.appendChild(document.createTextNode(" "));
                accountEntry.appendChild(accountProfileEmail);

                (function(i) {
                    accountEntry.addEventListener("click", function() {
                        profiles.setSelectedProfileToken(tokens[i]);
    
                        exports.populateAccountsMenu();
                    });
                })(i);

                document.querySelector("#accountsMenuList").appendChild(accountEntry);
            }
        });
    };

    subElements.ready(function() {
        exports.populateAccountsMenu();

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
    });
});