import globals from 'globals';
import tseslint from 'typescript-eslint';
import { baseConfig } from './base.js';

/**
 * ESLint config for Nest.js apps: type-aware rules plus node/jest globals.
 * @type {import('typescript-eslint').ConfigArray}
 */
export const nestConfig = tseslint.config(
  ...baseConfig,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
    },
  },
);

export default nestConfig;
