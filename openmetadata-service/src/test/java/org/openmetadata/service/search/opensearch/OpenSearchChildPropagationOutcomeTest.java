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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.json.stream.JsonParser;
import java.io.StringReader;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.ChildPropagationWatcher.TaskOutcome;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.tasks.GetTasksResponse;

class OpenSearchChildPropagationOutcomeTest {
  private static final String TASK =
      """
      "task": {"node": "n1", "id": 7, "type": "transport",
        "action": "indices:data/write/update/byquery", "start_time_in_millis": 0,
        "running_time_in_nanos": 0, "cancellable": true, "headers": {}}""";

  @Test
  void aTaskWithShardFailuresLeftChildrenStale() {
    TaskOutcome outcome =
        outcomeOf(
            response(
                "0",
                """
                [{"index": "table_search_index", "id": "x", "status": 429,
                  "cause": {"type": "rejected_execution_exception", "reason": "rejected"}}]"""));

    assertTrue(outcome.finished());
    assertEquals(1, outcome.failureReasons().size());
  }

  @Test
  void versionConflictsAreCounted() {
    TaskOutcome outcome = outcomeOf(response("2", "[]"));

    assertTrue(outcome.failureReasons().isEmpty());
    assertEquals(2, outcome.versionConflicts());
  }

  @Test
  void aTaskStillRunningHasNoOutcomeYet() {
    TaskOutcome outcome = outcomeOf("{\"completed\": false, %s}".formatted(TASK));

    assertFalse(outcome.finished());
  }

  private static String response(String versionConflicts, String failures) {
    return """
        {"completed": true, %s, "response": {"took": 5, "timed_out": false, "total": 3,
          "updated": 1, "deleted": 0, "batches": 1, "version_conflicts": %s, "noops": 0,
          "retries": {"bulk": 0, "search": 0}, "throttled_millis": 0,
          "requests_per_second": -1.0, "throttled_until_millis": 0, "failures": %s}}"""
        .formatted(TASK, versionConflicts, failures);
  }

  private static TaskOutcome outcomeOf(String json) {
    JacksonJsonpMapper mapper = new JacksonJsonpMapper();
    try (JsonParser parser = mapper.jsonProvider().createParser(new StringReader(json))) {
      return OpenSearchEntityManager.childPropagationOutcome(
          GetTasksResponse._DESERIALIZER.deserialize(parser, mapper));
    }
  }
}
