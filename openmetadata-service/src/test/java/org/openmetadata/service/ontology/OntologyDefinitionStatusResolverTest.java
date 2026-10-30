package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.ontology.OntologyDefinitionStatusResolver.Match.DIFFERENT;
import static org.openmetadata.service.ontology.OntologyDefinitionStatusResolver.Match.SAME;

import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.ontology.OntologyDefinitionStatusResolver.Match;
import org.openmetadata.service.ontology.OntologyDefinitionStatusResolver.Slots;

class OntologyDefinitionStatusResolverTest {
  @ParameterizedTest(name = "{0}")
  @CsvSource(
      delimiter = '|',
      value = {
        "never captured|false|ABSENT|ABSENT|ABSENT|Draft",
        "unchanged in the active release|false|SAME|ABSENT|ABSENT|Approved",
        "unchanged in the latest approved release|false|ABSENT|SAME|ABSENT|Approved",
        "edited after approval|false|DIFFERENT|DIFFERENT|ABSENT|Draft",
        "new in the release under review|false|ABSENT|ABSENT|SAME|InReview",
        "edited after the review request|false|ABSENT|ABSENT|DIFFERENT|Draft",
        "unchanged inside an in-review release|false|SAME|SAME|SAME|Approved",
        "edited since approval but captured for review|false|DIFFERENT|DIFFERENT|SAME|InReview",
        "approved but not in review|false|SAME|SAME|DIFFERENT|Approved",
        "deleted after approval|true|SAME|SAME|SAME|Draft"
      })
  void everyRowOfTheStatusTable(
      String row, boolean deleted, Match active, Match approved, Match review, String expected) {
    assertEquals(
        expected,
        OntologyDefinitionStatusResolver.status(deleted, new Slots(active, approved, review))
            .value(),
        row);
  }

  @Test
  void anEqualVersionProvesMembershipWithoutReadingThePayload() {
    final AtomicInteger payloadReads = new AtomicInteger();

    assertEquals(SAME, OntologyDefinitionStatusResolver.decide(0.3, 0.3, () -> read(payloadReads)));
    assertEquals(0, payloadReads.get());
  }

  @Test
  void aMovedVersionFallsBackToContentSoAnOwnerOnlyEditOrARevertStaysMember() {
    final AtomicInteger payloadReads = new AtomicInteger();

    assertEquals(SAME, OntologyDefinitionStatusResolver.decide(0.5, 0.3, () -> read(payloadReads)));
    assertEquals(
        DIFFERENT, OntologyDefinitionStatusResolver.decide(0.5, 0.3, () -> !read(payloadReads)));
    assertEquals(2, payloadReads.get());
  }

  @Test
  void aMissingVersionIsNeverTreatedAsEqual() {
    assertEquals(DIFFERENT, OntologyDefinitionStatusResolver.decide(null, 0.1, () -> false));
    assertEquals(DIFFERENT, OntologyDefinitionStatusResolver.decide(0.1, null, () -> false));
  }

  @Test
  void versionsCompareAsTenthsSoFloatingPointDriftDoesNotSplitThem() {
    assertTrue(OntologyDefinitionStatusResolver.sameVersion(0.1 + 0.2, 0.3));
    assertFalse(OntologyDefinitionStatusResolver.sameVersion(0.3, 0.4));
  }

  @ParameterizedTest(name = "{0} active={1}")
  @CsvSource({
    "DRAFT,false,Draft",
    "DRAFT,true,Draft",
    "IN_REVIEW,false,InReview",
    "REJECTED,false,ChangesRequested",
    "APPROVED,false,Approved",
    "APPROVED,true,Published"
  })
  void everyRowOfTheStageTable(EntityStatus status, boolean active, String expected) {
    assertEquals(expected, OntologyPublicationStatusResolver.stage(status, active).value());
  }

  @Test
  void aReleaseNeverReachesAnArchivedStage() {
    assertThrows(
        IllegalStateException.class,
        () -> OntologyPublicationStatusResolver.stage(EntityStatus.ARCHIVED, false));
  }

  private static boolean read(AtomicInteger reads) {
    reads.incrementAndGet();
    return true;
  }
}
