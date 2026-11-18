package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.ActivityEventType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskResolutionType;

class OntologyDecisionNoticeTest {
  private static final EntityReference REVIEWER =
      new EntityReference().withId(UUID.randomUUID()).withType("user").withName("reviewer");

  private static OntologyRelease release(String semanticVersion) {
    return new OntologyRelease()
        .withId(UUID.randomUUID())
        .withName("release-3")
        .withFullyQualifiedName("Sales.release-3")
        .withReleaseRevision(3L)
        .withSemanticVersion(semanticVersion);
  }

  @Test
  void anApprovalNamesTheReviewerAndTheVersion() {
    final ActivityEvent event =
        OntologyDecisionNotice.eventFor(
            release("1.2.0"), TaskResolutionType.Approved, REVIEWER, null, 42L);

    assertEquals("reviewer approved v1.2.0", event.getSummary());
    assertEquals("Approved", event.getNewValue());
    assertEquals(ActivityEventType.ENTITY_UPDATED, event.getEventType());
    assertEquals(42L, event.getTimestamp());
  }

  @Test
  void aRejectionCarriesTheReasonAndFallsBackToTheReleaseNumber() {
    final ActivityEvent event =
        OntologyDecisionNotice.eventFor(
            release(null), TaskResolutionType.Rejected, REVIEWER, "Scope is too broad", 7L);

    assertEquals("reviewer rejected release #3: Scope is too broad", event.getSummary());
    assertEquals("Rejected", event.getNewValue());
  }

  @Test
  void aReleaseWithNeitherVersionNorRevisionFallsBackToItsName() {
    final ActivityEvent event =
        OntologyDecisionNotice.eventFor(
            release(null).withReleaseRevision(null),
            TaskResolutionType.Approved,
            REVIEWER,
            null,
            7L);

    assertEquals("reviewer approved release-3", event.getSummary());
  }

  @Test
  void aLongReasonIsTruncatedSoTheSummaryStaysUnderTheStorageLimit() {
    final ActivityEvent event =
        OntologyDecisionNotice.eventFor(
            release("1.0.0"), TaskResolutionType.Rejected, REVIEWER, "x".repeat(900), 7L);

    assertEquals(true, event.getSummary().length() <= 500, event.getSummary());
  }
}
