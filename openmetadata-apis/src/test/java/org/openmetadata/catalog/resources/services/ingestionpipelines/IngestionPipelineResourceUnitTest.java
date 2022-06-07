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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.verify;

import java.io.IOException;
import java.util.Map;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedConstruction.Context;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.airflow.AirflowRESTClient;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.util.PipelineServiceClient;

@ExtendWith(MockitoExtension.class)
public class IngestionPipelineResourceUnitTest {

  private static final String DAG_NAME = "test_dag";

  private IngestionPipelineResource ingestionPipelineResource;

  @Mock UriInfo uriInfo;

  @Mock SecurityContext securityContext;

  @Mock Authorizer authorizer;

  @Mock CollectionDAO collectionDAO;

  @Spy CollectionDAO.IngestionPipelineDAO ingestionPipelineDAO;

  @Mock CatalogApplicationConfig catalogApplicationConfig;

  @BeforeEach
  void setUp() {
    doReturn(ingestionPipelineDAO).when(collectionDAO).ingestionPipelineDAO();
    ingestionPipelineResource = new IngestionPipelineResource(collectionDAO, authorizer);
  }

  @Test
  public void testLastIngestionLogsAreRetrievedWhen() throws IOException {
    Map<String, String> expectedMap = Map.of("task", "log");
    try (MockedConstruction<AirflowRESTClient> mocked =
        mockConstruction(AirflowRESTClient.class, this::preparePipelineServiceClient)) {
      ingestionPipelineResource.initialize(catalogApplicationConfig);
      assertEquals(
          expectedMap, ingestionPipelineResource.getLastIngestionLogs(uriInfo, securityContext, DAG_NAME).getEntity());
      PipelineServiceClient client = mocked.constructed().get(0);
      verify(client).getLastIngestionLogs(DAG_NAME);
    }
  }

  private void preparePipelineServiceClient(AirflowRESTClient mockPipelineServiceClient, Context context) {
    doReturn(Map.of("task", "log")).when(mockPipelineServiceClient).getLastIngestionLogs(anyString());
  }
}
