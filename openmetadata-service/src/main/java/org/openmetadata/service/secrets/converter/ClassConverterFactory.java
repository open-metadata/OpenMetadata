/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.secrets.converter;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.TestSparkEngineConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtGCSConfig;
import org.openmetadata.schema.security.credentials.ApiAccessTokenAuth;
import org.openmetadata.schema.security.credentials.BasicAuth;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.services.common.SSLCertPaths;
import org.openmetadata.schema.services.common.SSLCertValues;
import org.openmetadata.schema.services.common.SSLConfig;
import org.openmetadata.schema.services.connections.api.OpenAPISchemaFilePath;
import org.openmetadata.schema.services.connections.api.OpenAPISchemaS3;
import org.openmetadata.schema.services.connections.api.OpenAPISchemaURL;
import org.openmetadata.schema.services.connections.api.RestConnection;
import org.openmetadata.schema.services.connections.dashboard.LookerConnection;
import org.openmetadata.schema.services.connections.dashboard.OmniConnection;
import org.openmetadata.schema.services.connections.dashboard.PowerBIConnection;
import org.openmetadata.schema.services.connections.dashboard.SapS4HanaConnection;
import org.openmetadata.schema.services.connections.dashboard.SsrsConnection;
import org.openmetadata.schema.services.connections.dashboard.SupersetConnection;
import org.openmetadata.schema.services.connections.dashboard.TableauConnection;
import org.openmetadata.schema.services.connections.dashboard.ThoughtSpotConnection;
import org.openmetadata.schema.services.connections.dashboard.powerbi.AzureConfig;
import org.openmetadata.schema.services.connections.dashboard.powerbi.S3Config;
import org.openmetadata.schema.services.connections.database.BigQueryConnection;
import org.openmetadata.schema.services.connections.database.BigTableConnection;
import org.openmetadata.schema.services.connections.database.CassandraConnection;
import org.openmetadata.schema.services.connections.database.CockroachConnection;
import org.openmetadata.schema.services.connections.database.DatabricksConnection;
import org.openmetadata.schema.services.connections.database.DatalakeConnection;
import org.openmetadata.schema.services.connections.database.Db2Connection;
import org.openmetadata.schema.services.connections.database.DeltaLakeConnection;
import org.openmetadata.schema.services.connections.database.DorisConnection;
import org.openmetadata.schema.services.connections.database.DremioConnection;
import org.openmetadata.schema.services.connections.database.GreenplumConnection;
import org.openmetadata.schema.services.connections.database.HiveConnection;
import org.openmetadata.schema.services.connections.database.InformixConnection;
import org.openmetadata.schema.services.connections.database.MicrosoftAccessConnection;
import org.openmetadata.schema.services.connections.database.MongoDBConnection;
import org.openmetadata.schema.services.connections.database.MssqlConnection;
import org.openmetadata.schema.services.connections.database.MyDbConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.services.connections.database.QuestDBConnection;
import org.openmetadata.schema.services.connections.database.RedshiftConnection;
import org.openmetadata.schema.services.connections.database.SalesforceConnection;
import org.openmetadata.schema.services.connections.database.SapErpConnection;
import org.openmetadata.schema.services.connections.database.SapHanaConnection;
import org.openmetadata.schema.services.connections.database.SapSuccessFactorsConnection;
import org.openmetadata.schema.services.connections.database.StarRocksConnection;
import org.openmetadata.schema.services.connections.database.TimescaleConnection;
import org.openmetadata.schema.services.connections.database.TrinoConnection;
import org.openmetadata.schema.services.connections.database.UnityCatalogConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.services.connections.database.databricks.AzureADSetup;
import org.openmetadata.schema.services.connections.database.databricks.DatabricksOAuth;
import org.openmetadata.schema.services.connections.database.databricks.PersonalAccessToken;
import org.openmetadata.schema.services.connections.database.datalake.GCSConfig;
import org.openmetadata.schema.services.connections.database.deltalake.StorageConfig;
import org.openmetadata.schema.services.connections.drive.GoogleDriveConnection;
import org.openmetadata.schema.services.connections.drive.SftpConnection;
import org.openmetadata.schema.services.connections.drive.sftp.SftpBasicAuth;
import org.openmetadata.schema.services.connections.drive.sftp.SftpKeyAuth;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.services.connections.messaging.NatsConnection;
import org.openmetadata.schema.services.connections.messaging.PubSubConnection;
import org.openmetadata.schema.services.connections.metadata.AlationConnection;
import org.openmetadata.schema.services.connections.metadata.AlationSinkConnection;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.services.connections.mlmodel.VertexAIConnection;
import org.openmetadata.schema.services.connections.pipeline.AirbyteConnection;
import org.openmetadata.schema.services.connections.pipeline.AirflowConnection;
import org.openmetadata.schema.services.connections.pipeline.AirflowRestApiConnection;
import org.openmetadata.schema.services.connections.pipeline.DatabricksPipelineConnection;
import org.openmetadata.schema.services.connections.pipeline.FivetranConnection;
import org.openmetadata.schema.services.connections.pipeline.FlinkConnection;
import org.openmetadata.schema.services.connections.pipeline.MatillionConnection;
import org.openmetadata.schema.services.connections.pipeline.MulesoftConnection;
import org.openmetadata.schema.services.connections.pipeline.NifiConnection;
import org.openmetadata.schema.services.connections.pipeline.OpenLineageConnection;
import org.openmetadata.schema.services.connections.pipeline.PrefectConnection;
import org.openmetadata.schema.services.connections.pipeline.SSISConnection;
import org.openmetadata.schema.services.connections.pipeline.WherescapeConnection;
import org.openmetadata.schema.services.connections.pipeline.matillion.MatillionETLAuth;
import org.openmetadata.schema.services.connections.pipeline.openlineage.KafkaBrokerConfig;
import org.openmetadata.schema.services.connections.search.ElasticSearchConnection;
import org.openmetadata.schema.services.connections.search.OpenSearchConnection;
import org.openmetadata.schema.services.connections.security.RangerConnection;
import org.openmetadata.schema.services.connections.storage.GCSConnection;
import org.openmetadata.schema.services.connections.storage.S3Connection;

