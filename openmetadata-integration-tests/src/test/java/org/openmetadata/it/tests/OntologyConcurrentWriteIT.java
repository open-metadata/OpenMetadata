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
import static org.junit.jupiter.api.Assertions.assertNull;
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
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.sdk.services.ontology.OntologyPropertyService;

/**
 * Writers in different native ontologies share no lock: property writes with inverses in several
 * ontologies, and a recursive hard delete of one ontology beside writes to another, all commit
 * without InnoDB resolving a deadlock between them. Writers in one ontology still serialize, so
 * contested inverses stay an involution. Runs in the global-state lane because the deadlock counter
 * is database-wide. MySQL only; PostgreSQL has no gap locks.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyConcurrentWriteIT extends BaseOntologyApprovalIT {
  private static final int ONTOLOGIES = 6;
  private static final int PAIRS_PER_ONTOLOGY = 15;
  private static final int DELETE_ROUNDS = 3;
  private static final int SEEDED_PAIRS = 40;
  private static final int CONTENDERS = 8;

  @Test
  void inverseWritesInDifferentOntologiesCommitWithoutDeadlock(TestNamespace ns) throws Exception {
    assumeTrue(databaseUrl().startsWith("jdbc:mysql"), "InnoDB deadlocks need MySQL");
    final List<Ontology> ontologies =
        IntStream.range(0, ONTOLOGIES)
            .mapToObj(index -> createOntology(ns, "parallelWrites" + index))
            .toList();

    final long deadlocksBefore = deadlocks();
    final CountDownLatch start = new CountDownLatch(1);
    final ExecutorService pool = Executors.newFixedThreadPool(ONTOLOGIES);
    try {
      final List<CompletableFuture<List<Pair>>> writing = new ArrayList<>();
      for (final Ontology ontology : ontologies) {
        writing.add(
            CompletableFuture.supplyAsync(
                () -> writePairs(start, ontology, "p", PAIRS_PER_ONTOLOGY), pool));
      }
      start.countDown();
      for (final CompletableFuture<List<Pair>> pairs : writing) {
        pairs.get().forEach(OntologyConcurrentWriteIT::assertLinked);
      }
    } finally {
      pool.shutdownNow();
    }

    assertEquals(deadlocksBefore, deadlocks(), "deadlocks between ontology writers");
  }

  @Test
  void hardDeletingOneOntologyBesideWritesToAnotherCommitsWithoutDeadlock(TestNamespace ns)
      throws Exception {
    assumeTrue(databaseUrl().startsWith("jdbc:mysql"), "InnoDB deadlocks need MySQL");
    final Ontology written = createOntology(ns, "writtenBesideDelete");
    for (int round = 0; round < DELETE_ROUNDS; round++) {
      final Ontology deleted =
          SdkClients.adminClient()
              .ontologies()
              .create(request(ns).withName(ns.prefix("deletedBesideWrites" + round)));
      writePairs(new CountDownLatch(0), deleted, "seed", SEEDED_PAIRS);
      final List<String> deletedIds = idsOf(deleted);
      assertEquals(2 * SEEDED_PAIRS + 1, deletedIds.size());

      final String writtenName = "round" + round + "p";
      final long deadlocksBefore = deadlocks();
      final CountDownLatch start = new CountDownLatch(1);
      final ExecutorService pool = Executors.newFixedThreadPool(2);
      try {
        final CompletableFuture<Void> deleting =
            CompletableFuture.runAsync(() -> purge(start, deleted), pool);
        final CompletableFuture<List<Pair>> writing =
            CompletableFuture.supplyAsync(
                () -> writePairs(start, written, writtenName, PAIRS_PER_ONTOLOGY), pool);
        start.countDown();

        deleting.get();
        writing.get().forEach(OntologyConcurrentWriteIT::assertLinked);
      } finally {
        pool.shutdownNow();
      }

      assertEquals(deadlocksBefore, deadlocks(), "deadlocks beside a hard delete, round " + round);
      assertEquals(0, relationshipRows(deletedIds), "relationships of the deleted ontology");
    }
  }

  @Test
  void contestedInversesInOneOntologyStayAnInvolution(TestNamespace ns) throws Exception {
    final Ontology ontology = createOntology(ns, "contestedInverse");
    final OntologyPropertyService service = SdkClients.adminClient().ontologyProperties();
    final OntologyProperty target = service.create(property(ontology, "target"));

    final long deadlocksBefore = deadlocks();
    final CountDownLatch start = new CountDownLatch(1);
    final ExecutorService pool = Executors.newFixedThreadPool(CONTENDERS);
    final List<OntologyProperty> contenders = new ArrayList<>();
    try {
      final List<CompletableFuture<OntologyProperty>> creating = new ArrayList<>();
      for (int index = 0; index < CONTENDERS; index++) {
        final CreateOntologyProperty request =
            property(ontology, "contender" + index).withInverse(target.getIri());
        creating.add(CompletableFuture.supplyAsync(() -> create(start, request), pool));
      }
      start.countDown();
      for (final CompletableFuture<OntologyProperty> created : creating) {
        contenders.add(created.get());
      }
    } finally {
      pool.shutdownNow();
    }

    final URI winner = service.get(target.getId().toString()).getInverse();
    final List<URI> pointingAtTarget =
        contenders.stream()
            .map(contender -> service.get(contender.getId().toString()).getInverse())
            .filter(target.getIri()::equals)
            .toList();
    assertEquals(List.of(target.getIri()), pointingAtTarget, "one contender keeps the link");
    assertEquals(
        1,
        contenders.stream().filter(contender -> contender.getIri().equals(winner)).count(),
        "the target points back at a contender");
    assertEquals(deadlocksBefore, deadlocks(), "deadlocks between writers of one ontology");
  }

  private record Pair(OntologyProperty forward, OntologyProperty backward) {}

  private static List<Pair> writePairs(
      final CountDownLatch start, final Ontology ontology, final String name, final int count) {
    await(start);
    final OntologyPropertyService service = SdkClients.adminClient().ontologyProperties();
    final List<Pair> pairs = new ArrayList<>();
    for (int index = 0; index < count; index++) {
      final OntologyProperty forward = service.create(property(ontology, name + index + "To"));
      final OntologyProperty backward =
          service.create(property(ontology, name + index + "From").withInverse(forward.getIri()));
      pairs.add(new Pair(forward, backward));
    }
    return pairs;
  }

  private static void assertLinked(final Pair pair) {
    final OntologyPropertyService service = SdkClients.adminClient().ontologyProperties();
    assertEquals(
        pair.backward().getIri(),
        service.get(pair.forward().getId().toString()).getInverse(),
        "the reciprocal side of " + pair.forward().getFullyQualifiedName());
    assertEquals(
        pair.forward().getIri(),
        service.get(pair.backward().getId().toString()).getInverse(),
        "the stated side of " + pair.backward().getFullyQualifiedName());
  }

  private static OntologyProperty create(
      final CountDownLatch start, final CreateOntologyProperty request) {
    await(start);
    return SdkClients.adminClient().ontologyProperties().create(request);
  }

  private static void purge(final CountDownLatch start, final Ontology ontology) {
    await(start);
    SdkClients.adminClient()
        .ontologies()
        .delete(ontology.getId().toString(), Map.of("recursive", "true", "hardDelete", "true"));
    assertNull(
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT id FROM ontology_entity WHERE id = :id")
                        .bind("id", ontology.getId().toString())
                        .mapTo(String.class)
                        .findOne()
                        .orElse(null)),
        "the hard-deleted ontology row");
  }

  private static void await(final CountDownLatch start) {
    try {
      start.await();
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(interrupted);
    }
  }

  private static CreateOntologyProperty property(final Ontology ontology, final String name) {
    return new CreateOntologyProperty()
        .withName(name)
        .withOntology(ontology.getFullyQualifiedName())
        .withKind(OntologyPropertyKind.OBJECT)
        .withIri(URI.create(ontology.getNamespace() + "c" + ontology.getId() + "/" + name));
  }

  private static List<String> idsOf(final Ontology ontology) {
    final List<String> ids = new ArrayList<>();
    ids.add(ontology.getId().toString());
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT toId FROM entity_relationship WHERE fromId = :id "
                            + "AND toEntity = 'ontologyProperty'")
                    .bind("id", ontology.getId().toString())
                    .mapTo(String.class)
                    .forEach(ids::add));
    return ids;
  }

  private static long relationshipRows(final List<String> ids) {
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

  private static boolean isMysql() throws Exception {
    return databaseUrl().startsWith("jdbc:mysql");
  }

  private static String databaseUrl() throws Exception {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(handle -> handle.getConnection().getMetaData().getURL());
  }

  /**
   * The server retries a deadlocked transaction, so a green response alone would hide the lock
   * conflict. InnoDB counts every deadlock it resolves, which needs the PROCESS privilege of root.
   */
  private static long deadlocks() throws Exception {
    return isMysql()
        ? Jdbi.create(databaseUrl(), "root", "test")
            .withHandle(
                handle ->
                    handle
                        .createQuery(
                            "SELECT COUNT FROM information_schema.INNODB_METRICS "
                                + "WHERE NAME = 'lock_deadlocks'")
                        .mapTo(Long.class)
                        .one())
        : 0L;
  }
}
