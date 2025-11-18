#!/bin/bash
set -e
set -u

# Navigate to the project root directory
cd "$(dirname "$0")/.."

# Check for package.json to confirm Node.js project
if [ -f "package.json" ]; then
    # Check if node_modules exists or if package.json is newer than node_modules
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        # Install dependencies silently to avoid cluttering stdout
        npm install --silent
    fi
else
    echo "Error: package.json not found. Unable to determine project dependencies." >&2
    exit 1
fi