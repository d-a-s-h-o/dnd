### Installation

- Copy the directory containing this README to `%appdata%/../Local/FoundryVTT/Data/modules`
- Restart Foundry
- In Foundry, go to the "Settings" ("?") tab, click "Manage Modules," and enable "Plutonium." Be sure to save the changes by clicking "Update Modules."

### Rivet

A companion browser extension, "Rivet," is available on the [Chrome](https://chrome.google.com/webstore/detail/rivet/igmilfmbmkmpkjjgoabaagaoohhhbjde) and [Firefox](https://addons.mozilla.org/en-GB/firefox/addon/rivet/) web stores. With Rivet, you can one-click import content (notably creatures as a GM, or spells as a player) when browsing 5etools.

### Server-Side Modding

_**Note: Local/dedicated installs only!** You cannot use this with hosting services such as Forge. Turn back now._

Plutonium comes with a server-side mod to enable mass-downloading via the built-in Art Browser. To install this:

- Find Foundry's `main.js` file in:
   - If you installed "for current user only" on Windows: `%appdata%/../Local/Programs/FoundryVTT/resources/app`
   - If you installed "for all users" on Windows: `Program Files/FoundryVTT/resources/app`
- Edit the file, changing the final line from:
```js
require("init")(process.argv, global.paths, startupMessages);
```

to

```js
// Foundry 0.6.x
require("init")(process.argv, global.paths, initLogging)
	.then(() => require("plutonium-backend.js").init());

// ===========================================================

// Foundry 0.7.x
require("init")(process.argv, global.paths, startupMessages)
	.then(() => require("plutonium-backend.js").init());
```
- Copy the `plutonium-backend.js` file from `server/<your Foundry version>/` to the folder containing `main.js`
- Launch Foundry, and pray that nothing explodes. If everything is working, the in-game Foundry logo (in the top-left of the screen) will show the running Plutonium backend version.
