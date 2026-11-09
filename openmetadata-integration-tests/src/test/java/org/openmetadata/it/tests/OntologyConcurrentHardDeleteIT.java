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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.OntologyConceptType;

/**
 * Two large ontologies purged at the same moment must both succeed without a deadlock: the rows of
 * one ontology must never be locked by the other's recursive hard delete. Runs in the global-state
 * lane because the deadlock counter is database-wide. MySQL only; PostgreSQL has no gap locks.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyConcurrentHardDeleteIT extends BaseOntologyApprovalIT {
  private static final int CONCEPTS_PER_ONTOLOGY = 400;
  private static final int SEED_THREADS = 16;
  private static final int ROUNDS = 3;

  @Test
  void concurrentRecursiveHardDeletesOfLargeOntologiesBothSucceed(TestNamespace ns)
      throws Exception {
    assumeTrue(databaseUrl().startsWith("jdbc:mysql"), "InnoDB deadlocks need MySQL");
    for (int round = 0; round < ROUNDS; round++) {
      final Ontology first = seed(ns, "purgeA" + round);
      final Ontology second = seed(ns, "purgeB" + round);
      final List<String> firstIds = idsOf(first);
      final List<String> secondIds = idsOf(second);
      assertEquals(CONCEPTS_PER_ONTOLOGY + 1, firstIds.size());
      assertTrue(relationshipRows(firstIds) >= CONCEPTS_PER_ONTOLOGY);

      final long deadlocksBefore = deadlocks();
      final CountDownLatch start = new CountDownLatch(1);
      final ExecutorService pool = Executors.newFixedThreadPool(2);
      try {
        final CompletableFuture<Integer> deletingFirst = purge(pool, start, first);
        final CompletableFuture<Integer> deletingSecond = purge(pool, start, second);
        start.countDown();

        assertEquals(200, deletingFirst.get(), "first purge, round " + round);
        assertEquals(200, deletingSecond.get(), "second purge, round " + round);
      } finally {
        pool.shutdownNow();
      }

      assertEquals(deadlocksBefore, deadlocks(), "deadlocks while purging, round " + round);
      assertEquals(0, relationshipRows(firstIds));
      assertEquals(0, relationshipRows(secondIds));
    }
  }

  private static CompletableFuture<Integer> purge(
      ExecutorService pool, CountDownLatch start, Ontology ontology) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            start.await();
            SdkClients.adminClient()
                .ontologies()
                .delete(
                    ontology.getId().toString(), Map.of("recursive", "true", "hardDelete", "true"));
            return 200;
          } catch (org.openmetadata.sdk.exceptions.OpenMetadataException e) {
            return e.getStatusCode();
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
          }
        },
        pool);
  }

  private static Ontology seed(TestNamespace ns, String name) throws Exception {
    final Ontology ontology =
        SdkClients.adminClient().ontologies().create(request(ns).withName(ns.prefix(name)));
    final ExecutorService pool = Executors.newFixedThreadPool(SEED_THREADS);
    try {
      final List<CompletableFuture<?>> creating = new ArrayList<>();
      IntStream.range(0, CONCEPTS_PER_ONTOLOGY)
          .forEach(
              index ->
                  creating.add(CompletableFuture.runAsync(() -> declare(ontology, index), pool)));
      for (CompletableFuture<?> created : creating) {
        created.get();
      }
    } finally {
      pool.shutdownNow();
    }
    return ontology;
  }

  private static void declare(Ontology ontology, int index) {
    SdkClients.adminClient()
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withOntology(ontology.getFullyQualifiedName())
                .withName("Concept" + index)
                .withIri(URI.create(ontology.getNamespace() + "C" + index))
                .withConceptType(OntologyConceptType.OWL_CLASS));
  }

  private static List<String> idsOf(Ontology ontology) {
    final List<String> ids = new ArrayList<>();
    ids.add(ontology.getId().toString());
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT toId FROM entity_relationship WHERE fromId = :id "
                            + "AND toEntity = 'ontologyConcept'")
                    .bind("id", ontology.getId().toString())
                    .mapTo(String.class)
                    .forEach(ids::add));
    return ids;
  }

  private static String databaseUrl() throws Exception {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(handle -> handle.getConnection().getMetaData().getURL());
  }

  /**
   * The server retries a deadlocked purge, so a green response alone would hide the lock-order
   * defect. InnoDB counts every deadlock it resolves, which needs the PROCESS privilege of root.
   */
  private static long deadlocks() throws Exception {
    return Jdbi.create(databaseUrl(), "root", "test")
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT FROM information_schema.INNODB_METRICS "
                            + "WHERE NAME = 'lock_deadlocks'")
                    .mapTo(Long.class)
                    .one());
  }

  private static long relationshipRows(List<String> ids) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM entity_relationship "
                            + "WHERE fromId IN (<ids>) OR toId IN (<ids>)")
                    .bindList("ids", ids)
                    .mapTo(Long.class)
                    .one());
  }
}
