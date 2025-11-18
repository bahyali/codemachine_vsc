module.exports = {
    "root": true,
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": 2020,
        "sourceType": "module"
    },
    "env": {
        "node": true,
        "es6": true
    },
    "plugins": [
        "@typescript-eslint"
    ],
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    "rules": {
        "semi": ["error", "never"],
        "quotes": ["error", "single", { "avoidEscape": true }]
    }
};