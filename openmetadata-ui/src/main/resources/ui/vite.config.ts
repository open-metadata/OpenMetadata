/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import viteCompression from 'vite-plugin-compression';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

// Custom plugin to transform ReactComponent SVG imports
const svgReactComponentPlugin = (): Plugin => ({
  name: 'svg-react-component',
  transform(code, id) {
    if (id.endsWith('.ts') || id.endsWith('.tsx')) {
      // Handle imports with both default and ReactComponent
      code = code.replace(
        /import\s+(\w+)\s*,\s*{\s*ReactComponent\s+as\s+(\w+)\s*}\s+from\s+['"](.+?\.svg)['"]/g,
        "import $1 from '$3';\nimport $2 from '$3?react'"
      );

      // Handle multiple ReactComponent imports from same file
      code = code.replace(
        /import\s*{\s*ReactComponent\s+as\s+(\w+)\s*,\s*ReactComponent\s+as\s+(\w+)\s*}\s+from\s+['"](.+?\.svg)['"]/g,
        "import $1 from '$3?react';\nconst $2 = $1"
      );

      // Handle imports with only ReactComponent
      code = code.replace(
        /import\s+{\s*ReactComponent\s+as\s+(\w+)\s*}\s+from\s+['"](.+?\.svg)['"]/g,
        "import $1 from '$2?react'"
      );

      return { code, map: null };
    }

    return null;
  },
});

// Custom plugin to handle Less imports with url() syntax
const lessImportResolver = (): Plugin => ({
  name: 'less-import-resolver',
  enforce: 'pre',
  async transform(code, id) {
    if (id.endsWith('.less')) {
      let transformed = code;
      const fileDir = path.dirname(id);

      // Transform url() syntax to standard import syntax
      transformed = transformed.replace(
        /@import\s*(\(reference\))?\s*url\((['"]?)([^'")\s]+)\2\)/g,
        '@import $1 $2$3$2'
      );

      // Handle all relative imports
      transformed = transformed.replace(
        /@import\s*(\(reference\))?\s*['"]\.\/([^'"]+)['"]/g,
        (match, ref, importPath) => {
          const absolutePath = path.resolve(fileDir, importPath);
          if (fs.existsSync(absolutePath)) {
            return `@import ${ref || ''} '${absolutePath}'`;
          }

          return match;
        }
      );

      // Handle parent directory imports
      transformed = transformed.replace(
        /@import\s*(\(reference\))?\s*['"]\.\.\/([^'"]+)['"]/g,
        (match, ref, importPath) => {
          const absolutePath = path.resolve(fileDir, '..', importPath);
          if (fs.existsSync(absolutePath)) {
            return `@import ${ref || ''} '${absolutePath}'`;
          }

          return match;
        }
      );

      // Handle antd imports without leading path
      transformed = transformed.replace(
        /@import\s*(\(reference\))?\s*['"]antd\/([^'"]+)['"]/g,
        (match, ref, antdPath) => {
          const absolutePath = path.resolve(
            __dirname,
            'node_modules/antd',
            antdPath
          );
          if (fs.existsSync(absolutePath)) {
            return `@import ${ref || ''} '${absolutePath}'`;
          }

          return match;
        }
      );

      if (transformed !== code) {
        return {
          code: transformed,
          map: null,
        };
      }
    }

    return null;
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devServerTarget =
    env.VITE_DEV_SERVER_TARGET ||
    env.DEV_SERVER_TARGET ||
    'http://localhost:8585/';

  return {
    plugins: [
      lessImportResolver(),
      react(),
      svgr({
        svgrOptions: {
          icon: true,
          dimensions: false,
        },
      }),
      svgReactComponentPlugin(),
      tsconfigPaths(),
      nodePolyfills({
        include: ['process', 'buffer'],
        globals: {
          process: true,
          Buffer: true,
        },
      }),
      mode === 'production' &&
        viteCompression({
          algorithm: 'gzip',
          ext: '.gz',
        }),
    ].filter(Boolean),

    resolve: {
      alias: {
        process: 'process/browser',
        Quill: path.resolve(__dirname, 'node_modules/quill'),
        '@': path.resolve(__dirname, 'src'),
        '~antd': path.resolve(__dirname, 'node_modules/antd'),
        antd: path.resolve(__dirname, 'node_modules/antd'),
        '@deuex-solutions/react-tour': path.resolve(
          __dirname,
          'node_modules/@deuex-solutions/react-tour/dist/reacttour.min.js'
        ),
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.less', '.svg'],
    },

    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
          modifyVars: {},
          math: 'always',
          paths: [
            path.resolve(__dirname, 'node_modules'),
            path.resolve(__dirname, 'src'),
            path.resolve(__dirname, 'src/styles'),
          ],
          rewriteUrls: 'all',
        },
      },
    },

    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api': {
          target: devServerTarget,
          changeOrigin: true,
        },
      },
    },

    build: {
      outDir: 'build',
      sourcemap: true,
      minify: mode === 'production' ? 'terser' : false,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'antd-vendor': ['antd', '@ant-design/icons'],
            'editor-vendor': [
              '@tiptap/react',
              '@tiptap/starter-kit',
              '@tiptap/extension-link',
            ],
            'chart-vendor': ['recharts', 'reactflow'],
          },
        },
      },
    },

    optimizeDeps: {
      include: [
        'antlr4',
        '@azure/msal-browser',
        '@azure/msal-react',
        'codemirror',
        '@deuex-solutions/react-tour',
      ],
    },

    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      global: 'globalThis',
    },
  };
});
