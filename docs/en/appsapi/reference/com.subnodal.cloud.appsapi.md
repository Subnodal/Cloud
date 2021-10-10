# com.subnodal.cloud.appsapi
## ▶️ `init`
`function` · Initialise the Cloud Apps API. Once initialised, `ready` callbacks will be called.


Available options are:
* `rootElement`: The element to append the Cloud Apps API Bridge
  iframe to to allow for communications between the target app and
  API.

**Parameters:**
* **`options`** (`Object` = `{}`): The options to specify when initialising the Cloud Apps API

## ▶️ `ready`
`function` · Call the given callback when the Cloud Apps API is ready to be used.

**Parameters:**
* **`callback`** (`Function`): The callback to call when ready