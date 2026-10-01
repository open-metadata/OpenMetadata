package org.openmetadata.service.ontology;

import java.util.List;
import java.util.function.BooleanSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jobs.JobDAO;

/** Queues reviewable ontology derivation when a published memory is created or revised. */
@Slf4j
public final class OntologyMemoryDerivationQueue {
  private final JobDAO jobDao;
  private final BooleanSupplier enabled;

  public OntologyMemoryDerivationQueue(JobDAO jobDao, BooleanSupplier enabled) {
    this.jobDao = jobDao;
    this.enabled = enabled;
  }

  public void enqueue(ContextMemory memory, String createdBy) {
    if (!enabled.getAsBoolean() || !isPublished(memory)) {
      return;
    }
    try {
      jobDao.enqueueOntologyMemoryDerivationJob(
          List.of(memory.getId().toString()),
          JsonUtils.pojoToJson(
              new OntologyMemoryDerivationJobHandler.Args(null, List.of(memory.getId()))),
          createdBy);
    } catch (RuntimeException exception) {
      LOG.error("Could not queue ontology derivation for memory {}", memory.getId(), exception);
    }
  }

  public static boolean isPublished(ContextMemory memory) {
    if (memory == null
        || memory.getStatus() != ContextMemoryStatus.ACTIVE
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
