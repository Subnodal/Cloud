window.addEventListener("load", function() {
    document.querySelector("#authenticateButton").addEventListener("click", function() {
        document.querySelector("iframe").contentWindow.postMessage({
            eventDescriptor: "ensureAuthentication",
            eventToken: "authenticationTest"
        }, "*");
    });

    window.addEventListener("message", function(event) {
        console.log("Got data:", event.data);
    });
});