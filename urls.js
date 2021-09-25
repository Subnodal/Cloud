/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.urls", function(exports) {
    var core = require("com.subnodal.subelements.core");

    function normaliseArray(array) {
        return array.map((item) => item.trim()).filter((item) => item != "");
    }

    exports.encodeItems = function(items, cut = false, cutFrom = null) {
        var itemsValue = items.map((key) => encodeURIComponent(key)).join(",");

        return `${window.location.href.split("?")[0]}?action=open&items=${itemsValue}&cut=${cut ? "true&cutFrom=" + encodeURIComponent(cutFrom) : "false"}`;
    };

    exports.encodeSelection = function(items, path) {
        var itemsValue = items.map((key) => encodeURIComponent(key)).join(",");
        var pathValue = path.map((key) => encodeURIComponent(key)).join(",");

        return `${window.location.href.split("?")[0]}?action=select&items=${itemsValue}&path=${pathValue}`;
    };

    exports.isCloudUrl = function(url = window.location.href) {
        return !!url.match(new RegExp(`^https?:\\/\\/(?:${window.location.host}|cloud.subnodal.com)\\/`));
    };

    exports.getActionFromUrl = function(url = window.location.href) {
        return core.parameter("action", url) || null;
    };

    exports.getItemsFromUrl = function(url = window.location.href) {
        return {
            items: normaliseArray((core.parameter("items", url) || "").split(",")),
            cut: core.parameter("cut", url) == "true",
            cutFrom: core.parameter("cutFrom", url) || null
        };
    };

    exports.getSelectionFromUrl = function(url = window.location.href) {
        return {
            items: normaliseArray((core.parameter("items", url) || "").split(",")),
            path: normaliseArray((core.parameter("path", url) || "").split(","))
        };
    };
});