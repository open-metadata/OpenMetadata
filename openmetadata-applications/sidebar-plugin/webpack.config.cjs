const path = require("path");
module.exports = {
  // mode: "development",
  entry: "./src/index.tsx", // Entry point for SlackPlugin
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "SidebarPlugin.js", // Updated output filename to reflect the plugin name
    library: "SidebarPlugin", // Updated library name to match the plugin
    libraryTarget: "umd", // Universal Module Definition (UMD) format for compatibility
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"], // Extensions for module resolution
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        loader: "ts-loader",
        options: {
          configFile: "tsconfig.json",
          transpileOnly: true, // Speed up compilation in development mode
        },
        include: path.resolve(__dirname, "src"), // Just the source code
      },
      {
        test: /\.svg$/,
        use: ["@svgr/webpack", "url-loader"],
        include: path.resolve(__dirname, "src"), // Just the source code
      },
    ],
  },
  externals: {
    react: {
      root: "React",
      commonjs2: "react",
      commonjs: "react",
      amd: "react",
    }, // Mark React as external to prevent bundling
    "react-dom": "ReactDOM", // Ensure ReactDOM is not bundled
    "react-router-dom": "ReactRouterDOM", // Ensure ReactRouterDOM is not bundled
    "react-pluggable": "ReactPluggable", // Mark react-pluggable as external
    antd: "antd", // Exclude Ant Design to avoid duplication in the host app
    "@ant-design/icons": "@ant-design/icons",
    "@svgr/webpack": "@svgr/webpack",
  },
};
