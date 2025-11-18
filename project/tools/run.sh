#!/bin/bash
set -e
set -u

# Navigate to the project root directory
cd "$(dirname "$0")/.."

# 1. Environment & Dependency Check
# Run install.sh silently
./tools/install.sh > /dev/null 2>&1

# 2. Project Execution
# For a VS Code extension, 'running' in a CI/CLI context typically means compiling the source.
npm run compile