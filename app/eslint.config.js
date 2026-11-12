const js = require("@eslint/js");

// Node.js globals used across the project (avoids adding the `globals` package).
const nodeGlobals = {
  require: "readonly",
  module: "writable",
  exports: "writable",
  process: "readonly",
  console: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  Buffer: "readonly",
  setTimeout: "readonly",
  setInterval: "readonly",
  clearTimeout: "readonly",
  clearInterval: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  fetch: "readonly",
  AbortController: "readonly",
  structuredClone: "readonly",
  global: "readonly",
  globalThis: "readonly",
};

module.exports = [
  {
    ignores: ["node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: nodeGlobals,
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],

      // The legacy code relies on a few patterns that eslint:recommended
      // treats as errors (implicit globals, `let` inside `case`, ...). Keep
      // them as warnings so `npm run lint` stays actionable without failing
      // on pre-existing issues.
      "no-undef": "warn",
      "no-case-declarations": "warn",
      "no-fallthrough": "warn",
      "no-unsafe-negation": "warn",
    },
  },
];
