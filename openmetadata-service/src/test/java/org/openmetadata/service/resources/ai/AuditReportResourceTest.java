/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.security.Principal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AuditReportRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.RestUtil;

class AuditReportResourceTest {

  @Test
  void mayReadArtifactsAllowsTheRequester() {
    try (MockedStatic<DefaultAuthorizer> authMock = mockStatic(DefaultAuthorizer.class)) {
      SecurityContext securityContext = securityContext("mallory");
      SubjectContext subject = subject(false);
      authMock.when(() -> DefaultAuthorizer.getSubjectContext(securityContext)).thenReturn(subject);

      assertTrue(
          AuditReportResource.mayReadArtifacts(
              securityContext, reportWithRequester("mallory", "mallory")));
    }
  }

  @Test
  void mayReadArtifactsAllowsAdmin() {
    try (MockedStatic<DefaultAuthorizer> authMock = mockStatic(DefaultAuthorizer.class)) {
      SecurityContext securityContext = securityContext("mallory");
      SubjectContext subject = subject(true);
      authMock.when(() -> DefaultAuthorizer.getSubjectContext(securityContext)).thenReturn(subject);

      assertTrue(
          AuditReportResource.mayReadArtifacts(
              securityContext, reportWithRequester("admin", "admin")));
    }
  }

  @Test
  void mayReadArtifactsDeniesOtherUsers() {
    try (MockedStatic<DefaultAuthorizer> authMock = mockStatic(DefaultAuthorizer.class)) {
      SecurityContext securityContext = securityContext("mallory");
      SubjectContext subject = subject(false);
      authMock.when(() -> DefaultAuthorizer.getSubjectContext(securityContext)).thenReturn(subject);

      assertFalse(
          AuditReportResource.mayReadArtifacts(
              securityContext, reportWithRequester("admin", "admin")));
    }
  }

  @Test
  void mayReadArtifactsDeniesLegacyReportWithoutRequester() {
    try (MockedStatic<DefaultAuthorizer> authMock = mockStatic(DefaultAuthorizer.class)) {
      SecurityContext securityContext = securityContext("mallory");
      SubjectContext subject = subject(false);
      authMock.when(() -> DefaultAuthorizer.getSubjectContext(securityContext)).thenReturn(subject);

      assertFalse(AuditReportResource.mayReadArtifacts(securityContext, new AuditReport()));
    }
  }

  @Test
  void mayReadArtifactsAllowsInternalNullContext() {
    assertTrue(AuditReportResource.mayReadArtifacts(null, reportWithRequester("admin", "admin")));
  }

  @Test
  @SuppressWarnings("unchecked")
  void patchRejectsChangesToRequestedBy() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AuditReportRepository repository = mock(AuditReportRepository.class);
      entityMock.when(() -> Entity.getEntityRepository(Entity.AUDIT_REPORT)).thenReturn(repository);
      entityMock
          .when(() -> Entity.getEntityClassFromType(Entity.AUDIT_REPORT))
          .thenReturn(AuditReport.class);

      AuditReportResource resource =
          new AuditReportResource(mock(Authorizer.class), mock(Limits.class));
      JsonPatch patch =
          Json.createPatchBuilder()
              .replace("/requestedBy", Json.createObjectBuilder().add("name", "mallory").build())
              .build();

      assertThrows(
          IllegalArgumentException.class,
          () -> resource.patch(null, securityContext("bob"), UUID.randomUUID(), patch));
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void patchAllowsChangesToOtherFields() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AuditReportRepository repository = mock(AuditReportRepository.class);
      entityMock.when(() -> Entity.getEntityRepository(Entity.AUDIT_REPORT)).thenReturn(repository);
      entityMock
          .when(() -> Entity.getEntityClassFromType(Entity.AUDIT_REPORT))
          .thenReturn(AuditReport.class);
      AuditReport report = new AuditReport().withId(UUID.randomUUID());
      when(repository.patch(
              any(), any(UUID.class), anyString(), any(JsonPatch.class), any(), any(), any()))
          .thenReturn(
              new RestUtil.PatchResponse<>(Response.Status.OK, report, EventType.ENTITY_UPDATED));

      AuditReportResource resource =
          new AuditReportResource(mock(Authorizer.class), mock(Limits.class));
      JsonPatch patch =
          Json.createPatchBuilder()
              .replace("/description", Json.createValue("quarterly evidence"))
              .build();

      resource.patch(mock(UriInfo.class), securityContext("bob"), UUID.randomUUID(), patch);
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void createOrUpdatePreservesTheOriginalRequester() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AuditReportRepository repository = mock(AuditReportRepository.class);
      entityMock.when(() -> Entity.getEntityRepository(Entity.AUDIT_REPORT)).thenReturn(repository);
      entityMock
          .when(() -> Entity.getEntityClassFromType(Entity.AUDIT_REPORT))
          .thenReturn(AuditReport.class);
      EntityReference originalRequester = userRef("admin");
      when(repository.getByName(any(), eq("quarterly_pack"), any()))
          .thenReturn(
              new AuditReport().withName("quarterly_pack").withRequestedBy(originalRequester));

      AuditReportResource resource =
          new AuditReportResource(mock(Authorizer.class), mock(Limits.class));
      AuditReport update =
          new AuditReport().withName("quarterly_pack").withRequestedBy(userRef("mallory"));
      resource.preserveRequesterOnUpdate(update);

      assertSame(originalRequester, update.getRequestedBy());
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void createOrUpdateLeavesANewReportsRequesterAlone() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AuditReportRepository repository = mock(AuditReportRepository.class);
      entityMock.when(() -> Entity.getEntityRepository(Entity.AUDIT_REPORT)).thenReturn(repository);
      entityMock
          .when(() -> Entity.getEntityClassFromType(Entity.AUDIT_REPORT))
          .thenReturn(AuditReport.class);
      when(repository.getByName(any(), eq("new_pack"), any()))
          .thenThrow(new EntityNotFoundException("audit report new_pack not found"));

      AuditReportResource resource =
          new AuditReportResource(mock(Authorizer.class), mock(Limits.class));
      EntityReference requester = userRef("mallory");
      AuditReport report = new AuditReport().withName("new_pack").withRequestedBy(requester);
      resource.preserveRequesterOnUpdate(report);

      assertSame(requester, report.getRequestedBy());
    }
  }

  private AuditReport reportWithRequester(String name, String fqn) {
    return new AuditReport().withRequestedBy(userRef(name).withFullyQualifiedName(fqn));
  }

  private EntityReference userRef(String name) {
    return new EntityReference().withType("user").withName(name);
  }

  private SubjectContext subject(boolean admin) {
    SubjectContext subjectContext = mock(SubjectContext.class);
    when(subjectContext.isAdmin()).thenReturn(admin);
    return subjectContext;
  }

  private SecurityContext securityContext(String user) {
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn(user);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    return securityContext;
  }
}
