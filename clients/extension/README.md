# Nutag browser companion

This is one standards-based WebExtension source for Chrome, Edge, and Firefox. It signs into the Nutag Supabase project and records the same demo connection state as the web and mobile clients.

## Test it locally

- **Chrome / Edge:** open `chrome://extensions` or `edge://extensions`, enable Developer mode, select **Load unpacked**, then choose this folder.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, then select `manifest.json` in this folder.

It has only `storage` permission plus access to the Nutag Supabase endpoint. It does not inspect web pages or route browser traffic.

Safari uses the same WebExtension model but must be wrapped and signed in Xcode when the Apple distribution account is ready.
