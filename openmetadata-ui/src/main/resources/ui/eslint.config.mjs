import eslint from '@eslint/js';
import eslintPluginJsonc from 'eslint-plugin-jsonc';
import react from 'eslint-plugin-react';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      react.configs.flat.recommended,
      eslint.configs.all,
      //   {
      //     ...tseslint.configs.base,
      //     files: ['src/*.ts', 'src/*.tsx'],
      //   },
      ...tseslint.configs.recommended.map((conf) => ({
        ...conf,
        files: ['src/*.ts', 'src/*.tsx'],
      })),
      //   ...eslintPluginJsonc.configs['flat/base'].map((conf) => ({
      //     ...conf,
      //     files: ['src/*json'],
      //   })),
    ],
    languageOptions: {
      parserOptions: {
        react: {
          version: 'detect',
        },
      },
    },

    // rules: {
    //   '@typescript-eslint/array-type': 'error',
    //   '@typescript-eslint/consistent-type-imports': 'error',
    // },
  },
  {
    ...eslintPluginJsonc.configs['recommended-with-json'],
    files: ['src/*json'],
    ignores: ['**/tsconfig*.json'],
  }
  //   {
  //     files: ['src/locale/*.json'],
  //     plugins: { i18next },
  //     rules: {
  //       'i18next/no-literal-string': ['error', { mode: 'all' }],
  //     },
  //   }
);
