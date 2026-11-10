package org.openmetadata.service.context.center;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.jdbi3.ContextMemoryRepository.FIELD_PRIMARY_ENTITY;
import static org.openmetadata.service.jdbi3.ContextMemoryRepository.FIELD_RELATED_ENTITIES;
import static org.openmetadata.service.jdbi3.ContextMemoryRepository.SOURCE_LINK_FIELDS;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.util.FreshReadScope;

/**
 * What a memory does when one of its source documents is linked, archived, restored, permanently
 * deleted or shared differently (ADR:2026-09-29-context-file-memory-reuse).
 */
public class MemorySourceLifecycle {
  /** What a lifecycle write reads: without the source, so the write keeps the stored one. */
  private static final String LINK_FIELDS = FIELD_PRIMARY_ENTITY + "," + FIELD_RELATED_ENTITIES;

  private static final int MAX_LINK_ATTEMPTS = 3;
  private static final String KEPT_CHANGING_WHILE_LINKED =
      "Memory %s kept changing while another document was linked to it";

  private final ContextMemoryRepository memories;
  private final ArchivedWithSources archivedWithSources;
  private final SourceReaders readers;

  public MemorySourceLifecycle(ContextMemoryRepository memories) {
    this(memories, new SourceReaders());
  }

  private MemorySourceLifecycle(ContextMemoryRepository memories, SourceReaders readers) {
    this.memories = memories;
    this.archivedWithSources =
        new ArchivedWithSources(memories.getDaoCollection().entityExtensionDAO());
    this.readers = readers;
  }

  /** This lifecycle, deciding who may read {@code file} by its sharing as given, not as stored. */
  MemorySourceLifecycle withSharingOf(ContextFile file) {
    return new MemorySourceLifecycle(memories, readers.withSharingOf(file));
  }

  /**
   * Links another document that states the memory. Only one everyone may read joins its related
   * entities, so a restricted copy is linked by its source edge alone and never appears in them or
   * in the memory's history ({@link MemorySourceDisclosure}).
   */
  public void linkExtractedMemory(UUID memoryId, EntityReference source) {
    if (!isLinkedTo(memoryId, source)) {
      addRelatedSource(memoryId, source);
      memories.addRelationship(
          source.getId(),
          memoryId,
          source.getType(),
          Entity.CONTEXT_MEMORY,
          Relationship.MENTIONED_IN);
      // The link write indexed the memory with restricted names withheld; reindex it from storage.
      memories.refreshSearchDocument(memoryId);
    }
  }

