package org.openmetadata.service.context.center;

import java.util.UUID;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

/**
 * What a file's memories do when its own sharing turns it restricted or org-wide; a folder shares
 * nothing of its own. Runs inside the write that changes the sharing, so the two commit together,
 * and reads the file as that write leaves it (ADR:2026-09-29-context-file-memory-reuse).
 */
public class MemorySourceSharing {
  private final ContextMemoryRepository memories;

  public MemorySourceSharing(ContextMemoryRepository memories) {
    this.memories = memories;
  }

  /**
   * Follows {@code file} turning restricted: no memory names it among its related entities, and one
   * it anchors moves to a live source everyone may read, or stays and is copied for readers it hides.
   */
  public void followSourceRestriction(ContextFile file) {
    MemorySourceLifecycle lifecycle = lifecycleSharing(file);
    EntityReference restricted = referenceTo(file);
    for (EntityReference memory : lifecycle.linkedMemories(restricted)) {
      followRestriction(lifecycle, memory.getId(), restricted);
      memories.refreshSearchDocument(memory.getId());
    }
  }

  /**
   * Follows {@code file} turning org-wide: each memory it states names it again, and a restricted
   * anchor gives way to it, as on restore. Copies made while it was restricted stay.
   */
  public void followSourceOpening(ContextFile file) {
    MemorySourceLifecycle lifecycle = lifecycleSharing(file);
    EntityReference opened = referenceTo(file);
    for (EntityReference memory : lifecycle.linkedMemories(opened)) {
      lifecycle.showAsSourceOnceOpened(memory.getId(), opened);
    }
  }

  private static EntityReference referenceTo(ContextFile file) {
    return new EntityReference().withId(file.getId()).withType(Entity.CONTEXT_FILE);
  }

  private MemorySourceLifecycle lifecycleSharing(ContextFile file) {
    MemorySourceLifecycle lifecycle = new MemorySourceLifecycle(memories).withSharingOf(file);
    lifecycle.requireOpenTransaction();
    return lifecycle;
  }

  private static void followRestriction(
      MemorySourceLifecycle lifecycle, UUID memoryId, EntityReference restricted) {
    if (lifecycle.isAnchoredOn(memoryId, restricted)) {
      moveAnchorOff(lifecycle, memoryId, restricted);
    } else {
      lifecycle.dropRelatedSource(memoryId, restricted);
    }
  }

  /** The anchor moves only to a source everyone may read; a restricted one would hide it again. */
  private static void moveAnchorOff(
      MemorySourceLifecycle lifecycle, UUID memoryId, EntityReference restricted) {
    EntityReference target = lifecycle.chooseAnchor(memoryId, restricted);
    if (target != null && lifecycle.readableByEveryone(target)) {
      lifecycle.reanchor(memoryId, restricted, target);
    } else {
      lifecycle.copyForSourcesTheAnchorHides(memoryId, restricted);
    }
  }
}
