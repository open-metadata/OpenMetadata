package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.json.JSONObject;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class IngestionPipelineIndex implements SearchIndex {
  final IngestionPipeline ingestionPipeline;
  final Set<String> excludeFields = Set.of("sourceConfig", "openMetadataServerConnection");

  public IngestionPipelineIndex(IngestionPipeline ingestionPipeline) {
    this.ingestionPipeline = ingestionPipeline;
  }

  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(
        SearchSuggest.builder().input(ingestionPipeline.getFullyQualifiedName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(ingestionPipeline.getDisplayName()).weight(10).build());
    return suggest;
  }

  @Override
  public Object getEntity() {
    return ingestionPipeline;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> serviceSuggest = new ArrayList<>();
    serviceSuggest.add(
        SearchSuggest.builder()
            .input(
                (ingestionPipeline.getService() != null
                    ? ingestionPipeline.getService().getName()
                    : null))
            .weight(5)
            .build());
    ParseTags parseTags =
        new ParseTags(Entity.getEntityTags(Entity.INGESTION_PIPELINE, ingestionPipeline));
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(ingestionPipeline, Entity.INGESTION_PIPELINE);
    doc.putAll(commonAttributes);
    doc.put(
        "name",
        ingestionPipeline.getName() != null
            ? ingestionPipeline.getName()
            : ingestionPipeline.getDisplayName());
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("pipelineStatuses", ingestionPipeline.getPipelineStatuses());
    doc.put("service_suggest", serviceSuggest);
    doc.put("service", getEntityWithDisplayName(ingestionPipeline.getService()));
    // Add only 'scheduleInterval' to avoid exposing sensitive info in 'airflowConfig'
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
