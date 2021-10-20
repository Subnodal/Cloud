# com.subnodal.cloud.appsapi
## 🎛️ `CollaborativeDocument`
`class` · The manager for a revision-based document that supports collaboration.

**Parameters:**
* **`defaultData`** (`*`): The default data that serves as the first revision for the document

## 🔡️ `CollaborativeDocument.currentRevision`
`prop <Revision>` · The most recent revision, which contains the current working changes.

## 🔡️ `CollaborativeDocument.data`
`prop <*>` · The data stored in the document, reflective of the document's revisions.


Changes made to this property will be stored in the current
revision. New revisions are made when the document is saved.

## 🔡️ `CollaborativeDocument.dataBeforeChanges`
`prop <*>` · The data stored in the document, excluding the current changes.

## ❄️️ `CollaborativeDocument.deserialise`
`static method` · Convert a given document object into an instance of the `CollaborativeDocument` class.

**Parameters:**
* **`data`** (`{*}`): The document object to deserialise

**Returns:** `CollaborativeDocument` · The new document instance from the given document object

## 🔡️ `CollaborativeDocument.hasUnsavedChanges`
`prop <Boolean>` · Whether the current revision has changes that have not yet been saved.

## 🔡️ `CollaborativeDocument.mergeSettled`
`prop <Boolean>` · Whether the opened version of this document reflects the version of this document before opening. If `true`, then it is necessary to save this document to include all merged changes.

## 🔡️ `CollaborativeDocument.objectKey`
`prop <String | null>` · The object key of the document to save or open with.

## ⏩️ `CollaborativeDocument.open`
`method` · Open the document by its object key and update this document instance with any new changes.

**Parameters:**
* **`key`** (`String` = `this.objectKey`): The object key of the document to open
* **`keepCurrentChanges`** (`Boolean` = `false`): Whether to merge the current revision into the opened document revisions

**Returns:** `Promise` · A `Promise` that is resolved with the opened document's data (including current changes, if chosen) when the document has been opened

## 🔡️ `CollaborativeDocument.previousRevision`
`prop <Revision>` · The revision before the most recent revision.

## ❄️️ `CollaborativeDocument.readRevisionData`
`static method` · Read the contents of a document given by its object key and get the resulting document object.

**Parameters:**
* **`key`** (`String`): The object key of the document to read from

**Returns:** `Promise` · A `Promise` that is resolved with the resulting document object

## 🔡️ `CollaborativeDocument.revisions`
`prop <[Revision]>` · All of the revisions stored under this document.

## ⏩️ `CollaborativeDocument.save`
`method` · Save the revisions of this document instance into a document by its object key.

**Parameters:**
* **`key`** (`String` = `this.objectKey`): The object key of the document to save

**Returns:** `Promise` · A `Promise` that is resolved when the document has been saved

## ⏩️ `CollaborativeDocument.serialise`
`method` · Convert this document into a document object.

**Returns:** `{*}` · The serialised document

## 🎛️ `Revision`
`class` · A single revision, containing diffed data changes.

**Parameters:**
* **`author`** (`String | null` = `null`): The UID of the author, or `null` if not yet apparent
* **`lastModified`** (`Date` = `new Date()`): The default date at which the revision was last modified

## ⏩️ `Revision.applyData`
`method` · Apply the changes in this revision to the given data.

**Parameters:**
* **`current`** (`*`): The data to use as a basis for applying the changes under this revision

**Returns:** `*` · The resulting data from applying the changes to the base data

## ⏩️ `Revision.assignData`
`method` · Find the diff of two data versions and store the changes in this revision.

**Parameters:**
* **`current`** (`*`): The previous data that was in place before this revision
* **`incoming`** (`*`): The new data that is to be tracked under this revision

## 🔡️ `Revision.author`
`prop <String | null>` · The UID of the author, or `null` if not yet apparent

## 🔡️ `Revision.changes`
`prop <[{path: [String], data: *}]>` · A list of changes that have occurred in this revision

## ❄️️ `Revision.deserialise`
`static method` · Convert a given revision object into an instance of the `Revision` class.

**Parameters:**
* **`timestamp`** (`Number`): The timestamp to apply to the revision instance
* **`data`** (`{*}`): The revision object to deserialise

**Returns:** `CollaborativeDocument` · The new revision instance from the given revision object

## 🔡️ `Revision.lastModified`
`prop <Date>` · The date at which the revision was last modified

## ⏩️ `Revision.serialise`
`method` · Convert this revision into a revision object.

**Returns:** `{*}` · The serialised revision

## 🔡️ `Revision.timestamp`
`prop <Number>` · The timestamp at which the revision was last modified.


This is usually used as the key in an object containing
revisions.

## ▶️ `getUid`
`function` · Get the currently signed-in user's unique identifier.

**Returns:** `Promise` · A `Promise` that is resolved as an object with the user's unique identifier string as key `uid`

## ▶️ `init`
`function` · Initialise the Cloud Apps API. Once initialised, `ready` callbacks will be called.


Available options are:
* `rootElement`: The element to append the Cloud Apps API Bridge
  iframe to to allow for communications between the target app and
  API.
* `appName`: An object containing locale translations for the target
  app's name.
* `fallbackLocaleCode` The locale code to use when the current
  locale is not supported by the target app.
* `associations`: An array of objects that represent file
  associations:
  - `extension`: The file extension to associate with.
  - `documentTypeName`: An object containing locale translations for
    the association's document type name (such as
    `"Text document"`).
  - `thumbnailUrl`: The URL to the thumbnail to use in Subnodal
    Cloud to represent the file association.
* `openUrl`: The URL to redirect to when a file is opened.
  `{objectKey}` is substituted with the object key of the file to
  open.

**Parameters:**
* **`options`** (`Object` = `{}`): The options to specify when initialising the Cloud Apps API

## ▶️ `readFile`
`function` · Read the data from a file with a given object key.

**Parameters:**
* **`key`** (`String`): The object key of the file to read from

**Returns:** `Promise` · A `Promise` that is resolved as an object with the read data as key `data`, in `ArrayBuffer` form

## ▶️ `ready`
`function` · Call the given callback when the Cloud Apps API is ready to be used.

**Parameters:**
* **`callback`** (`Function`): The callback to call when ready

## ▶️ `showOpenFileDialog`
`function` · Present the open file dialog to the user so that they can choose a file to open.

**Parameters:**
* **`filterExtensions`** (`[String] | null` = `manifest.associations*.extension | null`): An array of extensions to only list the files of. Will list all files if `null`

**Returns:** `Promise` · A `Promise` that is resolved as an object with the selected file's object key as key `key`

## ▶️ `showSaveFileDialog`
`function` · Present the save file dialog to the user so that they can choose a folder to save their file to and a filename to save their file as.

**Parameters:**
* **`defaultName`** (`String | undefined`): The default filename to populate if no filename is chosen (is the localised version of "Untitled" if argument isn't specified)

**Returns:** `Promise` · A `Promise` that is resolved as an object with the newly-created file's object key as key `key`

## ▶️ `writeFile`
`function` · Write data to a file with a given object key.

**Parameters:**
* **`key`** (`String`): The object key of the file to write to
* **`data`** (`ArrayBuffer | TypedArray | String | *`): The data to write; an `ArrayBuffer` is preferred, but typed arrays are accepted, and so are strings (other objects will be converted to strings)

**Returns:** `Promise` · A `Promise` that is resolved when the data has been written to the file