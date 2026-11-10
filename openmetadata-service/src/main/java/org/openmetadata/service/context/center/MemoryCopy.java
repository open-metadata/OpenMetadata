package org.openmetadata.service.context.center;

import java.util.UUID;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * A memory restated for another document's readers: what it says and its review state, owned and
 * shared as it is. Disputes, usage, history and related entities stay with the original.
 */
final class MemoryCopy {
  private MemoryCopy() {}

  /** The copy, anchored on and sourced from {@code source}, named after it as extraction names. */
  static ContextMemory of(ContextMemory memory, EntityReference source) {
    String name = ContextMemoryExtractor.memoryName(source);
    ContextMemory copy =
        new ContextMemory()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(FullyQualifiedName.build(name))
            .withPrimaryEntity(source)
            .withSourceEntity(source)
            .withOwners(memory.getOwners())
            .withShareConfig(sharedAs(memory))
            .withUpdatedBy(Entity.ADMIN_USER_NAME)
            .withUpdatedAt(System.currentTimeMillis());
    return withReviewState(withContent(copy, memory), memory);
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
        .withSupersededBy(memory.getSupersededBy())
        .withLastReviewedAt(memory.getLastReviewedAt());
  }

  private static MemoryShareConfig sharedAs(ContextMemory memory) {
    return memory.getShareConfig() == null
        ? null
        : JsonUtils.deepCopy(memory.getShareConfig(), MemoryShareConfig.class);
  }
}
