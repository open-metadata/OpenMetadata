/*
 *  Copyright 2021 Collate
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IngestionPipelineStatusParserTest {

  private static String searchResponse(String pipelineStatusesJson) {
    return searchResponse(pipelineStatusesJson, "true");
  }

  private static String searchResponse(String pipelineStatusesJson, String enabledJson) {
    return """
        {
          "hits": {
            "hits": [
              {
                "_source": {
                  "id": "id-1",
                  "name": "pipeline_1",
                  "displayName": "Pipeline 1",
                  "fullyQualifiedName": "service.pipeline_1",
                  "pipelineType": "metadata",
                  "provider": "user",
                  "enabled": %s,
                  "pipelineStatuses": %s
                }
              }
            ]
          }
        }
        """
        .formatted(enabledJson, pipelineStatusesJson);
  }

  @Test
  void parse_readsStatusFromMostRecentOfArray() {
    String response =
        searchResponse(
            """
            [
              {"pipelineState": "success", "runId": "run-new"},
              {"pipelineState": "failed", "runId": "run-old"}
            ]
            """);

    List<Map> result = IngestionPipelineStatusParser.parse(response);

    assertEquals(1, result.size());
    assertEquals("success", result.getFirst().get("status"));
    assertEquals("service.pipeline_1", result.getFirst().get("fullyQualifiedName"));
  }

  @Test
  void parse_emptyArrayYieldsUnknownStatus() {
    String response = searchResponse("[]");

    List<Map> result = IngestionPipelineStatusParser.parse(response);

    assertEquals(1, result.size());
    assertEquals("unknown", result.getFirst().get("status"));
  }

  @Test
  void parse_missingStatusesYieldsUnknownStatus() {
    String response = searchResponse("null");

    List<Map> result = IngestionPipelineStatusParser.parse(response);

    assertEquals(1, result.size());
    assertEquals("unknown", result.getFirst().get("status"));
  }

  // A disabled pipeline keeps the state of the run it last completed, so the flag is what lets the
  // agents widget show it as disabled instead of as whatever it last did.
  @Test
  void parse_carriesTheEnabledFlag() {
    String response =
        searchResponse(
            """
            [{"pipelineState": "success"}]
            """,
            "false");

    List<Map> result = IngestionPipelineStatusParser.parse(response);

    assertEquals(1, result.size());
    assertEquals(Boolean.FALSE, result.getFirst().get("enabled"));
    assertEquals("success", result.getFirst().get("status"));
  }

  @Test
  void parse_noHitsYieldsEmptyList() {
    String response = """
        {"hits": {"hits": []}}
        """;

    List<Map> result = IngestionPipelineStatusParser.parse(response);

    assertTrue(result.isEmpty());
  }

  @Test
  void parse_invalidResponseYieldsEmptyList() {
    List<Map> result = IngestionPipelineStatusParser.parse("not-json");

    assertTrue(result.isEmpty());
  }
}
