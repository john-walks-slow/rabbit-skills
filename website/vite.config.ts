import { defineConfig } from 'vite';

export default defineConfig({
  base: '/rabbit-skills/',
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['gsap', 'marked'],
        },
      },
    },
  },
});
