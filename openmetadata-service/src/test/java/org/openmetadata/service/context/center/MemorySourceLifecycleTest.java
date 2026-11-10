package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
import static org.mockito.Mockito.doThrow;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.entity.context.MemoryDispute;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;

@Execution(ExecutionMode.SAME_THREAD)
class MemorySourceLifecycleTest {

  private ContextMemoryRepository repository;
  private CollectionDAO daoCollection;
  private CollectionDAO.ContextMemoryDAO memoryDAO;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private CollectionDAO.EntityExtensionDAO extensionDAO;

  @BeforeEach
  void setUp() {
    daoCollection = mock(CollectionDAO.class);
    memoryDAO = mock(CollectionDAO.ContextMemoryDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    extensionDAO = mock(CollectionDAO.EntityExtensionDAO.class);
    when(daoCollection.contextMemoryDAO()).thenReturn(memoryDAO);
    when(daoCollection.relationshipDAO()).thenReturn(relationshipDAO);
    when(daoCollection.entityExtensionDAO()).thenReturn(extensionDAO);
    when(daoCollection.isInTransaction()).thenReturn(true);
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
        .updateIfCurrent(isNull(), any(), any(), eq(Entity.ADMIN_USER_NAME));
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
    verify(memories)
        .updateIfCurrent(isNull(), eq(stored), reanchored.capture(), eq(Entity.ADMIN_USER_NAME));
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
    verify(memories, never()).updateIfCurrent(any(), any(), any(), any());
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
    verify(memories, never()).updateIfCurrent(any(), any(), any(), any());
    verifyLinkAdded(archivedCopy, memoryId, Relationship.APPLIED_TO);
    InOrder release = inOrder(relationshipDAO);
    verifyLinkDeleted(release, released, memoryId, Relationship.MENTIONED_IN);
    verifyLinkDeleted(release, released, memoryId, Relationship.APPLIED_TO);
    verifyNoInteractions(dispatcher);
  }

  /**
   * A restored org-wide file takes the anchor from a private copy, whether the file was the anchor or
   * only related; the private copy keeps its link but is named nowhere. An org-wide copy and an
   * article keep the anchor, and the restored file is a related source again beside them.
   */
  @Test
  void restoreMovesTheAnchorBackOnlyFromARestrictedAnchor() {
    EntityReference restored = contextFile("Restored");
    EntityReference privateCopy = contextFile("Private copy");
    EntityReference orgWideCopy = contextFile("Org-wide copy");
    EntityReference article =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.PAGE).withName("Article");
    ContextMemory onPrivate = anchoredMemory(privateCopy);
    ContextMemory onOrgWide = anchoredMemory(orgWideCopy);
    ContextMemory relatedOnPrivate =
        anchoredMemory(privateCopy).withRelatedEntities(List.of(restored));
    ContextMemory onArticle = anchoredMemory(article);
    sourceMentions(restored, onPrivate, onOrgWide, relatedOnPrivate, onArticle);
    anchoredOn(onPrivate.getId(), privateCopy, restored);
    anchoredOn(onOrgWide.getId(), orgWideCopy, restored);
    anchoredOn(relatedOnPrivate.getId(), privateCopy, restored);
    anchoredOn(onArticle.getId(), article, restored);
    Map<UUID, ContextMemory> stored = storedAs(onPrivate, onOrgWide, relatedOnPrivate, onArticle);
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
          article,
          onPrivate.getEntityReference(),
          onOrgWide.getEntityReference(),
          relatedOnPrivate.getEntityReference(),
          onArticle.getEntityReference());
      sharedAs(entities, restored, MemoryVisibility.ENTITY);
      sharedAs(entities, privateCopy, MemoryVisibility.PRIVATE);
      sharedAs(entities, orgWideCopy, MemoryVisibility.ENTITY);

