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

import { loadDBPlugin } from 'cypress-postgresql';
import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import { env } from 'process';

// eslint-disable-next-line no-undef
config({ path: resolve(__dirname, './.env') });

const hostPort = env.CYPRESS_POSTGRES_HOST_PORT;

const dbConfig = {
  user: env.CYPRESS_POSTGRES_USERNAME,
  password: env.CYPRESS_POSTGRES_PASSWORD,
  host: hostPort ? hostPort.split(':')[0] : undefined,
  database: env.CYPRESS_POSTGRES_DATABASE,
};

// eslint-disable-next-line no-unused-vars
export default (on, config) => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config
  config.env.googleRefreshToken = env.CYPRESS_GOOGLE_REFRESH_TOKEN;
  config.env.googleClientId = env.CYPRESS_GOOGLE_CLIENTID;
  config.env.googleClientSecret = env.CYPRESS_GOOGLE_CLIENT_SECRET;

  // snowflake
  config.env.snowflakeUsername = env.CYPRESS_SNOWFLAKE_USERNAME;
  config.env.snowflakePassword = env.CYPRESS_SNOWFLAKE_PASSWORD;
  config.env.snowflakeAccount = env.CYPRESS_SNOWFLAKE_ACCOUNT;
  config.env.snowflakeDatabase = env.CYPRESS_SNOWFLAKE_DATABASE;
  config.env.snowflakeWarehouse = env.CYPRESS_SNOWFLAKE_WAREHOUSE;

  // bigquery
  config.env.bigqueryClientEmail = env.CYPRESS_BQ_CLIENT_EMAIL;
  config.env.bigqueryProjectId = env.CYPRESS_BQ_PROJECT_ID;
  config.env.bigqueryProjectIdTaxonomy = env.CYPRESS_BQ_PROJECT_ID_TAXONOMY;
  config.env.bigqueryPrivateKeyId = env.CYPRESS_BQ_PRIVATE_KEY_ID;
  config.env.bigqueryPrivateKey = env.CYPRESS_BQ_PRIVATE_KEY;
  config.env.bigqueryClientId = env.CYPRESS_BQ_CLIENT_ID;

  // Redshift
  config.env.redshiftHost = env.CYPRESS_REDSHIFT_HOST;
  config.env.redshiftUsername = env.CYPRESS_REDSHIFT_USERNAME;
  config.env.redshiftPassword = env.CYPRESS_REDSHIFT_PASSWORD;
  config.env.redshiftDatabase = env.CYPRESS_REDSHIFT_DATABASE;

  // Metabase
  config.env.metabaseUsername = env.CYPRESS_METABASE_USERNAME;
  config.env.metabasePassword = env.CYPRESS_METABASE_PASSWORD;
  config.env.metabaseDbServiceName = env.CYPRESS_METABASE_DB_SERVICE_NAME;
  config.env.metabaseHostPort = env.CYPRESS_METABASE_HOST_PORT;

  // Superset
  config.env.supersetUsername = env.CYPRESS_SUPERSET_USERNAME;
  config.env.supersetPassword = env.CYPRESS_SUPERSET_PASSWORD;
  config.env.supersetHostPort = env.CYPRESS_SUPERSET_HOST_PORT;

  // Kafka
  config.env.kafkaBootstrapServers = env.CYPRESS_KAFKA_BOOTSTRAP_SERVERS;
  config.env.kafkaSchemaRegistryUrl = env.CYPRESS_KAFKA_SCHEMA_REGISTRY_URL;

  // Glue
  config.env.glueAwsAccessKeyId = env.CYPRESS_GLUE_ACCESS_KEY;
  config.env.glueAwsSecretAccessKey = env.CYPRESS_GLUE_SECRET_KEY;
  config.env.glueAwsRegion = env.CYPRESS_GLUE_AWS_REGION;
  config.env.glueEndPointURL = env.CYPRESS_GLUE_ENDPOINT;
  config.env.glueStorageServiceName = env.CYPRESS_GLUE_STORAGE_SERVICE;
  config.env.gluePipelineServiceName = env.CYPRESS_GLUE_PIPELINE_SERVICE;

  // Mysql
  config.env.mysqlUsername = env.CYPRESS_MYSQL_USERNAME;
  config.env.mysqlPassword = env.CYPRESS_MYSQL_PASSWORD;
  config.env.mysqlHostPort = env.CYPRESS_MYSQL_HOST_PORT;
  config.env.mysqlDatabaseSchema = env.CYPRESS_MYSQL_DATABASE_SCHEMA;

  // Postgres
  config.env.postgresUsername = env.CYPRESS_POSTGRES_USERNAME;
  config.env.postgresPassword = env.CYPRESS_POSTGRES_PASSWORD;
  config.env.postgresHostPort = env.CYPRESS_POSTGRES_HOST_PORT;
  config.env.postgresDatabase = env.CYPRESS_POSTGRES_DATABASE;

  const pool = new Pool(dbConfig);
  const tasks = loadDBPlugin(pool);
  on('task', tasks);

  return config;
};
