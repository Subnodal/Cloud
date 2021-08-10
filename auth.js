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

    exports.processProfile = function(uid, token) {
        return resources.getProfileInfo(token).then(function(data) {
            profiles.setSelectedProfileToken(token);

            if (data == null) {
                profiles.setProfile(token, {
                    version: profiles.PROFILE_VERSION,
                    uid,
                    lastSelected: new Date().getTime()
                });

                window.location.replace(SETUP_REDIRECT_URL);

                return;
            }

            profiles.setProfile(token, {
                ...data,
                version: profiles.PROFILE_VERSION,
                uid,
                lastSelected: new Date().getTime()
            });

            return Promise.resolve();
        });
    };

    if (core.parameter("uid") == null || core.parameter("token") == null) {
        window.location.replace(profiles.NO_PROFILES_REDIRECT_URL);
    }

    exports.processProfile(core.parameter("uid"), core.parameter("token")).then(function() {
        window.location.replace(COMPLETE_REDIRECT_URL);
    });
});