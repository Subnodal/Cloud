/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.cloud.folderviews", function(exports) {
    var subElements = require("com.subnodal.subelements");
    var views = require("com.subnodal.subui.views");

    var resources = require("com.subnodal.cloud.resources");
    var config = require("com.subnodal.cloud.config");
    var fs = require("com.subnodal.cloud.fs");

    exports.FolderView = class {
        constructor(viewElement, containerElement = null) {
            this.viewElement = viewElement;
            this.containerElement = containerElement;

            this.listingIsLoading = false;
            this.dataUnavailableWhileOffline = false;
            this.dataNotFound = false;
            this.path = [];
            this.listing = [];

            this.sortBy = config.getSetting("cloud_sortBy", "number", fs.sortByAttributes.NAME);
            this.sortReverse = config.getSetting("cloud_sortReverse", "boolean", false);
            this.separateFolders = config.getSetting("cloud_separateFolders", "boolean", true);
        }

        get currentFolderKey() {
            return this.path[this.path.length - 1]?.key || null;
        }

        get isAvailable() {
            return !this.listingIsLoading && !this.dataUnavailableWhileOffline && !this.dataNotFound;
        }

        get isUnavailable() {
            return !this.getListingIsLoading && (this.dataUnavailableWhileOffline || this.dataNotFound);
        }

        render() {
            subElements.render(this.containerElement || this.viewElement);
        }

        getItemFromListing(key) {
            for (var i = 0; i < this.listing.length; i++) {
                if (this.listing[i].key == key) {
                    return this.listing[i];
                }
            }
    
            return null;
        };

        handleFileOpen(item) {}

        handleFileSelect(item) {}

        attachListItemOpenEvents() {
            var thisScope = this;

            this.viewElement.querySelectorAll("li").forEach(function(listItem) {
                views.attachListItemOpenEvent(listItem, function() {
                    var item = thisScope.getItemFromListing(listItem.getAttribute("data-key"));
        
                    if (item == null) {
                        return;
                    }
        
                    if (item.type == "folder") {
                        thisScope.navigate(item.key).then(function() {
                            thisScope.viewElement.querySelector("li")?.focus();
                        });
        
                        return;
                    }

                    thisScope.handleFileOpen(item);
                });
            });
        }

        populate(key = this.currentFolderKey) {
            var thisScope = this;

            if (typeof(key) != "string") {
                return;
            }

            views.deselectList(this.viewElement);

            this.listingIsLoading = true;

            this.render()

            if (!navigator.onLine && !resources.getObjectCache().hasOwnProperty(key)) {
                this.listingIsLoading = false;
                this.dataUnavailableWhileOffline = true;

                this.render()

                return Promise.reject("Data unavailable while offline");
            } else {
                this.dataUnavailableWhileOffline = false;
            }

            return fs.listFolder(key, this.sortBy, this.sortReverse, this.separateFolders).then(function(listing) {
                thisScope.loading = false;

                if (listing == null) {
                    thisScope.dataNotFound = true;

                    thisScope.render();

                    return Promise.reject("Data not found");
                }

                thisScope.listing = listing;
                thisScope.listingIsLoading = false;
                thisScope.dataUnavailableWhileOffline = false;
                thisScope.dataNotFound = false;

                thisScope.render();

                thisScope.attachListItemOpenEvents();

                return Promise.resolve(listing);
            });
        }

        navigate(key, replaceRoot = false) {
            var thisScope = this;

            if (replaceRoot) {
                this.path = [];
            }

            this.listingIsLoading = true;

            this.render();
    
            return resources.getObject(key).then(function(data) {
                if (thisScope.path[thisScope.path.length - 1]?.key != key) {
                    thisScope.path.push({...data, key});
                }

                return thisScope.populate(key);
            });
        }

        goBack(toKey = this.path[this.path.length - 2]?.key) {    
            var thisScope = this;

            if (typeof(toKey) != "string") {
                return; // Tries to find ancestor of root
            }
    
            while (this.currentFolderKey != toKey) {
                this.path.pop();
    
                if (this.path.length <= 1) {
                    break;
                }
            }
    
            return thisScope.populate(toKey);
        };
    };
});