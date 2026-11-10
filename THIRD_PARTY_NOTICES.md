# Third-Party Notices

This project includes third-party software under terms separate from the
project's MIT License.

## Adobe CEP `CSInterface.js`

- File: `client/CSInterface.js`
- Copyright: Copyright 2020 Adobe Systems Incorporated. All Rights Reserved.
- Source: [Adobe CEP Resources, CEP 12.x](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/CSInterface.js)
- License: [Adobe General SDK License Agreement](https://github.com/Adobe-CEP/CEP-Resources/blob/master/License/GenSDK_IHC-en_US-20120323_1224.pdf)

Adobe permits use, modification, and distribution of this file subject to the
Adobe license agreement linked above. The original Adobe copyright and license
notice is retained in the file.

## JSON-js `json2.js`

- File: `host/json2.js`
- Source: [Douglas Crockford's JSON-js](https://github.com/douglascrockford/JSON-js/blob/master/json2.js)
- License: Public Domain; no warranty is expressed or implied.

The original public-domain and warranty notice is retained in the file.

## py-aep

- Package: `py-aep==0.19.0`
- Source: [forticheprod/py-aep](https://github.com/forticheprod/py-aep)
- License: MIT

The installer installs py-aep as a Python dependency. It is not bundled in the ZXP
or npm archive.

## Playwright for Python

- Package: `playwright==1.65.0`
- Source: [microsoft/playwright-python](https://github.com/microsoft/playwright-python)
- License: [Apache License 2.0](https://github.com/microsoft/playwright-python/blob/main/LICENSE)

Installed into the dedicated Python environment, not bundled in the npm archive or
ZXP. Its upstream notices and the notices of its dependencies remain in the installed
packages.

## Chromium

- Source: [Chromium](https://www.chromium.org/)
- License: [BSD-style Chromium license and component notices](https://www.chromium.org/chromium-os/licenses/)

Playwright downloads browser binaries separately during setup. Chromium and its
third-party components have their own licenses; they are not covered solely by
this repository's MIT license and are not redistributed inside its npm/ZXP package.

## Playwright FFmpeg helper

Playwright's browser setup also downloads its FFmpeg helper build, even though this
renderer writes PNG frames and does not invoke FFmpeg directly. The downloaded
build's own license and component notices apply. See
[Playwright's FFmpeg build sources and notices](https://github.com/microsoft/playwright/tree/main/browser_patches/ffmpeg).
It is not bundled in this project's npm or ZXP archive.
