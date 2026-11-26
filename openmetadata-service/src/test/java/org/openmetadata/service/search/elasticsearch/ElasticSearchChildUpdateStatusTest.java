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

package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import es.co.elastic.clients.elasticsearch.tasks.GetTasksResponse;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonParser;
import java.io.StringReader;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.EntityManagementClient.ChildUpdateStatus;

class ElasticSearchChildUpdateStatusTest {
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
    ChildUpdateStatus status =
        statusOf(
            """
            {"completed": true, %s, "response": {"updated": 0, "version_conflicts": 0,
              "timed_out": false, "failures": [{"index": "table_search_index",
              "cause": {"type": "es_rejected_execution_exception", "reason": "rejected"}}]}}"""
                .formatted(TASK));

    assertTrue(status.failed());
  }

  @Test
  void versionConflictsAreNotAFailure() {
    ChildUpdateStatus status =
        statusOf(
            """
            {"completed": true, %s, "response": {"updated": 2, "version_conflicts": 1,
              "timed_out": false, "failures": []}}"""
                .formatted(TASK));

    assertTrue(status.finished());
    assertFalse(status.failed());
  }

  @Test
  void aRunningTaskHasNotFinished() {
    assertFalse(statusOf("{\"completed\": false, %s}".formatted(TASK)).finished());
  }

  private static ChildUpdateStatus statusOf(String json) {
    JacksonJsonpMapper mapper = new JacksonJsonpMapper();
    try (JsonParser parser = mapper.jsonProvider().createParser(new StringReader(json))) {
      return ElasticSearchEntityManager.childUpdateStatusOf(
          GetTasksResponse._DESERIALIZER.deserialize(parser, mapper));
    }
  }
}
