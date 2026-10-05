package org.openmetadata.service.ontology;

import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.function.BooleanSupplier;
import java.util.function.LongSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jobs.JobDAO;

/** Queues reviewable ontology derivation when a published memory is created or revised. */
@Slf4j
public final class OntologyMemoryDerivationQueue {
  // Long enough for one extraction run to land all of a document's memories in the same batch.
  static final Duration BATCH_WINDOW = Duration.ofSeconds(30);

  private final JobDAO jobDao;
  private final BooleanSupplier enabled;
  private final LongSupplier clock;

  public OntologyMemoryDerivationQueue(JobDAO jobDao, BooleanSupplier enabled) {
    this(jobDao, enabled, System::currentTimeMillis);
  }

  OntologyMemoryDerivationQueue(JobDAO jobDao, BooleanSupplier enabled, LongSupplier clock) {
    this.jobDao = jobDao;
    this.enabled = enabled;
    this.clock = clock;
  }

  public void enqueue(ContextMemory memory, String createdBy) {
    if (isPublished(memory) && enabled.getAsBoolean()) {
      try {
        submit(memory, createdBy);
      } catch (RuntimeException exception) {
        LOG.error("Could not queue ontology derivation for memory {}", memory.getId(), exception);
      }
    }
  }

  // Memories extracted from one file or page share a delayed job; anything else runs on its own.
  private void submit(ContextMemory memory, String createdBy) {
    String memoryId = memory.getId().toString();
    EntityReference source = memory.getSourceEntity();
    if (source == null) {
      jobDao.enqueueOntologyMemoryDerivationJob(List.of(memoryId), args(memory, null), createdBy);
    } else {
      String batchKey = source.getType() + ":" + source.getId();
      jobDao.enqueueOntologyMemoryDerivationBatch(
          memoryId,
          batchKey,
          args(memory, batchKey),
          createdBy,
          clock.getAsLong() + BATCH_WINDOW.toMillis());
    }
  }

  private static String args(ContextMemory memory, String batchKey) {
    return JsonUtils.pojoToJson(
        new OntologyMemoryDerivationJobHandler.Args(null, List.of(memory.getId()), batchKey));
  }

  public static boolean hasNewPublishedContent(ContextMemory previous, ContextMemory updated) {
    return isPublished(updated)
        && (!isPublished(previous)
            || !Objects.equals(previous.getQuestion(), updated.getQuestion())
            || !Objects.equals(previous.getAnswer(), updated.getAnswer()));
  }

  public static boolean isPublished(ContextMemory memory) {
    if (memory == null
        || memory.getEntityStatus() != EntityStatus.APPROVED
        || memory.getShareConfig() == null
        || memory.getQuestion() == null
        || memory.getQuestion().isBlank()
        || memory.getAnswer() == null
        || memory.getAnswer().isBlank()) {
      return false;
    }
    MemoryVisibility visibility = memory.getShareConfig().getVisibility();
    return visibility == MemoryVisibility.ENTITY || visibility == MemoryVisibility.PUBLIC;
  }
}
