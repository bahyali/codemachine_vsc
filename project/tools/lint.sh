#!/bin/bash
set -euo pipefail

# Navigate to the project root directory
cd "$(dirname "$0")/.."

# 1. Environment & Dependency Check
# Run install.sh silently
bash tools/install.sh > /dev/null 2>&1
# Create a temporary file for raw linter output
TMP_LINT_OUTPUT=$(mktemp)

# 2. Linting Execution
# Run eslint via npm.
# --silent: tells npm not to output the script header/footer.
# --quiet: tells eslint to suppress warnings (if desired).
set +e
npm run lint --silent -- --quiet --format json > "$TMP_LINT_OUTPUT" 2>/dev/null
LINT_EXIT_CODE=$?
set -e

# 3. Output Formatting
# Use Node.js to parse the ESLint JSON and output the required format.
node -e '
const fs = require("fs");
const path = require("path");

try {
    const rawContent = fs.readFileSync(process.argv[1], "utf8");
    if (!rawContent.trim()) process.exit(0);

    let results;
    try {
        // Locate the start and end of the JSON array to ignore any potential 
        // NPM lifecycle text that might have slipped into stdout.
        const start = rawContent.indexOf("[");
        const end = rawContent.lastIndexOf("]");
        
        if (start === -1 || end === -1) {
            process.exit(1);
        }

        const jsonContent = rawContent.substring(start, end + 1);
        results = JSON.parse(jsonContent);

    } catch (e) {
        // If output is not valid JSON, exit silently
        process.exit(0);
    }

    if (Array.isArray(results)) {
        if (results.length === 0) {
            console.log("[]");
            process.exit(0);
        }
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
    // Fail silently on internal processing errors
    process.exit(1);
}
' "$TMP_LINT_OUTPUT"

# Cleanup
rm "$TMP_LINT_OUTPUT"

# 4. Exit Code
exit $LINT_EXIT_CODE