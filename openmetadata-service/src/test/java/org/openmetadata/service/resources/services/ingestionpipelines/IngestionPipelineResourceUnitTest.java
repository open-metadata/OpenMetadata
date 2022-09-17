/*
 *  Copyright 2022 Collate
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.core.SecurityContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedConstruction.Context;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.airflow.AirflowRESTClient;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.PipelineServiceClient;

@ExtendWith(MockitoExtension.class)
public class IngestionPipelineResourceUnitTest {

  private static final UUID DAG_ID = UUID.randomUUID();

  private static final String PIPELINE_NAME = "service_test";

  private IngestionPipelineResource ingestionPipelineResource;

  @Mock SecurityContext securityContext;

  @Mock Authorizer authorizer;

  @Mock CollectionDAO collectionDAO;

  @Mock OpenMetadataApplicationConfig openMetadataApplicationConfig;

  @Mock SecretsManager secretsManager;

  @Mock CollectionDAO.IngestionPipelineDAO entityDAO;

  @BeforeEach
  void setUp() {
    reset(entityDAO, collectionDAO, secretsManager, authorizer);
    CollectionDAO.EntityRelationshipDAO relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.EntityRelationshipRecord entityRelationshipRecord =
        mock(CollectionDAO.EntityRelationshipRecord.class);
    lenient().when(entityRelationshipRecord.getId()).thenReturn(UUID.randomUUID());
    lenient().when(entityRelationshipRecord.getType()).thenReturn("ingestionPipeline");
    lenient().when(relationshipDAO.findFrom(any(), any(), anyInt())).thenReturn(List.of(entityRelationshipRecord));
    when(collectionDAO.ingestionPipelineDAO()).thenReturn(entityDAO);
    lenient().when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    ingestionPipelineResource = new IngestionPipelineResource(collectionDAO, authorizer, secretsManager);
  }

  @Test
  void testLastIngestionLogsAreRetrieved() throws IOException {
    IngestionPipeline ingestionPipeline = mock(IngestionPipeline.class);
    when(ingestionPipeline.getId()).thenReturn(DAG_ID);
    when(entityDAO.findEntityById(any(), any())).thenReturn(ingestionPipeline);
    when(entityDAO.findEntityReferenceById(any(), any())).thenReturn(mock(EntityReference.class));
    Map<String, String> expectedMap = Map.of("task", "log");
    try (MockedConstruction<AirflowRESTClient> mocked =
        mockConstruction(AirflowRESTClient.class, this::preparePipelineServiceClient)) {
      ingestionPipelineResource.initialize(openMetadataApplicationConfig);
      assertEquals(
          expectedMap, ingestionPipelineResource.getLastIngestionLogs(null, securityContext, DAG_ID).getEntity());
      PipelineServiceClient client = mocked.constructed().get(0);
      verify(client).getLastIngestionLogs(ingestionPipeline);
    }
  }

  @Test
  void testTestConnectionCallSecretsManager() {
    TestServiceConnection testServiceConnection = new TestServiceConnection();
    try (MockedConstruction<AirflowRESTClient> mocked =
        mockConstruction(AirflowRESTClient.class, this::preparePipelineServiceClient)) {
      ingestionPipelineResource.initialize(openMetadataApplicationConfig);
      PipelineServiceClient client = mocked.constructed().get(0);
      HttpResponse<String> httpResponse = mock(HttpResponse.class);
      when(client.testConnection(any())).thenReturn(httpResponse);
      ingestionPipelineResource.testIngestion(null, null, testServiceConnection);
      verify(client).testConnection(testServiceConnection);
      verify(secretsManager).storeTestConnectionObject(testServiceConnection);
    }
  }

  @ParameterizedTest
  @MethodSource(
      "org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResourceUnitTestParams#params")
  void testGetIsEncryptedWhenSecretManagerIsConfigured(
      Object config,
      EntityReference service,
      Class<? extends EntityInterface> serviceClass,
      PipelineType pipelineType,
      boolean mustBeEncrypted)
      throws IOException {
    UUID id = UUID.randomUUID();

    IngestionPipeline ingestionPipeline = buildIngestionPipeline(config, pipelineType, id);

    Entity.registerEntity(serviceClass, service.getType(), mock(EntityDAO.class), mock(EntityRepository.class));

    doAnswer(
            invocation -> {
              if (mustBeEncrypted) {
                IngestionPipeline arg0 = invocation.getArgument(0);
                ((DatabaseServiceMetadataPipeline) arg0.getSourceConfig().getConfig()).setDbtConfigSource(null);
              }
              return null;
            })
        .when(secretsManager)
        .encryptOrDecryptDbtConfigSource(any(IngestionPipeline.class), anyBoolean());

    when(entityDAO.findEntityById(eq(id), any())).thenReturn(ingestionPipeline);
    when(entityDAO.findEntityReferenceById(any(), any())).thenReturn(service);

    IngestionPipeline actualIngestionPipeline = ingestionPipelineResource.get(null, securityContext, id, null, null);

    verifySecretManagerIsCalled(mustBeEncrypted, ingestionPipeline);
    assertIngestionPipelineDbtConfigIsEncrypted(mustBeEncrypted, actualIngestionPipeline);
  }

  @ParameterizedTest
  @MethodSource(
      "org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResourceUnitTestParams#params")
  void testGetByNameIsEncryptedWhenSecretManagerIsConfigured(
      Object config,
      EntityReference service,
      Class<? extends EntityInterface> serviceClass,
      PipelineType pipelineType,
      boolean mustBeEncrypted)
      throws IOException {
    UUID id = UUID.randomUUID();

    IngestionPipeline ingestionPipeline = buildIngestionPipeline(config, pipelineType, id);

    Entity.registerEntity(serviceClass, service.getType(), mock(EntityDAO.class), mock(EntityRepository.class));

    when(entityDAO.findEntityByName(eq(PIPELINE_NAME), any())).thenReturn(ingestionPipeline);
    when(entityDAO.findEntityReferenceById(any(), any())).thenReturn(service);

    doAnswer(
            invocation -> {
              if (mustBeEncrypted) {
                IngestionPipeline arg0 = invocation.getArgument(0);
                ((DatabaseServiceMetadataPipeline) arg0.getSourceConfig().getConfig()).setDbtConfigSource(null);
              }
              return null;
            })
        .when(secretsManager)
        .encryptOrDecryptDbtConfigSource(any(IngestionPipeline.class), anyBoolean());

    IngestionPipeline actualIngestionPipeline =
        ingestionPipelineResource.getByName(null, PIPELINE_NAME, securityContext, null, null);

    verifySecretManagerIsCalled(mustBeEncrypted, ingestionPipeline);
    assertIngestionPipelineDbtConfigIsEncrypted(mustBeEncrypted, actualIngestionPipeline);
  }

  private void preparePipelineServiceClient(AirflowRESTClient mockPipelineServiceClient, Context context) {
    when(mockPipelineServiceClient.getLastIngestionLogs(any())).thenReturn(Map.of("task", "log"));
  }

  private IngestionPipeline buildIngestionPipeline(Object config, PipelineType pipelineType, UUID id) {
    return new IngestionPipeline()
        .withId(id)
        .withPipelineType(pipelineType)
        .withSourceConfig(new SourceConfig().withConfig(config))
        .withName(PIPELINE_NAME);
  }

  private void verifySecretManagerIsCalled(boolean mustBeEncrypted, IngestionPipeline ingestionPipeline) {
    if (mustBeEncrypted) {
      verify(secretsManager).encryptOrDecryptDbtConfigSource(ingestionPipeline, false);
    } else {
      verify(secretsManager, never()).encryptOrDecryptDbtConfigSource(any(), any(), anyBoolean());
    }
  }

  private void assertIngestionPipelineDbtConfigIsEncrypted(
      boolean mustBeEncrypted, IngestionPipeline actualIngestionPipeline) {
    if (mustBeEncrypted) {
      assertNull(
          ((DatabaseServiceMetadataPipeline) actualIngestionPipeline.getSourceConfig().getConfig())
              .getDbtConfigSource());
    } else {
      assertNotNull(actualIngestionPipeline.getSourceConfig().getConfig());
    }
  }
}
