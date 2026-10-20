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

import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.BooleanSupplier;
import java.util.function.LongSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.llm.LLMClientHolder;

/**
 * Queues glossary-term derivation when a published memory is created or revised, provided memory
 * extraction is switched on and the AI provider has a {@link MemoryGlossaryDeriver}.
 */
@Slf4j
public final class MemoryGlossaryDerivationQueue {
  // Long enough for one extraction run to land all of a document's memories in the same batch.
  static final Duration BATCH_WINDOW = Duration.ofSeconds(30);

  private final JobDAO jobDao;
  private final BooleanSupplier isAvailable;
  private final LongSupplier clock;

  public MemoryGlossaryDerivationQueue(final JobDAO jobDao) {
    this(jobDao, MemoryGlossaryDerivationQueue::isAvailable, System::currentTimeMillis);
  }

  MemoryGlossaryDerivationQueue(
      final JobDAO jobDao, final BooleanSupplier isAvailable, final LongSupplier clock) {
    this.jobDao = jobDao;
    this.isAvailable = isAvailable;
    this.clock = clock;
  }

  /**
   * The deriver to run, while glossary terms are derived at all: the switches that turn memory
   * extraction on (the LLM and memory extraction) govern derivation from memories too, and only an
   * AI provider that ships a deriver has one.
   */
  public static Optional<MemoryGlossaryDeriver> availableDeriver() {
    return LLMClientHolder.isMemoryExtractionEnabled()
        ? AiProviderHolder.get().memoryGlossaryDeriver()
        : Optional.empty();
  }

  public static boolean isAvailable() {
    return availableDeriver().isPresent();
  }

  public void enqueue(final ContextMemory memory, final String createdBy) {
    if (isPublished(memory) && isAvailable.getAsBoolean()) {
      try {
        submit(memory, createdBy);
      } catch (RuntimeException exception) {
        LOG.error(
            "Could not queue glossary term derivation for memory {}", memory.getId(), exception);
      }
    }
  }

  // Memories extracted from one file or page share a delayed job; anything else runs on its own.
  private void submit(final ContextMemory memory, final String createdBy) {
    final String memoryId = memory.getId().toString();
    final EntityReference source = memory.getSourceEntity();
    if (source == null) {
      jobDao.enqueueMemoryGlossaryDerivationJob(List.of(memoryId), args(memory, null), createdBy);
    } else {
      final String batchKey = source.getType() + ":" + source.getId();
      jobDao.enqueueMemoryGlossaryDerivationBatch(
          memoryId,
          batchKey,
          args(memory, batchKey),
          createdBy,
          clock.getAsLong() + BATCH_WINDOW.toMillis());
    }
  }

  private static String args(final ContextMemory memory, final String batchKey) {
    return JsonUtils.pojoToJson(
        new MemoryGlossaryDerivationJobHandler.Args(List.of(memory.getId()), batchKey));
  }

  public static boolean hasNewPublishedContent(
      final ContextMemory previous, final ContextMemory updated) {
    return isPublished(updated)
        && (!isPublished(previous)
            || !Objects.equals(previous.getQuestion(), updated.getQuestion())
            || !Objects.equals(previous.getAnswer(), updated.getAnswer()));
  }

  /** An Approved memory with a question and an answer that is shared beyond its owners. */
  public static boolean isPublished(final ContextMemory memory) {
    return memory != null
        && memory.getEntityStatus() == ContextMemoryStatus.APPROVED
        && hasText(memory.getQuestion())
        && hasText(memory.getAnswer())
        && isSharedBeyondOwners(memory);
  }

  /** A memory gets at most one derived term; later content changes do not derive another. */
  public static boolean hasDerivedGlossaryTerm(final List<EntityReference> derivedEntities) {
    return listOrEmpty(derivedEntities).stream()
        .anyMatch(reference -> Entity.GLOSSARY_TERM.equals(reference.getType()));
  }

  private static boolean hasText(final String text) {
    return text != null && !text.isBlank();
  }

  private static boolean isSharedBeyondOwners(final ContextMemory memory) {
    final MemoryVisibility visibility =
        memory.getShareConfig() == null ? null : memory.getShareConfig().getVisibility();
    return visibility == MemoryVisibility.ENTITY || visibility == MemoryVisibility.PUBLIC;
  }
}
