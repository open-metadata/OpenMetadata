package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyState;

class OntologyReleaseReuseTest {
  private static final UUID ACTIVE = UUID.randomUUID();

  private static OntologyState state(long workingRevision, UUID active) {
    return new OntologyState().withWorkingRevision(workingRevision).withActiveReleaseId(active);
  }

  private static OntologyRelease draft(
      long revision, long sourceRevision, UUID base, String version, Long sealedAt) {
    return new OntologyRelease()
        .withId(UUID.randomUUID())
        .withReleaseRevision(revision)
        .withSourceWorkingRevision(sourceRevision)
        .withBaseReleaseId(base)
        .withSemanticVersion(version)
        .withSealedAt(sealedAt);
  }

  /** Mirrors what capture does: reuse a matching draft, otherwise seal a new one. */
  private static OntologyRelease capture(
      List<OntologyRelease> drafts, OntologyState state, String version) {
    OntologyRelease existing = OntologyReleaseCapture.reusableDraft(drafts, state, version);
    if (existing != null) {
      return existing;
    }
    OntologyRelease minted =
        draft(
            drafts.size() + 1L,
            state.getWorkingRevision(),
            state.getActiveReleaseId(),
            version,
            1L);
    drafts.add(minted);
    return minted;
  }

  @Test
  void fiveCapturesAtOneRevisionAndVersionReturnOneRelease() {
    List<OntologyRelease> drafts = new ArrayList<>();
    OntologyState state = state(7, null);
    UUID first = capture(drafts, state, "1.0.0").getId();
    for (int i = 0; i < 4; i++) {
      assertEquals(first, capture(drafts, state, "1.0.0").getId());
    }
    assertEquals(1, drafts.size());
  }

  @Test
  void aDifferentVersionCreatesANewDraft() {
    List<OntologyRelease> drafts = new ArrayList<>();
    OntologyState state = state(7, null);
    UUID major = capture(drafts, state, "1.0.0").getId();
    UUID minor = capture(drafts, state, "0.1.0").getId();
    assertNotEquals(major, minor);
    assertEquals(2, drafts.size());
    assertEquals(major, capture(drafts, state, "1.0.0").getId());
  }

  @Test
  void aVersionedCaptureDoesNotReuseAnUnversionedDraft() {
    List<OntologyRelease> drafts = List.of(draft(1, 7, null, null, 1L));
    assertNull(OntologyReleaseCapture.reusableDraft(drafts, state(7, null), "1.0.0"));
    assertEquals(
        drafts.get(0).getId(),
        OntologyReleaseCapture.reusableDraft(drafts, state(7, null), null).getId());
  }

  @Test
  void anEditedWorkingRevisionNeverReusesAnOlderDraft() {
    List<OntologyRelease> drafts = List.of(draft(1, 7, null, "1.0.0", 1L));
    assertNull(OntologyReleaseCapture.reusableDraft(drafts, state(8, null), "1.0.0"));
  }

  @Test
  void aNewActiveReleaseMakesAnOlderDraftStale() {
    List<OntologyRelease> drafts = List.of(draft(1, 7, null, "1.0.0", 1L));
    assertNull(OntologyReleaseCapture.reusableDraft(drafts, state(7, ACTIVE), "1.0.0"));
  }

  @Test
  void anUnsealedDraftIsNeverReused() {
    List<OntologyRelease> drafts = List.of(draft(1, 7, null, "1.0.0", null));
    assertNull(OntologyReleaseCapture.reusableDraft(drafts, state(7, null), "1.0.0"));
  }

  @Test
  void theNewestMatchingDraftWins() {
    OntologyRelease older = draft(1, 7, null, "1.0.0", 1L);
    OntologyRelease newer = draft(2, 7, null, "1.0.0", 1L);
    assertEquals(
        newer.getId(),
        OntologyReleaseCapture.reusableDraft(List.of(older, newer), state(7, null), "1.0.0")
            .getId());
  }
}
