/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

// @namespace com.subnodal.cloud.appsapi.revisions
namespace("com.subnodal.cloud.appsapi.revisions", function(exports) {
    exports.merge = function(current, incoming) {
        Object.keys(incoming.revisions).forEach(function(timestamp) {
            current.revisions[timestamp] = incoming.revisions[timestamp];
        });
    };

    exports.deflateObject = function(data) {
        var paths = [];

        if (typeof(data) == "object") {
            Object.keys(data).forEach(function(key) {
                var newPaths = exports.deflateObject(data[key]);

                newPaths.forEach(function(newPath) {
                    paths.push({path: [key, ...newPath.path], data: newPath.data});                    
                });
            });
        } else {
            paths.push({path: [], data});
        }

        return paths;
    };

    exports.inflateObject = function(paths) {
        var object = {};
        var pathGroups = {};

        for (var i = 0; i < paths.length; i++) {
            if (paths[i].path.length == 0) {
                return paths[i].data;
            }

            var pathGroup = paths[i].path[0];
            var pathToAdd = {path: paths[i].path.slice(1), data: paths[i].data};

            if (pathGroups.hasOwnProperty(pathGroup)) {
                pathGroups[pathGroup].push(pathToAdd);
            } else {
                pathGroups[pathGroup] = [pathToAdd];
            }
        }

        Object.keys(pathGroups).forEach(function(pathGroup) {
            object[pathGroup] = exports.inflateObject(pathGroups[pathGroup]);
        });

        return object;
    };

    exports.diffObjectPaths = function(current, incoming) {
        var diff = [];

        current.forEach(function(oldPathData) {
            var oldPathSerialised = JSON.stringify(oldPathData.path);
            var newPathData = incoming.find((pathData) => JSON.stringify(pathData.path) == oldPathSerialised);

            if (newPathData == undefined) {
                diff.push({path: oldPathData.path, remove: true});
            }
        });

        incoming.forEach(function(newPathData) {
            var newPathSerialised = JSON.stringify(newPathData.path);
            var oldPathData = current.find((pathData) => JSON.stringify(pathData.path) == newPathSerialised);

            if (oldPathData != undefined && oldPathData.data == newPathData.data) {
                return;
            }

            diff.push(newPathData);
        });

        return diff;
    };

    exports.applyDiffToObjectPaths = function(current, diff) {
        var applied = [];
        var excludeSerialised = [];

        diff.forEach(function(diffData) {
            if (diffData.remove) {
                excludeSerialised.push(JSON.stringify(diffData.path));
            }
        });

        current.forEach(function(pathData) {
            if (excludeSerialised.includes(JSON.stringify(pathData.path))) {
                return;
            }

            applied.push(pathData);
        });

        diff.forEach(function(diffData) {
            if (diffData.remove) {
                return;
            }

            var diffPathSerialised = JSON.stringify(diffData.path);
            var changeIndex = applied.findIndex((pathData) => JSON.stringify(pathData.path) == diffPathSerialised);

            if (changeIndex >= 0) {
                applied[changeIndex] = diffData;

                return;
            }

            applied.push(diffData);
        });

        return applied;
    };
});