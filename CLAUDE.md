# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension.
The main purpose is to help the user find bookmarks with broken/dead links.

## User Flow

**Screen 1 - Welcome:**
- Short description of the extension
- "Find dead bookmarks" button

**Screen 2 - Scanning:**
- Progress indicator while checking bookmarks
- Script fetches all user's bookmarks, sends HTTP HEAD requests to URLs with 10 sec timeout
- Non-200 responses (404, 500, timeouts, connection errors) are considered "dead"

**Screen 3 - Results:**
- Statistics: how many dead links found, how many bookmarks checked, etc.
- Table with dead links, each row has a checkbox (checked by default) and bookmark name
- User can check/uncheck individual bookmarks
- "Delete dead bookmarks" button

**Screen 4 - Completion:**
- Success message: "Deleted XX dead links. Keep your bookmarks clean regularly!"
- Auto-redirect to Screen 1

## Edge Cases

**No bookmarks found:**
- Show message: "No bookmarks to process"
- Display statistics and "Back" button (no table)

**No dead links found:**
- Show message: "No dead links found"
- Display statistics and "Back" button (no table)

**Some bookmarks could not be checked** (e.g., `chrome://`, `javascript:` URLs):
- Include in statistics: "X bookmarks could not be checked"

## Technical Requirements

**Manifest Version:** V3 (current standard)

**Required Permissions:**
- `bookmarks` - read and delete user bookmarks
- `host_permissions: <all_urls>` - send HEAD requests to any URL

**Extension Type:** Browser action popup

**Technology Stack:**
- Vanilla JavaScript (no frameworks)
- Plain CSS

## Build & Development Commands

<!-- TODO: Add commands for building, testing, linting, etc. -->

## Architecture

```
manifest.json      # Extension manifest (V3)
popup.html         # Main popup UI (all 4 screens)
popup.js           # Application logic (bookmark fetching, URL checking, deletion)
styles.css         # Styling for popup
icons/             # Extension icons (16x16, 48x48, 128x128)
```

**popup.js responsibilities:**
- Screen state management (show/hide screens)
- Fetch bookmarks via `chrome.bookmarks.getTree()`
- Send HEAD requests to check URLs
- Delete bookmarks via `chrome.bookmarks.remove()`
