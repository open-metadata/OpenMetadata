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

package org.openmetadata.service.monitoring;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

/** Bounded-cardinality release metrics for Ontology Studio and its RDF projection. */
public final class OntologyMetrics {
  private static final String RESULT = "result";
  private static final String STARTED = "started";
  private static final String COMPLETED = "completed";
  private static final String FAILED = "failed";
  private static final String CONFORMS = "conforms";
  private static final String VIOLATES = "violates";
  private static final String SKIPPED = "skipped";
  private static volatile OntologyMetrics instance;

  private final AtomicInteger rdfQueueDepth = new AtomicInteger();
  private final Counter rdfQueueDrops;
  private final Timer rdfQueueLag;
  private final Counter queryRejections;
  private final RebuildCounters graphRebuilds;
  private final ShaclCounters shaclValidations;
  private final OutcomeCounters inferenceRuns;
  private final Counter lockContentions;
  private final OutcomeCounters packImports;
  private final AiCounters aiRequests;

  private OntologyMetrics(final MeterRegistry registry) {
    registerQueueDepthGauge(registry);
    rdfQueueDrops = counter(registry, "ontology.rdf.queue.dropped", null);
    rdfQueueLag = queueLagTimer(registry);
    queryRejections = counter(registry, "ontology.query.rejected", null);
    graphRebuilds = rebuildCounters(registry);
    shaclValidations = shaclCounters(registry);
    inferenceRuns = outcomeCounters(registry, "ontology.inference.run");
    lockContentions = counter(registry, "ontology.lock.contention", null);
    packImports = outcomeCounters(registry, "ontology.pack.import");
    aiRequests = aiCounters(registry);
  }

  public static synchronized void initialize(final MeterRegistry registry) {
    if (instance == null) {
      instance = new OntologyMetrics(registry);
    }
  }

  public static void recordRdfQueueDepth(final int pendingWrites) {
    final OntologyMetrics metrics = instance;
    if (metrics != null) {
      metrics.rdfQueueDepth.set(Math.max(pendingWrites, 0));
    }
  }

  public static void recordRdfQueueDrop() {
    increment(instance == null ? null : instance.rdfQueueDrops);
  }

  public static void recordRdfQueueLag(final Duration lag) {
    final OntologyMetrics metrics = instance;
    if (metrics != null) {
      metrics.rdfQueueLag.record(lag);
    }
  }

  public static void recordQueryRejection() {
    increment(instance == null ? null : instance.queryRejections);
  }

  public static void recordGraphRebuildStarted() {
    increment(instance == null ? null : instance.graphRebuilds.started());
  }

  public static void recordGraphRebuildCompleted() {
    increment(instance == null ? null : instance.graphRebuilds.outcomes().completed());
  }

  public static void recordGraphRebuildFailed() {
    increment(instance == null ? null : instance.graphRebuilds.outcomes().failed());
  }

  public static void recordShaclValidation(final boolean performed, final boolean conforms) {
    final OntologyMetrics metrics = instance;
    final Counter counter =
        metrics == null ? null : metrics.shaclValidations.result(performed, conforms);
    increment(counter);
  }

  public static void recordInferenceRun(final boolean successful) {
    final OntologyMetrics metrics = instance;
    increment(metrics == null ? null : metrics.inferenceRuns.result(successful));
  }

  public static void recordLockContention() {
    increment(instance == null ? null : instance.lockContentions);
  }

  public static void recordPackImport(final boolean successful) {
    final OntologyMetrics metrics = instance;
    increment(metrics == null ? null : metrics.packImports.result(successful));
  }

  public static void recordAiRequest(final boolean successful) {
    final OntologyMetrics metrics = instance;
    increment(metrics == null ? null : metrics.aiRequests.outcomes().result(successful));
  }

  public static void recordAiDisabled() {
    increment(instance == null ? null : instance.aiRequests.disabled());
  }

  static synchronized void resetForTest() {
    instance = null;
  }

  private static Counter counter(
      final MeterRegistry registry, final String name, final String result) {
    final Counter.Builder builder = Counter.builder(name);
    if (result != null) {
      builder.tag(RESULT, result);
    }
    return builder.register(registry);
  }

  private void registerQueueDepthGauge(final MeterRegistry registry) {
    Gauge.builder("ontology.rdf.queue.pending", rdfQueueDepth, AtomicInteger::get)
        .description("Pending asynchronous RDF projection writes")
        .register(registry);
  }

  private static Timer queueLagTimer(final MeterRegistry registry) {
    return Timer.builder("ontology.rdf.queue.lag")
        .description("Delay between RDF projection enqueue and execution")
        .register(registry);
  }

  private static RebuildCounters rebuildCounters(final MeterRegistry registry) {
    final Counter started = counter(registry, "ontology.rdf.rebuild", STARTED);
    final OutcomeCounters outcomes = outcomeCounters(registry, "ontology.rdf.rebuild");
    return new RebuildCounters(started, outcomes);
  }

  private static ShaclCounters shaclCounters(final MeterRegistry registry) {
    return new ShaclCounters(
        counter(registry, "ontology.shacl.validation", CONFORMS),
        counter(registry, "ontology.shacl.validation", VIOLATES),
        counter(registry, "ontology.shacl.validation", SKIPPED));
  }

  private static OutcomeCounters outcomeCounters(final MeterRegistry registry, final String name) {
    return new OutcomeCounters(counter(registry, name, COMPLETED), counter(registry, name, FAILED));
  }

  private static AiCounters aiCounters(final MeterRegistry registry) {
    final OutcomeCounters outcomes = outcomeCounters(registry, "ontology.ai.request");
    final Counter disabled = counter(registry, "ontology.ai.request", "disabled");
    return new AiCounters(outcomes, disabled);
  }

  private static void increment(final Counter counter) {
    if (counter != null) {
      counter.increment();
    }
  }

  private record OutcomeCounters(Counter completed, Counter failed) {
    private Counter result(final boolean successful) {
      return successful ? completed : failed;
    }
  }

  private record RebuildCounters(Counter started, OutcomeCounters outcomes) {}

  private record ShaclCounters(Counter conforms, Counter violates, Counter skipped) {
    private Counter result(final boolean performed, final boolean isConforming) {
      return !performed ? skipped : isConforming ? conforms : violates;
    }
  }

  private record AiCounters(OutcomeCounters outcomes, Counter disabled) {}
}
