/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.StepStats;

/**
 * Failure-isolation contract for {@link EnrichmentPipeline}. The pipeline's promise to callers:
 * a step that throws contributes no fields to the entity map, but every sibling step still runs
 * to completion. This is the structural property that prevents one enrichment defect from
 * silently dropping an entity from the DI index.
 */
class EnrichmentPipelineTest {

  // ───────────────────────────── happy path ─────────────────────────────

  @Test
  void allStepsSucceed_eachContributesAndStatsRecordSuccess() {
    EnrichmentStep stepA = recordingStep("a", target -> target.entityMap().put("keyA", "valA"));
    EnrichmentStep stepB = recordingStep("b", target -> target.entityMap().put("keyB", "valB"));
    EnrichmentPipeline pipeline = new EnrichmentPipeline(List.of(stepA, stepB));

    EnrichmentTarget target = newTarget();
    List<StepFailure> failures = pipeline.run(target);

    assertTrue(failures.isEmpty(), "no step threw");
    assertEquals("valA", target.entityMap().get("keyA"));
    assertEquals("valB", target.entityMap().get("keyB"));

    Map<String, StepStats> stats = pipeline.snapshotStats();
    assertEquals(1, stats.get("a").getSuccessRecords());
    assertEquals(0, stats.get("a").getFailedRecords());
    assertEquals(1, stats.get("b").getSuccessRecords());
    assertEquals(0, stats.get("b").getFailedRecords());
  }

  // ──────────────────────── failure isolation: one step ────────────────────────

  @Test
  void oneStepThrows_siblingsStillRun_onlyThatStepMarkedFailed() {
    AtomicInteger siblingInvocations = new AtomicInteger();
    EnrichmentStep failing =
        recordingStep(
            "failing",
            target -> {
              throw new RuntimeException("boom");
            });
    EnrichmentStep beforeFail =
        recordingStep(
            "before",
            target -> {
              siblingInvocations.incrementAndGet();
              target.entityMap().put("before", true);
            });
    EnrichmentStep afterFail =
        recordingStep(
            "after",
            target -> {
              siblingInvocations.incrementAndGet();
              target.entityMap().put("after", true);
            });

    EnrichmentPipeline pipeline = new EnrichmentPipeline(List.of(beforeFail, failing, afterFail));
    EnrichmentTarget target = newTarget();

    List<StepFailure> failures = pipeline.run(target);

    assertEquals(1, failures.size(), "exactly one step failed");
    assertEquals("failing", failures.get(0).stepName());
    assertEquals("boom", failures.get(0).cause().getMessage());

    // Siblings before AND after the failing step both ran. This is the contract.
    assertEquals(2, siblingInvocations.get());
    assertTrue((Boolean) target.entityMap().get("before"));
    assertTrue((Boolean) target.entityMap().get("after"));
    assertFalse(target.entityMap().containsKey("failing"));

    Map<String, StepStats> stats = pipeline.snapshotStats();
    assertEquals(0, stats.get("failing").getSuccessRecords());
    assertEquals(1, stats.get("failing").getFailedRecords());
    assertEquals(1, stats.get("before").getSuccessRecords());
    assertEquals(1, stats.get("after").getSuccessRecords());
  }

  // ──────────────────────── failure isolation: multiple steps ────────────────────────

  @Test
  void multipleStepsThrow_eachIsolated_othersStillRun() {
    EnrichmentStep failingA =
        recordingStep(
            "a",
            target -> {
              throw new IllegalStateException("a-down");
            });
    EnrichmentStep okB = recordingStep("b", target -> target.entityMap().put("b", "ok"));
    EnrichmentStep failingC =
        recordingStep(
            "c",
            target -> {
              throw new NullPointerException("c-down");
            });
    EnrichmentStep okD = recordingStep("d", target -> target.entityMap().put("d", "ok"));

    EnrichmentPipeline pipeline = new EnrichmentPipeline(List.of(failingA, okB, failingC, okD));
    EnrichmentTarget target = newTarget();

    List<StepFailure> failures = pipeline.run(target);

    assertEquals(2, failures.size());
    assertEquals("a", failures.get(0).stepName());
    assertEquals("c", failures.get(1).stepName());

    // The two okay steps both contributed; the two failing steps contributed nothing.
    assertEquals("ok", target.entityMap().get("b"));
    assertEquals("ok", target.entityMap().get("d"));

    Map<String, StepStats> stats = pipeline.snapshotStats();
    assertEquals(1, stats.get("a").getFailedRecords());
    assertEquals(1, stats.get("b").getSuccessRecords());
    assertEquals(1, stats.get("c").getFailedRecords());
    assertEquals(1, stats.get("d").getSuccessRecords());
  }

  // ──────────────────────── construction validation ────────────────────────

