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

    Promise.all([
        requests.getJson("/locale/en_GB.json")
    ]).then(function(resources) {
        subElements.init({
            languageResources: {
                "en_GB": resources[0]
            },
            fallbackLocaleCode: "en_GB"
        });

        document.querySelector("title").textContent = _("subnodalCloud");

        if (window.location.pathname != "/auth.html") {
            profiles.checkProfilesState();
        }
    });

    window._ = l10n.translate;
});