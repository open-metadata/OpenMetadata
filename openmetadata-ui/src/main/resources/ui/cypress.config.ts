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
  numTestsKeptInMemory: 0,
  e2e: {
    experimentalSessionAndOrigin: true,
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return plugins(on, config);
    },
    baseUrl: 'http://localhost:8585',
    specPattern: [
      'cypress/e2e/AddNewService/*.{js,jsx,ts,tsx}',
      'cypress/e2e/Features/*.{js,jsx,ts,tsx}',
      'cypress/e2e/Pages/*.{js,jsx,ts,tsx}',
      'cypress/e2e/Flow/*.{js,jsx,ts,tsx}',
      'cypress/e2e/**/*.{js,jsx,ts,tsx}',
    ],
  },
});
