package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.EntityTagWriter.Target;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.util.PostCommitActionQueue;
import org.openmetadata.service.util.RequestEntityCache;
import org.openmetadata.service.util.RequestEntityCache.Projection;

class EntityTagAssetRemovalTest {
  @Test
  void previewRecordsSuccessWithoutChangingRowsOrCaches() {
    final Fixture fixture = new Fixture();
    fixture.service.remove(
        "glossary.term", "service.table", fixture.target, true, () -> fixture.successes++);
    assertEquals(1, fixture.successes);
    assertTrue(fixture.deleted.isEmpty());
    assertTrue(fixture.indexed.isEmpty());
    assertTrue(fixture.sharedTagPresent);
    assertNotNull(
        RequestEntityCache.getById(
            Entity.TABLE, fixture.target.id(), fixture.projection, Table.class));
  }

  @Test
  void searchFailureRetainsTheAlreadyRecordedSuccessfulDeletion() {
    final Fixture fixture = new Fixture();
    fixture.failSearch = true;
    assertThrows(
        IllegalStateException.class,
        () -> fixture.remove("glossary.term", "service.table", fixture.target));
    assertEquals(1, fixture.successes);
    assertEquals(1, fixture.deleted.size());
    assertFalse(fixture.sharedTagPresent);
  }

  @AfterEach
  void clearScopes() {
    PostCommitActionQueue.clear();
    RequestEntityCache.clear();
  }

  @Test
  void aCommittedDeletionRefreshesSearchAfterInvalidatingBothRequestAliases() {
    final Fixture fixture = new Fixture();
    fixture.remove("glossary.term", "service.table", fixture.target);
    assertEquals(List.of(new Deletion("glossary.term", "service.table")), fixture.deleted);
    fixture.assertRequestMissing();
    assertEquals(List.of(fixture.target), fixture.indexed);
    assertFalse(fixture.sharedTagPresent);
  }

  @Test
  void columnDeletionRefreshesItsParentAfterTheOwningCommit() {
    final Fixture fixture = new Fixture();
    PostCommitActionQueue.begin();
    fixture.remove("PII.Sensitive", "service.table.column", fixture.target);
    fixture.assertRequestMissing();
    assertTrue(fixture.sharedTagPresent);
    assertTrue(fixture.indexed.isEmpty());
    assertEquals(List.of(new Deletion("PII.Sensitive", "service.table.column")), fixture.deleted);
    PostCommitActionQueue.run(PostCommitActionQueue.drain());
    assertFalse(fixture.sharedTagPresent);
    assertEquals(List.of(fixture.target), fixture.indexed);
  }

  @Test
  void rollbackDiscardsPublication() {
    final Fixture fixture = new Fixture();
    PostCommitActionQueue.begin();
    fixture.remove("glossary.term", "service.table", fixture.target);
    PostCommitActionQueue.clear();
    PostCommitActionQueue.run(PostCommitActionQueue.drain());
    assertTrue(fixture.sharedTagPresent);
    assertTrue(fixture.indexed.isEmpty());
  }

  @Test
  void failedDeletesLeaveCachedStateAndPublicationUntouched() {
    final Fixture fixture = new Fixture();
    fixture.failDelete = true;
    PostCommitActionQueue.begin();
    assertThrows(
        IllegalStateException.class,
        () -> fixture.remove("glossary.term", "service.table", fixture.target));
    assertTrue(PostCommitActionQueue.drain().isEmpty());
    assertNotNull(
        RequestEntityCache.getById(
            Entity.TABLE, fixture.target.id(), fixture.projection, Table.class));
    assertTrue(fixture.sharedTagPresent);
    assertTrue(fixture.indexed.isEmpty());
  }

  @Test
  void retryCheckpointsDoNotRepeatRolledBackPublications() {
    final Fixture fixture = new Fixture();
    PostCommitActionQueue.begin();
    final int checkpoint = PostCommitActionQueue.checkpoint();
    fixture.remove("glossary.term", "service.table", fixture.target);
    PostCommitActionQueue.rollbackToCheckpoint(checkpoint);
    fixture.successes = 0;
    fixture.remove("glossary.term", "service.table", fixture.target);
    PostCommitActionQueue.run(PostCommitActionQueue.drain());
    assertEquals(List.of(fixture.target), fixture.indexed);
  }

  private record Deletion(String tag, String target) {}

  private static final class Fixture {
    private final Target target = new Target("service.table", Entity.TABLE, UUID.randomUUID());
    private final Projection projection = new Projection("tags", "NON_DELETED", true);
    private final List<Deletion> deleted = new ArrayList<>();
    private final List<Target> indexed = new ArrayList<>();
    private boolean sharedTagPresent = true;
    private boolean failDelete;
    private boolean failSearch;
    private final EntityTagAssetRemoval service;
    private int successes;

    private Fixture() {
      final TagUsageDAO tags = mock(TagUsageDAO.class);
      doAnswer(
              invocation -> {
                if (failDelete) {
                  throw new IllegalStateException("Injected delete failure");
                }
                deleted.add(new Deletion(invocation.getArgument(0), invocation.getArgument(1)));
                return null;
              })
          .when(tags)
          .deleteTagsByTagAndTargetEntity(anyString(), anyString());
      service =
          new EntityTagAssetRemoval(
              () -> tags,
              ignored -> sharedTagPresent = false,
              entity -> {
                assertRequestMissing();
                assertFalse(sharedTagPresent, "Search must reload after cache invalidation");
                assertEquals(1, successes);
                if (failSearch) {
                  throw new IllegalStateException("Injected search failure");
                }
                indexed.add(entity);
              });
      RequestEntityCache.putByIdAndName(
          Entity.TABLE,
          target.id(),
          target.fqn(),
          projection,
          new Table().withId(target.id()).withFullyQualifiedName(target.fqn()));
    }

    private void remove(final String tag, final String fqn, final Target entity) {
      service.remove(tag, fqn, entity, false, () -> successes++);
    }

    private void assertRequestMissing() {

      assertNull(RequestEntityCache.getById(Entity.TABLE, target.id(), projection, Table.class));
      assertNull(RequestEntityCache.getByName(Entity.TABLE, target.fqn(), projection, Table.class));
    }
  }
}
