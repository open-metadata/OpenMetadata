/*
 * Copyright 2024 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.service.drive.memory;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.digest.DigestUtils;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.configuration.AISettings;
import org.openmetadata.schema.configuration.MemoryAgentSettings;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryProcessingStatus;
import org.openmetadata.schema.entity.context.MemoryStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.drive.AiProviderHolder;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.util.AISettingsUtil;

/**
 * Orchestrates Memory Agent derivation from {@link ContextMemory}. When memory content changes,
 * a trailing-throttle (debounce) collapses rapid edits into one run. Each run is guarded by a
 * content hash so an identical memory is never re-derived, protecting against cost blowout and the
 * postUpdate→schedule→run re-entry loop.
 *
 * <p>The stamp persists memoryStats with {@code updateVersion=false}, so it does NOT bump the
 * entity version (no history churn). It DOES still fire postUpdate ({@code entityChanged=true}).
 * The recursion loop is therefore broken solely by the hash-gate: after a stamp, {@code sourceHash
 * == hashOf(memory)}, so a re-triggered ontology run skips derivation. The hash-gate is
 * load-bearing — do NOT remove it.
 */
@Slf4j
public class MemoryProcessingEngine {
  static final String SYSPROP_QUIET_MILLIS = "ontology.context.quiet.period.millis";
  static final String SYSPROP_MAX_PENDING = "ontology.context.max.pending.memories";

  /** Fetched so grounding can find the memory's same-document siblings for reuse + relations. */
  private static final String FIELD_SOURCE_ENTITY = "sourceEntity";

  // Short, not the 5-minute article-extraction debounce: a memory is a one-shot save (created by
  // extraction, or a single manual create/edit), not autosaved keystroke-by-keystroke like an
  // article body. So derivation runs promptly after the memory settles. The few seconds still keep
  // the run off the request thread (post-commit), coalesce the create -> status-stamp re-arm, and
  // let the hash gate make the re-triggered run a no-op. Override via SYSPROP_QUIET_MILLIS.
  static final long DEFAULT_QUIET_PERIOD_MILLIS = TimeUnit.SECONDS.toMillis(2);
  static final int DEFAULT_MAX_PENDING_MEMORIES = 10_000;

  private final ContextMemoryRepository memoryRepo;
  private final MemoryGrounding grounding;
  private final MemoryDeriver extractor;
  private final MemoryReconciler reconciler;
  private final long quietPeriodMillis;
  private final int maxPendingMemories;
  private final ScheduledExecutorService scheduler;
  private final boolean skipInfraGates;
  private final Map<UUID, ScheduledFuture<?>> pending = new ConcurrentHashMap<>();

  /** Production singleton — lazily built on first call to {@link #instance()}. */
  private static volatile MemoryProcessingEngine singleton;

  private MemoryProcessingEngine(
      final ContextMemoryRepository memoryRepo,
      final MemoryGrounding grounding,
      final MemoryDeriver extractor,
      final MemoryReconciler reconciler,
      final long quietPeriodMillis,
      final int maxPendingMemories,
      final ScheduledExecutorService scheduler,
      final boolean skipInfraGates) {
    this.memoryRepo = memoryRepo;
    this.grounding = grounding;
    this.extractor = extractor;
    this.reconciler = reconciler;
    this.quietPeriodMillis = quietPeriodMillis;
    this.maxPendingMemories = maxPendingMemories;
    this.scheduler = scheduler;
    this.skipInfraGates = skipInfraGates;
  }

  /** Returns the production singleton, building it on first call. */
  public static MemoryProcessingEngine instance() {
    if (singleton == null) {
      synchronized (MemoryProcessingEngine.class) {
        if (singleton == null) {
          singleton = buildProduction();
        }
      }
    }
    return singleton;
  }

