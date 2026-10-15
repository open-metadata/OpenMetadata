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

import java.time.Duration;
import org.awaitility.Awaitility;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Runs the scheduled search repair now, through the admin-only test-support endpoint, instead of
 * waiting for its next pass. A pass that another server, or the scheduler, is running holds the
 * repair lock; the call is retried until this one runs.
 */
public final class SearchRepairPasses {
  private static final Duration PASS_WAIT = Duration.ofMinutes(5);

  private SearchRepairPasses() {}

  /** Runs a pass that also checks rows changed moments ago. */
  public static void run() {
    run(false);
  }

  /**
   * Runs a pass that also checks rows changed moments ago.
   *
   * @param sweep also delete the documents whose rows are gone
   */
  public static void run(final boolean sweep) {
    QueuedSearchWrites.await();
    final String path = "/v1/test-support/search/repair?settleSeconds=0&sweep=" + sweep;
    Awaitility.await("A search repair pass runs")
        .atMost(PASS_WAIT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(() -> ranPass(path));
    QueuedSearchWrites.await();
  }

  /**
   * Asks for one pass and reports whether this server ran it; {@code false} while another server
   * holds the repair lock.
   */
  public static boolean tryRun() {
    return ranPass("/v1/test-support/search/repair?settleSeconds=0&sweep=false");
  }

  private static boolean ranPass(final String path) {
    final String response =
        OssTestServer.defaultHandle()
            .sdk()
            .getHttpClient()
            .executeForString(HttpMethod.POST, path, null);
    return JsonUtils.readTree(response).path("ran").asBoolean();
  }
}
