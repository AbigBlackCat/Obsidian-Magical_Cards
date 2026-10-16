import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
  { ignores: ['main.js', 'dist/**', 'tests/**', 'examples/**', 'src/vendor/**'] },
  ...obsidianmd.configs.recommended,
  {
    files: ['*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', Buffer: 'readonly' } },
    rules: { 'obsidianmd/no-nodejs-modules': 'off' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: { 'obsidianmd/ui/sentence-case': ['warn', { brands: ['Magical Cards', 'Obsidian', 'Dashboard'] }] },
  },
]);
