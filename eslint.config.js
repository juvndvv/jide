import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // Files / directories that ESLint must not touch at all.
  {
    ignores: [
      'out/',
      'dist/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'design/',
      '.planning/',
    ],
  },
  js.configs.recommended,
  // Root config files use untyped linting — they are not part of any
  // tsconfig project's `include`, so typed linting would fail to parse them.
  {
    files: ['*.config.{ts,js}', 'eslint.config.js'],
    extends: [tseslint.configs.recommended],
  },
  // Typed linting is scoped strictly to source and test trees.
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.web.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    ...react.configs.flat.recommended,
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
    },
    settings: { react: { version: '19' } },
  },
);
