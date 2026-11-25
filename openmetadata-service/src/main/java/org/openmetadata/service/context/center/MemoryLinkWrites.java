package org.openmetadata.service.context.center;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.jdbi3.ContextMemoryRepository.FIELD_PRIMARY_ENTITY;
import static org.openmetadata.service.jdbi3.ContextMemoryRepository.FIELD_RELATED_ENTITIES;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Predicate;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.util.FreshReadScope;

/**
 * How a source lifecycle writes a memory's links: conditional on the memory as read, so a decision
 * written meanwhile fails the write instead of being overwritten, and as the memory's relinking
 * write, which names no restricted document (ADR:2026-09-29-context-file-memory-reuse).
 */
final class MemoryLinkWrites {
  /** What a lifecycle write reads: without the source, so the write keeps the stored one. */
  private static final String LINK_FIELDS = FIELD_PRIMARY_ENTITY + "," + FIELD_RELATED_ENTITIES;

  private static final int MAX_WRITE_ATTEMPTS = 3;
  private static final String KEPT_CHANGING =
      "Memory %s kept changing while its source documents moved";

  private final ContextMemoryRepository memories;
  private final Predicate<EntityReference> readableByEveryone;

  MemoryLinkWrites(
      ContextMemoryRepository memories, Predicate<EntityReference> readableByEveryone) {
    this.memories = memories;
    this.readableByEveryone = readableByEveryone;
  }

  /** The live memory with its anchor and related entities, and without its source. */
  ContextMemory linksOf(UUID memoryId) {
    return memories.get(
        null, memoryId, memories.getFields(LINK_FIELDS), Include.NON_DELETED, false);
  }

  /** Conditional on the memory as read: a write landing meanwhile fails this one, never lost. */
  void update(ContextMemory current, ContextMemory updated) {
    relinking(
        current.getId(),
        () -> memories.updateIfCurrent(null, current, updated, Entity.ADMIN_USER_NAME));
  }

  /** Runs {@code write} as the memory's relinking write. */
  void relinking(UUID memoryId, Runnable write) {
    MemoryRelinking.run(memoryId, readableByEveryone, write);
  }

  /** Names {@code document} among the memory's related entities, reading again after a decision. */
  void relate(UUID memoryId, EntityReference document) {
    onFreshReads(
        memoryId,
        () -> {
          ContextMemory current = linksOf(memoryId);
          if (!namesDocument(current, document)) {
            update(current, withRelated(current, document));
          }
        });
  }

  /**
   * Reads the memory and writes until no write lands in between, each attempt on a fresh read.
   * Within one transaction on MySQL every attempt reads the same snapshot, so there the bounded
   * attempts only give up with 412.
   */
  void onFreshReads(UUID memoryId, Runnable readAndWrite) {
    for (int attempt = 1; !landed(readAndWrite); attempt++) {
      if (attempt == MAX_WRITE_ATTEMPTS) {
        throw new PreconditionFailedException(String.format(KEPT_CHANGING, memoryId));
      }
    }
  }

  /** False when a write landed between the attempt's read and its write. */
  private static boolean landed(Runnable readAndWrite) {
    boolean written = true;
    try (var ignored = FreshReadScope.enter()) {
      readAndWrite.run();
    } catch (PreconditionFailedException changedMeanwhile) {
      written = false;
    }
    return written;
  }

  private static boolean namesDocument(ContextMemory memory, EntityReference document) {
    EntityReference anchor = memory.getPrimaryEntity();
    return (anchor != null
            && document.getId().equals(anchor.getId())
            && document.getType().equals(anchor.getType()))
        || listOrEmpty(memory.getRelatedEntities()).stream()
            .anyMatch(related -> document.getId().equals(related.getId()));
  }

  /** The write keeps the stored source: a partial update preserves the one it omits. */
  private static ContextMemory withRelated(ContextMemory current, EntityReference document) {
    ContextMemory updated = JsonUtils.deepCopy(current, ContextMemory.class);
    List<EntityReference> related = new ArrayList<>(listOrEmpty(current.getRelatedEntities()));
    related.add(document);
    return updated.withRelatedEntities(related);
  }
}
