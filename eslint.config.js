import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*']
  },
  {
    files: ['**/*.rules'],
    plugins: {
      '@firebase/security-rules': firebaseRulesPlugin
    },
    rules: {
      '@firebase/security-rules/no-incomplete-rules': 'error',
      '@firebase/security-rules/no-redundant-rules': 'error',
      '@firebase/security-rules/no-implicit-read': 'error',
      '@firebase/security-rules/no-implicit-write': 'error'
    }
  }
];
