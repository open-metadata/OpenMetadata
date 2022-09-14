import { defineConfig } from 'cypress';
import plugins from './cypress/plugins/index.js';

export default defineConfig({
  projectId: 'a9yxci',
  viewportWidth: 1240,
  viewportHeight: 660,
  watchForFileChanges: false,
  defaultCommandTimeout: 5000,
  videoUploadOnPasses: false,
  chromeWebSecurity: false,
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return plugins(on, config);
    },
    baseUrl: 'http://localhost:8585',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
  },
});
