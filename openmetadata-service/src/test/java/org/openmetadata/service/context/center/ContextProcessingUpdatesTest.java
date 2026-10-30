package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.util.RequestEntityCache;

class ContextProcessingUpdatesTest {
  private final UUID id = UUID.randomUUID();
  private final ExtractionStats stats = new ExtractionStats().withChunksProcessed(1);

  @AfterEach
  void clearCache() {
    RequestEntityCache.clear();
  }

  @Test
  void fileStatsUseTheCurrentMetadataInsteadOfTheExtractionSnapshot() {
    ContextFile snapshot = new ContextFile().withId(id).withName("file").withUpdatedAt(100L);
    ContextFile edited =
        JsonUtils.deepCopy(snapshot, ContextFile.class)
            .withUpdatedAt(101L)
            .withDescription("Current description")
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));
    AtomicReference<ContextFile> stored = new AtomicReference<>(edited);
    RequestEntityCache.putById(
        Entity.CONTEXT_FILE, id, null, null, false, snapshot, ContextFile.class);
    ContextFileRepository repository = fileRepository(stored);

    new FileContextProcessingEngine(repository, null, null).stampStats(id, stats);

    assertEquals(edited.getShareConfig(), stored.get().getShareConfig());
    assertEquals(edited.getDescription(), stored.get().getDescription());
    assertEquals(stats, stored.get().getExtractionStats());
  }

  @Test
  void fileStatsRejectAnEditBetweenTheReadAndWrite() {
    AtomicReference<ContextFile> stored =
        new AtomicReference<>(new ContextFile().withId(id).withName("file").withUpdatedAt(100L));
    ContextFileRepository repository = fileRepository(stored);
    when(repository.get(isNull(), eq(id), any(), eq(Include.NON_DELETED), eq(false)))
        .thenAnswer(
            ignored -> {
              ContextFile snapshot = JsonUtils.deepCopy(stored.get(), ContextFile.class);
              stored.set(
                  JsonUtils.deepCopy(snapshot, ContextFile.class)
                      .withUpdatedAt(101L)
                      .withDescription("Concurrent edit"));
              return snapshot;
            });

    assertThrows(
        PreconditionFailedException.class,
        () -> new FileContextProcessingEngine(repository, null, null).stampStats(id, stats));

    assertEquals("Concurrent edit", stored.get().getDescription());
  }

  @Test
  void pageStatsUseTheCurrentBodyInsteadOfTheExtractionSnapshot() {
    Page snapshot =
        new Page().withId(id).withName("page").withUpdatedAt(100L).withDescription("Old body");
    Page edited =
        JsonUtils.deepCopy(snapshot, Page.class)
            .withUpdatedAt(101L)
            .withDescription("Current body");
    AtomicReference<Page> stored = new AtomicReference<>(edited);
    RequestEntityCache.putById(Entity.PAGE, id, null, null, false, snapshot, Page.class);
    KnowledgePageRepository repository = pageRepository(stored);

    new PageContextProcessingEngine(repository, null, null, null).stampStats(id, stats);

    assertEquals("Current body", stored.get().getDescription());
    assertEquals(stats, stored.get().getExtractionStats());
  }

  @Test
  void pageStatsRejectAnEditBetweenTheReadAndWrite() {
    AtomicReference<Page> stored =
        new AtomicReference<>(new Page().withId(id).withName("page").withUpdatedAt(100L));
    KnowledgePageRepository repository = pageRepository(stored);
    when(repository.get(isNull(), eq(id), any(), eq(Include.NON_DELETED), eq(false)))
        .thenAnswer(
            ignored -> {
              Page snapshot = JsonUtils.deepCopy(stored.get(), Page.class);
              stored.set(
                  JsonUtils.deepCopy(snapshot, Page.class)
                      .withUpdatedAt(101L)
                      .withDescription("Concurrent edit"));
              return snapshot;
            });

    assertThrows(
        PreconditionFailedException.class,
        () -> new PageContextProcessingEngine(repository, null, null, null).stampStats(id, stats));

    assertEquals("Concurrent edit", stored.get().getDescription());
  }

  private ContextFileRepository fileRepository(AtomicReference<ContextFile> stored) {
    ContextFileRepository repository = mock(ContextFileRepository.class);
    when(repository.get(isNull(), eq(id), any(), eq(Include.NON_DELETED), eq(false)))
        .thenAnswer(
            ignored -> {
              ContextFile cached =
                  RequestEntityCache.getById(
                      Entity.CONTEXT_FILE, id, null, null, false, ContextFile.class);
              return cached == null ? JsonUtils.deepCopy(stored.get(), ContextFile.class) : cached;
            });
    lenient()
        .when(repository.update(isNull(), any(), any(), anyString()))
        .thenAnswer(
            invocation -> {
              stored.set(invocation.getArgument(2));
              return null;
            });
    lenient()
        .when(repository.updateIfCurrent(isNull(), any(), any(), anyString()))
        .thenAnswer(
            invocation -> {
              ContextFile original = invocation.getArgument(1);
              if (!original.getUpdatedAt().equals(stored.get().getUpdatedAt())) {
                throw new PreconditionFailedException("Concurrent edit");
              }
              stored.set(invocation.getArgument(2));
              return null;
            });
    return repository;
  }

  private KnowledgePageRepository pageRepository(AtomicReference<Page> stored) {
    KnowledgePageRepository repository = mock(KnowledgePageRepository.class);
    when(repository.get(isNull(), eq(id), any(), eq(Include.NON_DELETED), eq(false)))
        .thenAnswer(
            ignored -> {
              Page cached =
                  RequestEntityCache.getById(Entity.PAGE, id, null, null, false, Page.class);
              return cached == null ? JsonUtils.deepCopy(stored.get(), Page.class) : cached;
            });
    lenient()
        .when(repository.update(isNull(), any(), any(), anyString()))
        .thenAnswer(
            invocation -> {
              stored.set(invocation.getArgument(2));
              return null;
            });
    lenient()
        .when(repository.updateIfCurrent(isNull(), any(), any(), anyString()))
        .thenAnswer(
            invocation -> {
              Page original = invocation.getArgument(1);
              if (!original.getUpdatedAt().equals(stored.get().getUpdatedAt())) {
                throw new PreconditionFailedException("Concurrent edit");
              }
              stored.set(invocation.getArgument(2));
              return null;
            });
    return repository;
  }
}