  @Test
  void duplicateStepNameRejectedAtConstruction() {
    EnrichmentStep first = recordingStep("dup", target -> {});
    EnrichmentStep second = recordingStep("dup", target -> {});
    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class, () -> new EnrichmentPipeline(List.of(first, second)));
    assertTrue(ex.getMessage().contains("dup"), "exception message names the duplicate");
  }

  // ──────────────────────── stats counters under repeated runs ────────────────────────

  @Test
  void repeatedFailuresAccumulate_evenBeyondLoggingRateLimit() {
    // Counts must always reflect EVERY failure even though LOG.warn samples cap at
    // MAX_WARN_SAMPLES_PER_STEP. This protects the workflow's stats accuracy.
    EnrichmentStep alwaysFails =
        recordingStep(
            "doomed",
            target -> {
              throw new RuntimeException("nope");
            });
    EnrichmentPipeline pipeline = new EnrichmentPipeline(List.of(alwaysFails));

    int runs = EnrichmentPipeline.MAX_WARN_SAMPLES_PER_STEP * 3;
    for (int i = 0; i < runs; i++) {
      pipeline.run(newTarget());
    }

    StepStats stats = pipeline.snapshotStats().get("doomed");
    assertEquals(runs, stats.getFailedRecords(), "every failure counted regardless of log cap");
    assertEquals(0, stats.getSuccessRecords());
    assertEquals(runs, stats.getTotalRecords());
  }

  // ──────────────────────── thread-safety smoke test ────────────────────────

  @Test
  void concurrentInvocationsProduceConsistentCounts() throws Exception {
    EnrichmentStep ok = recordingStep("ok", target -> target.entityMap().put("ok", true));
    EnrichmentStep failing =
        recordingStep(
            "failing",
            target -> {
              throw new RuntimeException("x");
            });
    EnrichmentPipeline pipeline = new EnrichmentPipeline(List.of(ok, failing));

    int totalRuns = 500;
    ExecutorService pool = Executors.newFixedThreadPool(8);
    try {
      List<Runnable> tasks = new ArrayList<>();
      for (int i = 0; i < totalRuns; i++) {
        tasks.add(() -> pipeline.run(newTarget()));
      }
      pool.invokeAll(tasks.stream().map(Executors::callable).toList());
    } finally {
      pool.shutdown();
      assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));
    }

    Map<String, StepStats> stats = pipeline.snapshotStats();
    assertEquals(totalRuns, stats.get("ok").getSuccessRecords());
    assertEquals(totalRuns, stats.get("failing").getFailedRecords());
  }

  // ──────────────────────── StepFailure metadata ────────────────────────

  @Test
  void stepFailureCarriesEntityFqnAndCause() {
    RuntimeException cause = new RuntimeException("specific cause");
    EnrichmentStep s =
        recordingStep(
            "x",
            target -> {
              throw cause;
            });
    EnrichmentPipeline pipeline = new EnrichmentPipeline(List.of(s));

    EnrichmentTarget target = newTargetWithFqn("svc.db.schema.table");
    StepFailure failure = pipeline.run(target).get(0);

    assertEquals("x", failure.stepName());
    assertEquals("svc.db.schema.table", failure.entityFqn());
    assertEquals(cause, failure.cause());
  }

  @Test
  void stepFailureFqnFallsBackWhenEntityNull() {
    EnrichmentStep s =
        recordingStep(
            "y",
            target -> {
              throw new RuntimeException();
            });
    EnrichmentPipeline pipeline = new EnrichmentPipeline(List.of(s));

    // entity null is degenerate but the pipeline should not NPE on log-formatting paths.
    EnrichmentTarget target =
        new EnrichmentTarget(
            null,
            new HashMap<>(),
            Map.of(),
            0L,
            0L,
            new EnrichmentContext("table", List.of(), 0L, 0L),
            VersionShape.LATEST_HYDRATED);
    StepFailure failure = pipeline.run(target).get(0);

    assertNotNull(failure.entityFqn());
    assertEquals("<unknown>", failure.entityFqn());
  }

  @Test
  void noStepsConfigured_runReturnsEmptyAndIsNoOp() {
    EnrichmentPipeline pipeline = new EnrichmentPipeline(List.of());
    EnrichmentTarget target = newTarget();
    List<StepFailure> failures = pipeline.run(target);
    assertTrue(failures.isEmpty());
    assertTrue(target.entityMap().isEmpty());
    assertTrue(pipeline.snapshotStats().isEmpty());
  }

  @Test
  void snapshotStatsBeforeAnyRunReportsZeros() {
    EnrichmentPipeline pipeline = new EnrichmentPipeline(List.of(recordingStep("a", target -> {})));
    StepStats stats = pipeline.snapshotStats().get("a");
    assertEquals(0, stats.getTotalRecords());
    assertEquals(0, stats.getSuccessRecords());
    assertEquals(0, stats.getFailedRecords());
  }

  @Test
  void unknownStepNotInSnapshot() {
    EnrichmentPipeline pipeline =
        new EnrichmentPipeline(List.of(recordingStep("known", target -> {})));
    assertNull(pipeline.snapshotStats().get("unknown"));
  }

  // ─────────────────────────────── helpers ───────────────────────────────

  private static EnrichmentStep recordingStep(String name, Consumer<EnrichmentTarget> body) {
    return new EnrichmentStep() {
      @Override
      public String name() {
        return name;
      }

      @Override
      public void apply(EnrichmentTarget target) {
        body.accept(target);
      }
    };
  }

  private static EnrichmentTarget newTarget() {
    return newTargetWithFqn("svc.db.schema.t_" + UUID.randomUUID());
  }

  private static EnrichmentTarget newTargetWithFqn(String fqn) {
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getFullyQualifiedName()).thenReturn(fqn);
    return new EnrichmentTarget(
        entity,
        new HashMap<>(),
        Map.of(),
        0L,
        86_400_000L,
        new EnrichmentContext("table", List.of(), 0L, 86_400_000L),
        VersionShape.LATEST_HYDRATED);
  }
}
