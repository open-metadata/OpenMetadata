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

package org.openmetadata.service.clients.pipeline.config;

import java.util.UUID;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateMetadataService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.app.external.CollateAIAppConfig;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MetadataConnection;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerClientLoader;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.security.ssl.VerifySSL;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.services.connections.metadata.ComponentConfig;
import org.openmetadata.schema.services.connections.metadata.ElasticsSearch;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityReference;

public abstract class WorkflowConfigTest {

  public static final String MOCK_SERVICE_NAME = "mysqlDB";
  public static final DatabaseService MOCK_SERVICE =
      new DatabaseService()
          .withId(UUID.randomUUID())
          .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
          .withName(MOCK_SERVICE_NAME)
          .withConnection(
              new DatabaseConnection()
                  .withConfig(
                      new MysqlConnection()
                          .withHostPort("mysql.example.com:3306")
                          .withUsername("mysql_user")
                          .withDatabaseName("testdb")));

  public static final String OM_SERVICE_NAME = "OpenMetadata";
  public static final MetadataService MOCK_OM_SERVICE =
      new MetadataService()
          .withId(UUID.randomUUID())
          .withServiceType(CreateMetadataService.MetadataServiceType.OpenMetadataServer)
          .withName(OM_SERVICE_NAME)
          .withConnection(
              new MetadataConnection()
                  .withConfig(
                      new OpenMetadataConnection()
                          .withHostPort("http://openmetadata-server:8585/api")
                          .withElasticsSearch(
                              new ElasticsSearch().withConfig(new ComponentConfig()))));

  IngestionPipeline newMetadataIngestionPipeline() {
    return new IngestionPipeline()
        .withName("testPipeline")
        .withFullyQualifiedName(MOCK_SERVICE_NAME + ".testPipeline")
        .withPipelineType(PipelineType.METADATA)
        .withLoggerLevel(LogLevels.DEBUG)
        .withService(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType("databaseService")
                .withName(MOCK_SERVICE_NAME))
        .withSourceConfig(new SourceConfig().withConfig(new DatabaseServiceMetadataPipeline()))
        .withAirflowConfig(new AirflowConfig().withRetries(1))
        .withOpenMetadataServerConnection(
            new OpenMetadataConnection()
                .withAuthProvider(AuthProvider.OPENMETADATA)
                .withHostPort("http://openmetadata-server:8585/api")
                .withSecurityConfig(new OpenMetadataJWTClientConfig().withJwtToken("token"))
                .withClusterName("clusterName")
                .withVerifySSL(VerifySSL.NO_SSL)
                .withSecretsManagerLoader(SecretsManagerClientLoader.NOOP)
                .withSecretsManagerProvider(SecretsManagerProvider.DB));
  }

  IngestionPipeline newApplicationPipeline() {
    return new IngestionPipeline()
        .withName("appPipeline")
        .withFullyQualifiedName(OM_SERVICE_NAME + ".appPipeline")
        .withPipelineType(PipelineType.APPLICATION)
        .withLoggerLevel(LogLevels.DEBUG)
        .withService(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType("metadataService")
                .withName(OM_SERVICE_NAME))
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    new ApplicationPipeline()
                        .withType(ApplicationPipeline.ApplicationConfigType.APPLICATION)
                        .withSourcePythonClass("metadata.ingestion.path")
                        .withAppConfig(new CollateAIAppConfig())))
        .withOpenMetadataServerConnection(
            new OpenMetadataConnection()
                .withAuthProvider(AuthProvider.OPENMETADATA)
                .withHostPort("http://openmetadata-server:8585/api")
                .withSecurityConfig(new OpenMetadataJWTClientConfig().withJwtToken("token"))
                .withClusterName("clusterName")
                .withVerifySSL(VerifySSL.NO_SSL)
                .withSecretsManagerLoader(SecretsManagerClientLoader.NOOP)
                .withSecretsManagerProvider(SecretsManagerProvider.DB));
  }
}
