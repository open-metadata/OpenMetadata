package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;

class SearchIndexRetryQueueTest {

  @Test
  void propagationContextRoundTripsWithoutHidingTheFailureReason() {
    ChangeDescription changeDescription = displayNameChange();

    String reason =
        SearchIndexRetryQueue.withPropagationContext("bulk flush timed out", changeDescription);
    ChangeDescription restored = SearchIndexRetryQueue.getPropagationContext(reason);

    assertTrue(reason.startsWith("bulk flush timed out"));
    assertEquals("bulk flush timed out", SearchIndexRetryQueue.visibleFailureReason(reason));
    assertEquals(Entity.FIELD_DISPLAY_NAME, restored.getFieldsUpdated().getFirst().getName());
    assertEquals("Old Service", restored.getFieldsUpdated().getFirst().getOldValue());
    assertEquals("New Service", restored.getFieldsUpdated().getFirst().getNewValue());
  }

  @Test
  void retryFailuresRetainTheOriginalPropagationContext() {
    String originalReason =
        SearchIndexRetryQueue.withPropagationContext("bulk flush timed out", displayNameChange());

    String retryReason =
        SearchIndexRetryQueue.preservePropagationContext(
            originalReason, "retryFailed: connection reset");

    assertTrue(retryReason.startsWith("retryFailed: connection reset"));
    assertEquals(
        Entity.FIELD_DISPLAY_NAME,
        SearchIndexRetryQueue.getPropagationContext(retryReason)
            .getFieldsUpdated()
            .getFirst()
            .getName());
  }

  @Test
  void diagnosticTruncationDoesNotTruncatePropagationContext() {
    String longValue = "x".repeat(12_000);
    ChangeDescription changeDescription =
        displayNameChange()
            .withFieldsUpdated(
                List.of(
                    new FieldChange()
                        .withName(Entity.FIELD_DISPLAY_NAME)
                        .withOldValue("Old Service")
                        .withNewValue(longValue)));

    String reason =
        SearchIndexRetryQueue.withPropagationContext("failure".repeat(2_000), changeDescription);

    assertEquals(8_192, SearchIndexRetryQueue.visibleFailureReason(reason).length());
    assertEquals(
        longValue,
        SearchIndexRetryQueue.getPropagationContext(reason)
            .getFieldsUpdated()
            .getFirst()
            .getNewValue());
  }

  @Test
  void aParentIdIsQueuedInTheIdColumnTheWorkerResolvesById() {
    String id = "8f0c2a8e-1c53-4b3e-9f39-5a3c1b1d2e4f";

    assertEquals(
        new SearchIndexRetryQueue.ParentKey(id, null), SearchIndexRetryQueue.ParentKey.of(id));
  }

  @Test
  void aParentFqnIsQueuedInTheFqnColumn() {
    String fqn = "service.database";

    assertEquals(
        new SearchIndexRetryQueue.ParentKey(null, fqn), SearchIndexRetryQueue.ParentKey.of(fqn));
  }

  @Test
  void plainAndMalformedReasonsAreDistinguished() {
    assertNull(SearchIndexRetryQueue.getPropagationContext("plain failure"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            SearchIndexRetryQueue.getPropagationContext(
                "failure\n__OPENMETADATA_SEARCH_PROPAGATION_V1__:not-base64"));
  }

  private static ChangeDescription displayNameChange() {
    return new ChangeDescription()
        .withPreviousVersion(1.0)
        .withFieldsAdded(List.of())
        .withFieldsUpdated(
            List.of(
                new FieldChange()
                    .withName(Entity.FIELD_DISPLAY_NAME)
                    .withOldValue("Old Service")
                    .withNewValue("New Service")))
        .withFieldsDeleted(List.of());
  }
}
