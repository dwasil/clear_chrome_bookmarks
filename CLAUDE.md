# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension.
The main purpose is to help the user find bookmarks with broken/dead links.
After install and open the extension user should see the page with a short description and button "Find dead bookmarks".
Script fetches all user's bookmarks, runs through all of them, sends HTTP HEAD requests to URLs with a 10 sec timeout.
It should not download all the content from the web-page, just check the HTTP response code.
Non-200 responses (404, 500, timeouts, connection errors) are all considered "dead".
After that all 'dead links' should be showin in a table with selected checkboxes before the name
Before the table it should be a statistic how much dead links was found
User can uncheck and check checkboxes
It should be button "delete dead bookmarks". 
After clicking this button, 
all bookmarks from the list which were 'checked' should be deleted
After all bookmarks were deleted we can show to the user message "It was deleted XX dead links. Keep you bookmarks clean regulary"
Redirect to the first page.


## Build & Development Commands

<!-- TODO: Add commands for building, testing, linting, etc. -->

## Architecture

<!-- TODO: Add high-level architecture overview -->
