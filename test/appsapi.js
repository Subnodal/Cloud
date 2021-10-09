var cloud = require("com.subnodal.cloud.appsapi");

cloud.ready(function() {
    document.querySelector("#authenticateButton").addEventListener("click", function() {
        cloud.sendBridgeEventDescriptor("ensureAuthentication").then(function(response) {
            if (response.status == "ok" && response.result == "authenticated") {
                document.querySelector("#status").textContent = "Authenticated";
            }
        });
    });
});

window.addEventListener("load", function() {
    cloud.init({
        bridgeHostUrl: window.location.origin + "/embed.html"
    });
});