      new MemorySourceLifecycle(memories)
          .restoreExtractedMemories(restored.getId(), restored.getType());
    }

    assertSourceLinks(stored.get(onPrivate.getId()), restored);
    assertSourceLinks(stored.get(onOrgWide.getId()), orgWideCopy, restored);
    assertSourceLinks(stored.get(relatedOnPrivate.getId()), restored);
    assertSourceLinks(stored.get(onArticle.getId()), article, restored);
    Stream.of(onPrivate, onOrgWide, relatedOnPrivate, onArticle)
        .forEach(memory -> verifyRefreshed(dispatcher, memory.getId()));
  }

  /** The marks and memory rows it locks only hold inside a transaction, so restore needs one. */
  @Test
  void restoreRefusesToRunOutsideATransaction() {
    EntityReference restored = contextFile("Restored");
    ContextMemory archived = memory(MemoryVisibility.ENTITY).withDeleted(true);
    sourceMentions(restored, archived);
    committed(archived);
    marked(archived);
    when(daoCollection.isInTransaction()).thenReturn(false);
    ContextMemoryRepository memories = restoresRecorded(spy(repository));

    assertThrows(
        IllegalStateException.class,
        () ->
            new MemorySourceLifecycle(memories)
                .restoreExtractedMemories(restored.getId(), restored.getType()));

    verify(memories, never()).restoreEntity(any(), any(UUID.class));
  }

  /**
   * The source's lookup can read a memory another source's restore has just brought back as still
   * archived. The memory as last committed is live, so it shows the restored file again.
   */
  @Test
  void restoreDecidesOnTheMemoryAsLastCommitted() {
    EntityReference restored = contextFile("Restored");
    ContextMemory restoredMeanwhile = memory(MemoryVisibility.ENTITY);
    sourceMentions(restored, restoredMeanwhile);
    anchoredOn(restoredMeanwhile.getId(), restored);
    committed(restoredMeanwhile);
    ContextMemoryRepository memories = restoresRecorded(spy(repository));
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(
          entities, restored, restoredMeanwhile.getEntityReference().withDeleted(true));

      new MemorySourceLifecycle(memories)
          .restoreExtractedMemories(restored.getId(), restored.getType());
    }

    verify(memories, never()).restoreEntity(any(), any(UUID.class));
    verify(extensionDAO, never()).getExtensionForUpdate(any(), any());
    verifyRefreshed(dispatcher, restoredMeanwhile.getId());
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
    committed(archivedWithIt, deletedByAPerson);
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
    Map<UUID, ContextMemory> stored = storedAs(staleAnchor);
    committed(JsonUtils.deepCopy(staleAnchor, ContextMemory.class).withDeleted(true));
    marked(staleAnchor);
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

  /**
   * A copy takes its document's link off the original, so restricting the original, opening it and
   * restricting it again leaves that document one copy of the memory, not one per restriction.
   */
  @Test
  void togglingSharingRepeatedlyNeverGrowsCopies() {
    EntityReference original = contextFile("Original");
    EntityReference privateCopy = contextFile("Private copy");
    ContextMemory memory = anchoredMemory(original);
    Edges edges = new Edges();
    edges.anchor(original, memory.getId());
    edges.mention(original, memory.getId());
    edges.mention(privateCopy, memory.getId());
    List<ContextMemory> created = new ArrayList<>();
    ContextMemoryRepository memories =
        createsKept(writesKept(spy(repository), storedAs(memory)), created, edges);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle
          .when(EntityLifecycleEventDispatcher::getInstance)
          .thenReturn(mock(EntityLifecycleEventDispatcher.class));
      resolveReferences(entities, original, privateCopy, memory.getEntityReference());
      storedFile(entities, privateCopy, MemoryVisibility.PRIVATE, user("copy-owner"));
      MemorySourceSharing sharing = new MemorySourceSharing(memories);
      sharing.followSourceRestriction(sharing(original, MemoryVisibility.PRIVATE));
      sharing.followSourceOpening(sharing(original, MemoryVisibility.ENTITY));
      sharing.followSourceRestriction(sharing(original, MemoryVisibility.PRIVATE));
    }

    assertEquals(1, created.size(), "one copy per memory per restricted document");
    assertEquals(Set.of(created.getFirst().getId()), edges.mentionedBy(privateCopy));
    assertEquals(Set.of(memory.getId()), edges.mentionedBy(original));
  }

  /**
   * An opened file rejoins the related entities of a memory anchored on an org-wide copy, which keeps
   * the anchor. The store still holds the file as private: the write opening it decides by the file.
   */
  @Test
  void openingAFileShowsItAsASourceWithoutMovingTheAnchor() {
    EntityReference opened = contextFile("Opened");
    EntityReference orgWideCopy = contextFile("Org-wide copy");
    ContextMemory memory = anchoredMemory(orgWideCopy).withRelatedEntities(List.of());
    anchoredOn(memory.getId(), orgWideCopy, opened);
    sourceMentions(opened, memory);
    Map<UUID, ContextMemory> stored = storedAs(memory);
    ContextMemoryRepository memories = writesKept(spy(repository), stored);
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(entities, opened, orgWideCopy, memory.getEntityReference());
      storedFile(entities, opened, MemoryVisibility.PRIVATE);
      storedFile(entities, orgWideCopy, MemoryVisibility.ENTITY);

      new MemorySourceSharing(memories)
          .followSourceOpening(sharing(opened, MemoryVisibility.ENTITY));
    }

    assertSourceLinks(stored.get(memory.getId()), orgWideCopy, opened);
    verifyRefreshed(dispatcher, memory.getId());
  }

  /**
   * A memory the file only relates to stops naming it and keeps its anchor. The store still holds
   * the file as org-wide: the write restricting it decides by the file.
   */
  @Test
  void restrictingAFileDropsItFromAMemoryItOnlyRelatesTo() {
    EntityReference restricted = contextFile("Restricted");
    EntityReference anchor = contextFile("Anchor");
    ContextMemory memory = anchoredMemory(anchor).withRelatedEntities(List.of(restricted));
    linkSources(memory.getId(), anchor, restricted);
    sourceMentions(restricted, memory);
    Map<UUID, ContextMemory> stored = storedAs(memory);
    ContextMemoryRepository memories = writesKept(spy(repository), stored);
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(entities, restricted, anchor, memory.getEntityReference());
      storedFile(entities, restricted, MemoryVisibility.ENTITY);
      storedFile(entities, anchor, MemoryVisibility.ENTITY);

      new MemorySourceSharing(memories)
          .followSourceRestriction(sharing(restricted, MemoryVisibility.PRIVATE));
    }

    assertSourceLinks(stored.get(memory.getId()), anchor);
    verifyRefreshed(dispatcher, memory.getId());
    verify(relationshipDAO, never())
        .delete(
            eq(restricted.getId()),
            anyString(),
            eq(memory.getId()),
            anyString(),
            eq(Relationship.MENTIONED_IN.ordinal()));
  }

  /**
   * A memory anchored on the file moves to its org-wide copy, ranked as archive ranks; the file
   * becomes neither the anchor nor a related source, and keeps its link for its own readers.
   */
  @Test
  void restrictingTheAnchorMovesItToASourceEveryoneMayRead() {
    EntityReference restricted = contextFile("A restricted");
    EntityReference orgWide = contextFile("B org-wide");
    ContextMemory memory = anchoredMemory(restricted).withRelatedEntities(List.of(orgWide));
    linkSources(memory.getId(), restricted, orgWide);
    sourceMentions(restricted, memory);
    Map<UUID, ContextMemory> stored = storedAs(memory);
    ContextMemoryRepository memories = writesKept(spy(repository), stored);
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(entities, restricted, orgWide, memory.getEntityReference());
      storedFile(entities, restricted, MemoryVisibility.ENTITY);
      storedFile(entities, orgWide, MemoryVisibility.ENTITY);

      new MemorySourceSharing(memories)
          .followSourceRestriction(sharing(restricted, MemoryVisibility.PRIVATE));
    }

    assertSourceLinks(stored.get(memory.getId()), orgWide);
    verify(memories, never()).create(any(), any(ContextMemory.class));
    verify(relationshipDAO, never())
        .delete(
            eq(restricted.getId()),
            anyString(),
            eq(memory.getId()),
            anyString(),
            eq(Relationship.MENTIONED_IN.ordinal()));
    verifyRefreshed(dispatcher, memory.getId());
  }

  /**
   * A sharing move writes on condition that the memory is as it read it, so a decision written
   * meanwhile fails the share change, which can be retried, instead of being overwritten.
   */
  @Test
  void aSharingMoveFailsRatherThanOverwriteAWriteMadeMeanwhile() {
    EntityReference restricted = contextFile("A restricted");
    EntityReference orgWide = contextFile("B org-wide");
    ContextMemory memory = anchoredMemory(restricted);
    linkSources(memory.getId(), restricted, orgWide);
    sourceMentions(restricted, memory);
    ContextMemoryRepository memories = loads(memory, Include.NON_DELETED);
    doThrow(new PreconditionFailedException("The memory has been modified."))
        .when(memories)
        .updateIfCurrent(isNull(), any(), any(), eq(Entity.ADMIN_USER_NAME));

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle
          .when(EntityLifecycleEventDispatcher::getInstance)
          .thenReturn(mock(EntityLifecycleEventDispatcher.class));
      resolveReferences(entities, restricted, orgWide, memory.getEntityReference());
      storedFile(entities, orgWide, MemoryVisibility.ENTITY);
      MemorySourceSharing sharing = new MemorySourceSharing(memories);

      assertThrows(
          PreconditionFailedException.class,
          () -> sharing.followSourceRestriction(sharing(restricted, MemoryVisibility.PRIVATE)));
    }

    verify(memories, never()).update(any(), any(), any(), any());
  }

  /**
   * Restricting the file to the people its private copy is owned by makes no copy: they may still
   * read the anchor. The store still holds the file as org-wide, shared with nobody.
   */
  @Test
  void aSourceWhoseReadersTheRestrictedFileSharesWithGetsNoCopy() {
    EntityReference restricted = contextFile("A restricted");
    EntityReference privateCopy = contextFile("B private copy");
    EntityReference reader = user("reader");
    ContextMemory memory = anchoredMemory(restricted);
    Edges edges = new Edges();
    edges.anchor(restricted, memory.getId());
    edges.mention(restricted, memory.getId());
    edges.mention(privateCopy, memory.getId());
    List<ContextMemory> created = new ArrayList<>();
    ContextMemoryRepository memories =
        createsKept(writesKept(spy(repository), storedAs(memory)), created, edges);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle
          .when(EntityLifecycleEventDispatcher::getInstance)
          .thenReturn(mock(EntityLifecycleEventDispatcher.class));
      resolveReferences(entities, restricted, privateCopy, memory.getEntityReference());
      storedFile(entities, restricted, MemoryVisibility.ENTITY);
      storedFile(entities, privateCopy, MemoryVisibility.PRIVATE, reader);

      new MemorySourceSharing(memories).followSourceRestriction(sharedWith(restricted, reader));
    }

    assertTrue(created.isEmpty(), "the copy's readers may read the anchor");
    assertEquals(Set.of(memory.getId()), edges.mentionedBy(privateCopy));
  }

  /**
   * Archiving the org-wide anchor leaves only restricted sources. The anchor moves to one of them,
   * and each other source gets a copy unless the new anchor's readers include all of its readers.
   */
  @Test
  void archivingLeavesACopyForEachRestrictedSourceWhoseReadersDiffer() {
    EntityReference archived = contextFile("A archived").withDeleted(true);
    EntityReference newAnchor = contextFile("B restricted");
    EntityReference otherReaders = contextFile("C restricted");
    EntityReference sameReaders = contextFile("D restricted");
    EntityReference owner = user("owner");
    ContextMemory memory = anchoredMemory(archived);
    Edges edges = new Edges();
    edges.anchor(archived, memory.getId());
    Stream.of(archived, newAnchor, otherReaders, sameReaders)
        .forEach(source -> edges.mention(source, memory.getId()));
    Map<UUID, ContextMemory> stored = storedAs(memory);
    List<ContextMemory> created = new ArrayList<>();
    ContextMemoryRepository memories =
        createsKept(writesKept(spy(repository), stored), created, edges);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle
          .when(EntityLifecycleEventDispatcher::getInstance)
          .thenReturn(mock(EntityLifecycleEventDispatcher.class));
      resolveReferences(
          entities, archived, newAnchor, otherReaders, sameReaders, memory.getEntityReference());
      storedFile(entities, newAnchor, MemoryVisibility.PRIVATE, owner);
      storedFile(entities, otherReaders, MemoryVisibility.PRIVATE, user("stranger"));
      storedFile(entities, sameReaders, MemoryVisibility.PRIVATE, owner);

      new MemorySourceLifecycle(memories)
          .archiveExtractedMemories(archived.getId(), archived.getType());
    }

    assertEquals(newAnchor.getId(), stored.get(memory.getId()).getPrimaryEntity().getId());
    assertEquals(1, created.size());
    assertEquals(otherReaders.getId(), created.getFirst().getPrimaryEntity().getId());
    assertEquals(Set.of(created.getFirst().getId()), edges.mentionedBy(otherReaders));
    assertEquals(Set.of(memory.getId()), edges.mentionedBy(sameReaders));
  }

  /** A live article is a source everyone may read, so it takes the anchor before a restricted file. */
  @Test
  void chooseAnchorCountsALiveArticleAsReadableByEveryone() {
    EntityReference leaving = contextFile("Leaving").withDeleted(true);
    EntityReference restrictedFile = contextFile("A restricted file");
    EntityReference article =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.PAGE).withName("B article");
    UUID memoryId = UUID.randomUUID();
    anchoredOn(memoryId, leaving, restrictedFile, article);

    EntityReference chosen;
    try (MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      resolveReferences(entities, leaving, restrictedFile, article);
      storedFile(entities, restrictedFile, MemoryVisibility.PRIVATE);
      entities
          .when(
              () ->
                  Entity.getEntityOrNull(
                      argThat(
                          (EntityReference ref) ->
                              ref != null && article.getId().equals(ref.getId())),
                      eq(""),
                      eq(Include.NON_DELETED)))
          .thenReturn(new Page().withId(article.getId()));

      chosen = new MemorySourceLifecycle(repository).chooseAnchor(memoryId, leaving);
    }

    assertEquals(article.getId(), chosen.getId());
  }

  /**
   * A copy says what the memory says, in its stage, anchored on and linked to its document alone,
   * which stops linking the original. Disputes and usage stay behind, and it is created as a
   * relinking write, so it derives nothing of its own.
   */
  @Test
  void copyForSourceRestatesTheMemoryForItsDocumentAlone() {
    EntityReference source = contextFile("Private copy");
    ContextMemory memory =
        anchoredMemory(contextFile("Original"))
            .withTitle("Refunds")
            .withQuestion("How long is the refund window?")
            .withAnswer("30 days")
            .withMemoryType(ContextMemoryType.NOTE)
            .withMemoryScope(ContextMemoryScope.ENTITY_SCOPED)
            .withSourceType(ContextMemorySourceType.FILE_EXTRACTION)
            .withEntityStatus(ContextMemoryStatus.DRAFT)
            .withStatusReason("contradicts: the window differs")
            .withDisputes(List.of(new MemoryDispute().withReason("30 against 45 days")))
            .withUsageCount(4)
            .withOwners(List.of(user("admin")));
    List<ContextMemory> created = new ArrayList<>();
    ContextMemoryRepository memories = createsKept(spy(repository), created, new Edges());
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    ContextMemory copy;
    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
        mockStatic(EntityLifecycleEventDispatcher.class)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      copy = new MemorySourceLifecycle(memories).copyForSource(memory, source);
    }

    assertEquals(List.of(copy), created);
    assertNotEquals(memory.getId(), copy.getId());
    assertTrue(copy.getName().startsWith("Private copy-"));
    assertEquals(
        List.of(
            memory.getTitle(), memory.getQuestion(), memory.getAnswer(), memory.getStatusReason()),
        List.of(copy.getTitle(), copy.getQuestion(), copy.getAnswer(), copy.getStatusReason()));
    assertEquals(
        List.of(memory.getMemoryType(), memory.getMemoryScope(), memory.getSourceType()),
        List.of(copy.getMemoryType(), copy.getMemoryScope(), copy.getSourceType()));
    assertEquals(ContextMemoryStatus.DRAFT, copy.getEntityStatus());
    assertEquals(memory.getOwners(), copy.getOwners());
    assertEquals(List.of(source, source), List.of(copy.getPrimaryEntity(), copy.getSourceEntity()));
    assertNull(copy.getDisputes());
    assertEquals(0, copy.getUsageCount(), "its own usage, from none");
    assertNull(copy.getRelatedEntities());
    verifyLinkDeleted(inOrder(relationshipDAO), source, memory.getId(), Relationship.MENTIONED_IN);
    verifyRefreshed(dispatcher, memory.getId());
  }

  /**
   * What a relinking write records of the memory as it was names the documents everyone may read and
   * an asset anchor; any other document, the file it restricts included, appears by id and type.
   */
  @Test
  void aRelinkingWriteRecordsADocumentOnlySomeMayReadByIdAlone() {
    EntityReference restricted = contextFile("Restricted");
    EntityReference orgWide = contextFile("Org-wide");
    EntityReference table =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE).withName("orders");
    ContextMemory original =
        memory(MemoryVisibility.ENTITY)
            .withPrimaryEntity(restricted)
            .withSourceEntity(restricted)
            .withSourceFile(restricted)
            .withRelatedEntities(List.of(orgWide, table));
    ContextMemory elsewhere = JsonUtils.deepCopy(original, ContextMemory.class);

    MemoryRelinking.run(
        original.getId(),
        document -> orgWide.getId().equals(document.getId()),
        () -> MemoryRelinking.withholdRestrictedNames(original));
    MemoryRelinking.withholdRestrictedNames(elsewhere);

    Stream.of(original.getPrimaryEntity(), original.getSourceEntity(), original.getSourceFile())
        .forEach(
            recorded ->
                assertEquals(
                    new EntityReference().withId(restricted.getId()).withType(Entity.CONTEXT_FILE),
                    recorded));
    assertEquals(List.of(orgWide, table), original.getRelatedEntities());
    assertEquals(restricted, elsewhere.getPrimaryEntity(), "only the relinking write is affected");
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
    when(extensionDAO.getExtensionForUpdate(memory.getId(), ArchivedWithSources.EXTENSION))
        .thenReturn("{}");
  }

  /** The memories as last committed, which the restore reads with their rows locked. */
  private void committed(ContextMemory... memories) {
    Stream.of(memories)
        .forEach(
            memory ->
                when(memoryDAO.findJsonByIdForUpdate(memory.getId(), Include.ALL))
                    .thenReturn(JsonUtils.pojoToJson(memory)));
  }

  /** The live memories as stored and committed, keyed by id. */
  private Map<UUID, ContextMemory> storedAs(ContextMemory... memories) {
    Map<UUID, ContextMemory> stored = new HashMap<>();
    Stream.of(memories).forEach(memory -> stored.put(memory.getId(), memory));
    committed(memories);
    return stored;
  }

  /** A live read returns the memory as the last conditional write stored it, as the database would. */
  private static ContextMemoryRepository writesKept(
      ContextMemoryRepository memories, Map<UUID, ContextMemory> stored) {
    doAnswer(call -> stored.get(call.<UUID>getArgument(1)))
        .when(memories)
        .get(isNull(), any(UUID.class), any(), eq(Include.NON_DELETED), eq(false));
    doAnswer(call -> keep(stored, call.getArgument(2)))
        .when(memories)
        .updateIfCurrent(isNull(), any(), any(), eq(Entity.ADMIN_USER_NAME));
    return memories;
  }

  private static PutResponse<ContextMemory> keep(
      Map<UUID, ContextMemory> stored, ContextMemory updated) {
    stored.put(updated.getId(), updated);
    return new PutResponse<>(Response.Status.OK, updated, EventType.ENTITY_UPDATED);
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
        .updateIfCurrent(isNull(), any(), any(), eq(Entity.ADMIN_USER_NAME));
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

  /** A create keeps the copy and writes the anchor and source edges a real create would. */
  private static ContextMemoryRepository createsKept(
      ContextMemoryRepository memories, List<ContextMemory> created, Edges edges) {
    doAnswer(
            call -> {
              ContextMemory copy = call.getArgument(1);
              assertTrue(MemoryRelinking.isRelinking(copy.getId()), "created as a relinking write");
              created.add(copy);
              edges.anchor(copy.getPrimaryEntity(), copy.getId());
              edges.mention(copy.getSourceEntity(), copy.getId());
              return copy;
            })
        .when(memories)
        .create(isNull(), any(ContextMemory.class));
    return memories;
  }

  /** The file as stored, shared as {@code visibility} and owned by {@code owners}. */
  private static void storedFile(
      MockedStatic<Entity> entities,
      EntityReference file,
      MemoryVisibility visibility,
      EntityReference... owners) {
    ContextFile stored = sharing(file, visibility, owners);
    entities
        .when(
            () ->
                Entity.getEntity(
                    argThat(
                        (EntityReference ref) -> ref != null && file.getId().equals(ref.getId())),
                    anyString(),
                    eq(Include.NON_DELETED)))
        .thenReturn(stored);
  }

  /** The file shared as {@code visibility}, as the write changing its sharing leaves it. */
  private static ContextFile sharing(
      EntityReference file, MemoryVisibility visibility, EntityReference... owners) {
    return new ContextFile()
        .withId(file.getId())
        .withName(file.getName())
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility))
        .withOwners(List.of(owners));
  }

  /** The file shared with exactly {@code readers}. */
  private static ContextFile sharedWith(EntityReference file, EntityReference... readers) {
    ContextFile shared = sharing(file, MemoryVisibility.SHARED);
    shared
        .getShareConfig()
        .setSharedWith(
            Stream.of(readers)
                .map(reader -> new MemorySharedPrincipal().withPrincipal(reader))
                .toList());
    return shared;
  }

  private static EntityReference user(String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName(name);
  }

  /** The relationship rows the writes under test read and change, as the database keeps them. */
  private final class Edges {
    private final Set<Edge> rows = new LinkedHashSet<>();

    private record Edge(UUID fromId, String fromType, UUID toId, int relation) {}

    Edges() {
      when(relationshipDAO.findFrom(any(UUID.class), eq(Entity.CONTEXT_MEMORY), anyInt()))
          .thenAnswer(call -> into(call.getArgument(0), call.getArgument(2), null));
      when(relationshipDAO.findFrom(
              any(UUID.class), eq(Entity.CONTEXT_MEMORY), anyInt(), anyString()))
          .thenAnswer(call -> into(call.getArgument(0), call.getArgument(2), call.getArgument(3)));
      when(relationshipDAO.findTo(
              any(UUID.class), anyString(), anyInt(), eq(Entity.CONTEXT_MEMORY)))
          .thenAnswer(call -> outOf(call.getArgument(0), call.getArgument(2)));
      doAnswer(
              call ->
                  rows.add(
                      new Edge(
                          call.getArgument(0),
                          call.getArgument(2),
                          call.getArgument(1),
                          call.getArgument(4))))
          .when(relationshipDAO)
          .insert(
              any(UUID.class),
              any(UUID.class),
              anyString(),
              anyString(),
              anyInt(),
              anyString(),
              any());
      doAnswer(
              call ->
                  rows.remove(
                          new Edge(
                              call.getArgument(0),
                              call.getArgument(1),
                              call.getArgument(2),
                              call.getArgument(4)))
                      ? 1
                      : 0)
          .when(relationshipDAO)
          .delete(any(UUID.class), anyString(), any(UUID.class), anyString(), anyInt());
    }

    void anchor(EntityReference source, UUID memoryId) {
      rows.add(edge(source, memoryId, Relationship.APPLIED_TO));
    }

    void mention(EntityReference source, UUID memoryId) {
      rows.add(edge(source, memoryId, Relationship.MENTIONED_IN));
    }

    /** The memories {@code source} is linked to as a source. */
    Set<UUID> mentionedBy(EntityReference source) {
      return rows.stream()
          .filter(row -> row.fromId().equals(source.getId()))
          .filter(row -> row.relation() == Relationship.MENTIONED_IN.ordinal())
          .map(Edge::toId)
          .collect(Collectors.toSet());
    }

    private static Edge edge(EntityReference source, UUID memoryId, Relationship relation) {
      return new Edge(source.getId(), source.getType(), memoryId, relation.ordinal());
    }

    private List<CollectionDAO.EntityRelationshipRecord> into(
        UUID memoryId, int relation, String fromType) {
      return rows.stream()
          .filter(row -> row.toId().equals(memoryId) && row.relation() == relation)
          .filter(row -> fromType == null || fromType.equals(row.fromType()))
          .map(row -> record(row.fromId(), row.fromType()))
          .toList();
    }

    private List<CollectionDAO.EntityRelationshipRecord> outOf(UUID sourceId, int relation) {
      return rows.stream()
          .filter(row -> row.fromId().equals(sourceId) && row.relation() == relation)
          .map(row -> record(row.toId(), Entity.CONTEXT_MEMORY))
          .toList();
    }

    private static CollectionDAO.EntityRelationshipRecord record(UUID id, String type) {
      return CollectionDAO.EntityRelationshipRecord.builder().id(id).type(type).build();
    }
  }
}
