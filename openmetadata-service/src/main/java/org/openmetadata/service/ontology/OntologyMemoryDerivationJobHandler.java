/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.ontology;

import java.util.List;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import org.openmetadata.schema.api.data.OntologyMemoryDerivationOutcome;
import org.openmetadata.schema.api.data.OntologyMemoryDerivationResult;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.jobs.JobHandler;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.util.RequestEntityCache;

/** Runs memory-grounded glossary proposals through the durable background job worker. */
public final class OntologyMemoryDerivationJobHandler implements JobHandler {
  public static final String HANDLER_NAME = "OntologyMemoryDerivationJobHandler";
  public static final String DISABLED_MESSAGE = "Ontology memory derivation is disabled";
  private static final String COMPLETED_MESSAGE = "Memory derivation completed";
  private static final String NO_NEW_TERMS_MESSAGE = "No new glossary terms proposed";

  /** {@code batchKey} groups lifecycle-queued memories from one source into a single job. */
  public record Args(String glossary, List<UUID> memoryIds, String batchKey) {}

  public record Result(UUID changeSetId) {}

  private final OntologyMemoryDerivationService service;
  private final JobDAO jobDao;
  private final BooleanSupplier enabled;

  public static OntologyMemoryDerivationJobHandler createDefault() {
    return new OntologyMemoryDerivationJobHandler(
        new OntologyMemoryDerivationService(
            (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY),
            (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY),
            (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM),
            (OntologyChangeSetRepository) Entity.getEntityRepository(Entity.ONTOLOGY_CHANGE_SET),
            new LlmOntologyAiCompletionGateway(LLMClientHolder.get())),
        Entity.getJobDAO(),
        OntologyAiAvailability::isMemoryDerivationEnabled);
  }

  OntologyMemoryDerivationJobHandler(
      final OntologyMemoryDerivationService service,
      final JobDAO jobDao,
      final BooleanSupplier enabled) {
    this.service = service;
    this.jobDao = jobDao;
    this.enabled = enabled;
  }

  @Override
  public void runJob(final BackgroundJob job) throws BackgroundJobException {
    try {
      RequestEntityCache.clear();
      complete(job, derive(job));
    } catch (RuntimeException exception) {
      throw fail(job, exception);
    } finally {
      RequestEntityCache.clear();
    }
  }

  private UUID derive(final BackgroundJob job) {
    // Jobs queued before an operator turned the feature off must not keep spending model calls.
    if (!enabled.getAsBoolean()) {
      throw new IllegalStateException(DISABLED_MESSAGE);
    }
    // A lifecycle batch can grow after the worker first read it, so run with its stored args.
    final BackgroundJob current = jobDao.fetchJobById(job.getId()).orElse(job);
    final Args args = JsonUtils.convertValue(current.getJobArgs(), Args.class);
    return service
        .derive(job.getId(), args.glossary(), args.memoryIds(), job.getCreatedBy())
        .orElse(null);
  }

  private void complete(final BackgroundJob job, final UUID changeSetId) {
    final long completedAt = System.currentTimeMillis();
    jobDao.completeJob(
        job.getId(),
        BackgroundJob.Status.COMPLETED.name(),
        JsonUtils.pojoToJson(new Result(changeSetId)),
        changeSetId == null ? NO_NEW_TERMS_MESSAGE : COMPLETED_MESSAGE,
        1,
        1,
        completedAt,
        completedAt);
  }

  private BackgroundJobException fail(final BackgroundJob job, final RuntimeException exception) {
    final String message = "Memory derivation failed: " + exception.getMessage();
    final long failedAt = System.currentTimeMillis();
    jobDao.failJob(
        job.getId(), BackgroundJob.Status.FAILED.name(), message, message, failedAt, failedAt);
    return new BackgroundJobException(job.getId(), message, exception);
  }

  /** What a finished job means for the memories it covered. */
  public static OntologyMemoryDerivationOutcome outcome(final BackgroundJob job) {
    final boolean isFailed = job.getStatus() == BackgroundJob.Status.FAILED;
    return new OntologyMemoryDerivationOutcome()
        .withResult(isFailed ? OntologyMemoryDerivationResult.FAILED : completedResult(job))
        .withMessage(isFailed ? failureMessage(job) : null)
        .withCompletedAt(job.getCompletedAt());
  }

  // The worker marks unexpected failures FAILED without an error, so fall back to the message.
  private static String failureMessage(final BackgroundJob job) {
    return job.getError() != null ? job.getError() : job.getMessage();
  }

  private static OntologyMemoryDerivationResult completedResult(final BackgroundJob job) {
    final Result result =
        job.getResult() == null ? null : JsonUtils.readValue(job.getResult(), Result.class);
    return result != null && result.changeSetId() != null
        ? OntologyMemoryDerivationResult.PROPOSED
        : OntologyMemoryDerivationResult.NO_NEW_TERMS;
  }

  @Override
  public boolean sendStatusToWebSocket() {
    return false;
  }
}
