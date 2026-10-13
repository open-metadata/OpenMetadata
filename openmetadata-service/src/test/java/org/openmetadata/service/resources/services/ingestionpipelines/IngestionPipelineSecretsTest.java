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

package org.openmetadata.service.resources.services.ingestionpipelines;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

class IngestionPipelineSecretsTest {

  private final OpenMetadataApplicationConfig config = mock(OpenMetadataApplicationConfig.class);
  private final SecretsManager secretsManager = mock(SecretsManager.class);
  private final OpenMetadataConnection builtConnection = new OpenMetadataConnection();
  private final OpenMetadataConnection encryptedConnection = new OpenMetadataConnection();
  private final List<List<?>> builderArguments = new ArrayList<>();

  private MockedStatic<Entity> entity;
  private MockedStatic<SecretsManagerFactory> secretsManagerFactory;
  private MockedConstruction<OpenMetadataConnectionBuilder> connectionBuilders;

  @BeforeEach
  void setUp() {
    entity = mockStatic(Entity.class);
    entity
        .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
        .thenReturn(mock(IngestionPipelineRepository.class));
    secretsManagerFactory = mockStatic(SecretsManagerFactory.class);
    secretsManagerFactory.when(SecretsManagerFactory::getSecretsManager).thenReturn(secretsManager);
    when(secretsManager.encryptOpenMetadataConnection(builtConnection, false))
        .thenReturn(encryptedConnection);
    connectionBuilders =
        mockConstruction(
            OpenMetadataConnectionBuilder.class,
            (builder, context) -> {
              builderArguments.add(context.arguments());
              when(builder.build()).thenReturn(builtConnection);
            });
  }

  @AfterEach
  void tearDown() {
    connectionBuilders.close();
    secretsManagerFactory.close();
    entity.close();
  }

  private static IngestionPipeline storedPipeline() {
    return new IngestionPipeline()
        .withId(UUID.randomUUID())
        .withName("lineage")
        .withPipelineType(PipelineType.LINEAGE)
        .withSourceConfig(new SourceConfig());
  }

  @Test
  void prepareForPipelineServiceAttachesTheConnectionOfThePipelinesBot() {
    IngestionPipeline pipeline = storedPipeline();

    IngestionPipelineSecrets.prepareForPipelineService(config, pipeline);

    assertSame(encryptedConnection, pipeline.getOpenMetadataServerConnection());
    assertEquals(List.of(List.of(config, pipeline)), builderArguments);
    verify(secretsManager).decryptIngestionPipeline(pipeline);
  }

  @Test
  void deployPreparationMatchesPrepareForPipelineService() {
    IngestionPipeline pipeline = storedPipeline();

    IngestionPipelineSecrets.decryptOrNullify(
        mock(Authorizer.class), mock(SecurityContext.class), config, pipeline, true);

    assertSame(encryptedConnection, pipeline.getOpenMetadataServerConnection());
    assertEquals(List.of(List.of(config, pipeline)), builderArguments);
    verify(secretsManager).decryptIngestionPipeline(pipeline);
  }

  @Test
  void responsePreparationNeverCarriesTheConnection() {
    IngestionPipeline pipeline =
        storedPipeline().withOpenMetadataServerConnection(new OpenMetadataConnection());

    IngestionPipelineSecrets.decryptOrNullify(
        mock(Authorizer.class), mock(SecurityContext.class), config, pipeline, false);

    assertNull(pipeline.getOpenMetadataServerConnection());
    assertTrue(builderArguments.isEmpty());
  }
}
