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

package org.openmetadata.service.context.center;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.jobs.JobHandler;
import org.openmetadata.service.util.RequestEntityCache;

/** Runs queued glossary-term derivation through the AI provider's {@link MemoryGlossaryDeriver}. */
public final class MemoryGlossaryDerivationJobHandler implements JobHandler {
  public static final String HANDLER_NAME = "MemoryGlossaryDerivationJobHandler";
  public static final String UNAVAILABLE_MESSAGE =
      "The configured AI provider does not derive glossary terms";
  private static final String MEMORY_FIELDS = "derivedEntities";

  /** {@code batchKey} groups lifecycle-queued memories from one source into a single job. */
  public record Args(List<UUID> memoryIds, String batchKey) {}

  public record Result(List<EntityReference> terms) {}

  private final Supplier<Optional<MemoryGlossaryDeriver>> deriverSupplier;
  private final Function<UUID, Optional<ContextMemory>> memoryLoader;
  private final Predicate<ContextMemory> readableByEveryone;
  private final JobDAO jobDao;

  public MemoryGlossaryDerivationJobHandler() {
    this(
        () -> AiProviderHolder.get().memoryGlossaryDeriver(),
        MemoryGlossaryDerivationJobHandler::loadMemory,
        MemoryGlossaryDerivationJobHandler::isReadableByEveryone,
        Entity.getJobDAO());
  }

  MemoryGlossaryDerivationJobHandler(
      final Supplier<Optional<MemoryGlossaryDeriver>> deriverSupplier,
      final Function<UUID, Optional<ContextMemory>> memoryLoader,
      final Predicate<ContextMemory> readableByEveryone,
      final JobDAO jobDao) {
    this.deriverSupplier = deriverSupplier;
    this.memoryLoader = memoryLoader;
    this.readableByEveryone = readableByEveryone;
    this.jobDao = jobDao;
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

  private List<EntityReference> derive(final BackgroundJob job) {
    final MemoryGlossaryDeriver deriver =
        deriverSupplier.get().orElseThrow(() -> new IllegalStateException(UNAVAILABLE_MESSAGE));
    // A lifecycle batch can grow after the worker first read it, so run with its stored args.
    final BackgroundJob current = jobDao.fetchJobById(job.getId()).orElse(job);
    final Args args = JsonUtils.convertValue(current.getJobArgs(), Args.class);
    final List<ContextMemory> memories = eligibleMemories(args.memoryIds());
    return memories.isEmpty() ? List.of() : List.copyOf(deriver.derive(memories));
  }

  // A memory can be deleted, retired, restricted or given a term between being queued and running.
  // Every glossary reader sees a derived term, so only a memory every reader may see can define
  // one: an anchored memory is restricted to its anchor's readers, unless that is an org-wide file.
  private List<ContextMemory> eligibleMemories(final List<UUID> memoryIds) {
    return listOrEmpty(memoryIds).stream()
        .distinct()
        .map(memoryLoader)
        .flatMap(Optional::stream)
        .filter(MemoryGlossaryDerivationJobHandler::isEligible)
        .filter(readableByEveryone)
        .toList();
  }

  private static boolean isReadableByEveryone(final ContextMemory memory) {
    return ((ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY))
        .hasOrgWideAnchor(memory);
  }

  static boolean isEligible(final ContextMemory memory) {
    return MemoryGlossaryDerivationQueue.isPublished(memory)
        && !MemoryGlossaryDerivationQueue.hasDerivedGlossaryTerm(memory.getDerivedEntities());
  }

  private static Optional<ContextMemory> loadMemory(final UUID memoryId) {
    final ContextMemoryRepository repository =
        (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
    try {
      return Optional.of(
          repository.get(
              null, memoryId, repository.getFields(MEMORY_FIELDS), Include.NON_DELETED, false));
    } catch (EntityNotFoundException deleted) {
      return Optional.empty();
    }
  }

  private void complete(final BackgroundJob job, final List<EntityReference> terms) {
    final long completedAt = System.currentTimeMillis();
    jobDao.completeJob(
        job.getId(),
        BackgroundJob.Status.COMPLETED.name(),
        JsonUtils.pojoToJson(new Result(terms)),
        "Derived " + terms.size() + " glossary terms",
        1,
        1,
        completedAt,
        completedAt);
  }

  private BackgroundJobException fail(final BackgroundJob job, final RuntimeException exception) {
    final String message = "Glossary term derivation failed: " + exception.getMessage();
    final long failedAt = System.currentTimeMillis();
    jobDao.failJob(
        job.getId(), BackgroundJob.Status.FAILED.name(), message, message, failedAt, failedAt);
    return new BackgroundJobException(job.getId(), message, exception);
  }

  @Override
  public boolean sendStatusToWebSocket() {
    return false;
  }
}
