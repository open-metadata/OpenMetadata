package org.openmetadata.service.search.indexes;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.json.JSONObject;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

public class IngestionPipelineIndex implements TaggableIndex, ServiceBackedIndex {
  final IngestionPipeline ingestionPipeline;
  final Set<String> excludeFields = Set.of("sourceConfig", "openMetadataServerConnection");

  public IngestionPipelineIndex(IngestionPipeline ingestionPipeline) {
    this.ingestionPipeline = ingestionPipeline;
  }

  @Override
  public Object getEntity() {
    return ingestionPipeline;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.INGESTION_PIPELINE;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new java.util.HashSet<>(TaggableIndex.super.getRequiredReindexFields());
    fields.add("pipelineStatuses");
    return java.util.Collections.unmodifiableSet(fields);
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put(
        "name",
        ingestionPipeline.getName() != null
            ? ingestionPipeline.getName()
            : ingestionPipeline.getDisplayName());
    doc.put("pipelineStatuses", statusWithoutConfig(ingestionPipeline.getPipelineStatuses()));
    Optional.ofNullable(ingestionPipeline.getAirflowConfig())
        .map(AirflowConfig::getScheduleInterval)
        .ifPresent(
            scheduleInterval -> {
              Map<String, Object> airflowConfigMap = new HashMap<>();
              airflowConfigMap.put("scheduleInterval", scheduleInterval);
              doc.put("airflowConfig", airflowConfigMap);
            });
    JSONObject sourceConfigJson =
        new JSONObject(JsonUtils.pojoToJson(ingestionPipeline.getSourceConfig().getConfig()));
    Optional.ofNullable(sourceConfigJson.optJSONObject("appConfig"))
        .map(appConfig -> appConfig.optString("type", null))
        .ifPresent(c -> doc.put("applicationType", c));
    return doc;
  }

  /**
   * Drops the free-form {@code config} blob from the run status before indexing. It is per-run
   * application config (not searched — only the derived {@code applicationType} is), can be large,
   * and previously triggered dynamic-mapping type conflicts (string then object) at reindex time. The
   * searchable status fields (state, runId, timestamps) are preserved. Returns a copy so the entity
   * is not mutated.
   */
  private Map<String, Object> statusWithoutConfig(PipelineStatus status) {
    Map<String, Object> result = null;
    if (status != null) {
      result = JsonUtils.getMap(status);
      result.remove("config");
    }
    return result;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
