import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {},
  viteFinal: async (viteConfig) => {
    // vite.config.ts externalizes deps for the library build so consumers don't
    // bundle them twice.  Storybook's static output must be fully self-contained,
    // so we clear those externals here.
    if (viteConfig.build?.rollupOptions) {
      viteConfig.build.rollupOptions.external = [];
    }
    return viteConfig;
  },
};
export default config;
