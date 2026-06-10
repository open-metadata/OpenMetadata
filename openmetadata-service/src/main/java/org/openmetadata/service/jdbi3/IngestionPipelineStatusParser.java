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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Parses the Elasticsearch search response for ingestion pipelines into the lightweight status
 * summaries streamed over the {@code chartDataStream} websocket channel.
 *
 * <p>Kept dependency-free so the parsing of the {@code pipelineStatuses} array (which became a list
 * of {@code pipelineStatus} entries) can be unit-tested in isolation.
 */
@Slf4j
final class IngestionPipelineStatusParser {

  private static final String HITS = "hits";
  private static final String SOURCE = "_source";
  private static final String PIPELINE_STATUSES = "pipelineStatuses";
  private static final String PIPELINE_STATE = "pipelineState";
  private static final String UNKNOWN_STATE = "unknown";

  private IngestionPipelineStatusParser() {}

  @SuppressWarnings("unchecked")
  static List<Map> parse(String responseBody) {
    List<Map> result = new ArrayList<>();
    try {
      Map<String, Object> responseMap = JsonUtils.readValue(responseBody, Map.class);
      List<Map<String, Object>> hitsList = extractHits(responseMap);
      for (Map<String, Object> hit : hitsList) {
        Map<String, Object> source = (Map<String, Object>) hit.get(SOURCE);
        if (source != null) {
          result.add(toStatusEntry(source));
        }
      }
      LOG.info("Parsed {} ingestion pipelines for service", result.size());
    } catch (Exception e) {
      LOG.error("Error parsing ingestion pipeline response", e);
      result = List.of();
    }
    return result;
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> extractHits(Map<String, Object> responseMap) {
    List<Map<String, Object>> hitsList = List.of();
    Map<String, Object> hits =
        responseMap == null ? null : (Map<String, Object>) responseMap.get(HITS);
    if (hits != null && hits.get(HITS) instanceof List<?> inner && !inner.isEmpty()) {
      hitsList = (List<Map<String, Object>>) hits.get(HITS);
    }
    return hitsList;
  }

  private static Map<String, Object> toStatusEntry(Map<String, Object> source) {
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("id", source.get("id"));
    metadata.put("name", source.get("name"));
    metadata.put("displayName", source.get("displayName"));
    metadata.put("fullyQualifiedName", source.get("fullyQualifiedName"));
    metadata.put("pipelineType", source.get("pipelineType"));
    metadata.put("provider", source.get("provider"));
    metadata.put("status", latestState(source));
    return metadata;
  }

  @SuppressWarnings("unchecked")
  private static String latestState(Map<String, Object> source) {
    String state = UNKNOWN_STATE;
    if (source.get(PIPELINE_STATUSES) instanceof List<?> statusList && !statusList.isEmpty()) {
      Map<String, Object> latestStatus = (Map<String, Object>) statusList.getFirst();
      Object latestState = latestStatus.get(PIPELINE_STATE);
      if (latestState != null) {
        state = (String) latestState;
      }
    }
    return state;
  }
}
