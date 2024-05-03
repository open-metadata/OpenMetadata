package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.models.SearchSuggest;

public class IngestionPipelineIndex implements SearchIndex {
  final IngestionPipeline ingestionPipeline;
  final Set<String> excludeFields =
      Set.of("sourceConfig", "openMetadataServerConnection", "airflowConfig");

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
    doc.put(
        "displayName",
        ingestionPipeline.getDisplayName() != null
            ? ingestionPipeline.getDisplayName()
            : ingestionPipeline.getName());
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("service_suggest", serviceSuggest);
    doc.put("service", getEntityWithDisplayName(ingestionPipeline.getService()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
