/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-onboarding"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (config) => {
    // Handle LESS files
    config.css = {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
        },
      },
    };

    return config;
  },
};
export default config;
