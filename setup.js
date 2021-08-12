/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.setup", function(exports) {
    var subElements = require("com.subnodal.subelements");
    var dialogs = require("com.subnodal.subui.dialogs");

    var resources = require("com.subnodal.cloud.resources");
    var profiles = require("com.subnodal.cloud.profiles");

    var loadingState = false;

    window.setup = exports;

    exports.isLoading = function() {
        return loadingState;
    };

    exports.submit = function(name = document.querySelector("#nameInput").value) {
        if (name.trim() == "") {
            document.querySelector("#error").textContent = _("setup_nameBlankError");

            return;
        }

        loadingState = true;

        subElements.render();

        resources.setProfileInfo({name: name.trim()}).then(function() {
            window.location.replace(profiles.COMPLETE_REDIRECT_URL);
        }).catch(function(error) {
            console.error(error);

            loadingState = false;

            subElements.render();

            document.querySelector("#error").textContent = _("setup_connectionError");
        });
    };

    subElements.ready(function() {
        document.querySelector("#doneButton").addEventListener("click", function() {
            exports.submit();
        });

        document.querySelector("#nameInput").addEventListener("keydown", function(event) {
            if (event.key == "Enter") {
                exports.submit();
            }
        });

        document.querySelector("#learnMoreButton").addEventListener("click", function() {
            dialogs.open(document.querySelector("#learnMoreDialog"));
        });

        setTimeout(function() {
            document.querySelector("#nameInput").focus();            
        });
    });
});