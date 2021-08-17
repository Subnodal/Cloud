/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.resources", function(exports) {
    var core = require("com.subnodal.subelements.core");

    var profiles = require("com.subnodal.cloud.profiles");

    var firebaseConfig = {
        apiKey: "AIzaSyAcLPA0mVAdC1Hv2zzxSx3FHTvBueJqYPA",
        authDomain: "subnodal-storage.firebaseapp.com",
        databaseURL: "https://subnodal-storage.firebaseio.com",
        projectId: "subnodal-storage",
        storageBucket: "subnodal-storage.appspot.com",
        messagingSenderId: "557010120711",
        appId: "1:557010120711:web:d9ab615282b9c1d4463aa2"
    };

    firebase.initializeApp(firebaseConfig);

    exports.getProfileInfo = function(token = profiles.getSelectedProfileToken()) {
        if (!navigator.onLine) {
            return Promise.resolve(profiles.getProfile(token) || null);
        }

        return new Promise(function(resolve, reject) {
            firebase.database().ref("profiles/" + token).once("value", function(snapshot) {
                profiles.setProfile(snapshot.val());

                resolve(snapshot.val());
            });
        });
    };

    exports.setProfileInfo = function(data, token = profiles.getSelectedProfileToken()) {
        if (!navigator.onLine) {
            return Promise.reject("Connect to the internet to change this information");
        }

        profiles.setProfile(token, {...profiles.getProfile(token), ...data});

        return Promise.all(Object.keys(data).map(function(key) {
            return firebase.database().ref("profiles/" + token + "/" + key).set(data[key]);
        }));
    };

    exports.getObject = function(key) {
        return new Promise(function(resolve, reject) {
            firebase.database().ref("objects/" + key + "/_payload").once("value", function(snapshot) {
                resolve(snapshot.val());
            })
        });
    };

    exports.setObject = function(key, data, token = profiles.getSelectedProfileToken()) {
        var oldData;

        return exports.getObject(key).then(function(receivedOldData) {
            oldData = receivedOldData;

            return profiles.getUidFromToken(token);
        }).then(function(uid) {
            return firebase.database().ref("objects/" + key).set({
                _payload: {
                    ...(oldData || {}),
                    ...data,
                    lastModified: firebase.database.ServerValue.TIMESTAMP
                },
                _meta: {
                    profileToken: token,
                    uid
                }
            });
        });
    };

    exports.createObject = function(data, token = profiles.getSelectedProfileToken()) {
        var key = core.generateKey(64);

        return profiles.getUidFromToken().then(function(uid) {
            var permissions = {};

            permissions[uid] = "write";

            return exports.setObject(key, {
                ...data,
                owner: uid,
                permissions,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            }, token);
        });
    };
});