import { defineConfig } from 'cypress';
import plugins from './cypress/plugins/index.js';

export default defineConfig({
  projectId: 'a9yxci',
  viewportWidth: 1240,
  viewportHeight: 660,
  watchForFileChanges: false,
  defaultCommandTimeout: 50000,
  videoUploadOnPasses: false,
  chromeWebSecurity: false,
  numTestsKeptInMemory: 0,
  e2e: {
    experimentalSessionAndOrigin: true,
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return plugins(on, config);
    },
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
  },
});
