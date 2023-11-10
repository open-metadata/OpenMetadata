package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.search.EntityBuilderConstant.DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.FULLY_QUALIFIED_NAME_PARTS;
import static org.openmetadata.service.search.EntityBuilderConstant.NAME_KEYWORD;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class StoredProcedureIndex implements SearchIndex {

  private static final List<String> excludeFields = List.of("changeDescription");

  final StoredProcedure storedProcedure;

  public StoredProcedureIndex(StoredProcedure storedProcedure) {
    this.storedProcedure = storedProcedure;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(storedProcedure);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(storedProcedure.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(storedProcedure.getName()).weight(10).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            storedProcedure.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.STORED_PROCEDURE);
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.STORED_PROCEDURE, storedProcedure));
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("owner", getOwnerWithDisplayName(storedProcedure.getOwner()));
    doc.put("service", getServiceWithDisplayName(storedProcedure.getService()));
    doc.put("domain", getDomainWithDisplayName(storedProcedure.getDomain()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put(FIELD_DISPLAY_NAME, 15.0f);
    fields.put(FIELD_NAME, 15.0f);
    fields.put(DISPLAY_NAME_KEYWORD, 25.0f);
    fields.put(NAME_KEYWORD, 25.0f);
    fields.put(FIELD_DESCRIPTION, 1.0f);
    fields.put(FULLY_QUALIFIED_NAME_PARTS, 10.0f);
    return fields;
  }
}
