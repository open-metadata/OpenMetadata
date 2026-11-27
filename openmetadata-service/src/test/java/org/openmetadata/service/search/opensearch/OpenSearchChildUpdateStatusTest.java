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

package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.json.stream.JsonParser;
import java.io.StringReader;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.EntityManagementClient.ChildUpdateStatus;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.tasks.GetTasksResponse;

class OpenSearchChildUpdateStatusTest {
  private static final String TASK =
      """
      "task": {"node": "n1", "id": 7, "type": "transport", "action": "indices:data/write/update/byquery", "start_time_in_millis": 0, "running_time_in_nanos": 0, "cancellable": true, "headers": {}}""";

  @Test
  void aTaskFailedOnRefusedScrollsReportsTheNestedCause() {
    ChildUpdateStatus status =
        statusOf(
            """
            {"completed": true, %s, "error": {"type": "search_phase_execution_exception",
              "reason": "Partial shards failure", "caused_by": {
                "type": "too_many_scroll_contexts_exception",
                "reason": "Trying to create too many scroll contexts"}}}"""
                .formatted(TASK));

    assertTrue(status.failed());
    assertTrue(status.failure().contains("too_many_scroll_contexts_exception"), status.failure());
  }

  @Test
  void documentFailuresFailTheTask() {
    assertTrue(
        statusOf(
                response(
                    "1",
                    "[{\"index\": \"t\", \"id\": \"x\", \"status\": 429, \"cause\": {\"type\": \"rejected_execution_exception\", \"reason\": \"rejected\"}}]"))
            .failed());
  }

  @Test
  void versionConflictsAreNotAFailure() {
    ChildUpdateStatus status = statusOf(response("2", "[]"));

    assertTrue(status.finished());
    assertFalse(status.failed());
  }

  @Test
  void aRunningTaskHasNotFinished() {
    assertFalse(statusOf("{\"completed\": false, %s}".formatted(TASK)).finished());
  }

  private static String response(String versionConflicts, String failures) {
    return """
        {"completed": true, %s, "response": {"took": 5, "timed_out": false, "total": 3,
          "updated": 1, "deleted": 0, "batches": 1, "version_conflicts": %s, "noops": 0,
          "retries": {"bulk": 0, "search": 0}, "throttled_millis": 0,
          "requests_per_second": -1.0, "throttled_until_millis": 0, "failures": %s}}"""
        .formatted(TASK, versionConflicts, failures);
  }

  private static ChildUpdateStatus statusOf(String json) {
    JacksonJsonpMapper mapper = new JacksonJsonpMapper();
    try (JsonParser parser = mapper.jsonProvider().createParser(new StringReader(json))) {
      return OpenSearchEntityManager.childUpdateStatusOf(
          GetTasksResponse._DESERIALIZER.deserialize(parser, mapper));
    }
  }
}
