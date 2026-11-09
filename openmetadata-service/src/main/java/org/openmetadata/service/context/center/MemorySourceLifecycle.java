package org.openmetadata.service.context.center;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.jdbi3.ContextMemoryRepository.SOURCE_LINK_FIELDS;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

/**
 * What a memory does when one of its source documents is archived or permanently deleted. Archiving
 * keeps the memory's links so a restore can bring it back; a permanent delete releases them.
 */
public class MemorySourceLifecycle {
  private final ContextMemoryRepository memories;

  public MemorySourceLifecycle(ContextMemoryRepository memories) {
    this.memories = memories;
  }

  /**
   * Archives a source's memories with it. One that no other live source states is soft-deleted and
   * keeps its links, so restoring the source can bring it back; a shared one stays live.
   */
  public void archiveExtractedMemories(UUID sourceId, String sourceType) {
    EntityReference source = new EntityReference().withId(sourceId).withType(sourceType);
    for (EntityReference memory :
        memories.findTo(sourceId, sourceType, Relationship.MENTIONED_IN, Entity.CONTEXT_MEMORY)) {
      archiveExtractedMemory(memory.getId(), source);
    }
  }

  /**
   * Releases every memory linked to a source being permanently deleted. Archiving the source first
   * soft-deleted some of them, so the lookup includes deleted memories.
   */
  public void releaseExtractedMemories(UUID sourceId, String sourceType) {
    EntityReference source = new EntityReference().withId(sourceId).withType(sourceType);
    for (EntityReference memory :
        memories.findTo(
            sourceId, sourceType, Relationship.MENTIONED_IN, Entity.CONTEXT_MEMORY, Include.ALL)) {
      releaseExtractedMemory(memory.getId(), source);
    }
  }

  /**
   * Releases {@code source}'s link to a memory. A memory nothing else states is hard-deleted; one
   * that only archived sources state waits in the Archive with them.
   */
  public void releaseExtractedMemory(UUID memoryId, EntityReference source) {
    List<EntityReference> remaining = otherSources(memoryId, source);
    if (remaining.isEmpty()) {
      memories.delete(Entity.ADMIN_USER_NAME, memoryId, false, true);
    } else {
      detachSource(memoryId, source, remaining.stream().anyMatch(other -> !isArchived(other)));
    }
  }

  /** Whether another source, archived ones included, still states the memory. */
  public boolean hasOtherSources(UUID memoryId, EntityReference source) {
    return !otherSources(memoryId, source).isEmpty();
  }

  /**
   * Where a memory's anchor belongs once {@code leaving} goes: a live source everyone may read, else
   * a live one, the current anchor first in both; else the first remaining source, so an archived
   * memory keeps an anchor for its restore. Null when no other source remains.
   */
  public EntityReference chooseAnchor(UUID memoryId, EntityReference leaving) {
    List<EntityReference> remaining = otherSources(memoryId, leaving);
    List<EntityReference> live =
        currentAnchorFirst(memoryId, remaining.stream().filter(other -> !isArchived(other)));
    return live.stream()
        .filter(ContextMemoryRepository::isOrgWideSource)
        .findFirst()
        .or(() -> live.stream().findFirst())
        .or(() -> remaining.stream().findFirst())
        .orElse(null);
  }

  private void archiveExtractedMemory(UUID memoryId, EntityReference source) {
    if (otherSources(memoryId, source).stream().allMatch(MemorySourceLifecycle::isArchived)) {
      memories.delete(Entity.ADMIN_USER_NAME, memoryId, false, false);
    } else {
      keepSharedMemoryLive(memoryId, source);
    }
  }

  /** The archived source keeps its links for a restore; only an anchor on it moves away. */
  private void keepSharedMemoryLive(UUID memoryId, EntityReference archived) {
    if (hasSourceRelationship(memoryId, archived, Relationship.APPLIED_TO)) {
      ContextMemory current =
          memories.get(
              null, memoryId, memories.getFields(SOURCE_LINK_FIELDS), Include.NON_DELETED, false);
      memories.update(null, current, reparented(current, archived, true), Entity.ADMIN_USER_NAME);
    }
    memories.refreshSearchDocument(memoryId);
  }

  private void detachSource(UUID memoryId, EntityReference source, boolean liveSourceRemains) {
    SourceLinks links = sourceLinks(memoryId, source);
    ContextMemory current =
        memories.get(null, memoryId, memories.getFields(SOURCE_LINK_FIELDS), Include.ALL, false);
    boolean staysLive = liveSourceRemains && !Boolean.TRUE.equals(current.getDeleted());
    if (staysLive) {
      reparentSharedMemory(current, source, links);
    } else {
      archiveWithRemainingSources(current, source, links);
    }
    deleteSourceLinks(memoryId, source, links);
    if (staysLive) {
      memories.refreshSearchDocument(memoryId);
    }
  }

