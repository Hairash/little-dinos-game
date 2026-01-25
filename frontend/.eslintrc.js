module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2021: true,
  },
  extends: [
    'plugin:vue/vue3-strongly-recommended',
    'eslint:recommended',
    'prettier', // Must be last to override other configs
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  overrides: [
    {
      files: ['*.js'],
      parser: '@babel/eslint-parser',
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ['@babel/preset-env'],
        },
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    {
      files: ['*.vue'],
      parser: 'vue-eslint-parser',
      parserOptions: {
        parser: '@babel/eslint-parser',
        requireConfigFile: false,
        babelOptions: {
          presets: ['@babel/preset-env'],
        },
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    {
      files: ['tests/**/*.js', '**/*.spec.js'],
      env: {
        node: true,
        browser: true,
      },
      globals: {
        // Vitest globals (configured in vitest.config.js with globals: true)
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        vitest: 'readonly',
      },
      rules: {
        'no-unused-vars': 'off', // Vitest globals might trigger this
      },
    },
  ],
  rules: {
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'vue/multi-word-component-names': 'off', // Allow single-word component names
    'vue/no-v-html': 'warn', // Warn about v-html usage (security)
    'vue/require-default-prop': 'off', // Not always needed
    'vue/require-explicit-emits': 'warn', // Better Vue 3 practices
  },
}

