package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Runs the stale text-stage sweep's query on the real database. Each test works years back in a
 * day of its own, so neither the live sweep nor the other test ever selects its rows.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class ContextFileStaleTextStageQueryIT {
  private static final long WINDOW = Duration.ofMinutes(30).toMillis();
  private static final long LOOKBACK = Duration.ofDays(1).toMillis();
  private static final long MINUTE = Duration.ofMinutes(1).toMillis();
  private static final int BATCH = 50;
  private static final Set<ProcessingStatus> TEXT_STAGE =
      Set.of(ProcessingStatus.Uploaded, ProcessingStatus.Analyzing);

  @Test
  void returnsOnlyStrandedTextStageFilesWithASnapshot(TestNamespace ns) {
    long now = Instant.parse("2016-01-10T00:00:00Z").toEpochMilli();
    List<UUID> inserted = new ArrayList<>();
    try {
      UUID atLookbackStart =
          insert(ns, inserted, "lookback-start", ProcessingStatus.Uploaded, now - LOOKBACK, true);
      UUID analyzing =
          insert(ns, inserted, "analyzing", ProcessingStatus.Analyzing, now - WINDOW - 2 * MINUTE);
      UUID uploaded =
          insert(ns, inserted, "uploaded", ProcessingStatus.Uploaded, now - WINDOW - MINUTE);
      insert(ns, inserted, "window-edge", ProcessingStatus.Uploaded, now - WINDOW);
      insert(ns, inserted, "inside-window", ProcessingStatus.Analyzing, now - WINDOW + MINUTE);
      insert(ns, inserted, "job-backed", ProcessingStatus.ExtractingContext, now - WINDOW - MINUTE);
      insert(ns, inserted, "no-snapshot", ProcessingStatus.Uploaded, now - WINDOW - MINUTE, false);
      insert(ns, inserted, "past-lookback", ProcessingStatus.Uploaded, now - LOOKBACK - MINUTE);

      assertEquals(List.of(atLookbackStart, analyzing, uploaded), idsReturned(now));
    } finally {
      delete(inserted);
    }
  }

  @Test
  void capsTheBatchAtFiftyOldestFirst(TestNamespace ns) {
    long now = Instant.parse("2016-02-10T00:00:00Z").toEpochMilli();
    List<UUID> inserted = new ArrayList<>();
    try {
      for (int minute = 1; minute <= BATCH + 1; minute++) {
        long updatedAt = now - LOOKBACK + minute * MINUTE;
        insert(ns, inserted, "eligible-" + minute, ProcessingStatus.Uploaded, updatedAt);
      }

      assertEquals(inserted.subList(0, BATCH), idsReturned(now));
    } finally {
      delete(inserted);
    }
  }

  private static UUID insert(
      TestNamespace ns, List<UUID> inserted, String name, ProcessingStatus status, long updatedAt) {
    return insert(ns, inserted, name, status, updatedAt, true);
  }

  private static UUID insert(
      TestNamespace ns,
      List<UUID> inserted,
      String name,
      ProcessingStatus status,
      long updatedAt,
      boolean withSnapshot) {
    String fileName = ns.prefix(name);
    ContextFile file =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withName(fileName)
            .withFullyQualifiedName(FullyQualifiedName.quoteName(fileName))
            .withProcessingStatus(status)
            .withHeadContentId(withSnapshot ? UUID.randomUUID().toString() : null)
            .withUpdatedAt(updatedAt)
            .withUpdatedBy(Entity.ADMIN_USER_NAME)
            .withVersion(0.1)
            .withDeleted(false);
    Entity.getCollectionDAO().contextFileDAO().insert(file, file.getFullyQualifiedName());
    inserted.add(file.getId());
    return file.getId();
  }

  private static List<UUID> idsReturned(long now) {
    ContextFileRepository repository =
        (ContextFileRepository) Entity.getEntityRepository(Entity.CONTEXT_FILE);
    return repository
        .listWithContentInProcessingStatus(TEXT_STAGE, now - LOOKBACK, now - WINDOW, BATCH)
        .stream()
        .map(ContextFile::getId)
        .toList();
  }

  private static void delete(List<UUID> ids) {
    ids.forEach(id -> Entity.getCollectionDAO().contextFileDAO().delete(id));
  }
}
