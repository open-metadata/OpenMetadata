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

import java.io.IOException;
import java.time.Duration;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * Search is eventually consistent: the server applies an API call's search writes after the call
 * returns, without forcing a refresh. A test that reads search right after a write waits here
 * first, until the server has applied every search write queued before the wait, fan-outs and
 * their update-by-query tasks included, and refreshed its indexes. It does not cover writes handed
 * to the retry queue; poll for those.
 */
public final class QueuedSearchWrites {
  private static final Duration TIMEOUT = Duration.ofMinutes(2);
  private static final String AWAIT_PATH =
      "/v1/test-support/search/queued-writes/await?timeoutSeconds=" + TIMEOUT.toSeconds();

  private QueuedSearchWrites() {}

  /** Waits until every search write the server queued before this call is applied and searchable. */
  public static void await() {
    if (!(OssTestServer.isExternalMode() ? awaitOnServer() : awaitInProcess())) {
      throw new AssertionError(
          "Search writes queued before this point were not applied within " + TIMEOUT);
    }
  }

  private static boolean awaitInProcess() {
    try {
      return Entity.getSearchRepository().awaitQueuedWritesSearchable(TIMEOUT);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new AssertionError("Interrupted waiting for queued search writes", interrupted);
    } catch (IOException refreshFailed) {
      throw new AssertionError("Could not refresh the search indexes", refreshFailed);
    }
  }

  private static boolean awaitOnServer() {
    final String response =
        OssTestServer.defaultHandle()
            .sdk()
            .getHttpClient()
            .executeForString(HttpMethod.POST, AWAIT_PATH, null);
    return JsonUtils.readTree(response).path("applied").asBoolean();
  }
}
