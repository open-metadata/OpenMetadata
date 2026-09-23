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

package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/** The test server starts on an empty database, as a fresh install does. */
class SystemAlertsIT {

  @Test
  void freshInstallHasBothSystemAlertsScheduled() {
    for (String name : List.of("ActivityFeedAlert", "WorkflowEventConsumer")) {
      JsonNode alert = JsonUtils.readTree(get("/v1/events/subscriptions/name/" + name));
      JsonNode scheduling =
          JsonUtils.readTree(
              get("/v1/events/subscriptions/id/" + alert.get("id").asText() + "/scheduling"));

      assertTrue(scheduling.get("enabled").asBoolean(), name);
      assertTrue(scheduling.get("jobClass").asText().endsWith("AlertPublisher"), name);
    }
  }

  private static String get(String path) {
    return SdkClients.adminClient()
        .getHttpClient()
        .executeForString(HttpMethod.GET, path, null, RequestOptions.builder().build());
  }
}
