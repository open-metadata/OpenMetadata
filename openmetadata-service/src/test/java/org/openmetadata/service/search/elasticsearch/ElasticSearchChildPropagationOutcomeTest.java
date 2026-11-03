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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import es.co.elastic.clients.elasticsearch.tasks.GetTasksResponse;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonParser;
import java.io.StringReader;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.ChildPropagationWatcher.TaskOutcome;

class ElasticSearchChildPropagationOutcomeTest {
  private static final String TASK =
      """
      "task": {"node": "n1", "id": 7, "type": "transport",
        "action": "indices:data/write/update/byquery", "start_time_in_millis": 0,
        "running_time_in_nanos": 0, "cancellable": true, "headers": {}}""";

  @Test
  void aTaskWithShardFailuresLeftChildrenStale() {
    TaskOutcome outcome =
        outcomeOf(
            """
            {"completed": true, %s, "response": {"updated": 0, "version_conflicts": 0,
              "timed_out": false, "failures": [{"index": "table_search_index",
              "cause": {"type": "es_rejected_execution_exception", "reason": "rejected"}}]}}"""
                .formatted(TASK));

    assertTrue(outcome.finished());
    assertEquals(1, outcome.failureReasons().size());
    assertTrue(outcome.failureReasons().getFirst().contains("es_rejected_execution_exception"));
  }

  @Test
  void aTaskThatErroredLeftChildrenStale() {
    TaskOutcome outcome =
        outcomeOf(
            """
            {"completed": true, %s, "error": {"type": "search_phase_execution_exception",
              "reason": "Partial shards failure"}}"""
                .formatted(TASK));

    assertEquals(List.of("Partial shards failure"), outcome.failureReasons());
  }

  @Test
  void versionConflictsAreCounted() {
    TaskOutcome outcome =
        outcomeOf(
            """
            {"completed": true, %s, "response": {"updated": 3, "version_conflicts": 2,
              "timed_out": false, "failures": []}}"""
                .formatted(TASK));

    assertTrue(outcome.failureReasons().isEmpty());
    assertEquals(2, outcome.versionConflicts());
  }

  @Test
  void aTaskStillRunningHasNoOutcomeYet() {
    TaskOutcome outcome = outcomeOf("{\"completed\": false, %s}".formatted(TASK));

    assertFalse(outcome.finished());
  }

  private static TaskOutcome outcomeOf(String json) {
    JacksonJsonpMapper mapper = new JacksonJsonpMapper();
    try (JsonParser parser = mapper.jsonProvider().createParser(new StringReader(json))) {
      return ElasticSearchEntityManager.childPropagationOutcome(
          GetTasksResponse._DESERIALIZER.deserialize(parser, mapper));
    }
  }
}
