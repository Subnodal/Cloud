var cloud = require("com.subnodal.cloud.appsapi");

cloud.ready(function() {
    document.querySelector("#authenticateButton").addEventListener("click", function() {
        cloud.sendBridgeEventDescriptor("ensureAuthentication").then(function(response) {
            if (response.status == "ok") {
                document.querySelector("#status").textContent = "Authenticated";
            }
        });
    });

    document.querySelector("#saveFileDialogButton").addEventListener("click", function() {
        cloud.showSaveFileDialog().then(function(response) {
            if (response.status == "ok") {
                document.querySelector("#status").textContent = `Selected item to save with key: ${response.key}`;

                return cloud.writeFile(response.key, document.querySelector("#editor").value);
            }

            return Promise.reject(response);
        }).then(function(response) {
            if (response.status == "ok") {
                document.querySelector("#status").textContent = `Successfully written to file`;

                return;
            }

            return Promise.reject(response);
        });
    });

    document.querySelector("#openFileDialogButton").addEventListener("click", function() {
        cloud.showOpenFileDialog().then(function(response) {
            if (response.status == "ok") {
                document.querySelector("#status").textContent = `Selected item to open with key: ${response.key}`;

                return cloud.readFile(response.key);
            }

            return Promise.reject(response);
        }).then(function(response) {
            if (response.status == "ok") {
                document.querySelector("#editor").value = new TextDecoder().decode(response.data);
                document.querySelector("#status").textContent = `Successfully read from file`;

                return;
            }

            return Promise.reject(response);
        });
    });
});

window.addEventListener("load", function() {
    cloud.init({
        bridgeHostUrl: window.location.origin + "/embed.html",
        appName: {
            "en_GB": "Test app"
        },
        fallbackLocaleCode: "en_GB",
        openUrl: "https://cloud.subnodal.com/test/appsapi.html?objectKey={objectKey}",
        associations: [
            {
                extension: "test",
                documentTypeName: {
                    "en_GB": "Test document"
                },
                thumbnailUrl: "https://cloud.subnodal.com/media/icon.svg",
                creatable: false
            }
        ]
    });
});