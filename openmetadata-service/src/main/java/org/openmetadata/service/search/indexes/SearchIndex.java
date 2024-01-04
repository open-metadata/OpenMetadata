package org.openmetadata.service.search.indexes;

import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.search.EntityBuilderConstant.DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FULLY_QUALIFIED_NAME;
import static org.openmetadata.service.search.EntityBuilderConstant.FULLY_QUALIFIED_NAME_PARTS;
import static org.openmetadata.service.search.EntityBuilderConstant.NAME_KEYWORD;

public interface SearchIndex {
  Map<String, Object> buildESDoc();

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

  static List<HashMap<String, Object>> getLineageData(EntityReference entity) {
    List<HashMap<String, Object>> data = new ArrayList<>();
    CollectionDAO dao = Entity.getCollectionDAO();
    List<CollectionDAO.EntityRelationshipRecord> toRelationshipsRecords =
        dao.relationshipDAO().findTo(entity.getId(), entity.getType(), Relationship.UPSTREAM.ordinal());
    for (CollectionDAO.EntityRelationshipRecord entityRelationshipRecord : toRelationshipsRecords) {
      EntityReference ref =
          Entity.getEntityReferenceById(
              entityRelationshipRecord.getType(), entityRelationshipRecord.getId(), Include.ALL);
      LineageDetails lineageDetails = JsonUtils.readValue(entityRelationshipRecord.getJson(), LineageDetails.class);
      SearchIndex.getLineageDataDirection(entity, ref, lineageDetails, data);
    }
    List<CollectionDAO.EntityRelationshipRecord> fromRelationshipsRecords =
        dao.relationshipDAO().findFrom(entity.getId(), entity.getType(), Relationship.UPSTREAM.ordinal());
    for (CollectionDAO.EntityRelationshipRecord entityRelationshipRecord : fromRelationshipsRecords) {
      EntityReference ref =
          Entity.getEntityReferenceById(
              entityRelationshipRecord.getType(), entityRelationshipRecord.getId(), Include.ALL);
      LineageDetails lineageDetails = JsonUtils.readValue(entityRelationshipRecord.getJson(), LineageDetails.class);
      SearchIndex.getLineageDataDirection(ref, entity, lineageDetails, data);
    }
    return data;
  }

  static void getLineageDataDirection(
      EntityReference fromEntity,
      EntityReference toEntity,
      LineageDetails lineageDetails,
      List<HashMap<String, Object>> data) {
    HashMap<String, Object> fromDetails = new HashMap<>();
    HashMap<String, Object> toDetails = new HashMap<>();
    HashMap<String, Object> relationshipDetails = new HashMap<>();
    fromDetails.put("id", fromEntity.getId().toString());
    fromDetails.put("type", fromEntity.getType());
    fromDetails.put("fqn", fromEntity.getFullyQualifiedName());
    toDetails.put("id", toEntity.getId().toString());
    toDetails.put("type", toEntity.getType());
    toDetails.put("fqn", toEntity.getFullyQualifiedName());
    relationshipDetails.put("doc_id", fromEntity.getId().toString() + "-" + toEntity.getId().toString());
    relationshipDetails.put("fromEntity", fromDetails);
    relationshipDetails.put("toEntity", toDetails);
    if (lineageDetails != null) {
      relationshipDetails.put(
          "pipeline",
          JsonUtils.getMap(CommonUtil.nullOrEmpty(lineageDetails.getPipeline()) ? null : lineageDetails.getPipeline()));
      relationshipDetails.put("edgeDescription", CommonUtil.nullOrEmpty(lineageDetails.getDescription()) ? null : lineageDetails.getDescription());
      if (!CommonUtil.nullOrEmpty(lineageDetails.getColumnsLineage())) {
        List<Map<String, Object>> colummnLineageList = new ArrayList<>();
        for (ColumnLineage columnLineage : lineageDetails.getColumnsLineage()) {
          colummnLineageList.add(JsonUtils.getMap(columnLineage));
        }
        relationshipDetails.put("columns", colummnLineageList);
      }
      relationshipDetails.put(
          "sqlQuery", CommonUtil.nullOrEmpty(lineageDetails.getSqlQuery()) ? null : lineageDetails.getSqlQuery());
      relationshipDetails.put(
          "source", CommonUtil.nullOrEmpty(lineageDetails.getSource()) ? null : lineageDetails.getSource());
    }
    data.add(relationshipDetails);
  }

  static Map<String, Float> getDefaultFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put(FIELD_DISPLAY_NAME, 15.0f);
    fields.put(FIELD_DISPLAY_NAME_NGRAM, 1.0f);
    fields.put(FIELD_NAME, 15.0f);
    fields.put(FIELD_NAME_NGRAM, 1.0f);
    fields.put(DISPLAY_NAME_KEYWORD, 25.0f);
    fields.put(NAME_KEYWORD, 25.0f);
    fields.put(FIELD_DESCRIPTION, 1.0f);
    fields.put(FULLY_QUALIFIED_NAME, 10.0f);
    fields.put(FULLY_QUALIFIED_NAME_PARTS, 10.0f);
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
