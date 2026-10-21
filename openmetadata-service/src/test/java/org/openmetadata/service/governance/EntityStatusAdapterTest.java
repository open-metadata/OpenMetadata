package org.openmetadata.service.governance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityStatus;

class EntityStatusAdapterTest {
  private static final EntityStatusAdapter<ContextMemoryStatus> MEMORY =
      new EntityStatusAdapter<>(ContextMemoryStatus.class);
  private static final EntityStatusAdapter<EntityStatus> GENERAL =
      new EntityStatusAdapter<>(EntityStatus.class);

  @Test
  void statusWritesResolveAgainstTheEntityVocabulary() {
    ContextMemory memory = new ContextMemory();
    EntityStatusAdapter.forEntityType(ContextMemory.class).write(memory, "  superseded  ");
    assertEquals(ContextMemoryStatus.SUPERSEDED, memory.getEntityStatus());
    assertEquals("Superseded", MEMORY.read(memory));
    assertThrows(IllegalArgumentException.class, () -> MEMORY.write(memory, "In Review"));
    assertEquals(ContextMemoryStatus.SUPERSEDED, memory.getEntityStatus());
    assertThrows(IllegalArgumentException.class, () -> GENERAL.write(new Table(), "Superseded"));
  }

  @Test
  void adapterCannotWriteADifferentEntityStatusEnum() {
    ContextMemory memory = new ContextMemory().withEntityStatus(ContextMemoryStatus.DRAFT);
    assertThrows(IllegalArgumentException.class, () -> GENERAL.write(memory, "Approved"));
    assertThrows(ClassCastException.class, () -> GENERAL.read(memory));
    assertEquals(ContextMemoryStatus.DRAFT, memory.getEntityStatus());
  }

  @Test
  void adapterPreservesUnsetAndLegacyStatuses() {
    ContextMemory memory = new ContextMemory();
    assertNull(MEMORY.read(memory));
    MEMORY.write(memory, "Deprecated");
    assertEquals(ContextMemoryStatus.DEPRECATED, memory.getEntityStatus());
    MEMORY.write(memory, "Rejected");
    assertEquals(ContextMemoryStatus.REJECTED, memory.getEntityStatus());
    MEMORY.write(memory, null);
    assertNull(memory.getEntityStatus());
  }

  @Test
  void adapterExposesTheCompleteGeneratedVocabulary() {
    assertEquals(List.of(ContextMemoryStatus.values()), MEMORY.statuses());
    assertEquals(
        MEMORY.statuses().stream().map(ContextMemoryStatus::value).toList(), MEMORY.codes());
    assertThrows(IllegalArgumentException.class, () -> MEMORY.resolve(null));
    assertThrows(
        IllegalArgumentException.class, () -> EntityStatusAdapter.forEntityType(String.class));
    assertThrows(IllegalArgumentException.class, () -> GENERAL.requireEntityType(String.class));
    assertThrows(
        IllegalArgumentException.class,
        () -> EntityStatusAdapter.forEntityType(EntityInterface.class));
  }
}
