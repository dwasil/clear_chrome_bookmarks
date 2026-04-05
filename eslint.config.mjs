import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/**'] },

  // Chrome extension source files — run as plain browser scripts (no ES modules)
  {
    files: ['popup.js', 'background.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        chrome: 'readonly',
      },
    },
    rules: js.configs.recommended.rules,
  },

  // Popup UI: warn on console statements (they are visible to end users via DevTools)
  {
    files: ['popup.js'],
    rules: {
      'no-console': 'warn',
    },
  },

  // Node.js config files
  {
    files: ['jest.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: js.configs.recommended.rules,
  },

  // Jest e2e test files
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: js.configs.recommended.rules,
  },

  // Disable ESLint style rules that conflict with Prettier (must be last)
  prettier,
];
