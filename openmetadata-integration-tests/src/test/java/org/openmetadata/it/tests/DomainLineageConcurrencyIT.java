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

package org.openmetadata.it.tests;

import static java.util.concurrent.TimeUnit.MILLISECONDS;
import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.DomainLineageSteps.assertEdgeAbsent;
import static org.openmetadata.it.tests.DomainLineageSteps.assetEdges;
import static org.openmetadata.it.tests.DomainLineageSteps.awaitPlatformLineage;
import static org.openmetadata.it.tests.DomainLineageSteps.client;
import static org.openmetadata.it.tests.DomainLineageSteps.deleteEdge;
import static org.openmetadata.it.tests.DomainLineageSteps.domain;
import static org.openmetadata.it.tests.DomainLineageSteps.putEdge;
import static org.openmetadata.it.tests.DomainLineageSteps.setDomains;
import static org.openmetadata.it.tests.DomainLineageSteps.table;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.service.util.LineageDomainCoordinator;
import org.openmetadata.service.util.LineageDomainCoordinator.Stage;

/**
 * A service's domain move and a lineage write on one of its tables, interleaved deterministically:
 * the first writer is stopped at a checkpoint inside its transaction, after it has read the domains
 * it counts under and before it commits, and the second one is started then. Either order must
 * leave exactly the domain pairs and counts the final edges and domains stand for, and the second
 * writer must not finish while the first holds its locks (#33961, PR review P1).
 * ADR:2026-11-26-domain-lineage-rollup-writers-lock-guard-rows-in-one-order
 */
@Isolated(
    "a writer stopped at a checkpoint holds the domain move lock, which every domain and lineage"
        + " write in the server waits for")
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
public class DomainLineageConcurrencyIT {

  private static final long WAITS_FOR_THE_FIRST_MILLIS = 500;
  private static final long FINISHES_SECONDS = 30;
  private static final ExecutorService WRITERS = Executors.newFixedThreadPool(4);

  @AfterAll
  static void stopWriters() {
    WRITERS.shutdownNow();
  }

  @Test
  void aLineageAddWaitsForAServiceMoveAndCountsUnderTheNewDomain(TestNamespace ns)
      throws Exception {
    Topology topology = Topology.create(ns);
    putEdge(topology.t0(), topology.target());

    Interleaving interleaving =
        Interleaving.stopFirstAt(Stage.DOMAIN_ROLLUPS_MOVED, topology.serviceA().getId());
    interleaving.run(
        () -> setDomains(client().databaseServices(), topology.serviceA().getId(), topology.d3()),
        () -> putEdge(topology.t1(), topology.target()));

    assertEdgeAbsent(topology.d1(), topology.d2());
    assertEquals(2, assetEdges(topology.d3(), topology.d2()));
    awaitPlatformLineage(topology.d3(), topology.d2(), true);
    awaitPlatformLineage(topology.d1(), topology.d2(), false);
    interleaving.assertSecondWaitedForFirst();
  }

  /** The race the review describes: the add read the old domains before the move. */
  @Test
  void aServiceMoveWaitsForALineageAddAndMovesTheEdgeItCounted(TestNamespace ns) throws Exception {
    Topology topology = Topology.create(ns);
    putEdge(topology.t0(), topology.target());

    Interleaving interleaving =
        Interleaving.stopFirstAt(Stage.LINEAGE_DOMAINS_READ, topology.t1().getId());
    interleaving.run(
        () -> putEdge(topology.t1(), topology.target()),
        () -> setDomains(client().databaseServices(), topology.serviceA().getId(), topology.d3()));

    assertEdgeAbsent(topology.d1(), topology.d2());
    assertEquals(2, assetEdges(topology.d3(), topology.d2()));
    awaitPlatformLineage(topology.d3(), topology.d2(), true);
    awaitPlatformLineage(topology.d1(), topology.d2(), false);
    interleaving.assertSecondWaitedForFirst();
  }

