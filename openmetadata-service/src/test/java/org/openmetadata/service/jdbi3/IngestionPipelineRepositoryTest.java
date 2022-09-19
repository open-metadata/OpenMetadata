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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.LinkedHashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.secrets.SecretsManager;

@ExtendWith(MockitoExtension.class)
public class IngestionPipelineRepositoryTest {

  @Mock protected CollectionDAO collectionDAO;

  @Mock protected SecretsManager secretsManager;

  @Mock protected CollectionDAO.IngestionPipelineDAO dao;

  protected IngestionPipelineRepository ingestionPipelineRepository;

  @BeforeEach
  void beforeEach() {
    when(collectionDAO.ingestionPipelineDAO()).thenReturn(dao);
    ingestionPipelineRepository = new IngestionPipelineRepository(collectionDAO, secretsManager);
  }

  @AfterEach
  void afterEach() {
    reset(secretsManager);
  }

  @Test
  void testStoreEntityCallCorrectlyLocalSecretManager() throws IOException {
    IngestionPipeline ingestionPipeline = initStoreEntityTest(true);

    ArgumentCaptor<EntityReference> serviceCaptor = ArgumentCaptor.forClass(EntityReference.class);
    ArgumentCaptor<String> ingestionPipelineStringCaptor = ArgumentCaptor.forClass(String.class);

    ingestionPipelineRepository.storeEntity(ingestionPipeline, true);

    verify(secretsManager)
        .encryptOrDecryptDbtConfigSource(any(IngestionPipeline.class), serviceCaptor.capture(), eq(true));
    verify(dao).update(isNull(), ingestionPipelineStringCaptor.capture());

    assertEquals("databaseService", serviceCaptor.getValue().getType());
    assertEquals("serviceName", serviceCaptor.getValue().getName());
    assertEquals(
        "{\"name\":\"testPipeline\",\"sourceConfig\":{\"config\":{\"type\":\"DatabaseMetadata\",\"markDeletedTables\":true,\"includeTables\":true,\"includeViews\":true,\"includeTags\":true,\"dbtConfigSource\":{}}},\"loggerLevel\":\"INFO\",\"enabled\":true,\"version\":0.1,\"deleted\":false}",
        ingestionPipelineStringCaptor.getValue());
  }

  @Test
  void testStoreEntityCallCorrectlyAWSSecretManager() throws IOException {
    IngestionPipeline ingestionPipeline = initStoreEntityTest(false);

    ArgumentCaptor<EntityReference> serviceCaptor = ArgumentCaptor.forClass(EntityReference.class);
    ArgumentCaptor<String> ingestionPipelineStringCaptor = ArgumentCaptor.forClass(String.class);

    ingestionPipelineRepository.storeEntity(ingestionPipeline, true);

    verify(secretsManager)
        .encryptOrDecryptDbtConfigSource(any(IngestionPipeline.class), serviceCaptor.capture(), eq(true));
    verify(dao).update(isNull(), ingestionPipelineStringCaptor.capture());

    assertEquals("databaseService", serviceCaptor.getValue().getType());
    assertEquals("serviceName", serviceCaptor.getValue().getName());
    assertEquals(
        "{\"name\":\"testPipeline\",\"sourceConfig\":{\"config\":{\"type\":\"DatabaseMetadata\",\"markDeletedTables\":true,\"includeTables\":true,\"includeViews\":true,\"includeTags\":true}},\"loggerLevel\":\"INFO\",\"enabled\":true,\"version\":0.1,\"deleted\":false}",
        ingestionPipelineStringCaptor.getValue());
  }

  private IngestionPipeline initStoreEntityTest(boolean isLocal) {
    when(secretsManager.isLocal()).thenReturn(isLocal);
    return new IngestionPipeline()
        .withName("testPipeline")
        .withService(
            new DatabaseService().getEntityReference().withType(Entity.DATABASE_SERVICE).withName("serviceName"))
        .withSourceConfig(
            new SourceConfig()
                .withConfig(new DatabaseServiceMetadataPipeline().withDbtConfigSource(new LinkedHashMap<>())));
  }
}
