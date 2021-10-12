var cloud = require("com.subnodal.cloud.appsapi");

cloud.ready(function() {
    document.querySelector("#authenticateButton").addEventListener("click", function() {
        cloud.sendBridgeEventDescriptor("ensureAuthentication").then(function(response) {
            if (response.status == "ok" && response.result == "authenticated") {
                document.querySelector("#status").textContent = "Authenticated";
            }
        });
    });

    document.querySelector("#saveFileDialogButton").addEventListener("click", function() {
        cloud.showSaveFileDialog().then(function(response) {
            if (response.status == "ok" && response.result == "selected") {
                document.querySelector("#status").textContent = `Selected item to save with key: ${response.key}`;
            }
        });
    });

    document.querySelector("#openFileDialogButton").addEventListener("click", function() {
        cloud.showOpenFileDialog().then(function(response) {
            if (response.status == "ok" && response.result == "selected") {
                document.querySelector("#status").textContent = `Selected item to open with key: ${response.key}`;
            }
        });
    });
});

window.addEventListener("load", function() {
    cloud.init({
        bridgeHostUrl: window.location.origin + "/embed.html",
        namingScheme: {
            "en_GB": "Test app"
        },
        fallbackLocaleCode: "en_GB",
        associations: [
            {
                extension: "test",
                documentTypeName: {
                    "en_GB": "Test document"
                },
                creatable: false
            }
        ]
    });
});