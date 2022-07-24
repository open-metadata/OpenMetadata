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

package org.openmetadata.catalog.resources.services.ingestionpipelines;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.core.SecurityContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedConstruction.Context;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.airflow.AirflowRESTClient;
import org.openmetadata.catalog.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.PipelineServiceClient;

@ExtendWith(MockitoExtension.class)
public class IngestionPipelineResourceUnitTest {

  private static final String DAG_ID = UUID.randomUUID().toString();

  private IngestionPipelineResource ingestionPipelineResource;

  @Mock SecurityContext securityContext;

  @Mock Authorizer authorizer;

  @Mock CollectionDAO collectionDAO;

  @Mock CatalogApplicationConfig catalogApplicationConfig;

  @Mock IngestionPipeline ingestionPipeline;

  @BeforeEach
  void setUp() throws IOException {
    CollectionDAO.IngestionPipelineDAO entityDAO = mock(CollectionDAO.IngestionPipelineDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.EntityRelationshipRecord entityRelationshipRecord =
        mock(CollectionDAO.EntityRelationshipRecord.class);
    when(entityRelationshipRecord.getId()).thenReturn(UUID.randomUUID());
    when(entityRelationshipRecord.getType()).thenReturn("ingestionPipeline");
    when(relationshipDAO.findFrom(any(), any(), anyInt())).thenReturn(List.of(entityRelationshipRecord));
    when(collectionDAO.ingestionPipelineDAO()).thenReturn(entityDAO);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(entityDAO.findEntityById(any(), any())).thenReturn(ingestionPipeline);
    when(entityDAO.findEntityReferenceById(any(), any())).thenReturn(mock(EntityReference.class));
    when(entityDAO.getEntityClass()).thenReturn(IngestionPipeline.class);
    when(ingestionPipeline.getId()).thenReturn(UUID.fromString(DAG_ID));
    ingestionPipelineResource = new IngestionPipelineResource(collectionDAO, authorizer);
  }

  @Test
  public void testLastIngestionLogsAreRetrieved() throws IOException {
    Map<String, String> expectedMap = Map.of("task", "log");
    try (MockedConstruction<AirflowRESTClient> mocked =
        mockConstruction(AirflowRESTClient.class, this::preparePipelineServiceClient)) {
      ingestionPipelineResource.initialize(catalogApplicationConfig);
      assertEquals(
          expectedMap, ingestionPipelineResource.getLastIngestionLogs(null, securityContext, DAG_ID).getEntity());
      PipelineServiceClient client = mocked.constructed().get(0);
      verify(client).getLastIngestionLogs(ingestionPipeline);
    }
  }

  private void preparePipelineServiceClient(AirflowRESTClient mockPipelineServiceClient, Context context) {
    when(mockPipelineServiceClient.getLastIngestionLogs(any())).thenReturn(Map.of("task", "log"));
  }
}
