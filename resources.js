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

    var shortTermObjectsCache = {};

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

    exports.getObjectCache = function() {
        try {
            return JSON.parse(localStorage.getItem("subnodalCloud_objectCache") || "{}");
        } catch (e) {
            return {};
        }
    };

    exports.setObjectCache = function(data) {
        localStorage.setItem("subnodalCloud_objectCache", JSON.stringify(data));
    };

    exports.setObjectCacheItem = function(key, data) {
        var cache = exports.getObjectCache();

        cache[key] = data;
        shortTermObjectsCache[key] = data;

        exports.setObjectCache(cache);

        console.log(`Cached object ${key}`);
    };

    exports.getOfflineUpdatedObjectsQueue = function() {
        try {
            return JSON.parse(localStorage.getItem("subnodalCloud_offlineUpdatedObjectsQueue") || "[]");
        } catch (e) {
            return [];
        }
    };

    exports.addOfflineUpdatedObjectToQueue = function(key) {
        localStorage.setItem("subnodalCloud_offlineUpdatedObjectsQueue", JSON.stringify([...exports.getOfflineUpdatedObjects, key]));

        console.log(`Added offline updated object queue for key ${key}`);
    };

    exports.clearOfflineUpdatedObjectsQueue = function() {
        localStorage.setItem("subnodalCloud_offlineUpdatedObjectsQueue", "[]");

        console.log("Cleared offline updated object queue");
    };

    exports.syncOfflineUpdatedObjects = function(token = profiles.getSelectedProfileToken()) {
        console.log("Syncing objects...");

        return Promise.all(exports.getOfflineUpdatedObjectsQueue().map(function(key) {
            var cachedObject = exports.getObjectCache()[key];

            return exports.getObject(key).then(function(data) {
                if (data != null && data.lastModified < cachedObject.lastModified) {
                    console.log(`Setting updated object ${key}`);

                    return exports.setObject(key, cachedObject, token);
                } else {
                    console.log(`Skipping sync of object ${key} since it's been modified online`);

                    return Promise.resolve(); // Online changes are newer than offline, so don't overwrite
                    // TODO: We might need to merge revisions somehow, which could get tricky
                }
            });
        })).then(function(outcomes) {
            console.log(`Syncing finished! Synced object count: ${outcomes.length}`);

            return exports.clearOfflineUpdatedObjectsQueue(); // All objects have been synced, so job done
        });
    };

    exports.getObject = function(key, preferShortTermCache = false) {
        if (preferShortTermCache && shortTermObjectsCache.hasOwnProperty(key)) {
            console.log(`Cache hit for short term objects cache with object ${key}`);

            return Promise.resolve(shortTermObjectsCache[key]);
        } else if (preferShortTermCache) {
            console.log(`Cache miss for short term objects cache with object ${key}`);
        }

        if (!navigator.onLine) {
            return Promise.resolve(exports.getObjectCache()[key] || null);
        }

        return new Promise(function(resolve, reject) {
            firebase.database().ref("objects/" + key + "/_payload").once("value", function(snapshot) {
                exports.setObjectCacheItem(key, snapshot.val());

                resolve(snapshot.val());
            })
        });
    };

    exports.setObject = function(key, data, token = profiles.getSelectedProfileToken()) {
        var oldData;

        exports.setObjectCacheItem(key, {...exports(exports.getObjectCache()[key] || {}), ...data});

        if (!navigator.onLine) {
            exports.addOfflineUpdatedObjectToQueue(key); // Can't do it online right now, so leave it for later when we can sync

            return Promise.resolve();
        }

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
        }).then(function() {
            return Promise.resolve(key);
        });
    };

    exports.createObject = function(data, token = profiles.getSelectedProfileToken()) {
        var key = core.generateKey(64);

        return profiles.getUidFromToken().then(function(uid) {
            var permissions = {};

            permissions[uid] = "write";

            if (uid == null) {
                return Promise.reject("Connect to the internet to create this object"); // Cache miss when getting the UID
            }

            exports.setObjectCacheItem(key, {
                ...data,
                owner: uid, // Hopefully the UID will have been cached by the profiles system from a previous request
                permissions,
                createdAt: new Date().getTime()
            });

            if (!navigator.onLine) {
                exports.addOfflineUpdatedObjectToQueue(key); // Can't do it online right now, so leave it for later when we can sync

                return Promise.resolve();
            }

            return exports.setObject(key, {
                ...data,
                owner: uid,
                permissions,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            }, token);
        });
    };
});