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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.api.parallel.Resources;
import org.openmetadata.schema.api.configuration.rdf.InferenceMaterializationResult;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.inference.InferenceGraphStore;
import org.openmetadata.service.rdf.inference.InferenceMaterializer;
import org.openmetadata.service.rdf.inference.InferenceRuleRepository;
import org.openmetadata.service.rdf.inference.InferenceRunInProgressException;
import org.openmetadata.service.rdf.inference.InferenceRunLock;
import org.openmetadata.service.rdf.storage.RdfWriteOutcomeUnknownException;

/**
 * Two OpenMetadata servers sharing one database and one Fuseki dataset, each with its own
 * materializer, against the real lock and rule tables on MySQL and Postgres. Each test uses its own
 * lock key, so the server's scheduled run cannot hold the lease these servers contend for.
 */
@Tag("rdf")
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
// Every RDF write through the server marks all rules dirty, so whether a run cleared a rule's dirty
// flag is only observable while no other test is writing.
@ResourceLock(value = Resources.GLOBAL, mode = ResourceAccessMode.READ_WRITE)
public class RdfInferenceMultiServerIT {
  private static final String SERVER_A = "server-a";
  private static final String SERVER_B = "server-b";

  private RdfReindexLockDAO locks;
  private InferenceRuleRepository rules;
  private InferenceGraphStore fuseki;
  private String lockKey;
  private String ruleName;

  @BeforeEach
  void connect() {
    final RdfRepository rdf = RdfRepository.getInstance();
    locks = Entity.getCollectionDAO().rdfReindexLockDAO();
    rules =
        new InferenceRuleRepository(
            Entity.getCollectionDAO().rdfInferenceRuleDAO(), Clock.systemUTC(), rdf.getBaseUri());
    fuseki = InferenceGraphStore.forRepository(rdf);
    assertTrue(fuseki.isAvailable(), "The RDF lane runs Fuseki with materialized inference");
    lockKey = "RdfInferenceMultiServerIT-" + UUID.randomUUID();
    ruleName = "multi-server-" + UUID.randomUUID().toString().substring(0, 8);
    rules.upsert(ruleName, ruleMatchingNothing());
  }

  @AfterEach
  void cleanUp() {
    locks.delete(lockKey);
    rules.delete(ruleName);
    materializer(SERVER_A, fuseki).materialize(true, null);
  }

  @Test
  void aSecondServerCannotStartARunWhileTheFirstIsRunning() {
    final CountingStore serverBStore = new CountingStore(fuseki);
    final AtomicReference<RuntimeException> serverBOutcome = new AtomicReference<>();
    final InferenceGraphStore serverAStore =
        new InterceptingStore(
            fuseki,
            () -> {
              try {
                materializer(SERVER_B, serverBStore).materialize(true, null);
              } catch (RuntimeException exception) {
                serverBOutcome.set(exception);
              }
            });

    final InferenceMaterializationResult serverA =
        materializer(SERVER_A, serverAStore).materialize(true, null);

    assertEquals(0, serverA.getFailedRules());
    assertInstanceOf(InferenceRunInProgressException.class, serverBOutcome.get());
    assertEquals(0, serverBStore.updates.get(), "The refused run must not touch Fuseki");
    assertEquals(0, materializer(SERVER_B, fuseki).materialize(true, null).getFailedRules());
  }

  @Test
  void aRuleEditedOnAnotherServerDuringARunStaysDirtyForTheNextRun() {
    final InferenceGraphStore serverAStore =
        new InterceptingStore(fuseki, () -> rules.upsert(ruleName, ruleMatchingNothing()));

    assertEquals(0, materializer(SERVER_A, serverAStore).materialize(false, null).getFailedRules());
    assertTrue(rules.get(ruleName).getDirty(), "Server B's edit landed after the run read it");

    assertEquals(0, materializer(SERVER_A, fuseki).materialize(false, null).getFailedRules());
    assertFalse(rules.get(ruleName).getDirty());
  }

