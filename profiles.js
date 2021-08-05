/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.profiles", function(exports) {
    const NO_PROFILES_REDIRECT_URL = "https://accounts.subnodal.com/?platform=cloud";

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

    exports.getSelectedProfile = function() {
        return localStorage.getItem("subnodalCloud_selectedProfile");
    };

    exports.setSelectedProfile = function(token) {
        localStorage.setItem("subnodalCloud_selectedProfile", token);
    };

    exports.setProfile = exports.withProfilesFactory(function(token, data) {
        exports.profiles[token] = data;
    });

    exports.getProfile = function(token) {
        exports.loadProfiles();

        return exports.profiles[token];
    };

    exports.removeProfile = exports.withProfilesFactory(function(token) {
        delete exports.profiles[token];
    });

    exports.listProfiles = function() {
        exports.loadProfiles();

        return Object.keys(exports.profiles);
    };

    exports.checkProfilesState = function() {
        return new Promise(function(resolve, reject) {
            if (Object.keys(exports.listProfiles()).length == 0) {
                window.location.replace(NO_PROFILES_REDIRECT_URL);

                return;
            }

            resolve();
        });
    };
});