  private boolean isLinkedTo(UUID memoryId, EntityReference source) {
    return memories
        .findFrom(memoryId, Entity.CONTEXT_MEMORY, Relationship.MENTIONED_IN, source.getType())
        .stream()
        .anyMatch(existing -> source.getId().equals(existing.getId()));
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
   * Restores what archiving a source took: each memory it took to the Archive comes back, and the
   * shared ones that stayed live show it as a source again. A memory a person deleted stays deleted.
   */
  public void restoreExtractedMemories(UUID sourceId, String sourceType) {
    requireOpenTransaction();
    EntityReference restored = new EntityReference().withId(sourceId).withType(sourceType);
    for (EntityReference memory :
        memories.findTo(
            sourceId, sourceType, Relationship.MENTIONED_IN, Entity.CONTEXT_MEMORY, Include.ALL)) {
      restoreExtractedMemory(memory.getId(), restored);
    }
  }

  /**
   * These moves lock rows or must commit with the source's own change, so they need a transaction.
   */
  void requireOpenTransaction() {
    if (!memories.getDaoCollection().isInTransaction()) {
      throw new IllegalStateException("A source's memories follow it only inside its own write");
    }
  }

  /** The live memories the source states. */
  List<EntityReference> linkedMemories(EntityReference source) {
    return memories.findTo(
        source.getId(), source.getType(), Relationship.MENTIONED_IN, Entity.CONTEXT_MEMORY);
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
        .filter(this::readableByEveryone)
        .findFirst()
        .or(() -> live.stream().findFirst())
        .or(() -> remaining.stream().findFirst())
        .orElse(null);
  }

  /**
   * A copy of the memory for {@code source}'s readers, anchored on and linked to that source, which
   * stops linking the original; none for a retired memory. Nothing extracts, reconciles or judges it.
   */
  public Optional<ContextMemory> copyForSource(ContextMemory memory, EntityReference source) {
    Optional<ContextMemory> copy = MemoryCopy.of(memory, source);
    copy.ifPresent(
        made -> {
          relinking(made.getId(), () -> memories.create(null, made));
          unlinkSource(memory.getId(), source);
        });
    return copy;
  }

  /** {@code source} stops linking the memory, which then names it nowhere. */
  private void unlinkSource(UUID memoryId, EntityReference source) {
    deleteSourceLink(memoryId, source, Relationship.MENTIONED_IN);
    deleteSourceLink(memoryId, source, Relationship.RELATED_TO);
    memories.refreshSearchDocument(memoryId);
  }

  private void archiveExtractedMemory(UUID memoryId, EntityReference source) {
    if (otherSources(memoryId, source).stream().allMatch(MemorySourceLifecycle::isArchived)) {
      archive(memoryId);
    } else {
      keepSharedMemoryLive(memoryId, source);
    }
  }

  /** The mark goes on after the delete, because every delete's hook clears it. */
  private void archive(UUID memoryId) {
    relinking(memoryId, () -> memories.delete(Entity.ADMIN_USER_NAME, memoryId, false, false));
    archivedWithSources.mark(memoryId);
  }

  /** The archived source keeps its links for a restore; only an anchor on it moves away. */
  private void keepSharedMemoryLive(UUID memoryId, EntityReference archived) {
    if (hasSourceRelationship(memoryId, archived, Relationship.APPLIED_TO)) {
      ContextMemory current =
          memories.get(
              null, memoryId, memories.getFields(SOURCE_LINK_FIELDS), Include.NON_DELETED, false);
      ContextMemory reanchored = reparented(current, archived, true);
      updateSourceLinks(current, reanchored);
      copyForSourcesTheAnchorHides(memoryId, reanchored.getPrimaryEntity());
    } else {
      copyForTheSourcesItWouldShow(memoryId);
    }
    memories.refreshSearchDocument(memoryId);
  }

  /** No longer names {@code source} among the memory's related entities; its links stay. */
  void dropRelatedSource(UUID memoryId, EntityReference source) {
    if (hasSourceRelationship(memoryId, source, Relationship.RELATED_TO)) {
      ContextMemory current = linksOf(memoryId);
      ContextMemory updated = JsonUtils.deepCopy(current, ContextMemory.class);
      updated.setRelatedEntities(relatedWithout(current.getRelatedEntities(), source, null));
      updateSourceLinks(current, updated);
    }
  }

  /**
   * Copies the memory for each of its live sources that not everyone may read and whose readers are
   * not all readers of its restricted anchor, so none of them loses it.
   */
  void copyForSourcesTheAnchorHides(UUID memoryId, EntityReference anchor) {
    if (anchor != null && !readableByEveryone(anchor)) {
      Set<UUID> anchorReaders = readers.readersOf(anchor);
      copyFor(
          memoryId,
          otherSources(memoryId, anchor).stream()
              .filter(source -> !isArchived(source) && !readableByEveryone(source))
              .filter(source -> !anchorReaders.containsAll(readers.readersOf(source)))
              .toList());
    }
  }

  private void copyFor(UUID memoryId, List<EntityReference> sources) {
    if (!sources.isEmpty()) {
      ContextMemory memory = storedMemory(memoryId);
      sources.forEach(source -> copyForSource(memory, source));
    }
  }

  /**
   * While the memory would show a document only some may read that is not its anchor, that document
   * takes a copy of it, or stops linking a retired one, so the memory never names it to its readers.
   */
  void copyForTheSourcesItWouldShow(UUID memoryId) {
    EntityReference shown = restrictedShownSource(memoryId);
    ContextMemory memory = shown == null ? null : storedMemory(memoryId);
    while (shown != null) {
      if (copyForSource(memory, shown).isEmpty()) {
        unlinkSource(memoryId, shown);
      }
      shown = restrictedShownSource(memoryId);
    }
  }

  /** The document the memory shows, when it is not its anchor and not everyone may read it. */
  private EntityReference restrictedShownSource(UUID memoryId) {
    EntityReference anchor = anchorEdge(memoryId);
    List<EntityReference> documents =
        memories.findFrom(memoryId, Entity.CONTEXT_MEMORY, Relationship.MENTIONED_IN, null);
    EntityReference shown =
        MemorySourceDisclosure.shownSource(anchor, documents, this::readableByEveryone);
    boolean named = shown == null || isSameSource(shown, anchor) || readableByEveryone(shown);
    return named ? null : shown;
  }

  private ContextMemory storedMemory(UUID memoryId) {
    return memories.get(null, memoryId, memories.getFields(""), Include.NON_DELETED, false);
  }

  /** A live article or org-wide file; a file this write shares differently, as it leaves it. */
  boolean readableByEveryone(EntityReference document) {
    return readers.everyoneMayRead(document);
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
      copyForTheSourcesItWouldShow(memoryId);
      memories.refreshSearchDocument(memoryId);
    }
  }

