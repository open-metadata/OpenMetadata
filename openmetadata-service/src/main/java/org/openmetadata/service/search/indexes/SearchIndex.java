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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.change.ChangeSummary;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public interface SearchIndex {
  Set<String> DEFAULT_EXCLUDED_FIELDS =
      Set.of(
          "changeDescription",
          "incrementalChangeDescription",
          "upstreamLineage.pipeline.changeDescription",
          "upstreamLineage.pipeline.incrementalChangeDescription",
          "connection",
          "changeSummary");

  /**
   * Relationship/enrichment fields fetched by {@code EntityRepository.setFields} that every search
   * document populates via {@link #populateCommonFields(Map, EntityInterface, String)}. Stored-JSON
   * fields (name, displayName, description, service, entity-native counts) are NOT in this set —
   * they live on the entity row and need no extra fetch.
   */
  Set<String> COMMON_REINDEX_FIELDS =
      Set.of(
          "owners",
          "domains",
          "reviewers",
          "followers",
          "votes",
          "extension",
          "tags",
          "certification",
          "dataProducts");

  SearchClient searchClient = Entity.getSearchRepository().getSearchClient();
  Logger LOG = LoggerFactory.getLogger(SearchIndex.class);

  default Map<String, Object> buildSearchIndexDoc() {
    return buildSearchIndexDoc(DocBuildContext.empty());
  }

  /**
   * Builds the search index document with optional pre-fetched data passed via {@link
   * DocBuildContext}. Reindex bulk sinks construct a context with batch-prefetched lineage so
   * doc-build mixins skip per-entity DB lookups; all other callers should keep using the no-arg
   * overload, which delegates here with {@link DocBuildContext#empty()}.
   */
  default Map<String, Object> buildSearchIndexDoc(DocBuildContext ctx) {
    Object entity = getEntity();
    Map<String, Object> esDoc = JsonUtils.getMap(entity);

    // Phase 1: Common entity fields (owners, domains, displayName, etc.)
    if (entity instanceof EntityInterface ei) {
      populateCommonFields(esDoc, ei, getEntityTypeName());
    }

    // Phase 2: Mixin fields (tags, service, lineage) — auto-applied based on interface
    if (this instanceof TaggableIndex ti) {
      ti.applyTagFields(esDoc);
    }
    if (this instanceof ServiceBackedIndex sbi) {
      sbi.applyServiceFields(esDoc);
    }
    if (this instanceof LineageIndex li) {
      li.applyLineageFields(esDoc, ctx);
    }

    // Phase 3: Entity-specific fields only
    esDoc = this.buildSearchIndexDocInternal(esDoc);

    // Phase 4: FQN hash
    if (esDoc.containsKey(Entity.FIELD_FULLY_QUALIFIED_NAME)
        && !nullOrEmpty((String) esDoc.get(Entity.FIELD_FULLY_QUALIFIED_NAME))) {
      String fqn = (String) esDoc.get(Entity.FIELD_FULLY_QUALIFIED_NAME);
      esDoc.put("fqnHash", FullyQualifiedName.buildHash(fqn));
    }

    // Phase 5: Cleanup
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

  /**
   * Returns the entity type name (e.g., Entity.TABLE). Used by mixin interfaces to avoid requiring
   * each implementation to pass the entity type explicitly.
   */
  String getEntityTypeName();

  default Set<String> getExcludedFields() {
    return Collections.emptySet();
  }

  Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc);

  /**
   * Returns the minimal set of fields the {@code SearchIndexApp} reindex path must ask
   * {@code EntityRepository.setFields} to populate for this index to build a correct document.
   *
   * <p>Default is {@link #COMMON_REINDEX_FIELDS}, augmented with {@code "tags"} when the index
   * implements {@link TaggableIndex}. Individual index classes override to add entity-specific
   * relationships. Keep this method side-effect-free and safe to call on a probe instance whose
   * entity is {@code null} — it is invoked without an entity to discover fields statically.
   */
  default Set<String> getRequiredReindexFields() {
    Set<String> fields = new java.util.HashSet<>(COMMON_REINDEX_FIELDS);
    if (this instanceof TaggableIndex) {
      fields.add("tags");
    }
    return java.util.Collections.unmodifiableSet(fields);
  }

  /**
   * Populates common entity fields into the search index document. Called automatically by {@link
   * #buildSearchIndexDoc()} for all EntityInterface-based entities. Individual index classes should
   * NOT call this — it is handled by the framework.
   */
  default void populateCommonFields(
      Map<String, Object> doc, EntityInterface entity, String entityType) {
    doc.put(
        "displayName",
        entity.getDisplayName() != null && !entity.getDisplayName().isBlank()
            ? entity.getDisplayName()
            : entity.getName());
    doc.put("entityType", entityType);
    List<EntityReference> ownersList = getEntitiesWithDisplayName(entity.getOwners());
    doc.put("owners", ownersList);
    doc.put(
        "ownerDisplayName",
        ownersList.stream()
            .map(EntityReference::getDisplayName)
            .filter(n -> !nullOrEmpty(n))
            .toList());
    doc.put(
        "ownerName",
        ownersList.stream().map(EntityReference::getName).filter(n -> !nullOrEmpty(n)).toList());
    doc.put("domains", getEntitiesWithDisplayName(entity.getDomains()));
    doc.put("reviewers", getEntitiesWithDisplayName(entity.getReviewers()));
    doc.put("followers", SearchIndexUtils.parseFollowers(entity.getFollowers()));
    doc.put(
        "entityStatus",
        entity.getEntityStatus() != null
            ? entity.getEntityStatus().value()
            : org.openmetadata.schema.type.EntityStatus.UNPROCESSED.value());
    if (entity.getVotes() != null) {
      int upVotes = entity.getVotes().getUpVotes() != null ? entity.getVotes().getUpVotes() : 0;
      int downVotes =
          entity.getVotes().getDownVotes() != null ? entity.getVotes().getDownVotes() : 0;
      doc.put("totalVotes", Math.max(upVotes - downVotes, 0));
      Map<String, Object> votesMap = new HashMap<>();
      votesMap.put("upVotes", upVotes);
      votesMap.put("downVotes", downVotes);
      doc.put("votes", votesMap);
    } else {
      doc.put("totalVotes", 0);
    }

    doc.put("descriptionStatus", getDescriptionStatus(entity));

    Map<String, ChangeSummary> changeSummaryMap = SearchIndexUtils.getChangeSummaryMap(entity);
    doc.put(
        "descriptionSources", SearchIndexUtils.processDescriptionSources(entity, changeSummaryMap));
    // tagSources/tierSources only for entities that support tags (TaggableIndex sets tier)
    if (this instanceof TaggableIndex) {
      SearchIndexUtils.TagAndTierSources tagAndTierSources =
          SearchIndexUtils.processTagAndTierSources(entity);
      doc.put("tagSources", tagAndTierSources.getTagSources());
      doc.put("tierSources", tagAndTierSources.getTierSources());
    }

    doc.put("fqnParts", getFQNParts(entity.getFullyQualifiedName()));
    doc.put("deleted", entity.getDeleted() != null && entity.getDeleted());
    doc.put("certification", entity.getCertification());

    doc.put(
        "customPropertiesTyped",
        SearchIndexUtils.buildTypedCustomProperties(entity.getExtension(), entityType));
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

  /**
   * Returns the batch-prefetched upstream lineage map for {@code entities} when {@code
   * entityType}'s index implements {@link LineageIndex}, or {@code null} when prefetch is not
   * applicable. {@code null} is returned in any of these cases:
   *
   * <ul>
   *   <li>{@code entities} is null/empty,
   *   <li>the entity type's index does not implement {@link LineageIndex},
   *   <li>the batch DB call inside {@link #prefetchUpstreamLineage(List)} failed.
   * </ul>
   *
   * A non-null map (possibly with entity-id keys mapping to empty lists for entities that have no
   * upstream edges) signals "prefetch succeeded; bind the per-entity slice into {@link
   * DocBuildContext}". Callers that get {@code null} must leave the context empty so doc-build
   * falls back to per-entity DB lookups via {@link #getLineageData(EntityReference)}.
   */
  static Map<UUID, List<EsLineageData>> prefetchLineageIfSupported(
      String entityType, List<? extends EntityInterface> entities) {
    Map<UUID, List<EsLineageData>> result = null;
    if (!nullOrEmpty(entities) && supportsLineagePrefetch(entityType)) {
      Map<UUID, List<EsLineageData>> prefetched = prefetchUpstreamLineage(entities);
      if (!prefetched.isEmpty()) {
        result = prefetched;
      }
    }
    return result;
  }

  /**
   * Per-JVM cache of "does {@code entityType}'s index implement {@link LineageIndex}?" so the
   * type-level marker probe runs at most once per type. Bounded per the project's caching policy
   * (CLAUDE.md): entity types are a closed set (~50), so 256 is far above the working set and
   * still satisfies "no unbounded caches".
   */
  com.google.common.cache.Cache<String, Boolean> LINEAGE_PREFETCH_SUPPORT_CACHE =
      com.google.common.cache.CacheBuilder.newBuilder().maximumSize(256).build();

  /**
   * Type-level marker check: builds the index for {@code entityType} with a {@code null} entity
   * (the same null-entity probe pattern used by {@code SearchIndexFactory#getReindexFieldsFor})
   * and returns true if the resulting index implements {@link LineageIndex}. Avoids constructing
   * a throwaway index over a real entity instance just to read a marker interface.
   *
   * <p>Only successful probes are memoized into {@link #LINEAGE_PREFETCH_SUPPORT_CACHE}; if the
   * probe fails (e.g. transient class-init issue during startup, mocked Entity in tests) we
   * return {@code false} without caching so a subsequent call retries.
   */
  private static boolean supportsLineagePrefetch(String entityType) {
    Boolean cached = LINEAGE_PREFETCH_SUPPORT_CACHE.getIfPresent(entityType);
    if (cached == null) {
      cached = probeLineagePrefetchSupport(entityType);
      if (cached != null) {
        LINEAGE_PREFETCH_SUPPORT_CACHE.put(entityType, cached);
      }
    }
    return Boolean.TRUE.equals(cached);
  }

  private static Boolean probeLineagePrefetchSupport(String entityType) {
    Boolean supported = null;
    try {
      SearchIndex probe = Entity.buildSearchIndex(entityType, null);
      supported = probe instanceof LineageIndex;
    } catch (Exception | LinkageError e) {
      LOG.warn(
          "Could not determine LineageIndex support for type '{}'; will retry on next call",
          entityType,
          e);
    }
    return supported;
  }

  /**
   * Batch-prefetch upstream lineage for every entity in {@code entities} using one
   * {@code findFromBatch} call and one {@code getEntityReferencesByIds} call per upstream entity
   * type. The returned map is keyed by every input entity's id (entities with no upstream lineage
   * map to an empty list), so the doc-build phase can wrap it in a {@link DocBuildContext} and
   * skip per-entity JDBI handle acquisition entirely.
   *
   * <p>An empty map signals "nothing prefetched" — either the input was empty or the batch DB
   * call failed. In the failure case callers must build doc-build {@link DocBuildContext#empty()}
   * so doc-build falls back to per-entity DB lookups.
   */
  static Map<UUID, List<EsLineageData>> prefetchUpstreamLineage(
      List<? extends EntityInterface> entities) {
    Map<UUID, List<EsLineageData>> result = new HashMap<>();
    if (!nullOrEmpty(entities)) {
      populatePrefetchedUpstreamLineage(entities, result);
    }
    return result;
  }

  private static void populatePrefetchedUpstreamLineage(
      List<? extends EntityInterface> entities, Map<UUID, List<EsLineageData>> result) {
    Map<UUID, EntityReference> toRefByEntityId = new HashMap<>(entities.size());
    List<String> toIds = new ArrayList<>(entities.size());
    // Seed every input id with the shared immutable empty-list sentinel. Reindex batches are
    // typically sparse in upstream lineage (most entities have none), so deferring the
    // ArrayList allocation to the first edge keeps the no-lineage path GC-free.
    for (EntityInterface entity : entities) {
      UUID entityId = entity.getId();
      if (entityId == null) {
        continue;
      }
      result.put(entityId, Collections.emptyList());
      toIds.add(entityId.toString());
      toRefByEntityId.put(entityId, entity.getEntityReference());
    }
    // Skip the batch DB call when every input entity had a null id; `WHERE toId IN ()` is
    // invalid SQL on most engines and the call would log noise for no benefit.
    if (!toIds.isEmpty()) {
      List<CollectionDAO.EntityRelationshipObject> records = fetchUpstreamRelationships(toIds);
      if (records == null) {
        result.clear();
      } else if (!records.isEmpty()) {
        Map<UUID, EntityReference> upstreamRefById = resolveUpstreamReferences(records);
        mergeRecordsIntoResult(records, upstreamRefById, toRefByEntityId, result);
      }
    }
  }

  private static List<CollectionDAO.EntityRelationshipObject> fetchUpstreamRelationships(
      List<String> toIds) {
    List<CollectionDAO.EntityRelationshipObject> records;
    try {
      records =
          Entity.getCollectionDAO()
              .relationshipDAO()
              .findFromBatch(toIds, Relationship.UPSTREAM.ordinal(), Include.ALL);
    } catch (Exception e) {
      LOG.warn("Batch lineage prefetch failed; doc-build will fall back to per-entity lookups", e);
      records = null;
    }
    return records;
  }

  private static Map<UUID, EntityReference> resolveUpstreamReferences(
      List<CollectionDAO.EntityRelationshipObject> records) {
    Map<String, Set<UUID>> upstreamIdsByType = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject rec : records) {
      UUID fromId = parseUuidOrNull(rec.getFromId());
      if (fromId != null && !nullOrEmpty(rec.getFromEntity())) {
        upstreamIdsByType.computeIfAbsent(rec.getFromEntity(), k -> new HashSet<>()).add(fromId);
      }
    }
    Map<UUID, EntityReference> upstreamRefById = new HashMap<>();
    for (Map.Entry<String, Set<UUID>> entry : upstreamIdsByType.entrySet()) {
      try {
        List<EntityReference> refs =
            Entity.getEntityReferencesByIds(
                entry.getKey(), new ArrayList<>(entry.getValue()), Include.ALL);
        for (EntityReference ref : refs) {
          upstreamRefById.put(ref.getId(), ref);
        }
      } catch (Exception e) {
        LOG.warn(
            "Failed to batch-fetch upstream references for type '{}' during lineage prefetch",
            entry.getKey(),
            e);
      }
    }
    return upstreamRefById;
  }

  private static void mergeRecordsIntoResult(
      List<CollectionDAO.EntityRelationshipObject> records,
      Map<UUID, EntityReference> upstreamRefById,
      Map<UUID, EntityReference> toRefByEntityId,
      Map<UUID, List<EsLineageData>> result) {
    for (CollectionDAO.EntityRelationshipObject rec : records) {
      UUID toId = parseUuidOrNull(rec.getToId());
      UUID fromId = parseUuidOrNull(rec.getFromId());
      if (toId != null && fromId != null) {
        EntityReference toRef = toRefByEntityId.get(toId);
        EntityReference fromRef = upstreamRefById.get(fromId);
        if (toRef != null) {
          appendLineageEdge(rec, fromRef, toRef, fromId, toId, result);
        }
      }
    }
  }

  private static UUID parseUuidOrNull(String value) {
    UUID parsed = null;
    try {
      parsed = UUID.fromString(value);
    } catch (IllegalArgumentException | NullPointerException e) {
      LOG.warn("Skipping prefetch record with invalid UUID '{}'", value);
    }
    return parsed;
  }

  private static void appendLineageEdge(
      CollectionDAO.EntityRelationshipObject rec,
      EntityReference fromRef,
      EntityReference toRef,
      UUID fromId,
      UUID toId,
      Map<UUID, List<EsLineageData>> result) {
    if (fromRef == null) {
      LOG.warn(
          "Upstream entity '{}' (ID: {}) not found during prefetch for '{}'; skipping lineage edge",
          rec.getFromEntity(),
          fromId,
          toRef.getFullyQualifiedName());
    } else {
      try {
        LineageDetails details = JsonUtils.readValue(rec.getJson(), LineageDetails.class);
        EsLineageData edge = buildEntityLineageData(fromRef, toRef, details);
        // Promote the empty-list sentinel to a mutable ArrayList on first edge.
        List<EsLineageData> sink = result.get(toId);
        if (!(sink instanceof ArrayList)) {
          sink = new ArrayList<>();
          result.put(toId, sink);
        }
        sink.add(edge);
      } catch (Exception e) {
        LOG.warn(
            "Failed to build prefetched lineage edge {} -> {}",
            fromRef.getFullyQualifiedName(),
            toRef.getFullyQualifiedName(),
            e);
      }
    }
  }

  static List<EsLineageData> getLineageDataFromRefs(
      EntityReference entity, List<CollectionDAO.EntityRelationshipRecord> records) {
    List<EsLineageData> data = new ArrayList<>();
    for (CollectionDAO.EntityRelationshipRecord entityRelationshipRecord : records) {
      try {
        EntityReference ref =
            Entity.getEntityReferenceById(
                entityRelationshipRecord.getType(), entityRelationshipRecord.getId(), Include.ALL);
        LineageDetails lineageDetails =
            JsonUtils.readValue(entityRelationshipRecord.getJson(), LineageDetails.class);
        data.add(buildEntityLineageData(ref, entity, lineageDetails));
      } catch (EntityNotFoundException ex) {
        // Upstream entity was deleted but lineage relationship still exists
        // Skip this lineage edge gracefully to prevent search indexing failure
        LOG.warn(
            "Upstream entity '{}' (ID: {}) not found for entity '{}'. Skipping lineage edge. Error: {}",
            entityRelationshipRecord.getType(),
            entityRelationshipRecord.getId(),
            entity.getFullyQualifiedName(),
            ex.getMessage());
      } catch (Exception ex) {
        // Mirror the prefetch path: malformed lineage JSON or a transient failure on one edge
        // should not fail the whole entity's indexing. Log and skip; other edges still apply.
        LOG.warn(
            "Failed to build legacy lineage edge for entity '{}' from upstream '{}' (ID: {}); skipping",
            entity.getFullyQualifiedName(),
            entityRelationshipRecord.getType(),
            entityRelationshipRecord.getId(),
            ex);
      }
    }
    return data;
  }

  /**
   * Populates upstreamLineage and lineageSqlQueries in the given search doc map.
   *
   * <p>Identical SQL queries across edges are deduplicated: the full text is stored once in
   * lineageSqlQueries keyed by a sequential integer, and each edge carries only the key via
   * sqlQueryKey. Edges with unique SQL still get their SQL stored (and keyed). The authoritative
   * per-edge SQL remains in the database; this deduplication is search-doc-local.
   */
  static void populateLineageData(Map<String, Object> doc, EntityReference entity) {
    List<EsLineageData> edges = getLineageData(entity);
    Map<String, String> sqlQueries = SearchIndexUtils.deduplicateSqlAcrossEdges(edges);
    doc.put("upstreamLineage", edges);
    if (!sqlQueries.isEmpty()) {
      doc.put("lineageSqlQueries", sqlQueries);
    }
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
        } catch (EntityNotFoundException ex) {
          LOG.warn(
              "Related table [{}] not found for upstream entity relationship of [{}]: {}",
              relatedEntityFQN,
              entity.getFullyQualifiedName(),
              ex.getMessage());
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
