import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  // Relative paths, so the game works at any address (for example /colour-rush/ on GitHub Pages)
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
