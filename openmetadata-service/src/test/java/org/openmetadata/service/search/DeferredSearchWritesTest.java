package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.SneakyThrows;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.LineageUtil;

class DeferredSearchWritesTest {
  private static final String ENTITY_ID = UUID.randomUUID().toString();

  @Test
  void aFailedCommittedWriteDoesNotStopTheWritesQueuedAfterIt() throws Exception {
    final AtomicInteger delivered = new AtomicInteger();
    try (LiveSearchWrites liveWrites = new LiveSearchWrites(mock(SearchRepository.class));
        MockedStatic<Entity> entity = searchRepositoryWith(liveWrites)) {
      DeferredSearchWrites.run(
          List.of(
              new SearchRepository.DeferredSearchWrite(
                  DeferredSearchWritesTest::failTransport, "cascade", ENTITY_ID, null, null),
              new SearchRepository.DeferredSearchWrite(
                  delivered::incrementAndGet, "healthy", ENTITY_ID, null, null)));

      assertTrue(liveWrites.awaitQueuedWrites(Duration.ofSeconds(10)));
    }
    assertEquals(1, delivered.get());
  }

  @Test
  void aFailedLineageWriteDoesNotStopTheWritesQueuedAfterIt() throws Exception {
    final AtomicInteger delivered = new AtomicInteger();
    final EntityReference table =
        new EntityReference().withId(UUID.fromString(ENTITY_ID)).withType(Entity.TABLE);
    try (LiveSearchWrites liveWrites = new LiveSearchWrites(mock(SearchRepository.class));
        MockedStatic<Entity> entity = searchRepositoryWith(liveWrites)) {
      DeferredSearchWrites.runLineage(
          List.of(
              new LineageUtil.DeferredLineageEsWrite(
                  DeferredSearchWritesTest::failTransport, table),
              new LineageUtil.DeferredLineageEsWrite(delivered::incrementAndGet, table)));

      assertTrue(liveWrites.awaitQueuedWrites(Duration.ofSeconds(10)));
    }
    assertEquals(1, delivered.get());
  }

  @Test
  void workToRunOnCommitRunsBeforeTheWritesCapturedAfterItAreQueued() throws Exception {
    final List<String> applied = Collections.synchronizedList(new ArrayList<>());
    try (LiveSearchWrites liveWrites = new LiveSearchWrites(mock(SearchRepository.class));
        MockedStatic<Entity> entity = searchRepositoryWith(liveWrites)) {
      DeferredSearchWrites.run(
          List.of(
              new SearchRepository.DeferredSearchWrite(
                  () -> applied.add("find documents by the old name"),
                  "invalidate",
                  null,
                  "old",
                  null,
                  true),
              new SearchRepository.DeferredSearchWrite(
                  () -> applied.add("rename documents"), "rename", ENTITY_ID, null, null)));

      assertEquals("find documents by the old name", applied.getFirst());
      assertTrue(liveWrites.awaitQueuedWrites(Duration.ofSeconds(10)));
    }
    assertEquals(List.of("find documents by the old name", "rename documents"), applied);
  }

  private static MockedStatic<Entity> searchRepositoryWith(final LiveSearchWrites liveWrites) {
    final SearchRepository repository = mock(SearchRepository.class);
    when(repository.getLiveWrites()).thenReturn(liveWrites);
    final MockedStatic<Entity> entity = mockStatic(Entity.class);
    entity.when(Entity::getSearchRepository).thenReturn(repository);
    return entity;
  }

  // Both search engine lineage clients propagate IOException through @SneakyThrows.
  @SneakyThrows(IOException.class)
  private static void failTransport() {
    throw new IOException("search transport unavailable");
  }
}
