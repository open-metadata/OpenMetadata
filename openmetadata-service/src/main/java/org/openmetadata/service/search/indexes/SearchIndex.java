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
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
  static final Logger LOG = LoggerFactory.getLogger(SearchIndex.class);

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
        entity.getDisplayName() != null && !entity.getDisplayName().isBlank()
            ? entity.getDisplayName()
            : entity.getName());
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

  static List<Map<String, Object>> populateUpstreamEntityRelationshipData(Table entity) {
    List<Map<String, Object>> upstreamRelationships = new ArrayList<>();

    // Only process constraints where this entity is the downstream (has foreign keys pointing to
    // other tables)
    processUpstreamConstraints(entity, upstreamRelationships);
    return upstreamRelationships;
  }

  private static void processUpstreamConstraints(
      Table entity, List<Map<String, Object>> upstreamRelationships) {
    for (TableConstraint tableConstraint : listOrEmpty(entity.getTableConstraints())) {
      if (!tableConstraint
          .getConstraintType()
          .value()
          .equalsIgnoreCase(TableConstraint.ConstraintType.FOREIGN_KEY.value())) {
        continue;
      }

      // Validate constraint has required data
      if (nullOrEmpty(tableConstraint.getColumns())
          || nullOrEmpty(tableConstraint.getReferredColumns())) {
        LOG.warn(
            "Skipping invalid constraint for entity '{}': missing columns or referredColumns",
            entity.getFullyQualifiedName());
        continue;
      }

      int columnIndex = 0;
      for (String referredColumn : listOrEmpty(tableConstraint.getReferredColumns())) {
        String relatedEntityFQN = getParentFQN(referredColumn);
        try {
          Table relatedEntity = getEntityByName(Entity.TABLE, relatedEntityFQN, "*", ALL);

          // Store only upstream relationship where relatedEntity is upstream
          // Current entity depends on relatedEntity (relatedEntity -> current entity)
          Map<String, Object> relationshipMap =
              checkUpstreamRelationship(
                  entity.getFullyQualifiedName(),
                  relatedEntity.getFullyQualifiedName(),
                  upstreamRelationships);

          if (relationshipMap != null) {
            updateExistingUpstreamRelationship(
                entity, tableConstraint, relationshipMap, referredColumn, columnIndex);
          } else {
            Map<String, Object> newRelationshipMap =
                buildUpstreamRelationshipMap(
                    entity, relatedEntity, tableConstraint, referredColumn, columnIndex);
            if (newRelationshipMap != null) {
              upstreamRelationships.add(newRelationshipMap);
            }
          }

          columnIndex++;
        } catch (EntityNotFoundException ignored) {
        }
      }
    }
  }

  private static Map<String, Object> buildUpstreamRelationshipMap(
      EntityInterface entity,
      Table relatedEntity,
      TableConstraint tableConstraint,
      String referredColumn,
      int columnIndex) {

    // Handle composite key scenarios gracefully
    List<String> columns = tableConstraint.getColumns();
    List<String> referredColumns = tableConstraint.getReferredColumns();

    if (columns == null || columns.isEmpty()) {
      LOG.warn(
          "Table constraint has no local columns for entity: {}. Skipping constraint creation.",
          entity.getFullyQualifiedName());
      return null;
    }

    // Detect composite foreign key constraints
    if (referredColumns != null && columns.size() != referredColumns.size()) {
      LOG.info(
          "Composite foreign key constraint detected for table '{}': {} Table columns mapped to {} referred columns.",
          entity.getFullyQualifiedName(),
          columns.size(),
          referredColumns.size());
      return null;
    }

    // Safe bounds checking for matching sizes
    if (columnIndex >= columns.size()) {
      LOG.warn(
          "Column index {} is out of bounds for constraint columns of size {}. Skipping constraint creation.",
          columnIndex,
          columns.size());
      return null;
    }

    try {
      Map<String, Object> relationshipMap = new HashMap<>();

      // Store only entity field (upstream entity)
      // relatedEntity is the upstream entity that the current entity depends on
      relationshipMap.put(
          "entity", buildEntityRefMap(relatedEntity.getEntityReference())); // upstream entity only
      relationshipMap.put(
          "docId", relatedEntity.getId().toString() + "-" + entity.getId().toString());

      List<Map<String, Object>> columnsList = new ArrayList<>();
      String columnFQN =
          FullyQualifiedName.add(entity.getFullyQualifiedName(), columns.get(columnIndex));

      Map<String, Object> columnMap = new HashMap<>();
      columnMap.put("columnFQN", referredColumn); // Upstream column
      columnMap.put("relatedColumnFQN", columnFQN); // Downstream column
      columnMap.put("relationshipType", tableConstraint.getRelationshipType());
      columnsList.add(columnMap);

      relationshipMap.put("columns", columnsList);
      return relationshipMap;

    } catch (Exception ex) {
      LOG.error(
          "Failed to create constraint relationship for entity '{}', column index {}, referred column '{}'. "
              + "Skipping this relationship to continue processing. Error: {}",
          entity.getFullyQualifiedName(),
          columnIndex,
          referredColumn,
          ex.getMessage());
      return null;
    }
  }

  static Map<String, Object> checkUpstreamRelationship(
      String entityFQN, String relatedEntityFQN, List<Map<String, Object>> relationships) {
    for (Map<String, Object> relationship : relationships) {
      Map<String, Object> upstreamEntity = (Map<String, Object>) relationship.get("entity");
      // Check if this upstream entity relationship already exists (compare by FQN)
      if (relatedEntityFQN.equals(upstreamEntity.get("fullyQualifiedName"))) {
        return relationship;
      }
    }
    return null;
  }

  private static void updateExistingUpstreamRelationship(
      EntityInterface entity,
      TableConstraint tableConstraint,
      Map<String, Object> existingRelationship,
      String referredColumn,
      int columnIndex) {

    // Handle composite key scenarios gracefully
    List<String> columns = tableConstraint.getColumns();
    List<String> referredColumns = tableConstraint.getReferredColumns();

    if (columns == null || columns.isEmpty()) {
      LOG.warn(
          "Table constraint has no local columns for entity: {}. Skipping constraint update.",
          entity.getFullyQualifiedName());
      return;
    }

    // Detect composite foreign key constraints
    if (referredColumns != null && columns.size() != referredColumns.size()) {
      LOG.info(
          "Composite foreign key constraint detected for table '{}': {} Table columns mapped to {} referred columns.",
          entity.getFullyQualifiedName(),
          columns.size(),
          referredColumns.size());
      return;
    }

    // Safe bounds checking for matching sizes
    if (columnIndex >= columns.size()) {
      LOG.warn(
          "Column index {} is out of bounds for constraint columns of size {}. Skipping constraint update.",
          columnIndex,
          columns.size());
      return;
    }

    try {
      String columnFQN =
          FullyQualifiedName.add(entity.getFullyQualifiedName(), columns.get(columnIndex));

      Map<String, Object> columnMap = new HashMap<>();
      columnMap.put("columnFQN", referredColumn); // Upstream column
      columnMap.put("relatedColumnFQN", columnFQN); // Downstream column
      columnMap.put("relationshipType", tableConstraint.getRelationshipType());

      List<Map<String, Object>> existingColumns =
          (List<Map<String, Object>>) existingRelationship.get("columns");
      existingColumns.add(columnMap);

    } catch (Exception ex) {
      LOG.error(
          "Failed to update constraint relationship for entity '{}', column index {}, referred column '{}'. "
              + "Skipping this relationship to continue processing. Error: {}",
          entity.getFullyQualifiedName(),
          columnIndex,
          referredColumn,
          ex.getMessage());
    }
  }

  static Map<String, Object> buildEntityRefMap(EntityReference entityRef) {
    Map<String, Object> details = new HashMap<>();
    details.put("id", entityRef.getId().toString());
    details.put("type", entityRef.getType());
    details.put("fullyQualifiedName", entityRef.getFullyQualifiedName());
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
