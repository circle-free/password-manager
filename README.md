# DecentPass

A decentralized password manager as a TypeScript, React, Webpack, Chrome Extension. Similar to other password manager extensions, except no passwords (salted and/or hashed and/or otherwise) are stored anywhere. Not in the cloud. Not on the blockchain. Not even locally. They are all deterministically generated from a master password you will choose and your primary MetaMask account. It's like BIP32 for your online passwords. The Ethereum blockchain (via your MetaMask extension) is just used to store password indices, which allows this extension to recall where it left for a given domain and username. That's it.

Is this more secure that using Google/Chrome's password manager, or an alternative extension? No. But it's less prone to loss of data. See, if the place where any of your passwords , metadata, or indices (encrypted or otherwise) is lost, so are your passwords. With this extension, since the only platform used is decentralized (the Ethereum blockchain), this entire solution is decentralized. There is no other service or backend. Just the open-source code for this extension that runs in your browser, and the Ethereum blockchain.

## Caveat
For the time being, you cannot change your master password since all your passwords are derived from it, similar to how you can't change your mnemonic for the HD crypto wallet. A more user-friendly half-solution will come shortly but for now, this is the limitation.

## Project Status
This is beta. It will not work on every site, and it uses Ethereum's testnet (Ropsten), as the single contract needed has not been deployed to mainnnet. Use at your own risk, and feel free to contribute.

Documentation and rationale for how and why this all works, specifically, and the security considerations (i.e. how this extension protects the "extended keys" from leaking to the content scripts, and thus, to the pages themselves) are coming.

## Get started

Clone this repository, and then, in this directory:

1. `npm install`
2. `npx webpack` or `npm run build`

The unpacked Chrome extension will be compiled into `dist/`. It can be loaded into Chrome by enabling developer mode on the "Extensions" page, hitting "Load unpacked", and selecting the `dist/` folder. Pack the extension into a `.crx` by using the "Pack extension" button on the same page.

Use `npx webpack` or `npm run build` to recompile after editing.

## Source layout

The default source layout:

```
src
├── app
│   ├── background.ts
│   └── content.ts
├── styles
│   └── popup.css
└── ui
    └── popup.tsx
```

* `background.ts` will get loaded as the extension background script, and will run persistently in the background
* `content.ts` will be injected into the URLs matched by `dist/manifest.json`'s `matches` entry (see [Match Patterns](https://developer.chrome.com/extensions/match_patterns) documentation)
* `popup.tsx` will become the extension's "browser action" popup
    * NOTE: `popup.tsx` compiles into `dist/js/popup.js`. It is loaded into `dist/popup.html` by an explicit `<script>` tag on that page. `dist/popup.html` is static and is not automatically generated by the build process.
* `popup.css` contains styles for the popup. These styles are loaded with `style-loader` via the `import` line at the top of `popup.tsx` (and directly injected into the popup via JavaScript)

## Dist layout

```
dist
├── _locales
│   └── en
│       └── messages.json
├── icons
│   ├── icon128.png
│   ├── icon16.png
│   ├── icon19.png
│   └── icon48.png
├── js
│   ├── background.js
│   ├── content.js
│   └── popup.js
├── manifest.json
└── popup.html
```

`dist` contains the Chrome extension. `js/*` contents will be regenerated by `webpack`, but the rest of the contents of `dist` will not.

## Notes

* If changes are made to the CSS, the newly built extension will fail to load styles for the popup due to a mistmatch in the stylesheet's checksum with that listed in the `manifest.json`. This is expected as part of Content Security Policies. Once the newly built extension is loaded into Chrome, right-click on the extension icon in the toolbar, and select `Inspect Popup`. The extension's popup will open, as well as a developer console which will likely have the related stylesheet content security policy injection error. Copy the checksum from the error and paste it over the second checksum in the `content_security_policy` field of the `manifest.json`. Rebuild the extension and reload it in Chrome.