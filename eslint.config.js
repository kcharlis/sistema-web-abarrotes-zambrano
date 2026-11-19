import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';

export default [
  {
    ignores: ['dist/**/*', 'firestore.rules']
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
    },
    rules: {
       // basic rules if needed
    }
  },
];
