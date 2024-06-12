package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.jdbi3.LineageRepository.buildRelationshipDetailsMap;
import static org.openmetadata.service.search.EntityBuilderConstant.DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FULLY_QUALIFIED_NAME;
import static org.openmetadata.service.search.EntityBuilderConstant.FULLY_QUALIFIED_NAME_PARTS;
import static org.openmetadata.service.search.EntityBuilderConstant.NAME_KEYWORD;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

public interface SearchIndex {
  Set<String> DEFAULT_EXCLUDED_FIELDS =
      Set.of("changeDescription", "lineage.pipeline.changeDescription", "connection");

  default Map<String, Object> buildSearchIndexDoc() {
    // Build Index Doc
    Map<String, Object> esDoc = this.buildSearchIndexDocInternal(JsonUtils.getMap(getEntity()));

    // Non Indexable Fields
    removeNonIndexableFields(esDoc);

    return esDoc;
  }

  default void removeNonIndexableFields(Map<String, Object> esDoc) {
    // Remove non indexable fields
    SearchIndexUtils.removeNonIndexableFields(esDoc, DEFAULT_EXCLUDED_FIELDS);

    // Remove Entity Specific Field
    SearchIndexUtils.removeNonIndexableFields(esDoc, getExcludedFields());
  }

  Object getEntity();

  default Set<String> getExcludedFields() {
    return Collections.emptySet();
  }

  Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc);

  default List<SearchSuggest> getSuggest() {
    return null;
  }

  default Map<String, Object> getCommonAttributesMap(EntityInterface entity, String entityType) {
    Map<String, Object> map = new HashMap<>();
    List<SearchSuggest> suggest = getSuggest();
    map.put("entityType", entityType);
    map.put("owner", getEntityWithDisplayName(entity.getOwner()));
    map.put("domain", getEntityWithDisplayName(entity.getDomain()));
    map.put("followers", SearchIndexUtils.parseFollowers(entity.getFollowers()));
    map.put(
        "totalVotes",
        CommonUtil.nullOrEmpty(entity.getVotes())
            ? 0
            : entity.getVotes().getUpVotes() - entity.getVotes().getDownVotes());
    map.put("descriptionStatus", getDescriptionStatus(entity));
    map.put("suggest", suggest);
    map.put(
        "fqnParts",
        getFQNParts(
            entity.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    return map;
  }

  default Set<String> getFQNParts(String fqn, List<String> fqnSplits) {
    Set<String> fqnParts = new HashSet<>();
    fqnParts.add(fqn);
    String parent = FullyQualifiedName.getParentFQN(fqn);
    while (parent != null) {
      fqnParts.add(parent);
      parent = FullyQualifiedName.getParentFQN(parent);
    }
    fqnParts.addAll(fqnSplits);
    return fqnParts;
  }

  default EntityReference getEntityWithDisplayName(EntityReference entity) {
    if (entity == null) {
      return null;
    }
    EntityReference cloneEntity = JsonUtils.deepCopy(entity, EntityReference.class);
    cloneEntity.setDisplayName(
        CommonUtil.nullOrEmpty(cloneEntity.getDisplayName())
            ? cloneEntity.getName()
            : cloneEntity.getDisplayName());
    return cloneEntity;
  }

  default String getDescriptionStatus(EntityInterface entity) {
    return CommonUtil.nullOrEmpty(entity.getDescription()) ? "INCOMPLETE" : "COMPLETE";
  }

  static List<Map<String, Object>> getLineageData(EntityReference entity) {
    List<Map<String, Object>> data = new ArrayList<>();
    CollectionDAO dao = Entity.getCollectionDAO();
    List<CollectionDAO.EntityRelationshipRecord> toRelationshipsRecords =
        dao.relationshipDAO()
            .findTo(entity.getId(), entity.getType(), Relationship.UPSTREAM.ordinal());
    for (CollectionDAO.EntityRelationshipRecord entityRelationshipRecord : toRelationshipsRecords) {
      EntityReference ref =
          Entity.getEntityReferenceById(
              entityRelationshipRecord.getType(), entityRelationshipRecord.getId(), Include.ALL);
      LineageDetails lineageDetails =
          JsonUtils.readValue(entityRelationshipRecord.getJson(), LineageDetails.class);
      data.add(buildRelationshipDetailsMap(entity, ref, lineageDetails));
    }
    List<CollectionDAO.EntityRelationshipRecord> fromRelationshipsRecords =
        dao.relationshipDAO()
            .findFrom(entity.getId(), entity.getType(), Relationship.UPSTREAM.ordinal());
    for (CollectionDAO.EntityRelationshipRecord entityRelationshipRecord :
        fromRelationshipsRecords) {
      EntityReference ref =
          Entity.getEntityReferenceById(
              entityRelationshipRecord.getType(), entityRelationshipRecord.getId(), Include.ALL);
      LineageDetails lineageDetails =
          JsonUtils.readValue(entityRelationshipRecord.getJson(), LineageDetails.class);
      data.add(buildRelationshipDetailsMap(ref, entity, lineageDetails));
    }
    return data;
  }

  static Map<String, Float> getDefaultFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put(FIELD_DISPLAY_NAME, 10.0f);
    fields.put(FIELD_DISPLAY_NAME_NGRAM, 1.0f);
    fields.put(FIELD_NAME, 10.0f);
    fields.put(FIELD_NAME_NGRAM, 1.0f);
    fields.put(DISPLAY_NAME_KEYWORD, 8.0f);
    fields.put(NAME_KEYWORD, 8.0f);
    fields.put(FIELD_DESCRIPTION, 2.0f);
    fields.put(FULLY_QUALIFIED_NAME, 5.0f);
    fields.put(FULLY_QUALIFIED_NAME_PARTS, 5.0f);
    return fields;
  }

  static Map<String, Float> getAllFields() {
    Map<String, Float> fields = getDefaultFields();
    fields.putAll(TableIndex.getFields());
    fields.putAll(DashboardIndex.getFields());
    fields.putAll(DashboardDataModelIndex.getFields());
    fields.putAll(PipelineIndex.getFields());
    fields.putAll(TopicIndex.getFields());
    fields.putAll(MlModelIndex.getFields());
    fields.putAll(ContainerIndex.getFields());
    fields.putAll(SearchEntityIndex.getFields());
    fields.putAll(GlossaryTermIndex.getFields());
    fields.putAll(TagIndex.getFields());
    fields.putAll(DataProductIndex.getFields());
    return fields;
  }
}