  @Test
  void aLineageDeleteWaitsForAServiceMoveAndReleasesTheNewPair(TestNamespace ns) throws Exception {
    Topology topology = Topology.create(ns);
    putEdge(topology.t0(), topology.target());
    putEdge(topology.t1(), topology.target());
    assertEquals(2, assetEdges(topology.d1(), topology.d2()));

    Interleaving interleaving =
        Interleaving.stopFirstAt(Stage.DOMAIN_ROLLUPS_MOVED, topology.serviceA().getId());
    interleaving.run(
        () -> setDomains(client().databaseServices(), topology.serviceA().getId(), topology.d3()),
        () -> deleteEdge(topology.t1(), topology.target()));

    assertEdgeAbsent(topology.d1(), topology.d2());
    assertEquals(1, assetEdges(topology.d3(), topology.d2()));
    interleaving.assertSecondWaitedForFirst();
  }

  @Test
  void aServiceMoveWaitsForALineageDeleteAndMovesOnlyTheEdgeLeft(TestNamespace ns)
      throws Exception {
    Topology topology = Topology.create(ns);
    putEdge(topology.t0(), topology.target());
    putEdge(topology.t1(), topology.target());
    assertEquals(2, assetEdges(topology.d1(), topology.d2()));

    Interleaving interleaving =
        Interleaving.stopFirstAt(Stage.LINEAGE_DOMAINS_READ, topology.t1().getId());
    interleaving.run(
        () -> deleteEdge(topology.t1(), topology.target()),
        () -> setDomains(client().databaseServices(), topology.serviceA().getId(), topology.d3()));

    assertEdgeAbsent(topology.d1(), topology.d2());
    assertEquals(1, assetEdges(topology.d3(), topology.d2()));
    interleaving.assertSecondWaitedForFirst();
  }

  /** Each end of the edge moves with its own service; only the pair of the final domains is left. */
  @Test
  void movesOfBothEndsOfAnEdgeLeaveOnlyTheFinalPair(TestNamespace ns) throws Exception {
    Topology topology = Topology.create(ns);
    putEdge(topology.t0(), topology.target());
    Domain d4 = domain(ns, "d4");

    Interleaving interleaving =
        Interleaving.stopFirstAt(Stage.DOMAIN_ROLLUPS_MOVED, topology.serviceA().getId());
    interleaving.run(
        () -> setDomains(client().databaseServices(), topology.serviceA().getId(), topology.d3()),
        () -> setDomains(client().databaseServices(), topology.serviceB().getId(), d4));

    assertEquals(1, assetEdges(topology.d3(), d4));
    assertEdgeAbsent(topology.d1(), topology.d2());
    assertEdgeAbsent(topology.d3(), topology.d2());
    assertEdgeAbsent(topology.d1(), d4);
    interleaving.assertSecondWaitedForFirst();
  }

  /** No rollup row exists for the pair until the first of these writes; none of them is lost. */
  @Test
  void concurrentFirstEdgesOfADomainPairAreAllCounted(TestNamespace ns) throws Exception {
    Topology topology = Topology.create(ns);
    int writers = 4;
    List<Table> sources = new ArrayList<>();
    List<Table> targets = new ArrayList<>();
    for (int i = 0; i < writers; i++) {
      sources.add(table(ns, topology.schemaA(), "source_" + i));
      targets.add(table(ns, topology.schemaB(), "target_" + i));
    }
    assertEdgeAbsent(topology.d1(), topology.d2());

    CyclicBarrier start = new CyclicBarrier(writers);
    List<CompletableFuture<Void>> adds = new ArrayList<>();
    for (int i = 0; i < writers; i++) {
      Table source = sources.get(i);
      Table target = targets.get(i);
      adds.add(
          CompletableFuture.runAsync(
              () -> {
                await(start);
                putEdge(source, target);
              },
              WRITERS));
    }
    CompletableFuture.allOf(adds.toArray(CompletableFuture[]::new)).get(FINISHES_SECONDS, SECONDS);

    assertEquals(writers, assetEdges(topology.d1(), topology.d2()));
  }

