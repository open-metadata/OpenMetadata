import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  mode: "production",
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
      },
      include: "**/*.svg",
    }),
    dts({
      exclude: ["**/*.stories.tsx"],
    }),
    {
      name: "copy-package-json",
      writeBundle() {
        const pkg = require("./package.json");
        const minimalPkg = {
          name: pkg.name,
          version: pkg.version,
          main: pkg.main,
          types: pkg.types,
          peerDependencies: pkg.peerDependencies,
          exports: pkg.exports,
          files: pkg.files,
        };

        const outputPath = resolve(__dirname, "dist/package.json");
        require("fs").writeFileSync(
          outputPath,
          JSON.stringify(minimalPkg, null, 2)
        );
        console.log(`📦 package.json copied to dist/`);
      },
    },
  ],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "OpenMetadataCommonUI",
      fileName: (format) => `index.${format}.js`,
      formats: ["cjs"],
    },
    sourcemap: false,
    rollupOptions: {
      external: [
        "react",
        "react/jsx-runtime",
        "react-dom",
        "antd",
        "classnames",
        "react-i18next",
      ],
      output: {},
    },
  },
});
