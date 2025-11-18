#!/bin/bash
set -u

# Navigate to the project root directory
cd "$(dirname "$0")/.."

# 1. Environment & Dependency Check
# Run install.sh silently
./tools/install.sh > /dev/null 2>&1

# Create a temporary file for raw linter output
TMP_LINT_OUTPUT=$(mktemp)

# 2. Linting Execution
# Run eslint via npm, forcing JSON output.
# We use 'set +e' because lint errors usually return exit code 1, which we want to capture.
set +e
npm run lint -- --silent --format json > "$TMP_LINT_OUTPUT" 2>/dev/null
LINT_EXIT_CODE=$?
set -e

# 3. Output Formatting
# Use a small embedded Node.js script to parse the ESLint JSON and output the required format.
node -e '
const fs = require("fs");
const path = require("path");

try {
    const content = fs.readFileSync(process.argv[1], "utf8");
    if (!content.trim()) process.exit(0);

    let results;
    try {
        results = JSON.parse(content);
    } catch (e) {
        // If output is not valid JSON, exit silently
        process.exit(0);
    }

    if (Array.isArray(results)) {
        results.forEach(fileResult => {
            const relativePath = path.relative(process.cwd(), fileResult.filePath);
            
            fileResult.messages.forEach(msg => {
                // Map ESLint severity (1=Warning, 2=Error)
                const type = msg.severity === 2 ? "error" : "warning";
                
                const output = {
                    "type": type,
                    "path": relativePath,
                    "obj": msg.nodeType || "",
                    "message": msg.message,
                    "line": msg.line || 0,
                    "column": msg.column || 0
                };
                
                // Print each error as a single line JSON object
                console.log(JSON.stringify(output));
            });
        });
    }
} catch (e) {
    // Fail silently on internal processing errors to strictly adhere to stdout requirements
    process.exit(1);
}
' "$TMP_LINT_OUTPUT"

# Cleanup
rm "$TMP_LINT_OUTPUT"

# 4. Exit Code
exit $LINT_EXIT_CODE