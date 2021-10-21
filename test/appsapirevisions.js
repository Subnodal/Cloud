var core = require("com.subnodal.subelements.core");
var cloud = require("com.subnodal.cloud.appsapi");

var collaborativeDocument = new cloud.CollaborativeDocument();

function getDocumentData() {
    document.querySelector("#editor").innerHTML = "";

    var workingData = collaborativeDocument.data;

    Object.keys(workingData).forEach(function(key) {
        var element = document.createElement("li");
        var input = document.createElement("input");

        element.setAttribute("data-key", key);

        input.value = workingData[key];
        
        element.append(input);
        document.querySelector("#editor").append(element);
    });
}

function setDocumentData() {
    var workingData = {};
    
    document.querySelectorAll("#editor li").forEach(function(element) {
        if (element.querySelector("input").value.trim() == "") {
            element.remove();

            return;
        }

        workingData[element.getAttribute("data-key")] = element.querySelector("input").value;
    });

    collaborativeDocument.data = workingData;
}

cloud.ready(function() {
    document.querySelector("#saveButton").addEventListener("click", function() {
        (function() {
            setDocumentData();

            if (collaborativeDocument.objectKey == null) {
                return cloud.showSaveFileDialog().then(function(response) {
                    if (response.status == "ok") {
                    document.querySelector("#status").textContent = "Saving...";

                        return collaborativeDocument.save(response.key);
                    }
    
                    return Promise.reject(response);
                });
            }

            document.querySelector("#status").textContent = "Saving...";

            return collaborativeDocument.save(collaborativeDocument.objectKey);
        })().then(function() {
            document.querySelector("#status").textContent = "Successfully saved";
        });
    });

    document.querySelector("#openButton").addEventListener("click", function() {
        (function() {
            if (collaborativeDocument.objectKey == null) {
                return cloud.showOpenFileDialog().then(function(response) {
                    if (response.status == "ok") {    
                        document.querySelector("#status").textContent = "Opening...";

                        return collaborativeDocument.open(response.key, true);
                    }
    
                    return Promise.reject(response);
                });
            }

            document.querySelector("#status").textContent = "Opening...";

            return collaborativeDocument.open(collaborativeDocument.objectKey);
        })().then(function() {
            getDocumentData();

            document.querySelector("#status").textContent = "Successfully opened";
        });
    });

    document.querySelector("#addButton").addEventListener("click", function() {
        var element = document.createElement("li");
        var input = document.createElement("input");

        element.setAttribute("data-key", core.generateKey());

        input.value = "";
        
        element.append(input);
        document.querySelector("#editor").append(element);

        input.focus();
    });

    document.querySelector("#getDataButton").addEventListener("click", getDocumentData);
    document.querySelector("#setDataButton").addEventListener("click", setDocumentData);

    if (core.parameter("objectKey") != null) {
        document.querySelector("#status").textContent = "Opening...";

        collaborativeDocument.open(core.parameter("objectKey")).then(function() {
            getDocumentData();

            document.querySelector("#status").textContent = "Successfully opened";
        });
    }
});

window.addEventListener("load", function() {
    cloud.init({
        bridgeHostUrl: window.location.origin + "/embed.html",
        appName: {
            "en_GB": "Test app for revisions"
        },
        fallbackLocaleCode: "en_GB",
        openUrl: "https://cloud.subnodal.com/test/appsapirevisions.html?objectKey={objectKey}",
        associations: [
            {
                extension: "testrev",
                documentTypeName: {
                    "en_GB": "Test collaborative document"
                },
                thumbnailUrl: "https://cloud.subnodal.com/media/icon.svg",
                creatable: false
            }
        ]
    });
});