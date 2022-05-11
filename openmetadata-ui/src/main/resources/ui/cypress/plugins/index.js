// / <reference types="cypress" />
// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

/**
 * @type {Cypress.PluginConfig}
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });

// eslint-disable-next-line no-unused-vars
module.exports = (on, config) => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config
  config.env.googleRefreshToken = process.env.CYPRESS_GOOGLE_REFRESH_TOKEN;
  config.env.googleClientId = process.env.CYPRESS_GOOGLE_CLIENTID;
  config.env.googleClientSecret = process.env.CYPRESS_GOOGLE_CLIENT_SECRET;

  // snowflake
  config.env.snowflakeUsername = process.env.CYPRESS_SNOWFLAKE_USERNAME;
  config.env.snowflakePassword = process.env.CYPRESS_SNOWFLAKE_PASSWORD;
  config.env.snowflakeAccount = process.env.CYPRESS_SNOWFLAKE_ACCOUNT;
  config.env.snowflakeDatabase = process.env.CYPRESS_SNOWFLAKE_DATABASE;
  config.env.snowflakeWarehouse = process.env.CYPRESS_SNOWFLAKE_WAREHOUSE;

  return config;
};
