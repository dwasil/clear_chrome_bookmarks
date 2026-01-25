#!/bin/bash
# Create a zip archive of the current folder with manifest.json at the root

zip_name="cleanup_bookmarks.zip"

# Remove existing zip if present
rm -f "$zip_name"


# Create the zip, including all files in the current directory (not the directory itself), excluding .git directory
zip -r "$zip_name" . -x "./.git/*" -x "./pack.sh" -x "./CLAUDE.md" -x "./.claude/*"

echo "Created $zip_name with manifest.json at the root."