package org.openmetadata.service.context.center;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/**
 * The source-link write this thread makes for one memory: it changes who may read the memory, not
 * what it says, and names only documents everyone may read (ADR:2026-09-29-context-file-memory-reuse).
 */
public final class MemoryRelinking {
  private static final Set<String> DOCUMENT_TYPES = Set.of(Entity.CONTEXT_FILE, Entity.PAGE);
  private static final ThreadLocal<MemoryRelinking> CURRENT = new ThreadLocal<>();

  private final UUID memoryId;
  private final Predicate<EntityReference> readableByEveryone;

  private MemoryRelinking(UUID memoryId, Predicate<EntityReference> readableByEveryone) {
    this.memoryId = memoryId;
    this.readableByEveryone = readableByEveryone;
  }

  /** Runs {@code write} as the source-link write for {@code memoryId}. */
  static void run(UUID memoryId, Predicate<EntityReference> readableByEveryone, Runnable write) {
    MemoryRelinking previous = CURRENT.get();
    CURRENT.set(new MemoryRelinking(memoryId, readableByEveryone));
    try {
      write.run();
    } finally {
      restore(previous);
    }
  }

  private static void restore(MemoryRelinking previous) {
    if (previous == null) {
      CURRENT.remove();
    } else {
      CURRENT.set(previous);
    }
  }

  /** Whether this thread is writing the memory's source links, or creating it as a copy. */
  public static boolean isRelinking(UUID memoryId) {
    return current(memoryId).isPresent();
  }

  /**
   * Leaves the documents not everyone may read out of what the write records of the memory as it
   * was, in its change and in the version it stores: they appear by id and type alone.
   */
  public static void withholdRestrictedNames(ContextMemory original) {
    current(original.getId()).ifPresent(relinking -> relinking.withholdNames(original));
  }

  private static Optional<MemoryRelinking> current(UUID memoryId) {
    return Optional.ofNullable(CURRENT.get())
        .filter(relinking -> relinking.memoryId.equals(memoryId));
  }

  private void withholdNames(ContextMemory memory) {
    memory.setPrimaryEntity(withheld(memory.getPrimaryEntity()));
    memory.setSourceEntity(withheld(memory.getSourceEntity()));
    memory.setSourceFile(withheld(memory.getSourceFile()));
    if (memory.getRelatedEntities() != null) {
      memory.setRelatedEntities(memory.getRelatedEntities().stream().map(this::withheld).toList());
    }
  }

  private EntityReference withheld(EntityReference reference) {
    boolean named =
        reference == null
            || !DOCUMENT_TYPES.contains(reference.getType())
            || readableByEveryone.test(reference);
    return named
        ? reference
        : new EntityReference().withId(reference.getId()).withType(reference.getType());
  }
}
