/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.migration.utils.v209;

import java.util.List;
import java.util.Map;

/**
 * Every secret ({@code format: password}) below a service connection config, by service entity
 * type and then connection {@code type}, each a path below {@code connection.config}. {@code []}
 * stands for every element of an array and {@code {}} for every value of an object.
 *
 * <p>It is the union over the connection schemas of every release from 1.11.0 to 2.0.8 and of the
 * current schemas, so it keeps fields later releases dropped (e.g. {@code
 * sampleDataStorageConfig}). It is a fixed copy on purpose: the migration must keep meaning the
 * same thing however the schemas change later.
 */
final class ServiceSecretPaths {
  private ServiceSecretPaths() {}

  static final Map<String, Map<String, List<String>>> SECRET_PATHS =
      Map.ofEntries(
          Map.entry(
              "apiService",
              Map.ofEntries(
                  paths(
                      "Rest",
                      "openAPISchemaConnection/awsCredentials/awsSecretAccessKey",
                      "openAPISchemaConnection/awsCredentials/awsSessionToken",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey",
                      "token"))),
          Map.entry(
              "dashboardService",
              Map.ofEntries(
                  paths("DomoDashboard", "accessToken", "secretToken"),
                  paths("Grafana", "apiKey"),
                  paths("Hex", "token"),
                  paths("Lightdash", "apiKey", "proxyAuthentication"),
                  paths("Looker", "clientSecret", "gitCredentials/token"),
                  paths("Metabase", "apiKey", "password"),
                  paths(
                      "MicroStrategy",
                      "password",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths("Mode", "accessTokenPassword"),
                  paths(
                      "Omni",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey",
                      "token"),
                  paths(
                      "PowerBI",
                      "clientSecret",
                      "pbitFilesSource/securityConfig/awsSecretAccessKey",
                      "pbitFilesSource/securityConfig/awsSessionToken",
                      "pbitFilesSource/securityConfig/clientSecret",
                      "pbitFilesSource/securityConfig/gcpConfig/privateKey"),
                  paths("PowerBIReportServer", "password"),
                  paths("QlikCloud", "token"),
                  paths(
                      "QlikSense",
                      "certificates/sslConfig/caCertificate",
                      "certificates/sslConfig/sslCertificate",
                      "certificates/sslConfig/sslKey"),
                  paths("QuickSight", "awsConfig/awsSecretAccessKey", "awsConfig/awsSessionToken"),
                  paths("Redash", "apiKey"),
                  paths("Rill", "token"),
                  paths(
                      "SapS4Hana",
                      "authType/clientSecret",
                      "authType/password",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths("Sigma", "clientSecret"),
                  paths(
                      "Ssrs",
                      "password",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "Superset",
                      "connection/authType/awsConfig/awsSecretAccessKey",
                      "connection/authType/awsConfig/awsSessionToken",
                      "connection/authType/azureConfig/clientSecret",
                      "connection/authType/gcpConfig/gcpConfig/privateKey",
                      "connection/authType/password",
                      "connection/password",
                      "connection/sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "connection/sslConfig/caCertificate",
                      "connection/sslConfig/sslCertificate",
                      "connection/sslConfig/sslKey"),
                  paths(
                      "Tableau",
                      "authType/password",
                      "authType/personalAccessTokenSecret",
                      "authType/secretValue",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths("ThoughtSpot", "authentication/accessToken", "authentication/password"))),
          Map.entry(
              "databaseService",
              Map.ofEntries(
                  paths(
                      "Athena",
                      "awsConfig/awsSecretAccessKey",
                      "awsConfig/awsSessionToken",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "AzureSQL",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "BigQuery",
                      "credentials/gcpConfig/privateKey",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths("BigTable", "credentials/gcpConfig/privateKey"),
                  paths("BurstIQ", "password"),
                  paths(
                      "Cassandra",
                      "authType/cloudConfig/token",
                      "authType/password",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "Clickhouse",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths("Clickzetta", "authType/password"),
                  paths(
                      "Cockroach",
                      "authType/password",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths("Couchbase", "password"),
                  paths("Data360", "consumerKey", "consumerSecret"),
                  paths("Databend", "password"),
                  paths(
                      "Databricks",
                      "authType/azureClientSecret",
                      "authType/clientSecret",
                      "authType/token",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "Datalake",
                      "configSource/securityConfig/awsSecretAccessKey",
                      "configSource/securityConfig/awsSessionToken",
                      "configSource/securityConfig/clientSecret",
                      "configSource/securityConfig/gcpConfig/privateKey",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "Db2",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "DeltaLake",
                      "configSource/connection/password",
                      "configSource/connection/securityConfig/awsSecretAccessKey"),
                  paths("DomoDatabase", "accessToken", "secretToken"),
                  paths(
                      "Doris",
                      "password",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths("Dremio", "authType/password", "authType/personalAccessToken"),
                  paths(
                      "Druid",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths("DynamoDB", "awsConfig/awsSecretAccessKey", "awsConfig/awsSessionToken"),
                  paths("Exasol", "password"),
                  paths("Glue", "awsConfig/awsSecretAccessKey", "awsConfig/awsSessionToken"),
                  paths(
                      "Greenplum",
                      "authType/awsConfig/awsSecretAccessKey",
                      "authType/awsConfig/awsSessionToken",
                      "authType/password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "Hive",
                      "metastoreConnection/authType/awsConfig/awsSecretAccessKey",
                      "metastoreConnection/authType/awsConfig/awsSessionToken",
                      "metastoreConnection/authType/azureConfig/clientSecret",
                      "metastoreConnection/authType/gcpConfig/gcpConfig/privateKey",
                      "metastoreConnection/authType/password",
                      "metastoreConnection/sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "metastoreConnection/sslConfig/caCertificate",
                      "metastoreConnection/sslConfig/sslCertificate",
                      "metastoreConnection/sslConfig/sslKey",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "Iceberg",
                      "catalog/connection/awsConfig/awsSecretAccessKey",
                      "catalog/connection/credential/clientId",
                      "catalog/connection/credential/clientSecret",
                      "catalog/connection/fileSystem/type/awsSecretAccessKey",
                      "catalog/connection/fileSystem/type/clientSecret",
                      "catalog/connection/token"),
                  paths(
                      "Impala",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "Informix",
                      "password",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "Iomete",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "MariaDB",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "MicrosoftAccess",
                      "connection/awsConfig/awsSecretAccessKey",
                      "connection/awsConfig/awsSessionToken"),
                  paths(
                      "MicrosoftFabric",
                      "authType/certificate",
                      "authType/clientSecret",
                      "authType/privateKey",
                      "authType/privateKeyPassphrase",
                      "clientSecret",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "MongoDB",
                      "password",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "Mssql",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "Mysql",
                      "authType/awsConfig/awsSecretAccessKey",
                      "authType/awsConfig/awsSessionToken",
                      "authType/azureConfig/clientSecret",
                      "authType/gcpConfig/gcpConfig/privateKey",
                      "authType/password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths("Neo4j", "password"),
                  paths(
                      "Oracle",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "PinotDB",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "Postgres",
                      "authType/awsConfig/awsSecretAccessKey",
                      "authType/awsConfig/awsSessionToken",
                      "authType/azureConfig/clientSecret",
                      "authType/password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "Presto",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths("QuestDB", "authType/password"),
                  paths(
                      "Redshift",
                      "authType/awsConfig/awsSecretAccessKey",
                      "authType/awsConfig/awsSessionToken",
                      "authType/password",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths("SAS", "password"),
                  paths(
                      "SQLite",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths("SSAS", "password"),
                  paths(
                      "Salesforce",
                      "consumerSecret",
                      "password",
                      "securityToken",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths("SapBw4Hana", "password"),
                  paths(
                      "SapErp",
                      "apiKey",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "SapHana",
                      "connection/password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "SapSuccessFactors",
                      "password",
                      "privateKey",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths("ServiceNow", "password"),
                  paths(
                      "SingleStore",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "Snowflake",
                      "password",
                      "privateKey",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "snowflakePrivatekeyPassphrase"),
                  paths(
                      "StarRocks",
                      "password",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "Synapse",
                      "clientSecret",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "Teradata",
                      "logdata",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "Timescale",
                      "authType/awsConfig/awsSecretAccessKey",
                      "authType/awsConfig/awsSessionToken",
                      "authType/azureConfig/clientSecret",
                      "authType/password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "Trino",
                      "authType/azureConfig/clientSecret",
                      "authType/jwt",
                      "authType/password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "UnityCatalog",
                      "authType/azureClientSecret",
                      "authType/clientSecret",
                      "authType/token",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"),
                  paths(
                      "Vertica",
                      "password",
                      "sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey"))),
          Map.entry(
              "driveService",
              Map.ofEntries(
                  paths("GoogleDrive", "credentials/gcpConfig/privateKey"),
                  paths(
                      "Sftp",
                      "authType/password",
                      "authType/privateKey",
                      "authType/privateKeyPassphrase"),
                  paths("SharePoint", "clientSecret"))),
          Map.entry(
              "llmService",
              Map.ofEntries(
                  paths("Anthropic", "apiKey"),
                  paths("AzureOpenAI", "apiKey"),
                  paths("Bedrock", "awsAccessKeyId", "awsSecretAccessKey", "awsSessionToken"),
                  paths("CustomLLM", "apiKey", "headers/{}"),
                  paths("HuggingFace", "apiKey"),
                  paths("OpenAI", "apiKey"),
                  paths("VertexAI", "credentials"))),
          Map.entry("mcpService", Map.ofEntries(paths("Mcp", "servers/[]/apiKey"))),
          Map.entry(
              "messagingService",
              Map.ofEntries(
                  paths(
                      "Kafka",
                      "basicAuthUserInfo",
                      "consumerConfig/sasl.oauthbearer.assertion.private.key.passphrase",
                      "consumerConfig/sasl.oauthbearer.assertion.private.key.pem",
                      "consumerConfig/sasl.oauthbearer.client.secret",
                      "consumerConfig/sasl.oauthbearer.config",
                      "consumerConfig/sasl.password",
                      "consumerConfig/ssl.key.password",
                      "consumerConfig/ssl.key.pem",
                      "consumerConfig/ssl.keystore.password",
                      "consumerConfig/ssl.truststore.password",
                      "consumerConfig/{}",
                      "consumerConfigSSL/caCertificate",
                      "consumerConfigSSL/sslCertificate",
                      "consumerConfigSSL/sslKey",
                      "saslPassword",
                      "schemaRegistryConfig/basic.auth.user.info",
                      "schemaRegistryConfig/bearer.auth.client.secret",
                      "schemaRegistryConfig/bearer.auth.token",
                      "schemaRegistryConfig/{}",
                      "schemaRegistrySSL/caCertificate",
                      "schemaRegistrySSL/sslCertificate",
                      "schemaRegistrySSL/sslKey"),
                  paths("Kinesis", "awsConfig/awsSecretAccessKey", "awsConfig/awsSessionToken"),
                  paths(
                      "Nats",
                      "authType/nkeySeed",
                      "authType/password",
                      "authType/token",
                      "tlsConfig/caCertificate",
                      "tlsConfig/sslCertificate",
                      "tlsConfig/sslKey"),
                  paths("PubSub", "gcpConfig/gcpConfig/privateKey"),
                  paths(
                      "Redpanda",
                      "basicAuthUserInfo",
                      "consumerConfig/sasl.oauthbearer.assertion.private.key.passphrase",
                      "consumerConfig/sasl.oauthbearer.assertion.private.key.pem",
                      "consumerConfig/sasl.oauthbearer.client.secret",
                      "consumerConfig/sasl.oauthbearer.config",
                      "consumerConfig/sasl.password",
                      "consumerConfig/ssl.key.password",
                      "consumerConfig/ssl.key.pem",
                      "consumerConfig/ssl.keystore.password",
                      "consumerConfig/ssl.truststore.password",
                      "consumerConfig/{}",
                      "saslPassword",
                      "schemaRegistryConfig/basic.auth.user.info",
                      "schemaRegistryConfig/bearer.auth.client.secret",
                      "schemaRegistryConfig/bearer.auth.token",
                      "schemaRegistryConfig/{}"))),
          Map.entry(
              "metadataService",
              Map.ofEntries(
                  paths(
                      "Alation",
                      "authType/accessToken",
                      "authType/password",
                      "connection/authType/awsConfig/awsSecretAccessKey",
                      "connection/authType/awsConfig/awsSessionToken",
                      "connection/authType/azureConfig/clientSecret",
                      "connection/authType/gcpConfig/gcpConfig/privateKey",
                      "connection/authType/password",
                      "connection/sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "connection/sslConfig/caCertificate",
                      "connection/sslConfig/sslCertificate",
                      "connection/sslConfig/sslKey"),
                  paths(
                      "AlationSink",
                      "authType/accessToken",
                      "authType/password",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths("Amundsen", "password"),
                  paths("Atlas", "password"),
                  paths("Collibra", "password"),
                  paths(
                      "OpenMetadata",
                      "securityConfig/jwtToken",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"))),
          Map.entry(
              "mlmodelService",
              Map.ofEntries(
                  paths("Mlflow", "registryUri"),
                  paths("SageMaker", "awsConfig/awsSecretAccessKey", "awsConfig/awsSessionToken"),
                  paths("VertexAI", "credentials/gcpConfig/privateKey"))),
          Map.entry(
              "pipelineService",
              Map.ofEntries(
                  paths("Airbyte", "auth/clientSecret", "auth/password"),
                  paths(
                      "Airflow",
                      "connection/authConfig/credentials/gcpConfig/privateKey",
                      "connection/authConfig/mwaaConfig/awsConfig/awsSecretAccessKey",
                      "connection/authConfig/mwaaConfig/awsConfig/awsSessionToken",
                      "connection/authConfig/password",
                      "connection/authConfig/token",
                      "connection/authType/awsConfig/awsSecretAccessKey",
                      "connection/authType/awsConfig/awsSessionToken",
                      "connection/authType/azureConfig/clientSecret",
                      "connection/authType/gcpConfig/gcpConfig/privateKey",
                      "connection/authType/password",
                      "connection/password",
                      "connection/sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "connection/sslConfig/caCertificate",
                      "connection/sslConfig/sslCertificate",
                      "connection/sslConfig/sslKey"),
                  paths("DBTCloud", "token"),
                  paths("Dagster", "token"),
                  paths("Data360Pipeline", "consumerKey", "consumerSecret"),
                  paths("DataFactory", "configSource/clientSecret"),
                  paths(
                      "DatabricksPipeline",
                      "authType/azureClientSecret",
                      "authType/clientSecret",
                      "authType/token",
                      "token"),
                  paths("DomoPipeline", "accessToken", "secretToken"),
                  paths(
                      "Fivetran",
                      "apiKey",
                      "apiSecret",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "Flink",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "GluePipeline", "awsConfig/awsSecretAccessKey", "awsConfig/awsSessionToken"),
                  paths("KafkaConnect", "KafkaConnectConfig/password"),
                  paths(
                      "KinesisFirehose",
                      "awsConfig/awsSecretAccessKey",
                      "awsConfig/awsSessionToken"),
                  paths(
                      "Matillion",
                      "connection/clientSecret",
                      "connection/password",
                      "connection/personalAccessToken",
                      "connection/sslConfig/caCertificate",
                      "connection/sslConfig/sslCertificate",
                      "connection/sslConfig/sslKey"),
                  paths("MicrosoftFabricPipeline", "clientSecret"),
                  paths("Mulesoft", "authentication/clientSecret", "authentication/password"),
                  paths("Nifi", "nifiConfig/password"),
                  paths(
                      "OpenLineage",
                      "brokerConfig/awsConfig/awsSecretAccessKey",
                      "brokerConfig/awsConfig/awsSessionToken",
                      "brokerConfig/saslConfig/saslPassword",
                      "brokerConfig/sslConfig/caCertificate",
                      "brokerConfig/sslConfig/sslCertificate",
                      "brokerConfig/sslConfig/sslKey",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "Prefect",
                      "authType/apiKey",
                      "authType/authString",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "SSIS",
                      "databaseConnection/password",
                      "databaseConnection/sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "databaseConnection/sslConfig/caCertificate",
                      "databaseConnection/sslConfig/sslCertificate",
                      "databaseConnection/sslConfig/sslKey",
                      "packageConnection/awsConfig/awsSecretAccessKey",
                      "packageConnection/awsConfig/awsSessionToken",
                      "packageConnection/credentials/clientSecret"),
                  paths("SapBw4HanaPipeline", "password"),
                  paths("Snowplow", "apiKey"),
                  paths("Stitch", "token"),
                  paths(
                      "TableauPipeline",
                      "authType/password",
                      "authType/personalAccessTokenSecret",
                      "authType/secretValue",
                      "sslConfig/caCertificate",
                      "sslConfig/sslCertificate",
                      "sslConfig/sslKey"),
                  paths(
                      "Wherescape",
                      "databaseConnection/password",
                      "databaseConnection/sampleDataStorageConfig/config/storageConfig/awsSecretAccessKey",
                      "databaseConnection/sslConfig/caCertificate",
                      "databaseConnection/sslConfig/sslCertificate",
                      "databaseConnection/sslConfig/sslKey"))),
          Map.entry(
              "searchService",
              Map.ofEntries(
                  paths(
                      "ElasticSearch",
                      "authType/apiKey",
                      "authType/password",
                      "sslConfig/certificates/caCertValue",
                      "sslConfig/certificates/clientCertValue",
                      "sslConfig/certificates/privateKeyValue"),
                  paths(
                      "OpenSearch",
                      "authType/awsSecretAccessKey",
                      "authType/awsSessionToken",
                      "authType/password",
                      "sslConfig/certificates/caCertValue",
                      "sslConfig/certificates/clientCertValue",
                      "sslConfig/certificates/privateKeyValue"))),
          Map.entry("securityService", Map.ofEntries(paths("Ranger", "authType/password"))),
          Map.entry(
              "storageService",
              Map.ofEntries(
                  paths("ADLS", "credentials/clientSecret"),
                  paths("GCS", "credentials/gcpConfig/privateKey"),
                  paths("S3", "awsConfig/awsSecretAccessKey", "awsConfig/awsSessionToken"))));

  private static Map.Entry<String, List<String>> paths(String type, String... paths) {
    return Map.entry(type, List.of(paths));
  }
}
