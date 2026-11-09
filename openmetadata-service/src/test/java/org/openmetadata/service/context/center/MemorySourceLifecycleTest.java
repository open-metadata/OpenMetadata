package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.core.Response;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;

@Execution(ExecutionMode.SAME_THREAD)
class MemorySourceLifecycleTest {

  private ContextMemoryRepository repository;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private CollectionDAO.EntityExtensionDAO extensionDAO;

  @BeforeEach
  void setUp() {
    CollectionDAO daoCollection = mock(CollectionDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    extensionDAO = mock(CollectionDAO.EntityExtensionDAO.class);
    when(daoCollection.contextMemoryDAO()).thenReturn(mock(CollectionDAO.ContextMemoryDAO.class));
    when(daoCollection.relationshipDAO()).thenReturn(relationshipDAO);
    when(daoCollection.entityExtensionDAO()).thenReturn(extensionDAO);
    Entity.setCollectionDAO(daoCollection);
    Entity.setEntityRelationshipRepository(new EntityRelationshipRepository(daoCollection));
    repository = new ContextMemoryRepository();
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  /**
   * Archiving saves the file deleted before its memories are released, so the reload no longer
   * lists it and the update changes nothing: only the release itself can drop the stale chip.
   */
  @Test
  void releasingASoftDeletedRelatedSourceRefreshesTheMemorysSearchDocument() {
    EntityReference anchor = contextFile("Anchor");
    EntityReference archived = contextFile("Archived").withDeleted(true);
    ContextMemory reloaded =
        memory(MemoryVisibility.ENTITY)
            .withSourceEntity(anchor)
            .withPrimaryEntity(anchor)
            .withRelatedEntities(List.of());
    UUID memoryId = reloaded.getId();
    linkSources(memoryId, anchor, archived);
    ContextMemoryRepository memories = reparentingChangesNothing(reloaded);
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      entities
          .when(
              () ->
                  Entity.getEntityReferencesByIds(
                      eq(Entity.CONTEXT_FILE), anyList(), any(Include.class)))
          .thenAnswer(
              call -> resolveSources(call.getArgument(1), call.getArgument(2), anchor, archived));

      new MemorySourceLifecycle(memories).releaseExtractedMemory(memoryId, archived);
    }

    ArgumentCaptor<EntityReference> refreshed = ArgumentCaptor.forClass(EntityReference.class);
    InOrder release = inOrder(relationshipDAO, dispatcher);
    verifyLinkDeleted(release, archived, memoryId, Relationship.MENTIONED_IN);
    verifyLinkDeleted(release, archived, memoryId, Relationship.RELATED_TO);
    release.verify(dispatcher).onEntityUpdated(refreshed.capture(), isNull());
    verifyNoMoreInteractions(dispatcher);
    assertEquals(memoryId, refreshed.getValue().getId());
    assertEquals(Entity.CONTEXT_MEMORY, refreshed.getValue().getType());
  }

  /**
   * The hook runs after the file is saved deleted, so the memory's only source is not live. The mark
   * is written after the delete, whose own hook clears it.
   */
  @Test
  void archivingTheOnlySourceSoftDeletesTheMemoryAndKeepsItsLink() {
    EntityReference archived = contextFile("Archived").withDeleted(true);
    ContextMemory stored = memory(MemoryVisibility.ENTITY);
    UUID memoryId = stored.getId();
    sourceMentions(archived, stored);
    linkSources(memoryId, archived);
    ContextMemoryRepository memories = deletesRecorded(spy(repository));
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(entities, archived, stored.getEntityReference());

      new MemorySourceLifecycle(memories)
          .archiveExtractedMemories(archived.getId(), archived.getType());
    }

    InOrder archive = inOrder(memories, extensionDAO);
    archive.verify(memories).delete(Entity.ADMIN_USER_NAME, memoryId, false, false);
    archive
        .verify(extensionDAO)
        .insert(eq(memoryId), eq(ArchivedWithSources.EXTENSION), any(), any());
    verify(memories, never()).delete(any(), any(UUID.class), anyBoolean(), eq(true));
    verify(relationshipDAO, never())
        .delete(any(UUID.class), anyString(), any(UUID.class), anyString(), anyInt());
    verifyNoInteractions(dispatcher);
  }

