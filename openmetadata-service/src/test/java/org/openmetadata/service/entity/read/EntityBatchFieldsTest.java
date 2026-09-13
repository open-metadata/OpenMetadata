package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;

class EntityBatchFieldsTest {
  @Test
  void assignmentReplacesExistingValuesAndClearsMissingOnes() {
    final Table present = new Table().withId(UUID.randomUUID()).withDescription("old");
    final Table missing = new Table().withId(UUID.randomUUID()).withDescription("stale");
    EntityBatchFields.assign(
        true, List.of(present, missing), Map.of(present.getId(), "loaded"), Table::setDescription);
    assertEquals("loaded", present.getDescription());
    assertNull(missing.getDescription());
  }

  @Test
  void excludedFieldsAndEmptyBatchesDoNotAccessValuesOrSetters() {
    final Table table = new Table().withDescription("unchanged");
    EntityBatchFields.assign(false, List.of(table), null, null);
    EntityBatchFields.assign(true, List.of(), null, null);
    assertEquals("unchanged", table.getDescription());
  }

  @Test
  void idProjectionKeepsInputOrderAndDuplicateRows() {
    final Table first = new Table().withId(UUID.randomUUID());
    final Table second = new Table().withId(UUID.randomUUID());
    assertEquals(
        List.of(second.getId(), first.getId(), second.getId()),
        EntityBatchFields.ids(List.of(second, first, second)));
    assertEquals(List.of(), EntityBatchFields.ids(List.of()));
  }
}