  private void reparentSharedMemory(
      ContextMemory current, EntityReference source, SourceLinks links) {
    if (links.anchor() || links.related() || isSameSource(current.getSourceEntity(), source)) {
      updateSourceLinks(current, reparented(current, source, links.anchor()));
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
      archive(memory.getId());
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

  /**
   * Decided on the memory's row as last committed, read with a lock, so a concurrent delete or
   * restore of the same memory cannot change that decision until this restore ends. The reads after
   * it are not locking: on MySQL they may see the transaction's earlier snapshot.
   */
  private void restoreExtractedMemory(UUID memoryId, EntityReference restored) {
    ContextMemory latest = lockedMemory(memoryId);
    boolean archived = latest != null && Boolean.TRUE.equals(latest.getDeleted());
    boolean comesBack = archived && archivedWithSources.isMarked(memoryId);
    if (comesBack) {
      relinking(memoryId, () -> memories.restoreEntity(Entity.ADMIN_USER_NAME, memoryId));
    }
    if (latest != null && (comesBack || !archived)) {
      showAsSourceAgain(memoryId, restored);
    }
  }

  /** The memory as last committed, its row locked until the restore ends; null once it is gone. */
  private ContextMemory lockedMemory(UUID memoryId) {
    String json = memories.getDao().findJsonByIdForUpdate(memoryId, Include.ALL);
    return json == null ? null : JsonUtils.readValue(json, ContextMemory.class);
  }

  /**
   * Shows {@code restored} as a source of the live memory again. Only a memory anchored on another of
   * its sources changes: the restored file takes the anchor back, or rejoins its related sources.
   */
  private void showAsSourceAgain(UUID memoryId, EntityReference restored) {
    EntityReference anchor = anchorEdge(memoryId);
    if (isAnotherSource(memoryId, anchor, restored)) {
      giveAnchorBackIfDue(memoryId, anchor, restored);
      addRelatedSource(memoryId, restored);
    }
    memories.refreshSearchDocument(memoryId);
  }

  /**
   * Shows a file everyone may read again as a source of the live memory: it rejoins the related
   * entities unless it anchors them, and a restricted anchor among its sources gives way to it.
   */
  void showAsSourceOnceOpened(UUID memoryId, EntityReference opened) {
    EntityReference anchor = anchorEdge(memoryId);
    if (isAnotherSource(memoryId, anchor, opened)) {
      giveAnchorBackIfDue(memoryId, anchor, opened);
    }
    addRelatedSource(memoryId, opened);
    memories.refreshSearchDocument(memoryId);
  }

  private void giveAnchorBackIfDue(
      UUID memoryId, EntityReference anchor, EntityReference document) {
    EntityReference target = anchorAfterRestore(memoryId, anchor, document);
    if (!isSameSource(target, anchor)) {
      reanchor(memoryId, anchor, target);
    }
  }

  /** The anchor its edge names, a live one first: the stored anchor can be stale in the Archive. */
  private EntityReference anchorEdge(UUID memoryId) {
    return memories
        .findFrom(memoryId, Entity.CONTEXT_MEMORY, Relationship.APPLIED_TO, null, Include.ALL)
        .stream()
        .min(Comparator.comparing(MemorySourceLifecycle::isArchived))
        .orElse(null);
  }

  private boolean isAnotherSource(UUID memoryId, EntityReference anchor, EntityReference source) {
    return anchor != null
        && otherSources(memoryId, source).stream().anyMatch(other -> isSameSource(other, anchor));
  }

  /**
   * Where the anchor belongs once {@code restored} is live, or readable by everyone, again. An
   * archived anchor moves to a live source; a file only some may read gives way to the restored
   * file when everyone may read that.
   */
  private EntityReference anchorAfterRestore(
      UUID memoryId, EntityReference anchor, EntityReference restored) {
    if (isArchived(anchor)) {
      return chooseAnchor(memoryId, anchor);
    }
    boolean takesTheAnchor = isRestrictedFile(anchor) && readableByEveryone(restored);
    return takesTheAnchor ? restored : anchor;
  }

  /** A file shared with only some people; an article or an asset anchor is never one. */
  private boolean isRestrictedFile(EntityReference anchor) {
    return Entity.CONTEXT_FILE.equals(anchor.getType()) && !readableByEveryone(anchor);
  }

  /**
   * Anchors the live memory on {@code anchor}. A live previous anchor everyone may read becomes a
   * related source; one only some may read is linked by its source edge alone.
   */
  void reanchor(UUID memoryId, EntityReference previous, EntityReference anchor) {
    ContextMemory current = linksOf(memoryId);
    updateSourceLinks(current, reanchored(current, previous, anchor));
    if (isArchived(previous)) {
      // The update diffs from the stored anchor, which an edge-only move left naming another file.
      deleteSourceLink(memoryId, previous, Relationship.APPLIED_TO);
    }
  }

  private ContextMemory reanchored(
      ContextMemory current, EntityReference previous, EntityReference anchor) {
    List<EntityReference> related =
        new ArrayList<>(relatedWithout(current.getRelatedEntities(), anchor, previous));
    if (!isArchived(previous) && readableByEveryone(previous)) {
      related.add(previous);
    }
    ContextMemory updated =
        JsonUtils.deepCopy(current, ContextMemory.class).withPrimaryEntity(anchor);
    updated.setRelatedEntities(related);
    return updated;
  }

  /** Names {@code source} among the memory's related entities, when everyone may read it. */
  private void addRelatedSource(UUID memoryId, EntityReference source) {
    if (readableByEveryone(source)) {
      relateLinkedSource(memoryId, source);
    }
  }

  /** Conditional on the memory as read, so a decision written meanwhile is read again, not lost. */
  private void relateLinkedSource(UUID memoryId, EntityReference source) {
    for (int attempt = 1; !tryRelatingLinkedSource(memoryId, source); attempt++) {
      if (attempt == MAX_LINK_ATTEMPTS) {
        throw new PreconditionFailedException(String.format(KEPT_CHANGING_WHILE_LINKED, memoryId));
      }
    }
  }

  /** False when the memory changed between this read and the write. */
  private boolean tryRelatingLinkedSource(UUID memoryId, EntityReference source) {
    boolean written = true;
    try (var ignored = FreshReadScope.enter()) {
      ContextMemory current = linksOf(memoryId);
      if (!namesDocument(current, source)) {
        ContextMemory updated = withRelated(current, source);
        relinking(
            memoryId,
            () -> memories.updateIfCurrent(null, current, updated, Entity.ADMIN_USER_NAME));
      }
    } catch (PreconditionFailedException changedMeanwhile) {
      written = false;
    }
    return written;
  }

  private static boolean namesDocument(ContextMemory memory, EntityReference document) {
    return isSameSource(memory.getPrimaryEntity(), document)
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

  /** The live memory with its anchor and related entities, and without its source. */
  private ContextMemory linksOf(UUID memoryId) {
    return memories.get(
        null, memoryId, memories.getFields(LINK_FIELDS), Include.NON_DELETED, false);
  }

  /** Conditional on the memory as read: a write landing meanwhile fails this one, never lost. */
  private void updateSourceLinks(ContextMemory current, ContextMemory updated) {
    relinking(
        current.getId(),
        () -> memories.updateIfCurrent(null, current, updated, Entity.ADMIN_USER_NAME));
  }

  private void relinking(UUID memoryId, Runnable write) {
    MemoryRelinking.run(memoryId, this::readableByEveryone, write);
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

  /** Whether {@code source} anchors the memory, archived or not. */
  boolean isAnchoredOn(UUID memoryId, EntityReference source) {
    return hasSourceRelationship(memoryId, source, Relationship.APPLIED_TO);
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
