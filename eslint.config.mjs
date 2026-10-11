import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
  { ignores: ['main.js', 'dist/**', 'tests/**', 'examples/**'] },
  ...obsidianmd.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: { 'obsidianmd/ui/sentence-case': ['warn', { brands: ['Magical Cards', 'Obsidian'] }] },
  },
]);
