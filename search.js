/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.search", function(exports) {
    var resources = require("com.subnodal.cloud.resources");
    var profiles = require("com.subnodal.cloud.profiles");

    exports.RE_MATCH_WORD = /[\u4E00-\u9FCC\u3400-\u4DB5\uFA0E\uFA0F\uFA11\uFA13\uFA14\uFA1F\uFA21\uFA23\uFA24\uFA27-\uFA29]|[\ud840-\ud868][\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|[\ud86a-\ud86c][\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d]|[^ .,:;!?()\[\]\{\}<>/\\&*_||@#~"“”„‟‧…‹›«»。，、！？；：（ ）［］【 】「」﹁﹂《》﹏——～]+/;

    exports.getPhraseTokens = function(phrase) {
        var allTokens = [...phrase.matchAll(new RegExp(exports.RE_MATCH_WORD, "g"))].map((match) => match[0]);
        var tokens = {
            require: [],
            reject: []
        };

        allTokens.forEach(function(token) {
            if (token.startsWith("-")) {
                tokens.reject.push(token);

                return;
            }

            tokens.require.push(token);
        });

        return tokens;
    };

    exports.hashToken = function(token) {
        return CryptoJS.SHA256(token).toString(CryptoJS.enc.Hex).substring(0, 8);
    };

    exports.getPhraseHashes = function(phrase) {
        var tokens = exports.getPhraseTokens(phrase);
        var hashes = {};

        hashes.require = tokens.require.map(exports.hashToken);
        hashes.reject = tokens.reject.map(exports.hashToken);

        return hashes;
    }

    exports.searchForPhrase = function(phrase, token = profiles.getSelectedProfileToken()) {
        var hashes = exports.getPhraseHashes(phrase);

        return Promise.all(hashes.map((hash) => resources.getSearchIndexObjects(hash, token))).then(function(combinedObjects) {
            var candidateObjects = [];

            combinedObjects.forEach(function(objects) {
                objects.forEach(function(object) {
                    var foundCandidateObject = candidateObjects.find((foundObject) => foundObject.key == object.key);

                    if (typeof(foundCandidateObject) == "object") {
                        foundCandidateObject.score += object.score;

                        return;
                    }

                    candidateObjects.push(object);
                });
            });

            return Promise.resolve(candidateObjects.sort((a, b) => a.score - b.score));
        });
    };
});