  private void reparentSharedMemory(
      ContextMemory current, EntityReference source, SourceLinks links) {
    if (links.anchor() || links.related() || isSameSource(current.getSourceEntity(), source)) {
      memories.update(
          null, current, reparented(current, source, links.anchor()), Entity.ADMIN_USER_NAME);
    }
  }

  /** The memory without {@code leaving}: its anchor and source move to {@link #chooseAnchor}. */
  private ContextMemory reparented(
      ContextMemory current, EntityReference leaving, boolean wasAnchor) {
    boolean wasSource = isSameSource(current.getSourceEntity(), leaving);
    EntityReference replacement =
        wasAnchor || wasSource ? chooseAnchor(current.getId(), leaving) : null;
    ContextMemory updated = JsonUtils.deepCopy(current, ContextMemory.class);
    if (wasSource) {
      updated.setSourceEntity(replacement);
    }
    if (wasAnchor) {
      updated.setPrimaryEntity(replacement);
    }
    updated.setRelatedEntities(
        relatedWithout(current.getRelatedEntities(), leaving, wasAnchor ? replacement : null));
    return updated;
  }

  private static List<EntityReference> relatedWithout(
      List<EntityReference> related, EntityReference leaving, EntityReference anchor) {
    return listOrEmpty(related).stream()
        .filter(entity -> !entity.getId().equals(leaving.getId()))
        .filter(entity -> anchor == null || !entity.getId().equals(anchor.getId()))
        .toList();
  }

  /** Only archived sources still state the memory, so it waits in the Archive with them. */
  private void archiveWithRemainingSources(
      ContextMemory memory, EntityReference source, SourceLinks links) {
    if (!Boolean.TRUE.equals(memory.getDeleted())) {
      memories.delete(Entity.ADMIN_USER_NAME, memory.getId(), false, false);
    }
    if (links.anchor()) {
      moveArchivedAnchor(memory.getId(), chooseAnchor(memory.getId(), source));
    }
  }

  /** An update would restore an archived memory, so its anchor moves by its edges alone. */
  private void moveArchivedAnchor(UUID memoryId, EntityReference anchor) {
    memories.addRelationship(
        anchor.getId(), memoryId, anchor.getType(), Entity.CONTEXT_MEMORY, Relationship.APPLIED_TO);
    deleteSourceLink(memoryId, anchor, Relationship.RELATED_TO);
  }

  private List<EntityReference> currentAnchorFirst(UUID memoryId, Stream<EntityReference> sources) {
    Set<UUID> anchors =
        memories
            .findFromRecords(memoryId, Entity.CONTEXT_MEMORY, Relationship.APPLIED_TO, null)
            .stream()
            .map(CollectionDAO.EntityRelationshipRecord::getId)
            .collect(Collectors.toSet());
    return sources
        .sorted(Comparator.comparing(source -> !anchors.contains(source.getId())))
        .toList();
  }

  /** The memory's sources besides {@code source}, archived ones included, in name order. */
  private List<EntityReference> otherSources(UUID memoryId, EntityReference source) {
    return memories
        .findFrom(memoryId, Entity.CONTEXT_MEMORY, Relationship.MENTIONED_IN, null, Include.ALL)
        .stream()
        .filter(other -> !isSameSource(other, source))
        .toList();
  }

  private static boolean isSameSource(EntityReference reference, EntityReference source) {
    return reference != null
        && source != null
        && reference.getId().equals(source.getId())
        && reference.getType().equals(source.getType());
  }

  private static boolean isArchived(EntityReference source) {
    return Boolean.TRUE.equals(source.getDeleted());
  }

  /** Which of a source's anchor and related edges to a memory exist beside its MENTIONED_IN one. */
  private record SourceLinks(boolean anchor, boolean related) {}

  private SourceLinks sourceLinks(UUID memoryId, EntityReference source) {
    return new SourceLinks(
        hasSourceRelationship(memoryId, source, Relationship.APPLIED_TO),
        hasSourceRelationship(memoryId, source, Relationship.RELATED_TO));
  }

  private boolean hasSourceRelationship(
      UUID memoryId, EntityReference source, Relationship relationship) {
    return memories
        .findFrom(memoryId, Entity.CONTEXT_MEMORY, relationship, source.getType(), Include.ALL)
        .stream()
        .anyMatch(reference -> reference.getId().equals(source.getId()));
  }

  private void deleteSourceLinks(UUID memoryId, EntityReference source, SourceLinks links) {
    deleteSourceLink(memoryId, source, Relationship.MENTIONED_IN);
    if (links.anchor()) {
      deleteSourceLink(memoryId, source, Relationship.APPLIED_TO);
    }
    if (links.related()) {
      deleteSourceLink(memoryId, source, Relationship.RELATED_TO);
    }
  }

  private void deleteSourceLink(UUID memoryId, EntityReference source, Relationship relationship) {
    memories.deleteRelationship(
        source.getId(), source.getType(), memoryId, Entity.CONTEXT_MEMORY, relationship);
  }
}
