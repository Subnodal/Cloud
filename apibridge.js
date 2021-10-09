/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.apibridge", function(exports) {
    var embed = require("com.subnodal.cloud.embed");

    embed.registerEventDescriptor("ensureAuthentication", function(data, respond) {
        respond({status: "ok", result: "authenticated"});
    }, true);
});