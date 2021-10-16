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
});