  @Test
  void aRunThatGaveUpOnAnUpdateHoldsOffOtherServersUntilItsLeaseExpires() {
    final InferenceGraphStore timingOut = new TimingOutStore(fuseki);

    final InferenceMaterializationResult serverA =
        materializer(SERVER_A, timingOut).materialize(true, null);

    assertTrue(serverA.getFailedRules() > 0);
    final RdfReindexLockDAO.RdfReindexLockRecord lease = locks.findByKey(lockKey);
    assertNotNull(lease, "Fuseki may still be applying the update server A gave up on");
    assertEquals(SERVER_A, lease.serverId());
    assertThrows(
        InferenceRunInProgressException.class,
        () -> materializer(SERVER_B, fuseki).materialize(true, null));

    final long expired = System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(1);
    locks.updateHeartbeat(lockKey, lease.jobId(), expired, expired);
    assertEquals(0, materializer(SERVER_B, fuseki).materialize(true, null).getFailedRules());
  }

  private InferenceMaterializer materializer(
      final String serverId, final InferenceGraphStore store) {
    return new InferenceMaterializer(
        store, rules, InferenceRunLock.forCluster(locks, lockKey, serverId), Clock.systemUTC());
  }

  private InferenceRule ruleMatchingNothing() {
    return new InferenceRule()
        .withName(ruleName)
        .withRuleType(InferenceRule.RuleType.CONSTRUCT)
        .withRuleBody(
            "CONSTRUCT { ?s <urn:%1$s:derived> ?o } WHERE { ?s <urn:%1$s:asserted> ?o }"
                .formatted(ruleName))
        .withPriority(100)
        .withEnabled(true);
  }

  /** Fuseki as one server sees it, with another server acting during the first rule update. */
  private static final class InterceptingStore implements InferenceGraphStore {
    private final InferenceGraphStore fuseki;
    private Runnable duringFirstInsert;

    private InterceptingStore(final InferenceGraphStore fuseki, final Runnable duringFirstInsert) {
      this.fuseki = fuseki;
      this.duringFirstInsert = duringFirstInsert;
    }

    @Override
    public boolean isAvailable() {
      return fuseki.isAvailable();
    }

    @Override
    public void update(final String sparqlUpdate) {
      fuseki.update(sparqlUpdate);
      if (sparqlUpdate.contains("INSERT")) {
        final Runnable action = duringFirstInsert;
        duringFirstInsert = () -> {};
        action.run();
      }
    }

    @Override
    public long tripleCount(final String graphUri) {
      return fuseki.tripleCount(graphUri);
    }
  }

  private static final class CountingStore implements InferenceGraphStore {
    private final InferenceGraphStore fuseki;
    private final AtomicInteger updates = new AtomicInteger();

    private CountingStore(final InferenceGraphStore fuseki) {
      this.fuseki = fuseki;
    }

    @Override
    public boolean isAvailable() {
      return fuseki.isAvailable();
    }

    @Override
    public void update(final String sparqlUpdate) {
      updates.incrementAndGet();
      fuseki.update(sparqlUpdate);
    }

    @Override
    public long tripleCount(final String graphUri) {
      return fuseki.tripleCount(graphUri);
    }
  }

  /** Sends rule updates to Fuseki but stops waiting for them, as at OM's request timeout. */
  private static final class TimingOutStore implements InferenceGraphStore {
    private final InferenceGraphStore fuseki;

    private TimingOutStore(final InferenceGraphStore fuseki) {
      this.fuseki = fuseki;
    }

    @Override
    public boolean isAvailable() {
      return fuseki.isAvailable();
    }

    @Override
    public void update(final String sparqlUpdate) {
      fuseki.update(sparqlUpdate);
      if (sparqlUpdate.contains("INSERT")) {
        throw new RdfWriteOutcomeUnknownException(
            "executeSparqlUpdate", new TimeoutException("request timed out"));
      }
    }

    @Override
    public long tripleCount(final String graphUri) {
      return fuseki.tripleCount(graphUri);
    }
  }
}
