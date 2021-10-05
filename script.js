/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud", function(exports) {
    var subElements = require("com.subnodal.subelements");
    var requests = require("com.subnodal.subelements.requests");
    var l10n = require("com.subnodal.subelements.l10n");

    var profiles = require("com.subnodal.cloud.profiles");
    var config = require("com.subnodal.cloud.config");

    var readyCallbacks = [];

    exports.ready = function(callback) {
        readyCallbacks.push(callback);
    };

    Promise.all([
        requests.getJson("/locale/en_GB.json"),
        requests.getJson("/locale/fr_FR.json"),
        requests.getJson("/locale/zh_CN.json")
    ]).then(function(resources) {
        subElements.init({
            languageResources: {
                "en_GB": resources[0],
                "fr_FR": resources[1],
                "zh_CN": resources[2]
            },
            localeCode: localStorage.getItem("subnodalCloud_locale") || null,
            fallbackLocaleCode: "en_GB"
        });

        subElements.ready(function() {
            readyCallbacks.forEach((callback) => callback());
        });

        document.querySelector("title").textContent = _("subnodalCloud");

        if (window.location.pathname != "/authenticate.html") {
            profiles.checkProfilesState().then(function(profileOkay) {
                if (!profileOkay) {
                    return;
                }

                if (window.location.pathname != "/setup.html") {
                    profiles.checkCurrentProfileState();

                    return;
                }

                config.init();
            });
        }
    });

    window._ = l10n.translate;
});