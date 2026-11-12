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

  /** #36440: changes made while RDF is off never reach the graph, so it must be rebuilt. */
  @Test
  @Order(3)
  void aStartWithRdfOffDegradesTheProjectionUntilTheNextStartRebuildsIt() {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "Run with the RDF integration-test profile");
    awaitReady();
    final int runsBefore = startupRuns().size();
    final RdfLiveWriteStore health = new RdfLiveWriteStore(Entity.getJdbi(), Clock.systemUTC());

    health.recordRdfDisabled();
    try {
      assertEquals(RdfProjectionState.DEGRADED, projectionState());

      enqueueAsServerStartDoes();
      awaitReady();
      enqueueAsServerStartDoes();

      assertEquals(runsBefore + 1, startupRuns().size());
    } finally {
      // A rebuild that failed here must not leave every later RDF test DEGRADED.
      health.markRebuilt(health.failureVersion());
    }
  }

  private static void enqueueAsServerStartDoes() {
    final App app =
        ((AppRepository) Entity.getEntityRepository(Entity.APPLICATION))
            .findByNameOrNull(APP_NAME, Include.ALL);
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
    return Entity.getCollectionDAO()
        .appExtensionTimeSeriesDao()
        .listAppExtensionByName(APP_NAME, 1000, 0, AppExtension.ExtensionType.STATUS.toString())
        .stream()
        .map(json -> JsonUtils.readValue(json, AppRunRecord.class))
        .filter(run -> RdfInitialIndexRun.TRIGGERED_BY.equals(run.getTriggeredBy()))
        .toList();
  }

  private static RdfProjectionState projectionState() {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/rdf/status", null, RdfStatus.class)
        .getProjectionState();
  }
}