  /**
   * Test seam: injects deterministic collaborators, bypasses LLM and AISettings infrastructure
   * gates (which require a running settings cache), and uses a daemon scheduler so {@link
   * #run(UUID)} can be exercised synchronously without timing dependencies.
   */
  static MemoryProcessingEngine forTest(
      final ContextMemoryRepository memoryRepo,
      final MemoryGrounding grounding,
      final MemoryDeriver extractor,
      final MemoryReconciler reconciler) {
    return new MemoryProcessingEngine(
        memoryRepo,
        grounding,
        extractor,
        reconciler,
        0L,
        DEFAULT_MAX_PENDING_MEMORIES,
        immediateExecutor(),
        true);
  }

  private static MemoryProcessingEngine buildProduction() {
    final ContextMemoryRepository memoryRepo =
        (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
    final GlossaryTermRepository termRepo =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    final MetricRepository metricRepo =
        (MetricRepository) Entity.getEntityRepository(Entity.METRIC);
    final GlossaryRepository glossaryRepo =
        (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
    final long quietMillis = Long.getLong(SYSPROP_QUIET_MILLIS, DEFAULT_QUIET_PERIOD_MILLIS);
    final int maxPending = Integer.getInteger(SYSPROP_MAX_PENDING, DEFAULT_MAX_PENDING_MEMORIES);
    return new MemoryProcessingEngine(
        memoryRepo,
        new MemoryGrounding(),
        AiProviderHolder.get().memoryDeriver(),
        new MemoryReconciler(termRepo, metricRepo, glossaryRepo),
        quietMillis,
        maxPending,
        defaultScheduler(),
        false);
  }

  /**
   * (Re)schedules an ontology derivation run after the quiet period, collapsing rapid memory edits
   * into one. Bounded: when the pending map is full, one entry is evicted with a warning; its next
   * edit re-arms it and the hash gate keeps the eventual run correct.
   */
  public void schedule(final UUID memoryId) {
    evictIfFull();
    final AtomicReference<ScheduledFuture<?>> holder = new AtomicReference<>();
    holder.set(
        scheduler.schedule(
            () -> runScheduled(memoryId, holder.get()), quietPeriodMillis, TimeUnit.MILLISECONDS));
    final ScheduledFuture<?> previous = pending.put(memoryId, holder.get());
    if (previous != null) {
      previous.cancel(false);
    }
  }

  /** Cancels any pending run for a memory, e.g. when it is deleted. */
  public void cancel(final UUID memoryId) {
    final ScheduledFuture<?> previous = pending.remove(memoryId);
    if (previous != null) {
      previous.cancel(false);
    }
  }

  /**
   * Runs the full derivation pipeline for one memory. Package-visible so tests can invoke
   * synchronously via {@link #forTest}. Gates on LLM availability, agent enablement, and content
   * hash before calling grounding → extractor → reconciler → stamp.
   */
  void run(final UUID memoryId) {
    final boolean eligible = skipInfraGates || (LLMClientHolder.isEnabled() && isAgentEnabled());
    if (eligible) {
      runIfHashChanged(memoryId);
    }
  }

  /** Returns {@code sha256Hex(title + " " + question + " " + answer + " " + memoryType)}. */
  public static String hashOf(final ContextMemory m) {
    final String text =
        StringUtils.defaultString(m.getTitle())
            + " "
            + StringUtils.defaultString(m.getQuestion())
            + " "
            + StringUtils.defaultString(m.getAnswer())
            + " "
            + (m.getMemoryType() == null ? "" : m.getMemoryType().value());
    return DigestUtils.sha256Hex(text);
  }

  private boolean isAgentEnabled() {
    final AISettings settings = AISettingsUtil.get();
    return AISettingsUtil.isMemoryAgentEnabled(settings);
  }

  private void runIfHashChanged(final UUID memoryId) {
    final ContextMemory memory =
        memoryRepo.get(null, memoryId, memoryRepo.getFields(FIELD_SOURCE_ENTITY));
    final String hash = hashOf(memory);
    final boolean unchanged = isHashUnchanged(memory, hash);
    if (!unchanged) {
      derive(memory, hash);
    }
  }

  private boolean isHashUnchanged(final ContextMemory memory, final String hash) {
    return memory.getMemoryStats() != null && hash.equals(memory.getMemoryStats().getSourceHash());
  }

  private void derive(final ContextMemory memory, final String hash) {
    final AISettings settings = AISettingsUtil.get();
    stampStatus(memory, MemoryProcessingStatus.Processing, null);
    MemoryStats stats;
    try {
      final MemoryContext ctx = grounding.fetchCandidates(memory);
      final MemoryDerivation verdict = extractor.derive(memory, ctx);
      final MemoryReconciler.ReconcileResult result =
          reconciler.reconcile(
              memory,
              verdict,
              ctx,
              AISettingsUtil.deletionPolicy(settings),
              deriveTermsEnabled(settings),
              deriveMetricsEnabled(settings));
      stats = buildStats(hash, result, MemoryProcessingStatus.Processed, null);
    } catch (RuntimeException ex) {
      // Stamp Failed AND the content hash: a deterministic failure would otherwise retry forever
      // (the hash gate skips a re-derive once sourceHash == hashOf), and the error is surfaced on
      // the memory so the UI can show why derivation did not produce ontologies.
      LOG.error("Ontology derivation failed for memory {}", memory.getId(), ex);
      stats = buildStats(hash, null, MemoryProcessingStatus.Failed, ex.getMessage());
    }
    memoryRepo.stampMemoryStats(memory, stats);
  }

  /** Flips only the lifecycle status (preserving prior counts/hash), e.g. to mark a run Processing. */
  private void stampStatus(
      final ContextMemory memory, final MemoryProcessingStatus status, final String error) {
    final MemoryStats stats =
        memory.getMemoryStats() == null
            ? new MemoryStats()
            : JsonUtils.deepCopy(memory.getMemoryStats(), MemoryStats.class);
    stats.withStatus(status).withError(error);
    memoryRepo.stampMemoryStats(memory, stats);
  }

  private boolean deriveTermsEnabled(final AISettings settings) {
    final MemoryAgentSettings agent = settings == null ? null : settings.getMemoryAgent();
    return agent == null || !Boolean.FALSE.equals(agent.getDeriveGlossaryTerms());
  }

  private boolean deriveMetricsEnabled(final AISettings settings) {
    final MemoryAgentSettings agent = settings == null ? null : settings.getMemoryAgent();
    return agent == null || !Boolean.FALSE.equals(agent.getDeriveMetrics());
  }

  private MemoryStats buildStats(
      final String hash,
      final MemoryReconciler.ReconcileResult r,
      final MemoryProcessingStatus status,
      final String error) {
    final int terms = r == null ? 0 : r.createdTerms();
    final int metrics = r == null ? 0 : r.createdMetrics();
    final int reused = r == null ? 0 : r.reused();
    return new MemoryStats()
        .withStatus(status)
        .withError(error)
        .withSourceHash(hash)
        .withDerivedTermCount(terms)
        .withDerivedMetricCount(metrics)
        .withReusedCount(reused)
        .withLastRunAt(System.currentTimeMillis());
  }

  private void runScheduled(final UUID memoryId, final ScheduledFuture<?> firedFuture) {
    pending.remove(memoryId, firedFuture);
    try {
      run(memoryId);
    } catch (RuntimeException e) {
      // Intentional broad catch: an uncaught exception here would kill the scheduler thread.
      LOG.error("Ontology derivation failed for memory {}", memoryId, e);
    }
  }

  private void evictIfFull() {
    if (pending.size() >= maxPendingMemories) {
      final UUID dropped = pending.keySet().stream().findFirst().orElse(null);
      if (dropped != null) {
        cancel(dropped);
        LOG.warn(
            "Ontology derivation throttle is full ({} pending); dropped memory {}. It re-arms on its next edit.",
            maxPendingMemories,
            dropped);
      }
    }
  }

  private static ScheduledExecutorService defaultScheduler() {
    return newScheduler("ontology-derivation");
  }

  private static ScheduledExecutorService immediateExecutor() {
    return newScheduler("ontology-derivation-test");
  }

  private static ScheduledExecutorService newScheduler(final String threadName) {
    return Executors.newSingleThreadScheduledExecutor(
        runnable -> {
          final Thread thread = new Thread(runnable, threadName);
          thread.setDaemon(true);
          return thread;
        });
  }
}
