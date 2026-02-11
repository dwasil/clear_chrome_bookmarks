# Bookmark Cleaner — Find & Remove Broken Bookmarks in Chrome

A lightweight Chrome extension that scans your bookmarks, detects dead links, and lets you delete them in bulk with one click.

Over time, bookmarks rot — websites shut down, pages get deleted, URLs change. Studies show **30–40% of links break** within a few years. Bookmark Cleaner helps you find and remove those broken bookmarks so your browser stays clean and organized.

<!-- TODO: uncomment when published
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/YOUR_EXTENSION_ID)](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/YOUR_EXTENSION_ID)](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)
-->
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](#)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

<!-- TODO: add a screenshot or GIF demo here
## Screenshot
![Bookmark Cleaner screenshot](screenshot.png)
-->

## Features

- **Dead link detection** — finds 404 errors, server errors, timeouts, and connection failures
- **Bulk deletion** — remove hundreds of broken bookmarks in one click
- **Selective cleanup** — review results, uncheck bookmarks you want to keep
- **Scan statistics** — see how many bookmarks were checked, how many are broken, and how many were skipped
- **Fast & lightweight** — vanilla JS, no frameworks, no bloat
- **Privacy-first** — zero data collection, zero tracking, everything runs locally in your browser

## How It Works

1. Click **"Find dead bookmarks"**
2. The extension scans all your bookmarks by sending HEAD requests to each URL
3. Review the list of dead links found
4. Click **"Delete selected bookmarks"** to clean up

Non-HTTP URLs (`chrome://`, `javascript:`, etc.) are skipped automatically and reported in the statistics.

## Installation

### From Chrome Web Store

<!-- TODO: add link when published -->
Coming soon.

### Manual (developer mode)

1. Clone or download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the project folder
5. The extension icon appears in your toolbar — click it to start

## Permissions

| Permission | Why it's needed |
|---|---|
| `bookmarks` | Read and delete bookmarks |
| `host_permissions: <all_urls>` | Send HEAD requests to check if bookmark URLs are alive |

No data leaves your browser. No analytics. No remote servers.

## Tech Stack

- **Manifest V3** — current Chrome extension standard
- **Vanilla JavaScript** — no dependencies, no build step
- **Plain CSS** — clean, minimal UI

## Project Structure

```
manifest.json       # Extension manifest (V3)
popup.html          # Popup UI (4 screens: welcome → scanning → results → done)
popup.js            # Core logic: bookmark fetching, URL checking, deletion
styles.css          # Popup styles
icons/              # Extension icons (16, 48, 128)
```

## Contributing

Contributions are welcome. Feel free to open an issue or submit a pull request.

## License

MIT
