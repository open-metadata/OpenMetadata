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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository.ForcedDeleteResult;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil.DeleteResponse;

class IngestionPipelineResourceDeleteTest {

  @Test
  void forceDeleteAuthorizesBeforeValidatingHardDelete() {
    IngestionPipelineRepository repository = mock(IngestionPipelineRepository.class);
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = securityContext("operator");
    UUID pipelineId = UUID.randomUUID();
    doThrow(new AuthorizationException("administrator access required"))
        .when(authorizer)
        .authorizeAdmin(securityContext);

    try (MockedStatic<Entity> entityMock = mockEntityRepository(repository)) {
      IngestionPipelineResource resource =
          new IngestionPipelineResource(authorizer, mock(Limits.class));

      assertThrows(
          AuthorizationException.class,
          () -> resource.delete(null, securityContext, false, true, pipelineId));

      verify(repository, never()).forceDelete(any(), any());
    }
  }

  @Test
  void forceDeleteRequiresHardDelete() {
    IngestionPipelineRepository repository = mock(IngestionPipelineRepository.class);
    SecurityContext securityContext = securityContext("admin");
    Authorizer authorizer = mock(Authorizer.class);

    try (MockedStatic<Entity> entityMock = mockEntityRepository(repository)) {
      IngestionPipelineResource resource =
          new IngestionPipelineResource(authorizer, mock(Limits.class));

      assertThrows(
          BadRequestException.class,
          () -> resource.delete(null, securityContext, false, true, UUID.randomUUID()));

      verify(repository, never()).forceDelete(any(), any());
      verify(authorizer).authorizeAdmin(any(SecurityContext.class));
    }
  }

  @Test
  void forceDeleteReportsSkippedRunnerCleanup() {
    UUID pipelineId = UUID.randomUUID();
    IngestionPipeline pipeline = pipeline(pipelineId);
    IngestionPipelineRepository repository = mock(IngestionPipelineRepository.class);
    ForcedDeleteResult result =
        new ForcedDeleteResult(new DeleteResponse<>(pipeline, ENTITY_DELETED), true);
    when(repository.forceDelete("admin", pipelineId)).thenReturn(result);
    Limits limits = mock(Limits.class);
    Authorizer authorizer = mock(Authorizer.class);

    try (MockedStatic<Entity> entityMock = mockEntityRepository(repository)) {
      IngestionPipelineResource resource = new IngestionPipelineResource(authorizer, limits);

      Response response = resource.delete(null, securityContext("admin"), true, true, pipelineId);

      assertEquals(
          IngestionPipelineResource.RUNNER_CLEANUP_SKIPPED,
          response.getHeaderString(IngestionPipelineResource.RUNNER_CLEANUP_HEADER));
      verify(limits).invalidateCache(Entity.INGESTION_PIPELINE);
      verify(authorizer).authorizeAdmin(any(SecurityContext.class));
    }
  }

  @Test
  void forceDeleteOmitsCleanupHeaderWhenRunnerCleanupCompletes() {
    UUID pipelineId = UUID.randomUUID();
    IngestionPipeline pipeline = pipeline(pipelineId);
    IngestionPipelineRepository repository = mock(IngestionPipelineRepository.class);
    ForcedDeleteResult result =
        new ForcedDeleteResult(new DeleteResponse<>(pipeline, ENTITY_DELETED), false);
    when(repository.forceDelete("admin", pipelineId)).thenReturn(result);

    try (MockedStatic<Entity> entityMock = mockEntityRepository(repository)) {
      IngestionPipelineResource resource =
          new IngestionPipelineResource(mock(Authorizer.class), mock(Limits.class));

      Response response = resource.delete(null, securityContext("admin"), true, true, pipelineId);

      assertNull(response.getHeaderString(IngestionPipelineResource.RUNNER_CLEANUP_HEADER));
    }
  }

  @Test
  void normalDeleteDoesNotRequireAdministratorAccess() {
    UUID pipelineId = UUID.randomUUID();
    IngestionPipeline pipeline = pipeline(pipelineId);
    IngestionPipelineRepository repository = mock(IngestionPipelineRepository.class);
    when(repository.delete("operator", pipelineId, false, false))
        .thenReturn(new DeleteResponse<>(pipeline, ENTITY_DELETED));
    Authorizer authorizer = mock(Authorizer.class);

    try (MockedStatic<Entity> entityMock = mockEntityRepository(repository)) {
      IngestionPipelineResource resource =
          new IngestionPipelineResource(authorizer, mock(Limits.class));

      resource.delete(null, securityContext("operator"), false, false, pipelineId);

      verify(authorizer, never()).authorizeAdmin(any(SecurityContext.class));
      verify(repository, never()).forceDelete(any(), any());
    }
  }

  private MockedStatic<Entity> mockEntityRepository(IngestionPipelineRepository repository) {
    MockedStatic<Entity> entityMock = mockStatic(Entity.class);
    entityMock
        .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
        .thenReturn(repository);
    return entityMock;
  }

  private IngestionPipeline pipeline(UUID pipelineId) {
    return new IngestionPipeline()
        .withId(pipelineId)
        .withName("pipeline")
        .withFullyQualifiedName("service.pipeline");
  }

  private SecurityContext securityContext(String userName) {
    SecurityContext securityContext = mock(SecurityContext.class);
    Principal principal = () -> userName;
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    return securityContext;
  }
}
