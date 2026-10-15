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
package org.openmetadata.it.util;

import java.time.Clock;
import java.time.Duration;
import org.awaitility.Awaitility;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfLiveWriteStore;

/**
 * Runs the scheduled RDF repair now, through the admin-only test-support endpoint, instead of
 * waiting for its next pass. A pass another server, or the scheduler, runs holds the repair lock;
 * the call is retried until this one runs. The repair queues its fixes on the live write queue, so
 * the call then waits for that queue to drain.
 */
public final class RdfRepairPasses {
  private static final Duration PASS_WAIT = Duration.ofMinutes(5);
  private static final String REPAIR_PATH = "/v1/test-support/rdf/repair?settleSeconds=0&sweep=";

  private RdfRepairPasses() {}

  /**
   * Runs a pass that also checks entities changed moments ago, and waits for its fixes.
   *
   * @param sweep also remove the entities whose rows are gone
   */
  public static void run(final boolean sweep) {
    Awaitility.await("An RDF repair pass runs")
        .atMost(PASS_WAIT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(() -> ranPass(sweep));
    final RdfLiveWriteStore liveWrites = new RdfLiveWriteStore(Entity.getJdbi(), Clock.systemUTC());
    Awaitility.await("The RDF repair's fixes are applied")
        .atMost(PASS_WAIT)
        .pollInterval(Duration.ofMillis(500))
        .until(() -> liveWrites.pendingWrites() == 0);
  }

  /** Asks for one pass; false while another server holds the repair lock. */
  public static boolean tryRun() {
    return ranPass(false);
  }

  private static boolean ranPass(final boolean sweep) {
    final String response =
        OssTestServer.defaultHandle()
            .sdk()
            .getHttpClient()
            .executeForString(HttpMethod.POST, REPAIR_PATH + sweep, null);
    return JsonUtils.readTree(response).path("ran").asBoolean();
  }
}
