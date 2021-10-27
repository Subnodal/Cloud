/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.appsapi.internal", function(exports) {
    var appsApi = require("com.subnodal.cloud.appsapi");

    exports.configGetSetting = function(setting, requiredType = null, fallback = null) {
        return appsApi.sendBridgeEventDescriptor("configGetSetting", {setting}).then(function(result) {
            if (requiredType != null && typeof(result.data) != requiredType) {
                return Promise.resolve({
                    status: "ok",
                    result: "fallback",
                    data: fallback
                });
            }

            return Promise.resolve(result);
        });
    };

    exports.configSetSetting = function(setting, data) {
        return appsApi.sendBridgeEventDescriptor("configSetSetting", {setting, data});
    };
});