/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class IngestionPipelineIndexTest {

  private static SearchRepository previousRepository;

  @BeforeAll
  static void initSearchRepository() {
    previousRepository = Entity.getSearchRepository();
    Entity.setSearchRepository(mock(SearchRepository.class));
  }

  @AfterAll
  static void restoreSearchRepository() {
    Entity.setSearchRepository(previousRepository);
  }

  /** Fields the {@code pipelineStatuses} index mapping declares; nothing else may reach the doc. */
  private static final Set<String> MAPPED_STATUS_FIELDS =
      Set.of("runId", "pipelineState", "timestamp", "startDate", "endDate");

  @Test
  void buildDoc_stripsFreeFormAndTelemetryFromPipelineStatuses_keepsScalars() {
    // A single run carrying every shape that has blown up the ingestion_pipeline mapping: the
    // free-form config/metadata maps and the per-step status[].operationMetrics keyed by API
    // endpoint. Each distinct key is dynamically mapped one-field-each; unstripped, a handful of
    // runs trip "Limit of total fields [1000] has been exceeded" during reindex.
    String statusJson =
        """
        {
          "runId": "run-1",
          "pipelineState": "success",
          "timestamp": 1785801779432,
          "startDate": 1785801779432,
          "endDate": 1785801884749,
          "status": [
            {
              "name": "Fivetran",
              "records": 254,
              "operationMetrics": {
                "source_api_calls": {
                  "GET:/connectors/cork_had": {"fivetran": {"count": 1, "totalTimeMs": 256.3}},
                  "GET:/connectors/bunt_ashen": {"fivetran": {"count": 1, "totalTimeMs": 249.4}},
                  "GET:/connectors/cork_had/schemas": {"fivetran": {"count": 1, "totalTimeMs": 495.9}}
                }
              }
            }
          ],
          "config": {"appConfig": {"actions": {"customProperties": "jointure"}}},
          "metadata": {"arbitraryKey": {"nested": "value"}}
        }
        """;
    PipelineStatus status = JsonUtils.readValue(statusJson, PipelineStatus.class);
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withName("p1")
            .withPipelineStatuses(List.of(status))
            .withSourceConfig(new SourceConfig().withConfig(Map.of()));

    Map<String, Object> doc =
        new IngestionPipelineIndex(pipeline).buildSearchIndexDocInternal(new HashMap<>());

    Object pipelineStatuses = doc.get("pipelineStatuses");
    assertInstanceOf(List.class, pipelineStatuses);
    List<?> statuses = (List<?>) pipelineStatuses;
    assertEquals(1, statuses.size());
    Map<?, ?> statusMap = (Map<?, ?>) statuses.getFirst();

    assertFalse(statusMap.containsKey("config"), "free-form config must be stripped from the doc");
    assertFalse(
        statusMap.containsKey("metadata"), "free-form metadata must be stripped from the doc");
    assertFalse(
        statusMap.containsKey("status"),
        "per-step telemetry (operationMetrics) must be stripped — its per-endpoint keys explode the mapping");
    // The catch-all guard: anything outside the mapped scalar set would be dynamically mapped and
    // is
    // a field-explosion risk. Fails if a future free-form field is added to PipelineStatus
    // unstripped.
    assertTrue(
        MAPPED_STATUS_FIELDS.containsAll(statusMap.keySet()),
        "indexed pipelineStatus must contain only mapped scalar fields, but had: "
            + statusMap.keySet());
    assertEquals("run-1", statusMap.get("runId"), "searchable status fields must be preserved");
    assertEquals("success", statusMap.get("pipelineState"), "pipelineState must be preserved");
  }
}
