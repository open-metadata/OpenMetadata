package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.RowDecisionGate;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class AuditReportAccessTest {
  @Test
  void onlyTheRequesterOrAnAdministratorCanAccessASavedPack() {
    final User requester = user();
    final ResourceContextInterface resource =
        report(
            new AuditReport()
                .withRequestedBy(
                    new EntityReference().withId(requester.getId()).withType(Entity.USER)));
    assertDoesNotThrow(
        () -> AuditReportAccess.authorize(new SubjectContext(requester, null), resource));
    assertDoesNotThrow(
        () ->
            AuditReportAccess.authorize(
                new SubjectContext(user().withIsAdmin(true), null), resource));
    assertThrows(
        AuthorizationException.class,
        () -> AuditReportAccess.authorize(new SubjectContext(user(), null), resource));
  }

  @Test
  void legacyReportsWithoutARequesterAreAdministratorOnly() {
    final ResourceContextInterface resource = report(new AuditReport());
    assertThrows(
        AuthorizationException.class,
        () -> AuditReportAccess.authorize(new SubjectContext(user(), null), resource));
    assertDoesNotThrow(
        () ->
            AuditReportAccess.authorize(
                new SubjectContext(user().withIsAdmin(true), null), resource));
  }

  @Test
  void listingTheTypeDoesNotGrantAccessToOtherRequestersRows() {
    final SubjectContext requester = new SubjectContext(user(), null);
    assertTrue(
        RowDecisionGate.mayDiffer(
            requester, Entity.AUDIT_REPORT, List.of(MetadataOperation.VIEW_BASIC)));
    assertFalse(
        RowDecisionGate.mayDiffer(
            new SubjectContext(user().withIsAdmin(true), null),
            Entity.AUDIT_REPORT,
            List.of(MetadataOperation.VIEW_BASIC)));
    final ResourceContextInterface type = report(new AuditReport());
    when(type.isEntityTypeLevel()).thenReturn(true);
    assertDoesNotThrow(() -> AuditReportAccess.authorize(requester, type));
  }

  private static ResourceContextInterface report(final AuditReport report) {
    final ResourceContextInterface resource = mock(ResourceContextInterface.class);
    when(resource.getResource()).thenReturn(Entity.AUDIT_REPORT);
    when(resource.getEntity()).thenAnswer(invocation -> report);
    return resource;
  }

  private static User user() {
    return new User()
        .withId(UUID.randomUUID())
        .withName("reader")
        .withIsAdmin(false)
        .withIsBot(false);
  }
}
