package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public record StoredProcedureIndex(StoredProcedure storedProcedure) implements SearchIndex {
  private static final List<String> excludeFields = List.of("changeDescription");

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(storedProcedure);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(
        SearchSuggest.builder().input(storedProcedure.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(storedProcedure.getName()).weight(10).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            storedProcedure.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.STORED_PROCEDURE);
    ParseTags parseTags =
        new ParseTags(Entity.getEntityTags(Entity.STORED_PROCEDURE, storedProcedure));
    doc.put("tags", parseTags.getTags());
    doc.put("followers", SearchIndexUtils.parseFollowers(storedProcedure.getFollowers()));
    doc.put("lineage", SearchIndex.getLineageData(storedProcedure.getEntityReference()));
    doc.put("tier", parseTags.getTierTag());
    doc.put("owner", getEntityWithDisplayName(storedProcedure.getOwner()));
    doc.put("ownerKeyword", getOwnerDisplayNameOrNoOwner(storedProcedure.getOwner()));
    doc.put("service", getEntityWithDisplayName(storedProcedure.getService()));
    doc.put(
        "totalVotes",
        CommonUtil.nullOrEmpty(storedProcedure.getVotes())
            ? 0
            : storedProcedure.getVotes().getUpVotes() - storedProcedure.getVotes().getDownVotes());
    doc.put("domain", getEntityWithDisplayName(storedProcedure.getDomain()));
    doc.put("descriptionStatus", getDescriptionStatus(storedProcedure.getDescription()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
