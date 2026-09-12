package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityStatus;

class EntityPreparationTest {
  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void preparesNamesBeforeValidatingExtensionsAndApplyingDefaultStatus(boolean update) {
    final Table entity = new Table().withId(UUID.randomUUID()).withName("table");
    final AtomicInteger nameReads = new AtomicInteger();
    final EntityPrepares<Table> preparation =
        new EntityPreparation<>(
            new EntityPreparation.Steps<>(
                table -> table.setDescription("validated tags"),
                (table, updating) -> {
                  assertEquals(update, updating);
                  assertEquals("validated tags", table.getDescription());
                  table.setDescription("resolved parent");
                },
                table -> {
                  assertEquals("resolved parent", table.getDescription());
                  nameReads.incrementAndGet();
                  table.setFullyQualifiedName("service.database.schema." + table.getName());
                },
                (table, updating) -> {
                  assertEquals(update, updating);
                  assertEquals("service.database.schema.table", table.getFullyQualifiedName());
                  assertNull(table.getEntityStatus());
                  table.setDescription("validated extensions");
                },
                (table, updating) -> {
                  assertEquals(update, updating);
                  assertEquals("validated extensions", table.getDescription());
                  table.setEntityStatus(EntityStatus.UNPROCESSED);
                }));
    preparation.prepare(entity, update);
    assertEquals(1, nameReads.get());
    assertEquals(EntityStatus.UNPROCESSED, entity.getEntityStatus());
  }

  @Test
  void invalidTagsStopParentResolutionAndDoNotAlterTheEntity() {
    final Table entity = new Table().withName("invalid");
    final AtomicInteger parentReads = new AtomicInteger();
    final EntityPrepares<Table> preparation =
        new EntityPreparation<>(
            new EntityPreparation.Steps<>(
                table -> {
                  throw new IllegalArgumentException("Invalid tag");
                },
                (table, update) -> parentReads.incrementAndGet(),
                table -> table.setFullyQualifiedName("unexpected"),
                (table, update) -> table.setDescription("unexpected"),
                (table, update) -> table.setEntityStatus(EntityStatus.UNPROCESSED)));
    assertThrows(IllegalArgumentException.class, () -> preparation.prepare(entity, false));
    assertEquals(0, parentReads.get());
    assertNull(entity.getFullyQualifiedName());
    assertNull(entity.getDescription());
    assertNull(entity.getEntityStatus());
  }
}
