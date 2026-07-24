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
package org.openmetadata.service.migration.utils.v200;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.generic.GenericType;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class MigrationUtilMySqlTest {

  private static final String PASSWORD = "openmetadata";

  @Container
  static final GenericContainer<?> MYSQL =
      new GenericContainer<>(DockerImageName.parse("mysql:8.0.32"))
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withEnv("MYSQL_DATABASE", "openmetadata")
          .withExposedPorts(3306);

  @Test
  void backfillsMissingAndExplicitJsonNullTypes() {
    String jdbcUrl =
        "jdbc:mysql://%s:%d/openmetadata?allowPublicKeyRetrieval=true&useSSL=false"
            .formatted(MYSQL.getHost(), MYSQL.getMappedPort(3306));
    Jdbi jdbi = Jdbi.create(jdbcUrl, "root", PASSWORD);

    jdbi.useHandle(
        handle -> {
          handle.execute(
              "CREATE TABLE ingestion_pipeline_entity (id VARCHAR(36) PRIMARY KEY, json JSON NOT NULL)");
          handle.execute(
              "CREATE TABLE entity_relationship (fromId VARCHAR(36), toId VARCHAR(36), "
                  + "fromEntity VARCHAR(64), toEntity VARCHAR(64), relation INT, deleted BOOLEAN)");
          handle.execute(
              "INSERT INTO ingestion_pipeline_entity VALUES "
                  + "('explicit-null', '{\"pipelineType\":\"metadata\",\"sourceConfig\":{\"config\":{\"type\":null}}}'), "
                  + "('missing', '{\"pipelineType\":\"metadata\",\"sourceConfig\":{\"config\":{}}}')");
          handle.execute(
              "INSERT INTO entity_relationship VALUES "
                  + "('service', 'explicit-null', 'databaseService', 'ingestionPipeline', 0, false), "
                  + "('service', 'missing', 'databaseService', 'ingestionPipeline', 0, false)");

          try (MockedStatic<DatasourceConfig> datasourceConfig =
              mockStatic(DatasourceConfig.class)) {
            DatasourceConfig config = mock(DatasourceConfig.class);
            datasourceConfig.when(DatasourceConfig::getInstance).thenReturn(config);
            when(config.isMySQL()).thenReturn(true);

            MigrationUtil.backfillMetadataSourceConfigTypes(handle);
          }

          Map<String, String> types =
              handle
                  .createQuery(
                      "SELECT id, JSON_UNQUOTE(JSON_EXTRACT(json, '$.sourceConfig.config.type')) type "
                          + "FROM ingestion_pipeline_entity")
                  .setMapKeyColumn("id")
                  .setMapValueColumn("type")
                  .collectInto(new GenericType<>() {});

          assertEquals("DatabaseMetadata", types.get("explicit-null"));
          assertEquals("DatabaseMetadata", types.get("missing"));
        });
  }
}
