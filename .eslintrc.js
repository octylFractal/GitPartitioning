module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        "semi": ["error", "always"],
        "comma-dangle": ["error", "only-multiline"],
        "@typescript-eslint/explicit-function-return-type": [
            "warn",
            {
                "allowConciseArrowFunctionExpressionsStartingWithVoid": true,
            },
        ],
    },
    "overrides": [
        {
            "files": ["*.js"],
            "rules": {
                "@typescript-eslint/no-var-requires": "off",
                "@typescript-eslint/explicit-function-return-type": "off",
            },
        },
    ],
};
