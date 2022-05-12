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

  // bigquery
  config.env.bigqueryClientEmail = process.env.CYPRESS_BQ_CLIENT_EMAIL;
  config.env.bigqueryProjectId = process.env.CYPRESS_BQ_PROJECT_ID;
  config.env.bigqueryPrivateKeyId = process.env.CYPRESS_BQ_PRIVATE_KEY_ID;
  config.env.bigqueryPrivateKey = process.env.CYPRESS_BQ_PRIVATE_KEY;
  config.env.bigqueryClientId = process.env.CYPRESS_BQ_CLIENT_ID;

  // Redshift
  config.env.redshiftHost = process.env.CYPRESS_REDSHIFT_HOST;
  config.env.redshiftUsername = process.env.CYPRESS_REDSHIFT_USERNAME;
  config.env.redshiftPassword = process.env.CYPRESS_REDSHIFT_PASSWORD;
  config.env.redshiftDatabase = process.env.CYPRESS_REDSHIFT_DATABASE;

  return config;
};
