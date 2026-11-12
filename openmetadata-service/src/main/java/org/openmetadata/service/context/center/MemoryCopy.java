package org.openmetadata.service.context.center;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * A memory restated for another document's readers: what it says and its review state, with the
 * defaults extraction gives a new memory. Owners, sharing, disputes, usage and history stay behind.
 */
final class MemoryCopy {
  /** In use, under review, or rejected; the other stages retire a memory, some for a successor. */
  private static final Set<ContextMemoryStatus> COPIED_STAGES =
      Set.of(
          ContextMemoryStatus.UNPROCESSED,
          ContextMemoryStatus.DRAFT,
          ContextMemoryStatus.APPROVED,
          ContextMemoryStatus.REJECTED);

  private MemoryCopy() {}

  /** The copy, anchored on and sourced from {@code source}; none for a retired memory. */
  static Optional<ContextMemory> of(ContextMemory memory, EntityReference source) {
    return COPIED_STAGES.contains(memory.getEntityStatus())
        ? Optional.of(withReviewState(withContent(anchoredOn(source), memory), memory))
        : Optional.empty();
  }

  private static ContextMemory anchoredOn(EntityReference source) {
    String name = ContextMemoryExtractor.memoryName();
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(FullyQualifiedName.build(name))
        .withPrimaryEntity(source)
        .withSourceEntity(source)
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY))
        .withUpdatedBy(Entity.ADMIN_USER_NAME)
        .withUpdatedAt(System.currentTimeMillis());
  }

  private static ContextMemory withContent(ContextMemory copy, ContextMemory memory) {
    return copy.withTitle(memory.getTitle())
        .withSummary(memory.getSummary())
        .withDescription(memory.getDescription())
        .withQuestion(memory.getQuestion())
        .withAnswer(memory.getAnswer())
        .withMachineRepresentation(memory.getMachineRepresentation())
        .withMemoryType(memory.getMemoryType())
        .withMemoryScope(memory.getMemoryScope())
        .withSourceType(memory.getSourceType());
  }

  private static ContextMemory withReviewState(ContextMemory copy, ContextMemory memory) {
    return copy.withEntityStatus(memory.getEntityStatus())
        .withStatusReason(memory.getStatusReason())
        .withLastReviewedAt(memory.getLastReviewedAt());
  }
}
