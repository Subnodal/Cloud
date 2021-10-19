# com.subnodal.cloud.appsapi
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