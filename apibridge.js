/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.apibridge", function(exports) {
    var embed = require("com.subnodal.cloud.embed");

    window.apiBridge = exports;

    var saveOpenRespond = null;
    var saveOpenExtension = null;

    exports.finishSaveOpen = function() {
        if (embed.getSaveOpenFolderView().currentFolderKey == null) {
            return; // Is root folder listing, so cannot save/open there
        }

        if (embed.getSaveOpenIsSave()) {
            var name = document.querySelector("#saveOpenFileName").value.trim();
            var fullName = name + "." + saveOpenExtension;

            if (name == "") {
                return;
            }

            fs.getItemPermissions(embed.getSaveOpenFolderView().currentFolderKey).then(function(permissions) {
                if (!permissions.write) {
                    console.log("No write permission");

                    return; // TODO: Complain
                }

                if (embed.getSaveOpenFolderView().listing.map((item) => item.name).includes(fullName)) {
                    console.log("Name taken");

                    return; // TODO: Complain
                }

                fs.createFile(fullName, embed.getSaveOpenFolderView().currentFolderKey).then(function(key) {
                    saveOpenRespond({
                        status: "ok",
                        result: "selected",
                        key
                    });
                });
            });
        } else {
            var selectedKey = embed.getSaveOpenFolderView().selectedItemKey;

            if (selectedKey == null) {
                return;
            }

            saveOpenRespond({
                status: "ok",
                result: "selected",
                key: selectedKey
            });
        }

        embed.closeDialog(document.querySelector("#saveOpenFileDialog"));
    };

    embed.registerEventDescriptor("ensureAuthentication", function(data, respond) {
        respond({status: "ok", result: "authenticated"});
    }, true);

    function showSaveOpenFileDialog() {
        embed.getSaveOpenFolderView().navigate(embed.getRootObjectKey(), true);
        embed.getSaveOpenFolderView().render();

        return embed.openDialog(document.querySelector("#saveOpenFileDialog"));
    }

    embed.registerEventDescriptor("showSaveFileDialog", function(data, respond) {
        embed.setSaveOpenIsSave(true);

        document.querySelector("#saveOpenFileName").value = data.name || _("untitledName");

        saveOpenRespond = respond;
        saveOpenExtension = data.extension || embed.getManifest().associations[0]?.extension || "txt";

        showSaveOpenFileDialog().then(function() {
            setTimeout(function() {
                document.querySelector("#saveOpenFileName").select();
                document.querySelector("#saveOpenFileName").focus();
            });
        });
    }, true);

    embed.registerEventDescriptor("showOpenFileDialog", function(data, respond) {
        embed.setSaveOpenIsSave(false);

        saveOpenRespond = respond;

        showSaveOpenFileDialog();
    }, true);
});