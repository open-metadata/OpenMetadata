/*
 *  Copyright 2025 Collate
 *  Licensed under the Collate Community License, Version 1.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.mcp.tools;

import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Slf4j
public class GetIngestionStatusTool implements McpTool {

  private static final String RESOURCE = Entity.INGESTION_PIPELINE;
  private static final String PARAM_FQN = "ingestionPipelineFqn";
  private static final String PARAM_LIMIT = "limit";
  private static final int DEFAULT_LIMIT = 5;
  private static final int MAX_LIMIT = 20;
  private static final long LOOKBACK_MS = 30L * 24 * 3600 * 1000;

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    final String fqn = requireString(params, PARAM_FQN);
    if (fqn == null) {
      return errorMap(PARAM_FQN + " is required");
    }
    final int limit = clampInt(params.get(PARAM_LIMIT), 1, MAX_LIMIT, DEFAULT_LIMIT);

    authorizer.authorize(
        securityContext, new OperationContext(RESOURCE, VIEW_ALL), new ResourceContext<>(RESOURCE));

    IngestionPipelineRepository repo =
        (IngestionPipelineRepository) Entity.getEntityRepository(RESOURCE);

    long endTs = System.currentTimeMillis();
    long startTs = endTs - LOOKBACK_MS;
    ResultList<PipelineStatus> statuses;
    try {
      statuses = repo.listPipelineStatus(fqn, startTs, endTs, limit);
    } catch (Exception exc) {
      LOG.warn("listPipelineStatus failed for {}: {}", fqn, exc.getMessage());
      return errorMap("Pipeline not found or status unavailable: " + fqn);
    }

    List<Map<String, Object>> runs = new ArrayList<>();
    statuses.getData().stream()
        .sorted(Comparator.comparingLong((PipelineStatus s) -> nvl(s.getStartDate())).reversed())
        .limit(limit)
        .forEach(s -> runs.add(toRunMap(s)));

    Map<String, Object> result = new HashMap<>();
    result.put("pipelineFqn", fqn);
    result.put("count", runs.size());
    result.put("runs", runs);
    return result;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException(
        "GetIngestionStatusTool does not require limit validation.");
  }

  private static Map<String, Object> toRunMap(PipelineStatus s) {
    Map<String, Object> m = new HashMap<>();
    m.put("runId", s.getRunId());
    m.put(
        "state",
        s.getPipelineState() != null ? s.getPipelineState().toString().toLowerCase() : "unknown");
    m.put("startTime", s.getStartDate());
    m.put("endTime", s.getEndDate());
    m.put("timestamp", s.getTimestamp());
    return m;
  }

  private static long nvl(Long v) {
    return v == null ? 0L : v;
  }

  private static String requireString(Map<String, Object> params, String key) {
    Object v = params.get(key);
    return (v == null || v.toString().isBlank()) ? null : v.toString().trim();
  }

  private static int clampInt(Object raw, int min, int max, int fallback) {
    if (raw == null) {
      return fallback;
    }
    try {
      int v = Integer.parseInt(raw.toString());
      return Math.min(Math.max(v, min), max);
    } catch (NumberFormatException e) {
      return fallback;
    }
  }

  private static Map<String, Object> errorMap(String msg) {
    Map<String, Object> m = new HashMap<>();
    m.put("error", msg);
    return m;
  }
}
