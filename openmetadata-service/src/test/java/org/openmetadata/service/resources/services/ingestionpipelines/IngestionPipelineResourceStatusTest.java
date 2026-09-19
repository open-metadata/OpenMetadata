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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import jakarta.ws.rs.core.SecurityContext;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;

class IngestionPipelineResourceStatusTest {

  /**
   * A deployment with no pipeline service client configured leaves the client null, and the status
   * it answers with is a healthy 200 — nothing is broken. {@code platform} is the only field that
   * separates that from a working client, and the UI keys its disabled state off it, so leaving it
   * out (as this did) left the agent lists with no way to say that deploying or running an agent
   * does nothing. It is also required by the response schema.
   */
  @Test
  void statusOfDisabledClientReportsTheDisabledPlatform() {
    try (MockedStatic<Entity> entityMock = mockEntityRepository()) {
      // Never initialized, so the client is null exactly as it is when the configuration disables
      // it — `PipelineServiceClientFactory` returns null for that case.
      IngestionPipelineResource resource =
          new IngestionPipelineResource(mock(Authorizer.class), mock(Limits.class));

      PipelineServiceClientResponse status =
          resource.getRESTStatus(null, mock(SecurityContext.class));

      assertEquals(200, status.getCode());
      assertEquals(PipelineServiceClientInterface.DISABLED_STATUS, status.getPlatform());
      assertEquals("Pipeline Client Disabled", status.getReason());
    }
  }

  private MockedStatic<Entity> mockEntityRepository() {
    MockedStatic<Entity> entityMock = mockStatic(Entity.class);
    entityMock
        .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
        .thenReturn(mock(IngestionPipelineRepository.class));
    return entityMock;
  }
}
