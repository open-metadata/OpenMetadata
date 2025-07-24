package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.Entity.getEntityByName;
import static org.openmetadata.service.jdbi3.LineageRepository.buildEntityLineageData;
import static org.openmetadata.service.search.EntityBuilderConstant.DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FULLY_QUALIFIED_NAME;
import static org.openmetadata.service.search.EntityBuilderConstant.FULLY_QUALIFIED_NAME_PARTS;
import static org.openmetadata.service.search.EntityBuilderConstant.NAME_KEYWORD;
import static org.openmetadata.service.util.FullyQualifiedName.getParentFQN;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSummary;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.FullyQualifiedName;

public interface SearchIndex {
  Set<String> DEFAULT_EXCLUDED_FIELDS =
      Set.of(
          "changeDescription",
          "votes",
          "incrementalChangeDescription",
          "upstreamLineage.pipeline.changeDescription",
          "upstreamLineage.pipeline.incrementalChangeDescription",
          "connection",
          "changeSummary");

  public static final SearchClient searchClient = Entity.getSearchRepository().getSearchClient();

  default Map<String, Object> buildSearchIndexDoc() {
    // Build Index Doc
    Map<String, Object> esDoc = this.buildSearchIndexDocInternal(JsonUtils.getMap(getEntity()));

    // Add FqnHash
    if (esDoc.containsKey(Entity.FIELD_FULLY_QUALIFIED_NAME)
        && !nullOrEmpty((String) esDoc.get(Entity.FIELD_FULLY_QUALIFIED_NAME))) {
      String fqn = (String) esDoc.get(Entity.FIELD_FULLY_QUALIFIED_NAME);
      esDoc.put("fqnHash", FullyQualifiedName.buildHash(fqn));
    }

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

  default Map<String, Object> getCommonAttributesMap(EntityInterface entity, String entityType) {
    Map<String, Object> map = new HashMap<>();
    map.put(
        "displayName",
        entity.getDisplayName() != null ? entity.getDisplayName() : entity.getName());
    map.put("entityType", entityType);
    map.put("owners", getEntitiesWithDisplayName(entity.getOwners()));
    map.put("domains", getEntitiesWithDisplayName(entity.getDomains()));
    map.put("followers", SearchIndexUtils.parseFollowers(entity.getFollowers()));
    int totalVotes =
        nullOrEmpty(entity.getVotes())
            ? 0
            : Math.max(entity.getVotes().getUpVotes() - entity.getVotes().getDownVotes(), 0);
    map.put("totalVotes", totalVotes);
    map.put("descriptionStatus", getDescriptionStatus(entity));

    Map<String, ChangeSummary> changeSummaryMap = SearchIndexUtils.getChangeSummaryMap(entity);
    map.put(
        "descriptionSources", SearchIndexUtils.processDescriptionSources(entity, changeSummaryMap));
    SearchIndexUtils.TagAndTierSources tagAndTierSources =
        SearchIndexUtils.processTagAndTierSources(entity);
    map.put("tagSources", tagAndTierSources.getTagSources());
    map.put("tierSources", tagAndTierSources.getTierSources());

    map.put("fqnParts", getFQNParts(entity.getFullyQualifiedName()));
    map.put("deleted", entity.getDeleted() != null && entity.getDeleted());
    TagLabel tierTag = new ParseTags(Entity.getEntityTags(entityType, entity)).getTierTag();
    Optional.ofNullable(tierTag)
        .filter(tier -> tier.getTagFQN() != null && !tier.getTagFQN().isEmpty())
        .ifPresent(tier -> map.put("tier", tier));
    Optional.ofNullable(entity.getCertification())
        .ifPresent(assetCertification -> map.put("certification", assetCertification));
    return map;
  }

  default Set<String> getFQNParts(String fqn) {
    var parts = FullyQualifiedName.split(fqn);
    var entityName = parts[parts.length - 1];

    return FullyQualifiedName.getAllParts(fqn).stream()
        .filter(part -> !part.equals(entityName))
        .collect(Collectors.toSet());
  }

  default List<EntityReference> getEntitiesWithDisplayName(List<EntityReference> entities) {
    if (nullOrEmpty(entities)) {
      return Collections.emptyList();
    }
    List<EntityReference> clone = new ArrayList<>();
    for (EntityReference entity : entities) {
      EntityReference cloneEntity = JsonUtils.deepCopy(entity, EntityReference.class);
      cloneEntity.setDisplayName(
          nullOrEmpty(cloneEntity.getDisplayName())
              ? cloneEntity.getName()
              : cloneEntity.getDisplayName());
      clone.add(cloneEntity);
    }
    return clone;
  }

  default EntityReference getEntityWithDisplayName(EntityReference entity) {
    if (entity == null) {
      return null;
    }
    EntityReference cloneEntity = JsonUtils.deepCopy(entity, EntityReference.class);
    cloneEntity.setDisplayName(
        nullOrEmpty(cloneEntity.getDisplayName())
            ? cloneEntity.getName()
            : cloneEntity.getDisplayName());
    return cloneEntity;
  }

  default String getDescriptionStatus(EntityInterface entity) {
    return nullOrEmpty(entity.getDescription()) ? "INCOMPLETE" : "COMPLETE";
  }

  static List<EsLineageData> getLineageData(EntityReference entity) {
    return new ArrayList<>(
        getLineageDataFromRefs(
            entity,
            Entity.getCollectionDAO()
                .relationshipDAO()
                .findFrom(entity.getId(), entity.getType(), Relationship.UPSTREAM.ordinal())));
  }

  static List<EsLineageData> getLineageDataFromRefs(
      EntityReference entity, List<CollectionDAO.EntityRelationshipRecord> records) {
    List<EsLineageData> data = new ArrayList<>();
    for (CollectionDAO.EntityRelationshipRecord entityRelationshipRecord : records) {
      EntityReference ref =
          Entity.getEntityReferenceById(
              entityRelationshipRecord.getType(), entityRelationshipRecord.getId(), Include.ALL);
      LineageDetails lineageDetails =
          JsonUtils.readValue(entityRelationshipRecord.getJson(), LineageDetails.class);
      data.add(buildEntityLineageData(ref, entity, lineageDetails));
    }
    return data;
  }

  private static void processConstraints(
      Table entity,
      Table relatedEntity,
      List<Map<String, Object>> constraints,
      Boolean updateForeignTableIndex) {
    for (TableConstraint tableConstraint : listOrEmpty(entity.getTableConstraints())) {
      if (!tableConstraint
          .getConstraintType()
          .value()
          .equalsIgnoreCase(TableConstraint.ConstraintType.FOREIGN_KEY.value())) {
        continue;
      }
      int columnIndex = 0;
      for (String referredColumn : listOrEmpty(tableConstraint.getReferredColumns())) {
        String relatedEntityFQN = getParentFQN(referredColumn);
        String destinationIndexName = null;
        try {
          if (updateForeignTableIndex) {
            relatedEntity = getEntityByName(Entity.TABLE, relatedEntityFQN, "*", ALL);
            IndexMapping destinationIndexMapping =
                Entity.getSearchRepository()
                    .getIndexMapping(relatedEntity.getEntityReference().getType());
            destinationIndexName =
                destinationIndexMapping.getIndexName(
                    Entity.getSearchRepository().getClusterAlias());
          }
          Map<String, Object> relationshipsMap = buildRelationshipsMap(entity, relatedEntity);
          int relatedEntityIndex =
              checkRelatedEntity(
                  entity.getFullyQualifiedName(),
                  relatedEntity.getFullyQualifiedName(),
                  constraints);
          if (relatedEntityIndex >= 0) {
            updateExistingConstraint(
                entity,
                tableConstraint,
                constraints.get(relatedEntityIndex),
                destinationIndexName,
                relatedEntity,
                referredColumn,
                columnIndex,
                updateForeignTableIndex);
          } else {
            addNewConstraint(
                entity,
                tableConstraint,
                constraints,
                relationshipsMap,
                destinationIndexName,
                relatedEntity,
                referredColumn,
                columnIndex,
                updateForeignTableIndex);
          }
          columnIndex++;
        } catch (EntityNotFoundException ex) {
        }
      }
    }
  }

  static List<Map<String, Object>> populateEntityRelationshipData(Table entity) {
    List<Map<String, Object>> constraints = new ArrayList<>();
    processConstraints(entity, null, constraints, true);

    // We need to query the table_entity table to find the references this current table
    // has with other tables. We pick this info from the ES however in case of re-indexing this info
    // needs to be picked from the db
    List<CollectionDAO.EntityRelationshipRecord> relatedTables =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findFrom(entity.getId(), Entity.TABLE, Relationship.RELATED_TO.ordinal());

    for (CollectionDAO.EntityRelationshipRecord table : relatedTables) {
      Table foreignTable = Entity.getEntity(Entity.TABLE, table.getId(), "tableConstraints", ALL);
      processConstraints(foreignTable, entity, constraints, false);
    }
    return constraints;
  }

  static int checkRelatedEntity(
      String entityFQN, String relatedEntityFQN, List<Map<String, Object>> constraints) {
    int index = 0;
    for (Map<String, Object> constraint : constraints) {
      Map<String, Object> relatedConstraintEntity =
          (Map<String, Object>) constraint.get("relatedEntity");
      Map<String, Object> constraintEntity = (Map<String, Object>) constraint.get("entity");
      if (relatedConstraintEntity.get("fqn").equals(relatedEntityFQN)
          && constraintEntity.get("fqn").equals(entityFQN)) {
        return index;
      }
      index++;
    }
    return -1;
  }

  private static Map<String, Object> buildRelationshipsMap(
      EntityInterface entity, Table relatedEntity) {
    Map<String, Object> relationshipsMap = new HashMap<>();
    relationshipsMap.put("entity", buildEntityRefMap(entity.getEntityReference()));
    relationshipsMap.put("relatedEntity", buildEntityRefMap(relatedEntity.getEntityReference()));
    relationshipsMap.put(
        "docId", entity.getId().toString() + "-" + relatedEntity.getId().toString());
    return relationshipsMap;
  }

  private static void updateRelatedEntityIndex(
      String destinationIndexName, Table relatedEntity, Map<String, Object> constraint) {
    Pair<String, String> to = new ImmutablePair<>("_id", relatedEntity.getId().toString());
    searchClient.updateEntityRelationship(destinationIndexName, to, constraint);
  }

  private static void updateExistingConstraint(
      EntityInterface entity,
      TableConstraint tableConstraint,
      Map<String, Object> presentConstraint,
      String destinationIndexName,
      Table relatedEntity,
      String referredColumn,
      int columnIndex,
      Boolean updateForeignTableIndex) {
    String columnFQN =
        FullyQualifiedName.add(
            entity.getFullyQualifiedName(), tableConstraint.getColumns().get(columnIndex));

    Map<String, Object> columnMap = new HashMap<>();
    columnMap.put("columnFQN", columnFQN);
    columnMap.put("relatedColumnFQN", referredColumn);
    columnMap.put("relationshipType", tableConstraint.getRelationshipType());

    List<Map<String, Object>> presentColumns =
        (List<Map<String, Object>>) presentConstraint.get("columns");
    presentColumns.add(columnMap);
    if (updateForeignTableIndex) {
      updateRelatedEntityIndex(destinationIndexName, relatedEntity, presentConstraint);
    }
  }

  private static void addNewConstraint(
      EntityInterface entity,
      TableConstraint tableConstraint,
      List<Map<String, Object>> constraints,
      Map<String, Object> relationshipsMap,
      String destinationIndexName,
      Table relatedEntity,
      String referredColumn,
      int columnIndex,
      Boolean updateForeignTableIndex) {
    List<Map<String, Object>> columns = new ArrayList<>();
    String columnFQN =
        FullyQualifiedName.add(
            entity.getFullyQualifiedName(), tableConstraint.getColumns().get(columnIndex));

    Map<String, Object> columnMap = new HashMap<>();
    columnMap.put("columnFQN", columnFQN);
    columnMap.put("relatedColumnFQN", referredColumn);
    columnMap.put("relationshipType", tableConstraint.getRelationshipType());
    columns.add(columnMap);
    relationshipsMap.put("columns", columns);
    constraints.add(JsonUtils.getMap(relationshipsMap));
    if (updateForeignTableIndex) {
      updateRelatedEntityIndex(destinationIndexName, relatedEntity, relationshipsMap);
    }
  }

  static Map<String, Object> buildEntityRefMap(EntityReference entityRef) {
    Map<String, Object> details = new HashMap<>();
    details.put("id", entityRef.getId().toString());
    details.put("type", entityRef.getType());
    details.put("fqn", entityRef.getFullyQualifiedName());
    details.put("fqnHash", FullyQualifiedName.buildHash(entityRef.getFullyQualifiedName()));
    return details;
  }

  static Map<String, Float> getDefaultFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put(NAME_KEYWORD, 10.0f);
    fields.put(DISPLAY_NAME_KEYWORD, 10.0f);
    fields.put(FIELD_NAME, 10.0f);
    fields.put(FIELD_NAME_NGRAM, 1.0f);
    fields.put(FIELD_DISPLAY_NAME, 10.0f);
    fields.put(FIELD_DISPLAY_NAME_NGRAM, 1.0f);
    fields.put(FIELD_DESCRIPTION, 2.0f);
    fields.put(FULLY_QUALIFIED_NAME, 5.0f);
    fields.put(FULLY_QUALIFIED_NAME_PARTS, 5.0f);
    return fields;
  }

  static Map<String, Float> getAllFields() {
    // Use SettingsCache to get the aggregated search fields
    // This is automatically cached and invalidated when searchSettings change
    return SettingsCache.getAggregatedSearchFields();
  }
}