  /** An anchor on the private copy would hide the memory from the org-wide copy's readers. */
  @Test
  void archivingTheAnchorMovesItToAnOrgWideLiveSourceAndRefreshes() {
    EntityReference archived = contextFile("A").withDeleted(true);
    EntityReference restricted = contextFile("B");
    EntityReference orgWide = contextFile("C");
    ContextMemory stored =
        memory(MemoryVisibility.ENTITY)
            .withPrimaryEntity(archived)
            .withSourceEntity(restricted)
            .withRelatedEntities(List.of(restricted, orgWide));
    UUID memoryId = stored.getId();
    sourceMentions(archived, stored);
    linkSources(memoryId, archived, restricted, orgWide);
    ContextMemoryRepository memories = deletesRecorded(loads(stored, Include.NON_DELETED));
    doReturn(new PutResponse<>(Response.Status.OK, stored, EventType.ENTITY_UPDATED))
        .when(memories)
        .update(isNull(), any(), any(), eq(Entity.ADMIN_USER_NAME));
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(entities, archived, restricted, orgWide, stored.getEntityReference());
      sharedAs(entities, restricted, MemoryVisibility.PRIVATE);
      sharedAs(entities, orgWide, MemoryVisibility.ENTITY);

      new MemorySourceLifecycle(memories)
          .archiveExtractedMemories(archived.getId(), archived.getType());
    }

