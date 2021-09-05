/*
    Subnodal Cloud

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://cloud.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

importScripts("/lib/crypto-js.js");

function encrypt(data, encryptionKey) {
    var wordArray = CryptoJS.lib.WordArray.create(data);
    var encrypted = CryptoJS.AES.encrypt(wordArray, encryptionKey).toString();

    return Uint8Array.from(atob(encrypted), (char) => char.charCodeAt(0)).buffer;
}

function decrypt(data, encryptionKey) {
    var encoded = btoa(String.fromCharCode(...new Uint8Array(data)));
    var decrypted = CryptoJS.AES.decrypt(encoded, encryptionKey).toString(CryptoJS.enc.Base64);

    return Uint8Array.from(atob(decrypted), (char) => char.charCodeAt(0)).buffer;
}

self.addEventListener("message", function(event) {
    switch (event.data.operation) {
        case "encrypt":
            self.postMessage({data: encrypt(...event.data.args)});

            break;

        case "decrypt":
            self.postMessage({data: decrypt(...event.data.args)});

            break;
    }
});