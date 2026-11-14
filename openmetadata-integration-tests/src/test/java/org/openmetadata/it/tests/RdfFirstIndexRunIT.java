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
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.schema.api.rdf.RdfStatus;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.ConflictException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.rdf.RdfInitialIndexRun;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.rdf.RdfLiveWriteStore;

/**
 * The suite server starts on an empty catalog with RDF on, so the startup hook has already queued
 * the first RdfIndexApp run by the time this class runs.
 */
@Isolated
// The first two cases count the start-up runs of a server that never ran with RDF off.
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class RdfFirstIndexRunIT {
  private static final String APP_NAME = "RdfIndexApp";
  private static final Set<AppRunRecord.Status> COMPLETED =
      Set.of(AppRunRecord.Status.SUCCESS, AppRunRecord.Status.COMPLETED);

  @Test
  @Order(1)
  void firstStartQueuesExactlyOneRunAndTheProjectionBecomesReady() {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "Run with the RDF integration-test profile");

    Awaitility.await("first-start run record")
        .atMost(Duration.ofMinutes(2))
        .until(() -> !startupRuns().isEmpty());
    awaitReady();

    assertEquals(1, startupRuns().size());
  }

  @Test
  @Order(2)
  void reinstallingAfterTheFirstRunQueuesNoSecondRun() {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "Run with the RDF integration-test profile");
    Awaitility.await("first-start run record")
        .atMost(Duration.ofMinutes(2))
        .until(() -> !startupRuns().isEmpty());

    enqueueAsServerStartDoes();
    enqueueAsServerStartDoes();

    assertEquals(1, startupRuns().size());
  }

  /**
   * #36440: changes made while RDF is off never reach the graph. The mark degrades the projection
   * and nothing queues the rebuild; an explicit full rebuild is what repairs it.
   */
  @Test
  @Order(3)
  void aStartWithRdfOffDegradesTheProjectionAndOnlyAnExplicitFullRebuildRepairsIt() {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "Run with the RDF integration-test profile");
    awaitReady();
    final int runsBefore = allRuns().size();
    final RdfLiveWriteStore health = new RdfLiveWriteStore(Entity.getJdbi(), Clock.systemUTC());

    health.recordRdfDisabled();
    try {
      assertEquals(RdfProjectionState.DEGRADED, projectionState());

      enqueueAsServerStartDoes();
      assertEquals(runsBefore, allRuns().size(), "the start-up hook queued a run");
      assertEquals(RdfProjectionState.DEGRADED, projectionState());

      final long floor = System.currentTimeMillis();
      triggerRun(true);
      awaitSuccessfulRunStartedAtOrAfter(floor);
      awaitReady();
    } finally {
      // A rebuild that failed here must not leave every later RDF test DEGRADED.
      health.markRebuilt(health.failureVersion());
    }
  }

  /** Only a rebuild of the entire projection brings back what was missed while RDF was off. */
  @Test
  @Order(4)
  void anIncrementalRunAfterAStartWithRdfOffLeavesTheProjectionDegraded() {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "Run with the RDF integration-test profile");
    awaitReady();
    final int runsBefore = startupRuns().size();
    final RdfLiveWriteStore health = new RdfLiveWriteStore(Entity.getJdbi(), Clock.systemUTC());

    health.recordRdfDisabled();
    try {
      final long floor = System.currentTimeMillis();
      triggerRun(false);
      awaitSuccessfulRunStartedAtOrAfter(floor);

      assertEquals(RdfProjectionState.DEGRADED, projectionState());

      enqueueAsServerStartDoes();
      assertEquals(runsBefore, startupRuns().size());
    } finally {
      health.markRebuilt(health.failureVersion());
    }
  }

  private static void triggerRun(final boolean recreateIndex) {
    Awaitility.await("trigger a " + APP_NAME + " run")
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreException(ConflictException.class)
        .until(
            () -> {
              SdkClients.adminClient()
                  .getHttpClient()
                  .execute(
                      HttpMethod.POST,
                      "/v1/apps/trigger/" + APP_NAME,
                      Map.of("recreateIndex", recreateIndex),
                      Void.class);
              return true;
            });
  }

  private static void awaitSuccessfulRunStartedAtOrAfter(final long floor) {
    Awaitility.await("run completed")
        .atMost(Duration.ofMinutes(5))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () ->
                allRuns().stream()
                    .anyMatch(
                        run ->
                            run.getStartTime() != null
                                && run.getStartTime() >= floor
                                && COMPLETED.contains(run.getStatus())));
  }

  // The start-up hook receives the app as AppResource loads it, bot included.
  private static void enqueueAsServerStartDoes() {
    final AppRepository repository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    final App app =
        repository.getByName(
            null, APP_NAME, repository.getFields("bot,pipelines"), Include.ALL, false);
    RdfInitialIndexRun.enqueueIfNeverRun(
        app, Entity.getCollectionDAO(), Entity.getSearchRepository());
  }

  private static void awaitReady() {
    Awaitility.await("projection READY")
        .atMost(Duration.ofMinutes(5))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(() -> assertEquals(RdfProjectionState.READY, projectionState()));
  }

  private static List<AppRunRecord> startupRuns() {
    return allRuns().stream()
        .filter(run -> RdfInitialIndexRun.TRIGGERED_BY.equals(run.getTriggeredBy()))
        .toList();
  }

  private static List<AppRunRecord> allRuns() {
    return Entity.getCollectionDAO()
        .appExtensionTimeSeriesDao()
        .listAppExtensionByName(APP_NAME, 1000, 0, AppExtension.ExtensionType.STATUS.toString())
        .stream()
        .map(json -> JsonUtils.readValue(json, AppRunRecord.class))
        .toList();
  }

  private static RdfProjectionState projectionState() {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/rdf/status", null, RdfStatus.class)
        .getProjectionState();
  }
}
