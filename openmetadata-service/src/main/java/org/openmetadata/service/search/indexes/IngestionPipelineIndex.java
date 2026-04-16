package org.openmetadata.service.search.indexes;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.json.JSONObject;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
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

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put(
        "name",
        ingestionPipeline.getName() != null
            ? ingestionPipeline.getName()
            : ingestionPipeline.getDisplayName());
    doc.put("pipelineStatuses", ingestionPipeline.getPipelineStatuses());
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

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
