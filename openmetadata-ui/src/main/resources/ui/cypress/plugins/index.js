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

  // Metabase
  config.env.metabaseUsername = process.env.CYPRESS_METABASE_USERNAME;
  config.env.metabasePassword = process.env.CYPRESS_METABASE_PASSWORD;
  config.env.metabaseDbServiceName =
    process.env.CYPRESS_METABASE_DB_SERVICE_NAME;
  config.env.metabaseHostPort = process.env.CYPRESS_METABASE_HOST_PORT;

  // Superset
  config.env.supersetUsername = process.env.CYPRESS_SUPERSET_USERNAME;
  config.env.supersetPassword = process.env.CYPRESS_SUPERSET_PASSWORD;
  config.env.supersetHostPort = process.env.CYPRESS_SUPERSET_HOST_PORT;

  // Kafka
  config.env.kafkaBootstrapServers =
    process.env.CYPRESS_KAFKA_BOOTSTRAP_SERVERS;

  // Glue
  config.env.glueAwsAccessKeyId = process.env.CYPRESS_GLUE_ACCESS_KEY;
  config.env.glueAwsSecretAccessKey = process.env.CYPRESS_GLUE_SECRET_KEY;
  config.env.glueAwsRegion = process.env.CYPRESS_GLUE_AWS_REGION;
  config.env.glueEndPointURL = process.env.CYPRESS_GLUE_ENDPOINT;
  config.env.glueStorageServiceName = process.env.CYPRESS_GLUE_STORAGE_SERVICE;
  config.env.gluePipelineServiceName =
    process.env.CYPRESS_GLUE_PIPELINE_SERVICE;

  return config;
};
