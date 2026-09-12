package org.openmetadata.service.entity.history;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeSummaryMap;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.change.ChangeSummary;

class SessionConsolidationPolicyTest {
  private final AtomicLong timeout = new AtomicLong(500);
  private final SessionConsolidationPolicy policy =
      new SessionConsolidationPolicy("table", timeout::get);

  @Test
  void timeoutIsInclusiveAndReadsTheCurrentConfiguration() {
    final Table original = table();
    final Table updated = table().withUpdatedAt(600L);

    assertTrue(policy.canConsolidate(original, updated, true, false));
    timeout.set(499);
    assertFalse(policy.canConsolidate(original, updated, true, false));
  }

  @Test
  void onlyLaterPatchVersionsOfLiveEntitiesByTheSameUserAreEligible() {
    assertFalse(policy.canConsolidate(table(), table(), false, false));
    assertFalse(policy.canConsolidate(null, null, true, true));
    assertFalse(policy.canConsolidate(table().withVersion(0.1), table(), true, false));
    assertFalse(policy.canConsolidate(table().withDeleted(true), table(), true, false));
    assertFalse(policy.canConsolidate(table(), table().withUpdatedBy("another-user"), true, false));
  }

  @Test
  void missingHistoryAndCurrentOrEarlierRenamesDisableConsolidation() {
    assertFalse(policy.canConsolidate(table().withChangeDescription(null), table(), true, false));
    assertFalse(
        policy.canConsolidate(
            table().withChangeDescription(new ChangeDescription().withPreviousVersion(null)),
            table(),
            true,
            false));
    assertFalse(policy.canConsolidate(table(), table().withName("renamed"), true, false));
    final Table original = table();
    original.getChangeDescription().setFieldsUpdated(List.of(new FieldChange().withName("name")));
    assertFalse(policy.canConsolidate(original, table(), true, false));
    original.getChangeDescription().setFieldsUpdated(List.of());
    original.setIncrementalChangeDescription(
        new ChangeDescription().withFieldsDeleted(List.of(new FieldChange().withName("name"))));
    assertFalse(policy.canConsolidate(original, table(), true, false));
  }

  @Test
  void glossaryMovesDisableConsolidationWithoutBlockingUnrelatedEntityFields() {
    final var glossary = new SessionConsolidationPolicy("glossaryTerm", timeout::get);
    for (final String field : List.of("parent", "glossary")) {
      final Table original = table();
      original.getChangeDescription().setFieldsAdded(List.of(new FieldChange().withName(field)));
      assertFalse(glossary.canConsolidate(original, table(), true, false));
      assertTrue(policy.canConsolidate(original, table(), true, false));
    }
  }

  @Test
  void changeSourceUsesTheLatestSummaryAndKeepsTheAbsentSourceFallback() {
    final Table original = table();
    final ChangeSummaryMap summary =
        new ChangeSummaryMap()
            .withAdditionalProperty(
                "old",
                new ChangeSummary().withChangedAt(10L).withChangeSource(ChangeSource.AUTOMATED))
            .withAdditionalProperty(
                "latest",
                new ChangeSummary().withChangedAt(20L).withChangeSource(ChangeSource.MANUAL));
    original.getChangeDescription().setChangeSummary(summary);

    assertFalse(policy.hasDifferentChangeSource(original, ChangeSource.MANUAL));
    assertTrue(policy.hasDifferentChangeSource(original, ChangeSource.AUTOMATED));
    summary.getAdditionalProperties().get("latest").setChangeSource(null);
    assertTrue(policy.hasDifferentChangeSource(original, null));
    assertTrue(policy.hasDifferentChangeSource(table(), null));
    assertTrue(policy.hasDifferentChangeSource(table().withChangeDescription(null), null));
  }

  private Table table() {
    return new Table()
        .withName("table")
        .withVersion(0.2)
        .withUpdatedBy("user")
        .withUpdatedAt(100L)
        .withChangeDescription(new ChangeDescription().withPreviousVersion(0.1));
  }
}
