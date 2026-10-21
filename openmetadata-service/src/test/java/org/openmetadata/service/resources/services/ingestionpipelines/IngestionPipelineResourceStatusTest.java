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
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.lang.reflect.Field;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientPlatform;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

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
      assertEquals(PipelineServiceClientPlatform.DISABLED.value(), status.getPlatform());
      assertEquals("Pipeline Client Disabled", status.getReason());
    }
  }

  /**
   * Every user's UI polls the status, but a failure reason can name the orchestrator's URL and the
   * account the server uses against it. A non-admin keeps the code and platform the UI needs to
   * render its unavailable state, and gets a generic reason instead of those details.
   */
  @Test
  void failedStatusHidesItsReasonFromNonAdmins() throws Exception {
    PipelineServiceClientResponse failure = authenticationFailure();

    PipelineServiceClientResponse status = statusSeenBy(false, failure);

    assertEquals(401, status.getCode());
    assertEquals("Airflow", status.getPlatform());
    assertEquals(IngestionPipelineResource.UNAVAILABLE_STATUS_REASON, status.getReason());
  }

  @Test
  void failedStatusKeepsItsReasonForAdmins() throws Exception {
    PipelineServiceClientResponse failure = authenticationFailure();

    PipelineServiceClientResponse status = statusSeenBy(true, failure);

    assertEquals(failure.getReason(), status.getReason());
  }

  /** A healthy client can still carry a reason the UI shows every user, e.g. hybrid runners. */
  @Test
  void healthyStatusKeepsItsReasonForNonAdmins() throws Exception {
    PipelineServiceClientResponse healthy =
        new PipelineServiceClientResponse()
            .withCode(200)
            .withPlatform("Airflow")
            .withReason("Runner [eu-runner] is offline");

    PipelineServiceClientResponse status = statusSeenBy(false, healthy);

    assertEquals(healthy.getReason(), status.getReason());
  }

  private static PipelineServiceClientResponse authenticationFailure() {
    return new PipelineServiceClientResponse()
        .withCode(401)
        .withPlatform("Airflow")
        .withVersion("1.0.0")
        .withReason(
            "Authentication failed for user [admin] trying to access the Airflow APIs at "
                + "[http://airflow.internal:8080]");
  }

  private PipelineServiceClientResponse statusSeenBy(
      boolean admin, PipelineServiceClientResponse clientStatus) throws Exception {
    SecurityContext securityContext = mock(SecurityContext.class);
    PipelineServiceClientInterface client = mock(PipelineServiceClientInterface.class);
    when(client.getServiceStatus()).thenReturn(clientStatus);
    try (MockedStatic<Entity> entityMock = mockEntityRepository();
        MockedStatic<DefaultAuthorizer> authorizerMock = mockStatic(DefaultAuthorizer.class)) {
      authorizerMock
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(new SubjectContext(new User().withName("caller").withIsAdmin(admin), null));
      IngestionPipelineResource resource =
          new IngestionPipelineResource(mock(Authorizer.class), mock(Limits.class));
      Field clientField = IngestionPipelineResource.class.getDeclaredField("pipelineServiceClient");
      clientField.setAccessible(true);
      clientField.set(resource, client);

      return resource.getRESTStatus(null, securityContext);
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