/** Factory class to get a `ClassConverter` based on the service class. */
public final class ClassConverterFactory {
  private ClassConverterFactory() {
    /* Final Class */
  }

  @Getter private static final Map<Class<?>, ClassConverter> converterMap;

  /**
   * Connections whose {@code Object} properties -- the ones a JSON Schema {@code oneOf} produces --
   * only need to be re-typed so the password masker and the secrets manager can walk into them. See
   * {@link NestedConfigClassConverter}; anything needing more logic gets its own converter above.
   */
  private static final Map<Class<?>, ClassConverter> NESTED_CONFIG_CONVERTERS =
      Map.ofEntries(
          Map.entry(
              AlationConnection.class,
              new NestedConfigClassConverter(
                  AlationConnection.class,
                  Map.of(
                      "authType", List.of(BasicAuth.class, ApiAccessTokenAuth.class),
                      "connection", List.of(PostgresConnection.class, MysqlConnection.class)))),
          Map.entry(
              AlationSinkConnection.class,
              new NestedConfigClassConverter(
                  AlationSinkConnection.class,
                  Map.of(
                      "authType", List.of(BasicAuth.class, ApiAccessTokenAuth.class),
                      "sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              DatabricksPipelineConnection.class,
              new NestedConfigClassConverter(
                  DatabricksPipelineConnection.class,
                  Map.of(
                      "authType",
                      List.of(
                          PersonalAccessToken.class, DatabricksOAuth.class, AzureADSetup.class)))),
          Map.entry(
              Db2Connection.class,
              new NestedConfigClassConverter(
                  Db2Connection.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              DorisConnection.class,
              new NestedConfigClassConverter(
                  DorisConnection.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              FivetranConnection.class,
              new NestedConfigClassConverter(
                  FivetranConnection.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              FlinkConnection.class,
              new NestedConfigClassConverter(
                  FlinkConnection.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              InformixConnection.class,
              new NestedConfigClassConverter(
                  InformixConnection.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              KafkaBrokerConfig.class,
              new NestedConfigClassConverter(
                  KafkaBrokerConfig.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              KafkaConnection.class,
              new NestedConfigClassConverter(
                  KafkaConnection.class,
                  Map.of(
                      "consumerConfigSSL", List.of(ValidateSSLClientConfig.class),
                      "schemaRegistrySSL", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              MatillionETLAuth.class,
              new NestedConfigClassConverter(
                  MatillionETLAuth.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              MicrosoftAccessConnection.class,
              new NestedConfigClassConverter(
                  MicrosoftAccessConnection.class,
                  Map.of("connection", List.of(S3Connection.class)))),
          Map.entry(
              MongoDBConnection.class,
              new NestedConfigClassConverter(
                  MongoDBConnection.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              MyDbConnection.class,
              new NestedConfigClassConverter(
                  MyDbConnection.class,
                  Map.of(
                      "authType", List.of(basicAuth.class),
                      "sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              NatsConnection.class,
              new NestedConfigClassConverter(
                  NatsConnection.class,
                  Map.of("tlsConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              OmniConnection.class,
              new NestedConfigClassConverter(
                  OmniConnection.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              OpenMetadataConnection.class,
              new NestedConfigClassConverter(
                  OpenMetadataConnection.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              PowerBIConnection.class,
              new NestedConfigClassConverter(
                  PowerBIConnection.class,
                  Map.of(
                      "pbitFilesSource",
                      List.of(
                          AzureConfig.class,
                          org.openmetadata.schema.services.connections.dasboard.powerbi.GCSConfig
                              .class,
                          S3Config.class)))),
          Map.entry(
              QuestDBConnection.class,
              new NestedConfigClassConverter(
                  QuestDBConnection.class, Map.of("authType", List.of(basicAuth.class)))),
          Map.entry(
              RestConnection.class,
              new NestedConfigClassConverter(
                  RestConnection.class,
                  Map.of(
                      "openAPISchemaConnection",
                          List.of(
                              OpenAPISchemaURL.class,
                              OpenAPISchemaFilePath.class,
                              OpenAPISchemaS3.class),
                      "sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              SSLConfig.class,
              new NestedConfigClassConverter(
                  SSLConfig.class,
                  Map.of("certificates", List.of(SSLCertPaths.class, SSLCertValues.class)))),
          Map.entry(
              SapErpConnection.class,
              new NestedConfigClassConverter(
                  SapErpConnection.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              SapS4HanaConnection.class,
              new NestedConfigClassConverter(
                  SapS4HanaConnection.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              SapSuccessFactorsConnection.class,
              new NestedConfigClassConverter(
                  SapSuccessFactorsConnection.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))),
          Map.entry(
              SftpConnection.class,
              new NestedConfigClassConverter(
                  SftpConnection.class,
                  Map.of("authType", List.of(SftpBasicAuth.class, SftpKeyAuth.class)))),
          Map.entry(
              SsrsConnection.class,
              new NestedConfigClassConverter(
                  SsrsConnection.class,
                  Map.of("sslConfig", List.of(ValidateSSLClientConfig.class)))));

  static {
    Map<Class<?>, ClassConverter> converters =
        new HashMap<>(
            Map.ofEntries(
                Map.entry(AirbyteConnection.class, new AirbyteConnectionClassConverter()),
                Map.entry(AirflowConnection.class, new AirflowConnectionClassConverter()),
                Map.entry(
                    AirflowRestApiConnection.class, new AirflowRestApiConnectionClassConverter()),
                Map.entry(BigQueryConnection.class, new BigQueryConnectionClassConverter()),
                Map.entry(BigTableConnection.class, new BigTableConnectionClassConverter()),
                Map.entry(DatalakeConnection.class, new DatalakeConnectionClassConverter()),
                Map.entry(DeltaLakeConnection.class, new DeltaLakeConnectionClassConverter()),
                Map.entry(DremioConnection.class, new DremioConnectionClassConverter()),
                Map.entry(DbtGCSConfig.class, new DbtGCSConfigClassConverter()),
                Map.entry(DbtPipeline.class, new DbtPipelineClassConverter()),
                Map.entry(
                    ElasticSearchConnection.class, new ElasticSearchConnectionClassConverter()),
                Map.entry(OpenSearchConnection.class, new OpenSearchConnectionClassConverter()),
                Map.entry(GCSConfig.class, new GCPConfigClassConverter()),
                Map.entry(GCPCredentials.class, new GcpCredentialsClassConverter()),
                Map.entry(GCSConnection.class, new GcpConnectionClassConverter()),
                Map.entry(GoogleDriveConnection.class, new GoogleDriveConnectionClassConverter()),
                Map.entry(PubSubConnection.class, new PubSubConnectionClassConverter()),
                Map.entry(HiveConnection.class, new HiveConnectionClassConverter()),
                Map.entry(LookerConnection.class, new LookerConnectionClassConverter()),
                Map.entry(
                    MicrosoftAccessConnection.class, new MicrosoftAccessConnectionClassConverter()),
                Map.entry(MssqlConnection.class, new MssqlConnectionClassConverter()),
                Map.entry(MysqlConnection.class, new MysqlConnectionClassConverter()),
                Map.entry(RedshiftConnection.class, new RedshiftConnectionClassConverter()),
                Map.entry(GreenplumConnection.class, new GreenplumConnectionClassConverter()),
                Map.entry(PostgresConnection.class, new PostgresConnectionClassConverter()),
                Map.entry(SapHanaConnection.class, new SapHanaConnectionClassConverter()),
                Map.entry(StarRocksConnection.class, new StarRocksConnectionClassConverter()),
                Map.entry(StorageConfig.class, new StorageConfigClassConverter()),
                Map.entry(SupersetConnection.class, new SupersetConnectionClassConverter()),
                Map.entry(SSOAuthMechanism.class, new SSOAuthMechanismClassConverter()),
                Map.entry(TableauConnection.class, new TableauConnectionClassConverter()),
                Map.entry(ThoughtSpotConnection.class, new ThoughtSpotConnectionClassConverter()),
                Map.entry(MulesoftConnection.class, new MulesoftConnectionClassConverter()),
                Map.entry(SalesforceConnection.class, new SalesforceConnectorClassConverter()),
                Map.entry(
                    TestServiceConnectionRequest.class,
                    new TestServiceConnectionRequestClassConverter()),
                Map.entry(
                    TestSparkEngineConnectionRequest.class,
                    new TestSparkEngineConnectionRequestClassConverter()),
                Map.entry(TrinoConnection.class, new TrinoConnectionClassConverter()),
                Map.entry(Workflow.class, new WorkflowClassConverter()),
                Map.entry(CockroachConnection.class, new CockroachConnectionClassConverter()),
                Map.entry(NifiConnection.class, new NifiConnectionClassConverter()),
                Map.entry(OpenLineageConnection.class, new OpenLineageConnectionClassConverter()),
                Map.entry(MatillionConnection.class, new MatillionConnectionClassConverter()),
                Map.entry(PrefectConnection.class, new PrefectConnectionClassConverter()),
                Map.entry(VertexAIConnection.class, new VertexAIConnectionClassConverter()),
                Map.entry(RangerConnection.class, new RangerConnectionClassConverter()),
                Map.entry(DatabricksConnection.class, new DatabricksConnectionClassConverter()),
                Map.entry(UnityCatalogConnection.class, new UnityCatalogConnectionClassConverter()),
                Map.entry(CassandraConnection.class, new CassandraConnectionClassConverter()),
                Map.entry(SSISConnection.class, new SsisConnectionClassConverter()),
                Map.entry(WherescapeConnection.class, new WherescapeConnectionClassConverter()),
                Map.entry(TimescaleConnection.class, new TimescaleConnectionClassConverter())));
    converters.putAll(NESTED_CONFIG_CONVERTERS);
    converterMap = Map.copyOf(converters);
  }

  public static ClassConverter getConverter(Class<?> clazz) {
    return converterMap.getOrDefault(clazz, new DefaultConnectionClassConverter(clazz));
  }
}
