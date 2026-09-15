package org.openmetadata.service.entity.history;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeSummaryMap;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.change.ChangeSummary;

class EntityChangeSummaryTest {
  private final EntityChangeSummary<Table> summaries =
      new EntityChangeSummary<>(
          new ChangeSummarizer<>(Table.class, Set.of("description", "columns.description")));

  @Test
  void emptyChangesDoNotCreateAttribution() {
    final var changes = new ChangeDescription();
    summaries.update(new Table(), new Table(), null, null);
    summaries.update(new Table(), new Table(), changes, null);
    assertNull(changes.getChangeSummary());
  }

  @Test
  void changesWithoutPreviousAttributionUseCurrentActorAndTime() {
    final var changes = new ChangeDescription().withFieldsAdded(List.of(field("description")));
    summaries.update(new Table(), updated(), changes, ChangeSource.MANUAL);
    final var summary = changes.getChangeSummary().getAdditionalProperties().get("description");
    assertEquals("editor", summary.getChangedBy());
    assertEquals(20L, summary.getChangedAt());
    assertEquals(ChangeSource.MANUAL, summary.getChangeSource());
  }

  @Test
  void mergesAndDeletesAttributionWithoutMutatingHistoricalState() {
    final var prior =
        new ChangeSummaryMap()
            .withAdditionalProperty("description", attribution(10L))
            .withAdditionalProperty("columns.removed.description", attribution(10L))
            .withAdditionalProperty("columns.kept.description", attribution(30L));
    final var original =
        new Table().withChangeDescription(new ChangeDescription().withChangeSummary(prior));
    final var changes =
        new ChangeDescription()
            .withFieldsUpdated(List.of(field("description"), field("columns.kept.description")))
            .withFieldsDeleted(List.of(field("columns").withOldValue("[{\"name\":\"removed\"}]")));
    summaries.update(original, updated(), changes, ChangeSource.MANUAL);
    final var result = changes.getChangeSummary().getAdditionalProperties();
    assertEquals(20L, result.get("description").getChangedAt());
    assertEquals(30L, result.get("columns.kept.description").getChangedAt());
    assertFalse(result.containsKey("columns.removed.description"));
    result.get("columns.kept.description").setChangedBy("mutated");
    assertEquals(
        "before", prior.getAdditionalProperties().get("columns.kept.description").getChangedBy());
    assertTrue(prior.getAdditionalProperties().containsKey("columns.removed.description"));
  }

  private static FieldChange field(String name) {
    return new FieldChange().withName(name);
  }

  private static ChangeSummary attribution(long at) {
    return new ChangeSummary()
        .withChangedAt(at)
        .withChangedBy("before")
        .withChangeSource(ChangeSource.AUTOMATED);
  }

  private static Table updated() {
    return new Table().withUpdatedBy("editor").withUpdatedAt(20L);
  }
}