    ArgumentCaptor<ContextMemory> reanchored = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memories).update(isNull(), eq(stored), reanchored.capture(), eq(Entity.ADMIN_USER_NAME));
    assertEquals(orgWide.getId(), reanchored.getValue().getPrimaryEntity().getId());
    assertEquals(List.of(restricted.getId()), ids(reanchored.getValue().getRelatedEntities()));
    assertEquals(restricted.getId(), reanchored.getValue().getSourceEntity().getId());
    verify(relationshipDAO, never())
        .delete(eq(archived.getId()), anyString(), eq(memoryId), anyString(), anyInt());
    verify(memories, never()).delete(any(), any(UUID.class), anyBoolean(), anyBoolean());
    verify(dispatcher)
        .onEntityUpdated(argThat((EntityReference ref) -> memoryId.equals(ref.getId())), isNull());
  }

  /**
   * Permanently deleting one of two archived copies: the memory waits in the Archive for the other.
   * An update would restore it, so its anchor moves to that copy by its edges alone.
   */
  @Test
  void releasingAnArchivedMemoryMovesItsAnchorWithoutRestoringIt() {
    EntityReference released = contextFile("Released").withDeleted(true);
    EntityReference kept = contextFile("Kept").withDeleted(true);
    ContextMemory archived = memory(MemoryVisibility.ENTITY).withDeleted(true);
    UUID memoryId = archived.getId();
    linkSources(memoryId, released, kept);
    ContextMemoryRepository memories = deletesRecorded(loads(archived, Include.ALL));
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(entities, released, kept);

      new MemorySourceLifecycle(memories).releaseExtractedMemory(memoryId, released);
    }

    verify(memories, never()).delete(any(), any(UUID.class), anyBoolean(), anyBoolean());
    verify(memories, never()).update(any(), any(), any(), any());
    verifyLinkAdded(kept, memoryId, Relationship.APPLIED_TO);
    InOrder release = inOrder(relationshipDAO);
    verifyLinkDeleted(release, kept, memoryId, Relationship.RELATED_TO);
    verifyLinkDeleted(release, released, memoryId, Relationship.MENTIONED_IN);
    verifyLinkDeleted(release, released, memoryId, Relationship.APPLIED_TO);
    verify(extensionDAO, never()).insert(any(), any(), any(), any());
    verifyNoInteractions(dispatcher);
  }

  /**
   * Re-extraction drops a fact from its last live source while an archived copy still states it.
   * The memory is archived for that copy rather than deleted, and its anchor moves onto the copy.
   */
  @Test
  void releasingTheLastLiveSourceArchivesTheMemoryForItsArchivedCopy() {
    EntityReference released = contextFile("Live");
    EntityReference archivedCopy = contextFile("Archived").withDeleted(true);
    ContextMemory live = memory(MemoryVisibility.ENTITY);
    UUID memoryId = live.getId();
    linkSources(memoryId, released, archivedCopy);
    ContextMemoryRepository memories = deletesRecorded(loads(live, Include.ALL));
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(entities, released, archivedCopy);

      MemorySourceLifecycle lifecycleOfSources = new MemorySourceLifecycle(memories);
      assertTrue(lifecycleOfSources.hasOtherSources(memoryId, released));
      lifecycleOfSources.releaseExtractedMemory(memoryId, released);
    }

    verify(memories).delete(Entity.ADMIN_USER_NAME, memoryId, false, false);
    verify(extensionDAO).insert(eq(memoryId), eq(ArchivedWithSources.EXTENSION), any(), any());
    verify(memories, never()).delete(any(), any(UUID.class), anyBoolean(), eq(true));
    verify(memories, never()).update(any(), any(), any(), any());
    verifyLinkAdded(archivedCopy, memoryId, Relationship.APPLIED_TO);
    InOrder release = inOrder(relationshipDAO);
    verifyLinkDeleted(release, released, memoryId, Relationship.MENTIONED_IN);
    verifyLinkDeleted(release, released, memoryId, Relationship.APPLIED_TO);
    verifyNoInteractions(dispatcher);
  }

  /**
   * The restored org-wide file was the anchor of the first two memories, which archiving moved: it
   * takes it back from a private copy, which stays a related source, but not from an org-wide one,
   * beside which it is a related source again. It was only related to the third, which keeps its
   * private anchor.
   */
  @Test
  void restoreMovesTheAnchorBackOnlyFromARestrictedAnchor() {
    EntityReference restored = contextFile("Restored");
    EntityReference privateCopy = contextFile("Private copy");
    EntityReference orgWideCopy = contextFile("Org-wide copy");
    ContextMemory onPrivate = anchoredMemory(privateCopy);
    ContextMemory onOrgWide = anchoredMemory(orgWideCopy);
    ContextMemory relatedOnly = anchoredMemory(privateCopy).withRelatedEntities(List.of(restored));
    sourceMentions(restored, onPrivate, onOrgWide, relatedOnly);
    anchoredOn(onPrivate.getId(), privateCopy, restored);
    anchoredOn(onOrgWide.getId(), orgWideCopy, restored);
    anchoredOn(relatedOnly.getId(), privateCopy, restored);
    when(relationshipDAO.findFrom(
            relatedOnly.getId(),
            Entity.CONTEXT_MEMORY,
            Relationship.RELATED_TO.ordinal(),
            restored.getType()))
        .thenReturn(edgesFrom(restored));
    Map<UUID, ContextMemory> stored = storedAs(onPrivate, onOrgWide, relatedOnly);
    ContextMemoryRepository memories = writesKept(spy(repository), stored);
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(
          entities,
          restored,
          privateCopy,
          orgWideCopy,
          onPrivate.getEntityReference(),
          onOrgWide.getEntityReference(),
          relatedOnly.getEntityReference());
      sharedAs(entities, restored, MemoryVisibility.ENTITY);
      sharedAs(entities, privateCopy, MemoryVisibility.PRIVATE);
      sharedAs(entities, orgWideCopy, MemoryVisibility.ENTITY);

      new MemorySourceLifecycle(memories)
          .restoreExtractedMemories(restored.getId(), restored.getType());
    }

    assertSourceLinks(stored.get(onPrivate.getId()), restored, privateCopy);
    assertSourceLinks(stored.get(onOrgWide.getId()), orgWideCopy, restored);
    assertSourceLinks(stored.get(relatedOnly.getId()), privateCopy, restored);
    verify(memories, never())
        .update(any(), argThat((ContextMemory memory) -> memory == relatedOnly), any(), any());
    verifyRefreshed(dispatcher, onPrivate.getId());
    verifyRefreshed(dispatcher, onOrgWide.getId());
    verifyRefreshed(dispatcher, relatedOnly.getId());
  }

  /**
   * Of two live org-wide sources, the one that anchors the memory keeps the anchor, though sources are
   * listed in name order.
   */
  @Test
  void chooseAnchorKeepsTheCurrentAnchorWhenItQualifies() {
    EntityReference leaving = contextFile("Leaving").withDeleted(true);
    EntityReference listedFirst = contextFile("A listed first");
    EntityReference current = contextFile("B current anchor");
    UUID memoryId = UUID.randomUUID();
    anchoredOn(memoryId, current, listedFirst, leaving);

    EntityReference chosen;
    try (MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      resolveReferences(entities, listedFirst, current, leaving);
      sharedAs(entities, listedFirst, MemoryVisibility.ENTITY);
      sharedAs(entities, current, MemoryVisibility.ENTITY);

      chosen = new MemorySourceLifecycle(repository).chooseAnchor(memoryId, leaving);
    }

    assertEquals(current.getId(), chosen.getId());
  }

  /** A memory the source's archive took comes back; one a person deleted stays deleted. */
  @Test
  void restoringASourceBringsBackOnlyTheMemoriesItsArchiveTook() {
    EntityReference restored = contextFile("Restored");
    ContextMemory archivedWithIt = memory(MemoryVisibility.ENTITY).withDeleted(true);
    ContextMemory deletedByAPerson = memory(MemoryVisibility.ENTITY).withDeleted(true);
    sourceMentions(restored, archivedWithIt, deletedByAPerson);
    anchoredOn(archivedWithIt.getId(), restored);
    anchoredOn(deletedByAPerson.getId(), restored);
    marked(archivedWithIt);
    ContextMemoryRepository memories = restoresRecorded(spy(repository));
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(
          entities,
          restored,
          archivedWithIt.getEntityReference().withDeleted(true),
          deletedByAPerson.getEntityReference().withDeleted(true));

      new MemorySourceLifecycle(memories)
          .restoreExtractedMemories(restored.getId(), restored.getType());
    }

    verify(memories).restoreEntity(Entity.ADMIN_USER_NAME, archivedWithIt.getId());
    verify(memories, never()).restoreEntity(any(), eq(deletedByAPerson.getId()));
    verifyRefreshed(dispatcher, archivedWithIt.getId());
    verifyNoMoreInteractions(dispatcher);
  }

  /**
   * Permanently deleting an archived memory's anchor moved its anchor edge onto another archived
   * copy without touching the stored anchor. Restoring a private file, its only live source, anchors
   * it there and drops the archived copy's edge, which the stored anchor no longer names.
   */
  @Test
  void restoringAMemoryMovesItsAnchorOffAnArchivedCopy() {
    EntityReference restored = contextFile("Restored");
    EntityReference archivedCopy = contextFile("Archived copy").withDeleted(true);
    EntityReference deletedAnchor = contextFile("Permanently deleted");
    ContextMemory staleAnchor = memory(MemoryVisibility.ENTITY).withPrimaryEntity(deletedAnchor);
    UUID memoryId = staleAnchor.getId();
    sourceMentions(restored, staleAnchor);
    anchoredOn(memoryId, archivedCopy, restored);
    marked(staleAnchor);
    Map<UUID, ContextMemory> stored = storedAs(staleAnchor);
    ContextMemoryRepository memories = restoresRecorded(writesKept(spy(repository), stored));
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(
          entities, restored, archivedCopy, staleAnchor.getEntityReference().withDeleted(true));
      sharedAs(entities, restored, MemoryVisibility.PRIVATE);

      new MemorySourceLifecycle(memories)
          .restoreExtractedMemories(restored.getId(), restored.getType());
    }

    verify(memories).restoreEntity(Entity.ADMIN_USER_NAME, memoryId);
    assertEquals(restored.getId(), stored.get(memoryId).getPrimaryEntity().getId());
    assertTrue(stored.get(memoryId).getRelatedEntities().isEmpty());
    verifyLinkDeleted(inOrder(relationshipDAO), archivedCopy, memoryId, Relationship.APPLIED_TO);
    verifyRefreshed(dispatcher, memoryId);
  }

  /** Every file mentions the memory: the first is its anchor and the rest are related sources. */
  private void linkSources(UUID memoryId, EntityReference anchor, EntityReference... related) {
    when(relationshipDAO.findFrom(
            memoryId, Entity.CONTEXT_MEMORY, Relationship.MENTIONED_IN.ordinal()))
        .thenReturn(
            edgesFrom(
                Stream.concat(Stream.of(anchor), Stream.of(related))
                    .toArray(EntityReference[]::new)));
    when(relationshipDAO.findFrom(
            memoryId, Entity.CONTEXT_MEMORY, Relationship.APPLIED_TO.ordinal(), anchor.getType()))
        .thenReturn(edgesFrom(anchor));
    when(relationshipDAO.findFrom(
            memoryId, Entity.CONTEXT_MEMORY, Relationship.APPLIED_TO.ordinal()))
        .thenReturn(edgesFrom(anchor));
    when(relationshipDAO.findFrom(
            memoryId, Entity.CONTEXT_MEMORY, Relationship.RELATED_TO.ordinal(), anchor.getType()))
        .thenReturn(edgesFrom(related));
  }

  /** The source's MENTIONED_IN edges to the memories, as a lookup of the source's memories reads them. */
  private void sourceMentions(EntityReference source, ContextMemory... memories) {
    when(relationshipDAO.findTo(
            source.getId(),
            source.getType(),
            Relationship.MENTIONED_IN.ordinal(),
            Entity.CONTEXT_MEMORY))
        .thenReturn(
            edgesFrom(
                Stream.of(memories)
                    .map(ContextMemory::getEntityReference)
                    .toArray(EntityReference[]::new)));
  }

  /** The memory is anchored on {@code anchor}, and it and every other given file mention it. */
  private void anchoredOn(UUID memoryId, EntityReference anchor, EntityReference... others) {
    when(relationshipDAO.findFrom(
            memoryId, Entity.CONTEXT_MEMORY, Relationship.MENTIONED_IN.ordinal()))
        .thenReturn(
            edgesFrom(
                Stream.concat(Stream.of(anchor), Stream.of(others))
                    .toArray(EntityReference[]::new)));
    when(relationshipDAO.findFrom(
            memoryId, Entity.CONTEXT_MEMORY, Relationship.APPLIED_TO.ordinal()))
        .thenReturn(edgesFrom(anchor));
  }

  /** The source lifecycle archived the memory with its sources. */
  private void marked(ContextMemory memory) {
    when(extensionDAO.getExtension(memory.getId(), ArchivedWithSources.EXTENSION)).thenReturn("{}");
  }

  /** The live memories as stored, keyed by id. */
  private static Map<UUID, ContextMemory> storedAs(ContextMemory... memories) {
    Map<UUID, ContextMemory> stored = new HashMap<>();
    Stream.of(memories).forEach(memory -> stored.put(memory.getId(), memory));
    return stored;
  }

  /** A live read returns the memory as the last update stored it, as the database would. */
  private static ContextMemoryRepository writesKept(
      ContextMemoryRepository memories, Map<UUID, ContextMemory> stored) {
    doAnswer(call -> stored.get(call.<UUID>getArgument(1)))
        .when(memories)
        .get(isNull(), any(UUID.class), any(), eq(Include.NON_DELETED), eq(false));
    doAnswer(
            call -> {
              ContextMemory updated = call.getArgument(2);
              stored.put(updated.getId(), updated);
              return new PutResponse<>(Response.Status.OK, updated, EventType.ENTITY_UPDATED);
            })
        .when(memories)
        .update(isNull(), any(), any(), eq(Entity.ADMIN_USER_NAME));
    return memories;
  }

  /** Restores are recorded, not run: the restore pipeline itself is covered by the ITs. */
  private static ContextMemoryRepository restoresRecorded(ContextMemoryRepository memories) {
    doReturn(null).when(memories).restoreEntity(any(), any(UUID.class));
    return memories;
  }

  private static ContextMemory anchoredMemory(EntityReference anchor) {
    return memory(MemoryVisibility.ENTITY).withPrimaryEntity(anchor);
  }

  private static void assertSourceLinks(
      ContextMemory memory, EntityReference anchor, EntityReference... related) {
    assertEquals(anchor.getId(), memory.getPrimaryEntity().getId());
    assertEquals(ids(List.of(related)), ids(listOrEmpty(memory.getRelatedEntities())));
  }

  private static void verifyRefreshed(EntityLifecycleEventDispatcher dispatcher, UUID memoryId) {
    verify(dispatcher)
        .onEntityUpdated(argThat((EntityReference ref) -> memoryId.equals(ref.getId())), isNull());
  }

  /** The file as stored, shared as {@code visibility}. */
  private static void sharedAs(
      MockedStatic<Entity> entities, EntityReference file, MemoryVisibility visibility) {
    ContextFile stored =
        new ContextFile()
            .withId(file.getId())
            .withName(file.getName())
            .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
    entities
        .when(
            () ->
                Entity.getEntity(
                    argThat(
                        (EntityReference ref) -> ref != null && file.getId().equals(ref.getId())),
                    eq(""),
                    eq(Include.NON_DELETED)))
        .thenReturn(stored);
  }

  private static List<UUID> ids(List<EntityReference> references) {
    return references.stream().map(EntityReference::getId).toList();
  }

  /** The memory reads back as {@code stored} when loaded with {@code include}. */
  private ContextMemoryRepository loads(ContextMemory stored, Include include) {
    ContextMemoryRepository memories = spy(repository);
    doReturn(stored)
        .when(memories)
        .get(isNull(), eq(stored.getId()), any(), eq(include), eq(false));
    return memories;
  }

  /** Deletes are recorded, not run: the delete pipeline itself is covered by the ITs. */
  private static ContextMemoryRepository deletesRecorded(ContextMemoryRepository memories) {
    doReturn(new DeleteResponse<>(null, EventType.ENTITY_SOFT_DELETED))
        .when(memories)
        .delete(any(), any(UUID.class), anyBoolean(), anyBoolean());
    return memories;
  }

  /** Resolves every reference lookup from {@code references}, as the database would. */
  private static void resolveReferences(
      MockedStatic<Entity> entities, EntityReference... references) {
    entities
        .when(() -> Entity.getEntityReferencesByIds(anyString(), anyList(), any(Include.class)))
        .thenAnswer(call -> resolveSources(call.getArgument(1), call.getArgument(2), references));
  }

  private void verifyLinkAdded(EntityReference source, UUID memoryId, Relationship relationship) {
    verify(relationshipDAO)
        .insert(
            source.getId(),
            memoryId,
            source.getType(),
            Entity.CONTEXT_MEMORY,
            relationship.ordinal(),
            "",
            null);
  }

  /** The memory reloads as {@code reloaded}, and updating it to the same content writes nothing. */
  private ContextMemoryRepository reparentingChangesNothing(ContextMemory reloaded) {
    ContextMemoryRepository memories = loads(reloaded, Include.ALL);
    doReturn(new PutResponse<>(Response.Status.OK, reloaded, EventType.ENTITY_NO_CHANGE))
        .when(memories)
        .update(isNull(), any(), any(), eq(Entity.ADMIN_USER_NAME));
    return memories;
  }

  private void verifyLinkDeleted(
      InOrder order, EntityReference source, UUID memoryId, Relationship relationship) {
    order
        .verify(relationshipDAO)
        .delete(
            source.getId(),
            source.getType(),
            memoryId,
            Entity.CONTEXT_MEMORY,
            relationship.ordinal());
  }

  private static EntityReference contextFile(String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.CONTEXT_FILE)
        .withName(name);
  }

  private static List<CollectionDAO.EntityRelationshipRecord> edgesFrom(
      EntityReference... sources) {
    return Stream.of(sources)
        .map(
            source ->
                CollectionDAO.EntityRelationshipRecord.builder()
                    .id(source.getId())
                    .type(source.getType())
                    .build())
        .toList();
  }

  /** Resolves source ids as the database does, where a non-deleted lookup skips deleted ones. */
  private static List<EntityReference> resolveSources(
      List<UUID> ids, Include include, EntityReference... sources) {
    return Stream.of(sources)
        .filter(source -> ids.contains(source.getId()))
        .filter(
            source -> include != Include.NON_DELETED || !Boolean.TRUE.equals(source.getDeleted()))
        .toList();
  }

  private static ContextMemory memory(MemoryVisibility visibility) {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("mem")
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }
}
