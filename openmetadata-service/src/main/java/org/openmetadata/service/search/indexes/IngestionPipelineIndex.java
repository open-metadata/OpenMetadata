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

  /**
   * Free-form per-run map fields on a {@link PipelineStatus} that are not searched and whose
   * arbitrary keys must never reach the index (see {@link #searchableStatus}).
   */
  private static final Set<String> NON_SEARCHABLE_STATUS_FIELDS = Set.of("config", "metadata");

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
    doc.put("pipelineStatuses", searchableStatus(ingestionPipeline.getPipelineStatuses()));
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
   * Drops the free-form {@code config} and {@code metadata} blobs from the run status before
   * indexing. Both are arbitrary per-run key/value maps (a {@code map} in the schema): they are not
   * searched (only the derived {@code applicationType} is), can be large, and dynamically mapping
   * their arbitrary keys previously triggered type conflicts (a key seen first as a string then as an
   * object) and can push the index past its total-fields limit — either of which rejects the whole
   * document. The searchable status fields (state, runId, timestamps) are preserved. Returns a copy
   * so the entity is not mutated.
   */
  private Map<String, Object> searchableStatus(PipelineStatus status) {
    Map<String, Object> result = null;
    if (status != null) {
      result = JsonUtils.getMap(status);
      result.keySet().removeAll(NON_SEARCHABLE_STATUS_FIELDS);
    }
    return result;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