  private static void await(CyclicBarrier barrier) {
    try {
      barrier.await(FINISHES_SECONDS, SECONDS);
    } catch (Exception e) {
      throw new IllegalStateException("The writers did not start together", e);
    }
  }

  /**
   * Service A (domain D1) holds t0 and t1, service B (domain D2) holds the target; D3 is where
   * service A moves. The edges are written by each test.
   */
  private record Topology(
      DatabaseService serviceA,
      DatabaseService serviceB,
      DatabaseSchema schemaA,
      DatabaseSchema schemaB,
      Table t0,
      Table t1,
      Table target,
      Domain d1,
      Domain d2,
      Domain d3) {

    static Topology create(TestNamespace ns) {
      DatabaseService serviceA = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseService serviceB = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schemaA = DatabaseSchemaTestFactory.createSimple(ns, serviceA);
      DatabaseSchema schemaB = DatabaseSchemaTestFactory.createSimple(ns, serviceB);
      Domain d1 = domain(ns, "d1");
      Domain d2 = domain(ns, "d2");
      setDomains(client().databaseServices(), serviceA.getId(), d1);
      setDomains(client().databaseServices(), serviceB.getId(), d2);
      return new Topology(
          serviceA,
          serviceB,
          schemaA,
          schemaB,
          table(ns, schemaA, "t0"),
          table(ns, schemaA, "t1"),
          table(ns, schemaB, "target"),
          d1,
          d2,
          domain(ns, "d3"));
    }
  }

  /**
   * Runs the first write until it reaches a checkpoint, starts the second, records whether the
   * second finished while the first held its locks, then lets the first go and waits for both. The
   * tests assert the counts first, so a run without the locks fails on what they leave behind.
   */
  private record Interleaving(
      Stage stage,
      UUID subjectId,
      CountDownLatch reached,
      CountDownLatch released,
      AtomicBoolean secondFinishedEarly) {

    static Interleaving stopFirstAt(Stage stage, UUID subjectId) {
      return new Interleaving(
          stage, subjectId, new CountDownLatch(1), new CountDownLatch(1), new AtomicBoolean());
    }

    void run(Runnable first, Runnable second) throws Exception {
      try (AutoCloseable checkpoint = LineageDomainCoordinator.onCheckpoint(this::stopAtStage)) {
        CompletableFuture<Void> firstWrite = CompletableFuture.runAsync(first, WRITERS);
        assertTrue(
            reached.await(FINISHES_SECONDS, SECONDS),
            "the first write did not reach " + stage + " for " + subjectId);
        CompletableFuture<Void> secondWrite = CompletableFuture.runAsync(second, WRITERS);
        try {
          secondFinishedEarly.set(finishesWithin(secondWrite));
        } finally {
          released.countDown();
        }
        firstWrite.get(FINISHES_SECONDS, SECONDS);
        secondWrite.get(FINISHES_SECONDS, SECONDS);
      } finally {
        released.countDown();
      }
    }

    void assertSecondWaitedForFirst() {
      assertFalse(
          secondFinishedEarly.get(), "the second write finished while the first held its locks");
    }

    private static boolean finishesWithin(CompletableFuture<Void> write) throws Exception {
      boolean finished = true;
      try {
        write.get(WAITS_FOR_THE_FIRST_MILLIS, MILLISECONDS);
      } catch (TimeoutException e) {
        finished = false;
      }
      return finished;
    }

    private void stopAtStage(LineageDomainCoordinator.Checkpoint checkpoint) {
      if (checkpoint.stage() == stage && checkpoint.subjectId().equals(subjectId)) {
        reached.countDown();
        try {
          released.await(FINISHES_SECONDS, SECONDS);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
        }
      }
    }
  }
}
