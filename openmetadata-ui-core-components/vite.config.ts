import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { glob } from 'glob';
import dts from 'vite-plugin-dts';

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development';
  
  return {
    plugins: [
      react(),
      dts({
        insertTypesEntry: true,
        include: ['src/**/*'],
        exclude: ['src/**/*.stories.tsx', 'src/**/*.test.tsx'],
        outDir: 'dist',
        skipDiagnostics: true,
        staticImport: true,
        rollupTypes: false,
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      lib: {
        entry: glob.sync(path.resolve(__dirname, 'src/**/*.{ts,tsx,js,jsx}')),
        formats: ['es'],
      },
      cssCodeSplit: true,
      rollupOptions: {
        external: [
          'react', 
          'react-dom', 
          'react/jsx-runtime',
          'react-router',
          'react-router-dom',
          '@untitledui/icons',
          '@untitledui/file-icons',
          'react-aria',
          'react-aria-components',
          'tailwind-merge',
          'motion',
          'react-hotkeys-hook',
          'tailwindcss-animate',
          'tailwindcss-react-aria-components',
          // Add any other peer dependencies that might cause issues
          /^use-sync-external-store/,
        ],
        output: {
          preserveModules: true,
          preserveModulesRoot: 'src',
          entryFileNames: '[name].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.css')) {
              return '[name][extname]';
            }
            return 'assets/[name][extname]';
          },
        },
      },
      sourcemap: isDevelopment ? 'inline' : false,
      minify: false,
      emptyOutDir: false,
    },
  };
});