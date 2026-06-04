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
import static org.mockito.Mockito.mock;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
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

  @Test
  void buildDoc_stripsConfigFromPipelineStatuses_keepsOtherFields() {
    PipelineStatus status =
        new PipelineStatus()
            .withRunId("run-1")
            .withConfig(
                Map.of("appConfig", Map.of("actions", Map.of("customProperties", "jointure"))));
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withName("p1")
            .withPipelineStatuses(status)
            .withSourceConfig(new SourceConfig().withConfig(Map.of()));

    Map<String, Object> doc =
        new IngestionPipelineIndex(pipeline).buildSearchIndexDocInternal(new HashMap<>());

    Object pipelineStatuses = doc.get("pipelineStatuses");
    assertInstanceOf(Map.class, pipelineStatuses);
    Map<?, ?> statusMap = (Map<?, ?>) pipelineStatuses;
    assertFalse(statusMap.containsKey("config"), "free-form config must be stripped from the doc");
    assertEquals("run-1", statusMap.get("runId"), "searchable status fields must be preserved");
  }
}
