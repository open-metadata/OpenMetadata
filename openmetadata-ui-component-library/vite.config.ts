import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "OpenMetadataUIComponentLibrary",
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom", "@untitled-ui/icons-react", "react-aria-components", "tailwind-merge", "lodash", "clsx"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "@untitled-ui/icons-react": "UntitledUIIconsReact",
          "react-aria-components": "ReactAriaComponents",
          "tailwind-merge": "tailwindMerge",
          lodash: "_",
          clsx: "clsx",
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
