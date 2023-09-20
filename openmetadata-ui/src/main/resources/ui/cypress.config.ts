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
  chromeWebSecurity: false,
  numTestsKeptInMemory: 0,
  experimentalMemoryManagement: true,
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return plugins(on, config);
    },
    baseUrl: 'http://localhost:8585',
    specPattern: [
      'cypress/e2e/Pages/ServiceVersionPage.spec.js',
      'cypress/e2e/Pages/DataQualityAndProfiler.spec.j',
      'cypress/e2e/AddNewService/mysql.spec.js',
      'cypress/e2e/AddNewService/kafka.spec.js',
      'cypress/e2e/AddNewService/Alerts.spec.js',
      'cypress/e2e/AddNewService/AddAndRemoveTierAndOwner.spec.js',
      'cypress/e2e/AddNewService/bigquery.spec.js',
      'cypress/e2e/Pages/Glossary.spec.js',
      'cypress/e2e/Pages/Tags.spec.js',
      'cypress/e2e/Pages/Domains.spec.js',
      'cypress/e2e/AddNewService/S3Storage.spec.js',
      'cypress/e2e/AddNewService/redshiftWithDBT.spec.js',
      'cypress/e2e/Features/SchemaSearch.spec.js',
      'cypress/e2e/Features/RecentlyViewed.spec.js  ',
    ],
  },
});
