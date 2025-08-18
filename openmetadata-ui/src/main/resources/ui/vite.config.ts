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

import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { resolve } from 'path';

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
      
      return code;
    }
    return code;
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devServerTarget = env.DEV_SERVER_TARGET ?? 'http://localhost:8585/';
  
  return {
    plugins: [
      react(),
      svgr({
        svgrOptions: {
          icon: true,
        },
      }),
      svgReactComponentPlugin(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '~antd': resolve(__dirname, './node_modules/antd'),
        '~antd4': resolve(__dirname, './node_modules/antd4'),
        '@deuex-solutions/react-tour': resolve(__dirname, './node_modules/@deuex-solutions/react-tour/dist/reacttour.min.js'),
        'rc-util': resolve(__dirname, './node_modules/rc-util'),
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
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'antd-vendor': ['antd', '@ant-design/icons'],
            'editor-vendor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-link'],
            'chart-vendor': ['recharts', 'reactflow'],
          },
        },
      },
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
          modifyVars: {
            'primary-color': '#1677ff',
          },
          paths: [
            resolve(__dirname, 'node_modules'),
            resolve(__dirname, 'src'),
          ],
          // Handle ~ prefix for node_modules imports
          rewriteUrls: 'all',
        },
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      global: 'globalThis',
    },
    optimizeDeps: {
      include: [
        'antlr4',
        '@azure/msal-browser',
        '@azure/msal-react',
        'codemirror',
        '@deuex-solutions/react-tour',
        'rc-util',
      ],
    },
  };
});