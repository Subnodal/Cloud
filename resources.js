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

    exports.getSearchIndexCacheObjects = function(hash, token = profiles.getSelectedProfileToken()) {
        var cache = {};

        try {
            cache = JSON.parse(localStorage.getItem("subnodalCloud_searchIndexCache") || "{}");
        } catch (e) {}

        return (cache[token] || {})[hash] || [];
    };

    exports.setSearchIndexCacheObject = function(objectKey, hash, deltaScore, token = profiles.getSelectedProfileToken()) {
        var cache = {};

        try {
            cache = JSON.parse(localStorage.getItem("subnodalCloud_searchIndexCache") || "{}");
        } catch (e) {}

        if (!cache.hasOwnProperty(token)) {
            cache[token] = {};
        }

        if (!cache[token].hasOwnProperty(hash)) {
            cache[token][hash] = [];
        }

        var oldScore = cache[token][hash].find((objectData) => objectData.key == objectKey)?.score || 0;

        cache[token][hash] = cache[token][hash].filter((objectData) => objectData.key != objectKey);

        cache[token][hash].push({
            key: objectKey,
            score: Math.max(oldScore + deltaScore, 0) || undefined
        });

        localStorage.setItem("subnodalCloud_searchIndexCache", JSON.stringify(cache));
    };

    exports.getSearchIndexObjects = function(hash, token = profiles.getSelectedProfileToken()) {
        if (!navigator.onLine) {
            return Promise.resolve(exports.getSearchIndexCacheObjects(hash, token));
        }

        return new Promise(function(resolve, reject) {
            firebase.database().ref("searchIndices/" + token + "/" + hash).once("value", function(snapshot) {
                resolve(snapshot.val() || []);
            });
        });
    };

    exports.setSearchIndexObject = function(objectKey, hash, deltaScore, token = profiles.getSelectedProfileToken()) {
        exports.setSearchIndexCacheObject(objectKey, hash, deltaScore, token);

        if (!navigator.onLine) {
            return Promise.resolve();
        }

        var objects = exports.getSearchIndexCacheObjects(hash, token);

        return firebase.database().ref("searchIndices/" + token + "/" + hash).set(objects);
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
        var queue = exports.getOfflineUpdatedObjectsQueue();

        if (queue.includes(key)) {
            return; // Already queued; so doesn't need to be updated again
        }

        queue.push(key);

        localStorage.setItem("subnodalCloud_offlineUpdatedObjectsQueue", JSON.stringify(queue));

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
                if (data == null || data.lastModified < cachedObject.lastModified) {
                    console.log(`Setting updated object ${key}`);

                    return exports.setObject(key, cachedObject, token);
                } else if (data.type == "folder") {
                    console.log(`Merging updated object ${key} (is folder)`);

                    return exports.setFolderObject(key, cachedObject, token);
                } else {
                    console.log(`Skipping sync of object ${key} since it's been modified online`);

                    return Promise.resolve(); // Online changes are newer than offline, so don't overwrite
                }
            });
        })).then(function(outcomes) {
            console.log(`Syncing finished! Synced object count: ${outcomes.length}`);

            return exports.clearOfflineUpdatedObjectsQueue(); // All objects have been synced, so job done
        });
    };

    exports.clearAllObjectCaches = function() {
        shortTermObjectsCache = {};

        localStorage.setItem("subnodalCloud_objectCache", "{}");
        localStorage.setItem("subnodalCloud_offlineUpdatedObjectsQueue", "[]");
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

        exports.setObjectCacheItem(key, {
            ...(exports.getObjectCache()[key] || {}),
            ...data,
            lastModified: new Date().getTime()
        });

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

    exports.setFolderObject = function(key, data, token = profiles.getSelectedProfileToken()) {
        return exports.getObject(key).then(function(oldData) {
            // We have to merge the folder *contents* to ensure that the folder is up-to-date
            return exports.setObject(key, {
                ...(oldData || {}),
                ...data,
                contents: {
                    ...(oldData?.contents || []),
                    ...(data?.contents || [])
                }
            }, token);
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

                return Promise.resolve(key);
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