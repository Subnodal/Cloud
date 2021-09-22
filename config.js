/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.config", function(exports) {
    var resources = require("com.subnodal.cloud.resources");
    var profiles = require("com.subnodal.cloud.profiles");

    exports.data = {};

    exports.getGuestConfig = function() {
        try {
            return JSON.parse(localStorage.getItem("subnodalCloud_guestConfig") || "{}");
        } catch (e) {
            return {};
        }
    };

    exports.setGuestConfig = function(data) {
        localStorage.setItem("subnodalCloud_guestConfig", JSON.stringify(data));
    };

    exports.getSetting = function(setting, requiredType = null, fallback = null) {
        if (!exports.data.hasOwnProperty(setting) || (requiredType != null && typeof(exports.data[setting]) != requiredType)) {
            return fallback;
        }

        return exports.data[setting];
    };

    exports.setSetting = function(setting, data) {
        exports.data[setting] = data; // Set immediately

        if (profiles.isGuestMode()) {
            var guestConfig = exports.getGuestConfig();

            guestConfig = {
                ...guestConfig,
                ...exports.data
            };

            exports.setGuestConfig(guestConfig);

            return;
        }

        resources.getProfileInfo().then(function(oldData) {
            if (typeof(oldData?.config) == "object") {
                exports.data = oldData.config;
            }

            exports.data[setting] = data; // Merge with old data when available

            resources.setProfileInfo({
                config: exports.data
            });
        });
    };

    exports.init = function() {
        if (profiles.isGuestMode()) {
            exports.data = exports.getGuestConfig();

            return;
        }

        resources.getProfileInfo().then(function(data) {
            if (typeof(data?.config) != "object") {
                return;
            }

            exports.data = data.config;
        });
    };
});