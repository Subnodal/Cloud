/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.profiles", function(exports) {
    var resources = require("com.subnodal.cloud.resources");
    var urls = require("com.subnodal.cloud.urls");

    exports.PROFILE_VERSION = 0;
    exports.COMPLETE_REDIRECT_URL = "/";
    exports.SETUP_REDIRECT_URL = "/setup.html";
    exports.NO_PROFILES_REDIRECT_URL = "https://accounts.subnodal.com/?platform=cloud";
    exports.ADD_PROFILE_REDIRECT_URL = "https://accounts.subnodal.com/?platform=cloud&switchAccounts=true";

    exports.profiles = {};

    exports.saveProfiles = function() {
        localStorage.setItem("subnodalCloud_profiles", JSON.stringify(exports.profiles));
    };

    exports.loadProfiles = function() {
        var profilesJson = localStorage.getItem("subnodalCloud_profiles");

        if (profilesJson == null) {
            return;
        }

        try {
            exports.profiles = JSON.parse(profilesJson);
        } catch (e) {
            console.warn("Could not decode profiles; data is not in JSON format");
        }
    };

    exports.withProfiles = function(payload) {
        exports.loadProfiles();
        payload();
        exports.saveProfiles();
    };

    exports.withProfilesFactory = function(callback) {
        return function() {
            exports.withProfiles(() => callback(...arguments));
        };
    };

    exports.getSelectedProfileToken = function() {
        if (profiles.isGuestMode()) {
            throw new Error("In guest mode, and so no profile exists");
        }

        return localStorage.getItem("subnodalCloud_selectedProfile");
    };

    exports.setSelectedProfileToken = function(token) {
        if (token == null) {
            localStorage.removeItem("subnodalCloud_selectedProfile");

            return;
        }

        localStorage.setItem("subnodalCloud_selectedProfile", token);
    };

    exports.setProfile = exports.withProfilesFactory(function(token, data) {
        if (token == null) {
            return;
        }

        exports.profiles[token] = data;
    });

    exports.getProfile = function(token) {
        exports.loadProfiles();

        return exports.profiles[token];
    };

    exports.removeProfile = function(token) {
        exports.loadProfiles();

        delete exports.profiles[token];

        exports.saveProfiles();

        if (exports.getSelectedProfileToken() == token) {
            exports.setSelectedProfileToken(exports.listProfiles()[0] || null);
        }
    };

    exports.listProfiles = function() {
        exports.loadProfiles();

        return Object.keys(exports.profiles);
    };

    exports.isGuestMode = function() {
        return exports.listProfiles().length == 0;
    };

    exports.getUidFromToken = function(token) {
        return new Promise(function(resolve, reject) {
            var uid = exports.getProfile(token);

            if (typeof(uid) != "string") {
                return resources.getProfileInfo(token).then(function(info) {
                    resolve(info?.uid || null);
                });
            }

            resolve(uid);
        });
    };

    exports.checkProfilesState = function() {
        return new Promise(function(resolve, reject) {
            if (urls.getActionFromUrl() == "open") {
                resolve(true);

                return;
            }

            if (Object.keys(exports.listProfiles()).length == 0) {
                window.location.replace(exports.NO_PROFILES_REDIRECT_URL);

                resolve(false);

                return;
            }

            resolve(true);
        });
    };

    exports.checkCurrentProfileState = function() {
        if (exports.isGuestMode()) {
            return Promise.resolve(true);
        }

        return resources.getProfileInfo().then(function(data) {
            if (urls.getActionFromUrl() == "open") {
                return Promise.resolve(true);
            }

            if (typeof(data?.name) != "string") {
                window.location.replace("/setup.html");

                return Promise.resolve(false);
            }

            return Promise.resolve(true);
        });
    };
});