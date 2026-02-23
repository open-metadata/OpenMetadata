import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";
import { readdirSync, statSync } from "fs";

/**
 * Dynamically discover all top-level index.ts files in the src directory to use as entry points.
 * This ensures that sub-modules like components, theme, etc. are built as separate entries
 * matching the 'exports' defined in package.json.
 */
const getEntries = () => {
  const entries: Record<string, string> = {
    index: resolve(__dirname, "src/index.ts"),
  };

  const srcPath = resolve(__dirname, "src");
  const items = readdirSync(srcPath, { withFileTypes: true });

  for (const item of items) {
    if (item.isDirectory()) {
      const indexPath = resolve(srcPath, item.name, "index.ts");
      const indexTsxPath = resolve(srcPath, item.name, "index.tsx");
      
      try {
        if (statSync(indexPath).isFile()) {
          entries[`${item.name}/index`] = indexPath;
          continue;
        }
      } catch (e) {}

      try {
        if (statSync(indexTsxPath).isFile()) {
          entries[`${item.name}/index`] = indexTsxPath;
        }
      } catch (e) {}
    }
  }

  return entries;
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      include: ["src"],
      outDir: "dist/types",
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.stories.ts",
        "**/*.stories.tsx",
        "**/vite.config.ts",
      ],
    }),
  ],
  build: {
    lib: {
      entry: getEntries(),
      name: "OpenMetadataUICore",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@mui/material",
        "@mui/system",
        "@mui/material/styles",
        "@mui/material/Chip",
        "@mui/icons-material",
        "@mui/x-date-pickers",
        "@emotion/react",
        "@emotion/styled",
        "@material/material-color-utilities",
        "notistack",
      ],
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "index") {
            return `index.[format].js`;
          }
          return `${chunkInfo.name}.[format].js`;
        },
        chunkFileNames: `[name].[format].js`,
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "@mui/material": "MaterialUI",
          "@mui/system": "MUISystem",
          "@emotion/react": "EmotionReact",
          "@emotion/styled": "EmotionStyled",
          notistack: "notistack",
        },
      },
    },
    sourcemap: false,
    minify: "esbuild",
    target: "es2020",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
