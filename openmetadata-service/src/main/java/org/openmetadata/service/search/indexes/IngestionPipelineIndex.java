package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class IngestionPipelineIndex implements SearchIndex {
  final IngestionPipeline ingestionPipeline;
  final List<String> excludeFields =
      List.of("changeDescription", "sourceConfig", "openMetadataServerConnection", "airflowConfig");

  public IngestionPipelineIndex(IngestionPipeline ingestionPipeline) {
    this.ingestionPipeline = ingestionPipeline;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(ingestionPipeline);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    List<SearchSuggest> serviceSuggest = new ArrayList<>();
    suggest.add(
        SearchSuggest.builder().input(ingestionPipeline.getFullyQualifiedName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(ingestionPipeline.getDisplayName()).weight(10).build());
    serviceSuggest.add(
        SearchSuggest.builder().input(ingestionPipeline.getService().getName()).weight(5).build());
    ParseTags parseTags =
        new ParseTags(Entity.getEntityTags(Entity.INGESTION_PIPELINE, ingestionPipeline));
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
    doc.put("followers", SearchIndexUtils.parseFollowers(ingestionPipeline.getFollowers()));
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("suggest", suggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("entityType", Entity.INGESTION_PIPELINE);
    doc.put(
        "totalVotes",
        CommonUtil.nullOrEmpty(ingestionPipeline.getVotes())
            ? 0
            : ingestionPipeline.getVotes().getUpVotes()
                - ingestionPipeline.getVotes().getDownVotes());
    doc.put(
        "fqnParts",
        getFQNParts(
            ingestionPipeline.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("owner", getEntityWithDisplayName(ingestionPipeline.getOwner()));
    doc.put("service", getEntityWithDisplayName(ingestionPipeline.getService()));
    doc.put("domain", getEntityWithDisplayName(ingestionPipeline.getDomain()));
    doc.put("descriptionStatus", getDescriptionStatus(ingestionPipeline.getDescription()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
