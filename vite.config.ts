import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['**/*.test.*', '**/*.spec.*'],
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        react: resolve(__dirname, 'src/adapters/react/index.ts'),
        'tanstack-query': resolve(__dirname, 'src/adapters/tanstack-query/index.ts'),
        nextjs: resolve(__dirname, 'src/adapters/nextjs/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const ext = format === 'es' ? 'mjs' : 'cjs';
        return entryName === 'index' ? `index.${ext}` : `adapters/${entryName}/index.${ext}`;
      },
    },
    rollupOptions: {
      external: [
        'react',
        'react/jsx-runtime',
        '@tanstack/react-query',
        'next',
        'next/server',
        'next/cache',
        // Temporarily disabled Angular/Vue dependencies
        // 'vue',
        // '@vue/composition-api',
        // '@angular/core',
        // '@angular/common',
        // 'rxjs',
        // 'rxjs/operators',
        // '@tanstack/vue-query',
      ],
      output: {
        globals: {
          react: 'React',
          'react/jsx-runtime': 'jsxRuntime',
          '@tanstack/react-query': 'ReactQuery',
          // Temporarily disabled Angular/Vue globals
          // vue: 'Vue',
          // '@vue/composition-api': 'VueCompositionAPI',
          // '@angular/core': 'ng.core',
          // '@angular/common': 'ng.common',
          // 'rxjs': 'rxjs',
          // 'rxjs/operators': 'rxjs.operators',
          // '@tanstack/vue-query': 'VueQuery',
        },
      },
    },
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});