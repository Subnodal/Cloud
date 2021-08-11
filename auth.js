/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.auth", function(exports) {
    var core = require("com.subnodal.subelements.core");

    var resources = require("com.subnodal.cloud.resources");
    var profiles = require("com.subnodal.cloud.profiles");

    const COMPLETE_REDIRECT_URL = "/";
    const SETUP_REDIRECT_URL = "/"; // TODO: Add distinct setup page

    exports.processProfile = function(token) {
        return resources.getProfileInfo(token).then(function(data) {
            profiles.setSelectedProfileToken(token);

            if (data == null) {
                profiles.setProfile(token, {
                    version: profiles.PROFILE_VERSION,
                    lastSelected: new Date().getTime()
                });

                window.location.replace(SETUP_REDIRECT_URL);

                return;
            }

            profiles.setProfile(token, {
                ...data,
                version: profiles.PROFILE_VERSION,
                lastSelected: new Date().getTime()
            });

            return Promise.resolve();
        });
    };

    if (core.parameter("token") == null) {
        window.location.replace(profiles.NO_PROFILES_REDIRECT_URL);
    }

    if (core.parameter("locale") != null) {
        localStorage.setItem("subnodalCloud_locale", core.parameter("locale"));
    }

    exports.processProfile(core.parameter("token")).then(function() {
        window.location.replace(COMPLETE_REDIRECT_URL);
    });
});