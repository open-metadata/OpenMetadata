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

  public record Args(String glossary, List<UUID> memoryIds) {}

  public record Result(UUID changeSetId) {}

  private final OntologyMemoryDerivationService service;
  private final JobDAO jobDao;

  public static OntologyMemoryDerivationJobHandler createDefault() {
    return new OntologyMemoryDerivationJobHandler(
        new OntologyMemoryDerivationService(
            (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY),
            (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY),
            (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM),
            (OntologyChangeSetRepository) Entity.getEntityRepository(Entity.ONTOLOGY_CHANGE_SET),
            new LlmOntologyAiCompletionGateway(LLMClientHolder.get())),
        Entity.getJobDAO());
  }

  OntologyMemoryDerivationJobHandler(
      final OntologyMemoryDerivationService service, final JobDAO jobDao) {
    this.service = service;
    this.jobDao = jobDao;
  }

  @Override
  public void runJob(final BackgroundJob job) throws BackgroundJobException {
    try {
      RequestEntityCache.clear();
      final Args args = JsonUtils.convertValue(job.getJobArgs(), Args.class);
      final UUID changeSetId =
          service
              .derive(job.getId(), args.glossary(), args.memoryIds(), job.getCreatedBy())
              .orElse(null);
      final long completedAt = System.currentTimeMillis();
      jobDao.completeJob(
          job.getId(),
          BackgroundJob.Status.COMPLETED.name(),
          JsonUtils.pojoToJson(new Result(changeSetId)),
          "Memory derivation completed",
          1,
          1,
          completedAt,
          completedAt);
    } catch (RuntimeException exception) {
      throw new BackgroundJobException(
          job.getId(), "Memory derivation failed: " + exception.getMessage(), exception);
    } finally {
      RequestEntityCache.clear();
    }
  }

  @Override
  public boolean sendStatusToWebSocket() {
    return false;
  }
}
