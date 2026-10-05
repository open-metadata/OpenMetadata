/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.EntityLifecycle;
import org.openmetadata.service.ontology.OntologyAiAvailability;
import org.openmetadata.service.ontology.OntologyMemoryDerivationQueue;
import org.openmetadata.service.resources.context.ContextMemoryResource;
import org.openmetadata.service.resources.context.ContextMemoryVisibility;
import org.openmetadata.service.resources.drive.ContextFileVisibility;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.search.vector.ContextMemoryBodyTextContributor;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Every memory is written to the search index regardless of its {@code shareConfig.visibility}, and
 * privacy is enforced at query time by {@link
 * org.openmetadata.service.search.security.ContextMemorySearchVisibility}. Indexing only org-wide
 * memories would hide a user's own PRIVATE memories and the SHARED ones they are a principal of
 * from {@code GET /contextCenter/memories}, which serves the ContextCenter listing from search
 * whenever it is given a query, filter, sort or offset.
 */
@Slf4j
@Repository(name = "ContextMemoryRepository")
public class ContextMemoryRepository extends EntityRepository<ContextMemory> {

  public static final String FIELD_PRIMARY_ENTITY = "primaryEntity";
  public static final String FIELD_RELATED_ENTITIES = "relatedEntities";
  static final String FIELD_DERIVED_ENTITIES = "derivedEntities";
  public static final String FIELD_SOURCE_FILE = "sourceFile";
  static final String FIELD_SOURCE_ENTITY = "sourceEntity";
  private static final String PATCH_FIELDS =
      FIELD_PRIMARY_ENTITY
          + ","
          + FIELD_RELATED_ENTITIES
          + ",rootMemory,parentMemory,"
          + FIELD_SOURCE_FILE
          + ","
          + FIELD_SOURCE_ENTITY;
  private static final String UPDATE_FIELDS =
      FIELD_PRIMARY_ENTITY
          + ","
          + FIELD_RELATED_ENTITIES
          + ",rootMemory,parentMemory,"
          + FIELD_SOURCE_FILE
          + ","
          + FIELD_SOURCE_ENTITY;

  static {
    ContextMemoryBodyTextContributor.INSTANCE.register();
  }

  /** Memory-specific stages and transitions; the shared repository validates every stage change. */
  public static final EntityLifecycle LIFECYCLE =
      new EntityLifecycle(
          Map.of(
              EntityStatus.DRAFT, Set.of(EntityStatus.APPROVED, EntityStatus.ARCHIVED),
              EntityStatus.APPROVED,
                  Set.of(EntityStatus.ARCHIVED, EntityStatus.DEPRECATED, EntityStatus.REJECTED),
              EntityStatus.DEPRECATED, Set.of(EntityStatus.APPROVED, EntityStatus.ARCHIVED),
              EntityStatus.REJECTED, Set.of(EntityStatus.APPROVED, EntityStatus.ARCHIVED),
              EntityStatus.ARCHIVED, Set.of(EntityStatus.APPROVED)));

  public ContextMemoryRepository() {
    super(
        ContextMemoryResource.COLLECTION_PATH,
        Entity.CONTEXT_MEMORY,
        ContextMemory.class,
        Entity.getCollectionDAO().contextMemoryDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;
    entityLifecycle = LIFECYCLE;
    defaultEntityStatus = EntityStatus.APPROVED;
  }

  public ResultList<ContextMemory> listContextMemoriesWithStatuses(
      UriInfo uriInfo,
      SearchListFilter searchListFilter,
      int limit,
      int offset,
      SearchSortFilter searchSortFilter,
      String q,
      SecurityContext securityContext,
      List<EntityStatus> statuses)
      throws IOException {
    SearchResultListMapper results =
        searchRepository.listContextMemoriesWithStatuses(
            searchListFilter,
            limit,
            offset,
            searchSortFilter,
            q,
            DefaultAuthorizer.getSubjectContext(securityContext),
            statuses);
    List<ContextMemory> entityList = new ArrayList<>();
    for (Map<String, Object> json : results.getResults()) {
      SearchIndexUtils.normalizeFollowers(json);
      ContextMemory entity = JsonUtils.readOrConvertValueLenient(json, ContextMemory.class);
      entityList.add(withHref(uriInfo, entity));
    }
    return new ResultList<>(entityList, offset, limit, (int) results.getTotal());
  }

  @Override
  protected void postCreate(ContextMemory memory) {
    super.postCreate(memory);
    ontologyQueue().enqueue(memory, memory.getUpdatedBy());
  }

  @Override
  protected void postCreate(List<ContextMemory> memories) {
    super.postCreate(memories);
    if (nullOrEmpty(memories)) {
      return;
    }
    OntologyMemoryDerivationQueue queue = ontologyQueue();
    memories.forEach(memory -> queue.enqueue(memory, memory.getUpdatedBy()));
  }

  @Override
  protected void postUpdate(ContextMemory previous, ContextMemory updated) {
    super.postUpdate(previous, updated);
    if (OntologyMemoryDerivationQueue.hasNewPublishedContent(previous, updated)
        && OntologyAiAvailability.isMemoryDerivationEnabled()
        && getDerivedEntities(updated).isEmpty()) {
      ontologyQueue().enqueue(updated, updated.getUpdatedBy());
    }
  }

  /** Whether the memory row exists, soft-deleted or not; provenance may point at either. */
  static boolean memoryExists(UUID memoryId) {
    EntityDAO<?> dao = Entity.getEntityRepository(Entity.CONTEXT_MEMORY).getDao();
    return dao.exists(dao.getTableName(), memoryId);
  }

  private OntologyMemoryDerivationQueue ontologyQueue() {
    return new OntologyMemoryDerivationQueue(
        Entity.getJobDAO(), OntologyAiAvailability::isMemoryDerivationEnabled);
  }

  @Override
  protected void setFields(ContextMemory entity, Fields fields, RelationIncludes relationIncludes) {
    if (fields.contains(FIELD_PRIMARY_ENTITY)) {
      entity.setPrimaryEntity(getPrimaryEntity(entity));
    }
    if (fields.contains(FIELD_RELATED_ENTITIES)) {
      entity.setRelatedEntities(getRelatedEntities(entity));
    }
    if (fields.contains(FIELD_DERIVED_ENTITIES)) {
      entity.setDerivedEntities(getDerivedEntities(entity));
    }
    if (fields.contains(FIELD_SOURCE_ENTITY) || fields.contains(FIELD_SOURCE_FILE)) {
      EntityReference source = getSourceEntity(entity);
      if (fields.contains(FIELD_SOURCE_ENTITY)) {
        entity.setSourceEntity(source);
      }
      if (fields.contains(FIELD_SOURCE_FILE)) {
        entity.setSourceFile(asContextFileRef(source));
      }
    }
  }

  @Override
  protected void clearFields(ContextMemory entity, Fields fields) {
    if (!fields.contains(FIELD_PRIMARY_ENTITY)) {
      entity.setPrimaryEntity(null);
    }
    if (!fields.contains(FIELD_RELATED_ENTITIES)) {
      entity.setRelatedEntities(null);
    }
    if (!fields.contains(FIELD_DERIVED_ENTITIES)) {
      entity.setDerivedEntities(null);
    }
    if (!fields.contains(FIELD_SOURCE_ENTITY)) {
      entity.setSourceEntity(null);
    }
    if (!fields.contains(FIELD_SOURCE_FILE)) {
      entity.setSourceFile(null);
    }
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<ContextMemory> entities) {
    if (nullOrEmpty(entities)) {
      return;
    }
    fetchAndSetPrimaryEntities(entities, fields);
    fetchAndSetRelatedEntities(entities, fields);
    fetchAndSetDerivedEntities(entities, fields);
    fetchAndSetSources(entities, fields);
    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    for (ContextMemory entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  private void fetchAndSetPrimaryEntities(List<ContextMemory> entities, Fields fields) {
    if (!fields.contains(FIELD_PRIMARY_ENTITY)) {
      return;
    }
    Map<UUID, EntityReference> primaryById = batchFetchPrimaryEntities(entities);
    entities.forEach(memory -> memory.setPrimaryEntity(primaryById.get(memory.getId())));
  }

  private Map<UUID, EntityReference> batchFetchPrimaryEntities(List<ContextMemory> entities) {
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatchWithRelations(
                entityListToStrings(entities),
                Entity.CONTEXT_MEMORY,
                List.of(Relationship.APPLIED_TO.ordinal(), Relationship.HAS.ordinal()),
                Include.NON_DELETED);
    Map<String, EntityReference> refById = resolveReferencesByType(records);
    Map<UUID, EntityReference> appliedTo = new HashMap<>();
    Map<UUID, EntityReference> hasFallback = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : records) {
      indexPrimaryRecord(record, refById, appliedTo, hasFallback);
    }
    hasFallback.forEach(appliedTo::putIfAbsent);
    return appliedTo;
  }

  private void indexPrimaryRecord(
      CollectionDAO.EntityRelationshipObject record,
      Map<String, EntityReference> refById,
      Map<UUID, EntityReference> appliedTo,
      Map<UUID, EntityReference> hasFallback) {
    EntityReference ref = refById.get(record.getFromId());
    if (ref == null) {
      return;
    }
    UUID memoryId = UUID.fromString(record.getToId());
    if (record.getRelation() == Relationship.APPLIED_TO.ordinal()) {
      appliedTo.putIfAbsent(memoryId, ref);
    } else if (!Entity.DOMAIN.equals(ref.getType())) {
      hasFallback.putIfAbsent(memoryId, ref);
    }
  }

  private void fetchAndSetRelatedEntities(List<ContextMemory> entities, Fields fields) {
    if (!fields.contains(FIELD_RELATED_ENTITIES)) {
      return;
    }
    Map<UUID, List<EntityReference>> relatedById = batchFetchRelatedEntities(entities);
    entities.forEach(
        memory ->
            memory.setRelatedEntities(
                relatedById.getOrDefault(memory.getId(), Collections.emptyList())));
  }

  private Map<UUID, List<EntityReference>> batchFetchRelatedEntities(List<ContextMemory> entities) {
    Map<UUID, List<EntityReference>> relatedById = new HashMap<>();
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(entities),
                Relationship.RELATED_TO.ordinal(),
                Include.NON_DELETED);
    Map<String, EntityReference> refById = resolveReferencesByType(records);
    for (CollectionDAO.EntityRelationshipObject record : records) {
      EntityReference ref = refById.get(record.getFromId());
      if (ref != null) {
        relatedById
            .computeIfAbsent(UUID.fromString(record.getToId()), id -> new ArrayList<>())
            .add(ref);
      }
    }
    relatedById.values().forEach(refs -> refs.sort(EntityUtil.compareEntityReference));
    return relatedById;
  }

  private Map<String, EntityReference> resolveReferencesByType(
      List<CollectionDAO.EntityRelationshipObject> records) {
    Map<String, Set<UUID>> idsByType = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : records) {
      String fromType = record.getFromEntity();
      // Skip types that have no repository (e.g. search-index-only pseudo-types such as
      // tableColumn): resolving them throws EntityNotFoundException, and a single stray
      // relationship row would otherwise fail the whole list response.
      if (!Entity.hasEntityRepository(fromType)) {
        continue;
      }
      idsByType
          .computeIfAbsent(fromType, type -> new HashSet<>())
          .add(UUID.fromString(record.getFromId()));
    }
    Map<String, EntityReference> refById = new HashMap<>();
    idsByType.forEach(
        (type, ids) ->
            Entity.getEntityReferencesByIds(type, new ArrayList<>(ids), Include.NON_DELETED)
                .forEach(ref -> refById.put(ref.getId().toString(), ref)));
    return refById;
  }

  private EntityReference getPrimaryEntity(ContextMemory entity) {
    List<EntityReference> refs =
        findFrom(entity.getId(), Entity.CONTEXT_MEMORY, Relationship.APPLIED_TO, null);
    if (nullOrEmpty(refs)) {
      // Fallback for data written before the APPLIED_TO migration. Filter out domain refs
      // because domains use the same HAS relationship type (domain --HAS--> contextMemory).
      refs =
          findFrom(entity.getId(), Entity.CONTEXT_MEMORY, Relationship.HAS, null).stream()
              .filter(r -> !Entity.DOMAIN.equals(r.getType()))
              .toList();
    }
    return nullOrEmpty(refs) ? null : refs.getFirst();
  }

  private List<EntityReference> getRelatedEntities(ContextMemory entity) {
    return findFrom(entity.getId(), Entity.CONTEXT_MEMORY, Relationship.RELATED_TO, null);
  }

  private List<EntityReference> getDerivedEntities(ContextMemory entity) {
    return findFrom(
        entity.getId(), Entity.CONTEXT_MEMORY, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM);
  }

  private void fetchAndSetDerivedEntities(List<ContextMemory> entities, Fields fields) {
    if (!fields.contains(FIELD_DERIVED_ENTITIES)) {
      return;
    }
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(entities),
                Relationship.DERIVED_FROM.ordinal(),
                Include.NON_DELETED);
    Map<String, EntityReference> refById = resolveReferencesByType(records);
    Map<UUID, List<EntityReference>> derivedById = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : records) {
      if (!Entity.GLOSSARY_TERM.equals(record.getFromEntity())) {
        continue;
      }
      EntityReference ref = refById.get(record.getFromId());
      if (ref != null) {
        derivedById
            .computeIfAbsent(UUID.fromString(record.getToId()), id -> new ArrayList<>())
            .add(ref);
      }
    }
    derivedById.values().forEach(refs -> refs.sort(EntityUtil.compareEntityReference));
    entities.forEach(
        memory ->
            memory.setDerivedEntities(
                derivedById.getOrDefault(memory.getId(), Collections.emptyList())));
  }

  /** The single Context Center source (file or page) a memory was extracted from, via MENTIONED_IN. */
  private EntityReference getSourceEntity(ContextMemory entity) {
    List<EntityReference> refs =
        findFrom(entity.getId(), Entity.CONTEXT_MEMORY, Relationship.MENTIONED_IN, null);
    return nullOrEmpty(refs) ? null : refs.getFirst();
  }

  /** Back-compat view: the deprecated sourceFile is the source only when it is a ContextFile. */
  private EntityReference asContextFileRef(EntityReference source) {
    return source != null && Entity.CONTEXT_FILE.equals(source.getType()) ? source : null;
  }

  private void fetchAndSetSources(List<ContextMemory> entities, Fields fields) {
    if (!fields.contains(FIELD_SOURCE_ENTITY) && !fields.contains(FIELD_SOURCE_FILE)) {
      return;
    }
    Map<UUID, EntityReference> sourceById = batchFetchSources(entities);
    for (ContextMemory memory : entities) {
      EntityReference source = sourceById.get(memory.getId());
      if (fields.contains(FIELD_SOURCE_ENTITY)) {
        memory.setSourceEntity(source);
      }
      if (fields.contains(FIELD_SOURCE_FILE)) {
        memory.setSourceFile(asContextFileRef(source));
      }
    }
  }

  private Map<UUID, EntityReference> batchFetchSources(List<ContextMemory> entities) {
    Map<UUID, List<EntityReference>> sourcesById = new HashMap<>();
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(entities),
                Relationship.MENTIONED_IN.ordinal(),
                Include.NON_DELETED);
    Map<String, EntityReference> refById = resolveReferencesByType(records);
    for (CollectionDAO.EntityRelationshipObject record : records) {
      EntityReference ref = refById.get(record.getFromId());
      if (ref != null) {
        sourcesById
            .computeIfAbsent(UUID.fromString(record.getToId()), id -> new ArrayList<>())
            .add(ref);
      }
    }
    Map<UUID, EntityReference> sourceById = new HashMap<>();
    sourcesById.forEach(
        (id, refs) -> {
          refs.sort(EntityUtil.compareEntityReference);
          sourceById.put(id, refs.getFirst());
        });
    return sourceById;
  }

  @Override
  public void setFullyQualifiedName(ContextMemory entity) {
    if (!nullOrEmpty(entity.getFullyQualifiedName())) {
      return;
    }
    // FQN is the (immutable) memory name. Deriving it from mutable fields such as
    // primaryEntity or owners would change nameHash on update, risking unique-constraint
    // collisions and orphaned references. The link to primaryEntity/owners is captured
    // via the relationship table instead. FullyQualifiedName.build quotes reserved
    // characters, matching the convention in every other top-level entity repository.
    entity.setFullyQualifiedName(FullyQualifiedName.build(entity.getName()));
  }

  private static final Set<String> ALLOWED_SHARED_PRINCIPAL_TYPES =
      Set.of(Entity.USER, Entity.TEAM, Entity.DOMAIN);

  @Override
  public void prepare(ContextMemory entity, boolean update) {
    if (entity.getPrimaryEntity() != null) {
      EntityReference primaryEntity =
          Entity.getEntityReference(entity.getPrimaryEntity(), Include.NON_DELETED);
      entity.setPrimaryEntity(primaryEntity);
    }
    if (entity.getSourceEntity() == null && entity.getSourceFile() != null) {
      entity.setSourceEntity(entity.getSourceFile());
    }
    if (entity.getSourceEntity() != null) {
      entity.setSourceEntity(
          Entity.getEntityReference(entity.getSourceEntity(), Include.NON_DELETED));
    }
    entity.setRelatedEntities(EntityUtil.populateEntityReferences(entity.getRelatedEntities()));

    if (entity.getRootMemory() != null) {
      ContextMemory rootMemory = Entity.getEntity(entity.getRootMemory(), "", Include.NON_DELETED);
      validateNotSelfReference(entity, rootMemory.getId(), "rootMemory");
      entity.setRootMemory(rootMemory.getEntityReference());
    }
    if (entity.getParentMemory() != null) {
      ContextMemory parentMemory =
          Entity.getEntity(entity.getParentMemory(), "", Include.NON_DELETED);
      validateNotSelfReference(entity, parentMemory.getId(), "parentMemory");
      entity.setParentMemory(parentMemory.getEntityReference());
    }
    validateSharedPrincipals(entity);
    setCreatorAsDefaultOwner(entity, update);
    prepareLifecycle(entity, update);
    inheritAnchorDomains(entity, update);
  }

  private void validateNotSelfReference(ContextMemory entity, UUID referencedId, String field) {
    if (entity.getId() != null && entity.getId().equals(referencedId)) {
      throw new BadRequestException(
          String.format("A context memory cannot reference itself as %s", field));
    }
  }

  private void validateSharedPrincipals(ContextMemory entity) {
    if (entity.getShareConfig() == null || entity.getShareConfig().getSharedWith() == null) {
      return;
    }
    for (var sharedPrincipal : entity.getShareConfig().getSharedWith()) {
      if (sharedPrincipal.getPrincipal() == null) {
        continue;
      }
      EntityReference principal =
          Entity.getEntityReference(sharedPrincipal.getPrincipal(), Include.NON_DELETED);
      if (!ALLOWED_SHARED_PRINCIPAL_TYPES.contains(principal.getType())) {
        throw new BadRequestException(
            String.format(
                "Invalid shared principal type '%s'. Supported types: %s",
                principal.getType(), ALLOWED_SHARED_PRINCIPAL_TYPES));
      }
      sharedPrincipal.setPrincipal(principal);
    }
  }

  /**
   * The creator owns the memory only at creation time. On update/PUT the owners are managed by the
   * standard framework path so omitting owners no longer silently replaces previously set owners.
   */
  private void setCreatorAsDefaultOwner(ContextMemory entity, boolean update) {
    if (update || !nullOrEmpty(entity.getOwners())) {
      return;
    }
    entity.setOwners(
        List.of(
            Entity.getEntityReferenceByName(
                Entity.USER, entity.getUpdatedBy(), Include.NON_DELETED)));
  }

  private static void prepareLifecycle(ContextMemory memory, boolean update) {
    if (!update) {
      ContextMemoryLifecycle.applyCreate(
          memory, (reference, field) -> resolveLiveMemory(reference, field, memory.getUpdatedBy()));
    }
  }

  private static EntityReference resolveLiveMemory(
      EntityReference reference, String field, String userName) {
    try {
      ContextMemory target =
          Entity.getEntity(
              reference,
              ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, ""),
              Include.NON_DELETED);
      boolean admin = SubjectContext.getSubjectContext(userName).isAdmin();
      if (ContextMemoryVisibility.isVisibleToUser(target, userName, admin)) {
        return target.getEntityReference();
      }
    } catch (EntityNotFoundException e) {
      // Report the same error for missing and unreadable memories.
    }
    throw new BadRequestException(
        String.format("%s must reference a readable, non-deleted context memory", field));
  }

  /** A new memory follows its anchor's single domain for policy and search access. */
  private void inheritAnchorDomains(ContextMemory memory, boolean update) {
    if (shouldInheritAnchorDomains(memory, update)) {
      List<EntityReference> domains = listOrEmpty(anchorDomains(memory.getPrimaryEntity()));
      if (domains.size() == 1) {
        memory.setDomains(validateDomainsByRef(domains));
      }
    }
  }

  private static boolean shouldInheritAnchorDomains(ContextMemory memory, boolean update) {
    EntityReference anchor = memory.getPrimaryEntity();
    return !update
        && anchor != null
        && nullOrEmpty(memory.getDomains())
        && Entity.getEntityRepository(anchor.getType()).isSupportsDomains();
  }

  private static List<EntityReference> anchorDomains(EntityReference anchor) {
    EntityInterface entity = Entity.getEntity(anchor, Entity.FIELD_DOMAINS, Include.NON_DELETED);
    return entity.getDomains();
  }

  @Override
  public void storeEntity(ContextMemory entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(ContextMemory entity) {
    // Add-only: addRelationship upserts, so re-running on update is idempotent. Stale-edge
    // cleanup on update is handled in ContextMemoryUpdater via updateFromRelationship(s),
    // which deletes only the specific changed refs. A blanket deleteTo here would also wipe
    // the framework's domain --HAS--> memory edge (storeDomains runs before storeRelationships).
    if (entity.getPrimaryEntity() != null) {
      addRelationship(
          entity.getPrimaryEntity().getId(),
          entity.getId(),
          entity.getPrimaryEntity().getType(),
          Entity.CONTEXT_MEMORY,
          Relationship.APPLIED_TO);
    }

    for (var relatedEntity : listOrEmpty(entity.getRelatedEntities())) {
      addRelationship(
          relatedEntity.getId(),
          entity.getId(),
          relatedEntity.getType(),
          Entity.CONTEXT_MEMORY,
          Relationship.RELATED_TO);
    }

    // Distinct relationship types (CONTAINS for root-ancestor, PARENT_OF for direct parent)
    // so the two hierarchies resolve independently and neither collides with the framework's
    // HAS edges (domains).
    if (entity.getRootMemory() != null) {
      addRelationship(
          entity.getRootMemory().getId(),
          entity.getId(),
          Entity.CONTEXT_MEMORY,
          Entity.CONTEXT_MEMORY,
          Relationship.CONTAINS);
    }

    if (entity.getParentMemory() != null) {
      addRelationship(
          entity.getParentMemory().getId(),
          entity.getId(),
          Entity.CONTEXT_MEMORY,
          Entity.CONTEXT_MEMORY,
          Relationship.PARENT_OF);
    }

    if (entity.getSourceEntity() != null) {
      addRelationship(
          entity.getSourceEntity().getId(),
          entity.getId(),
          entity.getSourceEntity().getType(),
          Entity.CONTEXT_MEMORY,
          Relationship.MENTIONED_IN);
    }
  }

  private static List<EntityReference> asRefList(EntityReference ref) {
    return ref == null ? List.of() : List.of(ref);
  }

  // ------------------------------------------------------------------
  // Lifecycle enforcement
  // ------------------------------------------------------------------

  @Override
  public EntityUpdater getUpdater(
      ContextMemory original, ContextMemory updated, Operation operation, ChangeSource source) {
    return new ContextMemoryUpdater(original, updated, operation);
  }

  public class ContextMemoryUpdater extends EntityUpdater {
    public ContextMemoryUpdater(
        ContextMemory original, ContextMemory updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    void updateEntityStatus(boolean consolidatingChanges) {
      if (operation == Operation.PATCH && updated.getEntityStatus() == null) {
        throw new BadRequestException("A context memory requires an entityStatus");
      }
      super.updateEntityStatus(consolidatingChanges);
    }

    @Override
    protected boolean consolidateChanges(
        ContextMemory original, ContextMemory updated, Operation operation) {
      return original.getEntityStatus() == updated.getEntityStatus()
          && super.consolidateChanges(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      flipToManualOnUserEdit();
      recordChange("title", original.getTitle(), updated.getTitle());
      recordChange("summary", original.getSummary(), updated.getSummary());
      recordChange("question", original.getQuestion(), updated.getQuestion());
      recordChange("answer", original.getAnswer(), updated.getAnswer());
      recordChange("memoryType", original.getMemoryType(), updated.getMemoryType());
      recordChange("memoryScope", original.getMemoryScope(), updated.getMemoryScope());
      recordChange("sourceType", original.getSourceType(), updated.getSourceType());
      recordChange("pinned", original.getPinned(), updated.getPinned());
      recordChange(
          "sourceConversation", original.getSourceConversation(), updated.getSourceConversation());
      recordChange(
          "sourceHumanMessage", original.getSourceHumanMessage(), updated.getSourceHumanMessage());
      recordChange(
          "sourceAssistantMessage",
          original.getSourceAssistantMessage(),
          updated.getSourceAssistantMessage());
      recordChange(
          "machineRepresentation",
          original.getMachineRepresentation(),
          updated.getMachineRepresentation());

      updateLifecycle(consolidatingChanges);

      recordChange("shareConfig", original.getShareConfig(), updated.getShareConfig());

      // Relationship-backed fields: these helpers record the version change and delete only
      // the specific changed refs (never a blanket delete), so the framework's
      // domain --HAS--> memory edge is left intact.
      updateFromRelationships(
          FIELD_PRIMARY_ENTITY,
          Entity.CONTEXT_MEMORY,
          asRefList(original.getPrimaryEntity()),
          asRefList(updated.getPrimaryEntity()),
          Relationship.APPLIED_TO,
          Entity.CONTEXT_MEMORY,
          original.getId());
      updateFromRelationships(
          FIELD_RELATED_ENTITIES,
          Entity.CONTEXT_MEMORY,
          listOrEmpty(original.getRelatedEntities()),
          listOrEmpty(updated.getRelatedEntities()),
          Relationship.RELATED_TO,
          Entity.CONTEXT_MEMORY,
          original.getId());
      updateFromRelationship(
          "rootMemory",
          Entity.CONTEXT_MEMORY,
          original.getRootMemory(),
          updated.getRootMemory(),
          Relationship.CONTAINS,
          Entity.CONTEXT_MEMORY,
          original.getId());
      updateFromRelationship(
          "parentMemory",
          Entity.CONTEXT_MEMORY,
          original.getParentMemory(),
          updated.getParentMemory(),
          Relationship.PARENT_OF,
          Entity.CONTEXT_MEMORY,
          original.getId());
      updateSourceEntityRelationship();

      // usageCount and lastUsedAt are AI-retrieval telemetry, intentionally excluded from
      // version history so routine retrieval does not churn the entity version.
    }

    /**
     * A user editing the content of a machine-generated pill through the PATCH endpoint takes
     * ownership of it: the sourceType flips to Manual so re-extraction never clobbers the human
     * edit. updatedBy cannot tell this apart (the extraction engine also writes as admin) — the
     * operation does, since the engine only ever creates/PUTs, never PATCHes. The flip is gated on
     * an actual content change so unrelated PATCHes (tagging, starring, re-scoping, sharing) leave
     * the pill under engine management.
     */
    private void flipToManualOnUserEdit() {
      if (operation == Operation.PATCH
          && updated.getSourceType() == original.getSourceType()
          && isAutomatedSource(original.getSourceType())
          && extractionManagedFieldChanged()) {
        updated.setSourceType(ContextMemorySourceType.MANUAL);
      }
    }

    /** True when a PATCH edited a field the extraction reconciler would otherwise overwrite. */
    private boolean extractionManagedFieldChanged() {
      return ContextMemoryRepository.extractionManagedFieldChanged(original, updated);
    }

    private void updateLifecycle(boolean consolidatingChanges) {
      if (operation == Operation.PUT) {
        updated.setStatusReason(original.getStatusReason());
        updated.setSupersededBy(original.getSupersededBy());
        updated.setDisputes(original.getDisputes());
      }
      if (!consolidatingChanges) {
        ContextMemoryLifecycle.applyUpdate(
            original,
            updated,
            (reference, field) -> resolveLiveMemory(reference, field, updated.getUpdatedBy()));
      }
      recordChange("statusReason", original.getStatusReason(), updated.getStatusReason());
      recordChange(
          ContextMemoryLifecycle.FIELD_SUPERSEDED_BY,
          original.getSupersededBy(),
          updated.getSupersededBy(),
          true,
          EntityUtil.entityReferenceMatch);
      recordChange(
          ContextMemoryLifecycle.FIELD_DISPUTES,
          original.getDisputes(),
          updated.getDisputes(),
          true);
    }

    private void updateSourceEntityRelationship() {
      // Preserve the stored source when an update omits it. sourceEntity is a relationship-derived
      // field that a partial fetch leaves null (e.g. the ontology hash stamp and re-extraction load
      // the memory via getFields("")), and a null here would otherwise delete the MENTIONED_IN edge
      // that links the pill to its source file/page -- orphaning it from memoryCount, the
      // sourceEntityId listing, and the article's derived ontologies. A genuine re-parent still
      // works: it supplies a non-null ref, so this guard does not fire.
      if (updated.getSourceEntity() == null) {
        updated.setSourceEntity(original.getSourceEntity());
      }
      // Plural form with single-element lists so the stale edge is removed under its OWN entity
      // type and the new one added under its own. The singular updateFromRelationship took one
      // fromType for both delete and add, which orphaned the old edge when the source changed type
      // (e.g. ContextFile -> Page). Mirrors how primaryEntity is reconciled above.
      updateFromRelationships(
          FIELD_SOURCE_ENTITY,
          Entity.CONTEXT_MEMORY,
          asRefList(original.getSourceEntity()),
          asRefList(updated.getSourceEntity()),
          Relationship.MENTIONED_IN,
          Entity.CONTEXT_MEMORY,
          original.getId());
    }
  }

  private static boolean isAutomatedSource(ContextMemorySourceType type) {
    return type == ContextMemorySourceType.FILE_EXTRACTION
        || type == ContextMemorySourceType.PAGE_EXTRACTION;
  }

  private static boolean extractionManagedFieldChanged(
      ContextMemory original, ContextMemory updated) {
    return !Objects.equals(original.getTitle(), updated.getTitle())
        || !Objects.equals(original.getQuestion(), updated.getQuestion())
        || !Objects.equals(original.getAnswer(), updated.getAnswer())
        || !Objects.equals(original.getSummary(), updated.getSummary())
        || !Objects.equals(original.getMemoryType(), updated.getMemoryType());
  }

  /** Loads the knowledge pills currently linked to a Context Center source (file or page). */
  public List<ContextMemory> listExtractedMemories(UUID sourceId, String sourceType) {
    List<EntityReference> refs =
        findTo(sourceId, sourceType, Relationship.MENTIONED_IN, Entity.CONTEXT_MEMORY);
    if (refs.isEmpty()) {
      return new ArrayList<>();
    }
    // Batch-load both stored content and relationship-backed anchors. Reconciliation repairs older
    // extracted pills whose primaryEntity was not populated, while preserving any human-chosen
    // primaryEntity and the source link on update.
    List<UUID> ids = refs.stream().map(EntityReference::getId).toList();
    List<ContextMemory> memories = find(ids, Include.NON_DELETED);
    setFieldsInBulk(getFields("primaryEntity,sourceEntity"), memories);
    return memories;
  }

  public void linkExtractedMemory(UUID memoryId, EntityReference source) {
    boolean alreadyLinked =
        findFrom(memoryId, Entity.CONTEXT_MEMORY, Relationship.MENTIONED_IN, source.getType())
            .stream()
            .anyMatch(existing -> source.getId().equals(existing.getId()));
    if (alreadyLinked) {
      return;
    }
    ContextMemory current =
        get(
            null,
            memoryId,
            getFields("sourceEntity,primaryEntity,relatedEntities"),
            Include.NON_DELETED,
            false);
    boolean isPrimary =
        current.getPrimaryEntity() != null
            && source.getId().equals(current.getPrimaryEntity().getId());
    boolean isRelated =
        listOrEmpty(current.getRelatedEntities()).stream()
            .anyMatch(related -> source.getId().equals(related.getId()));
    if (!isPrimary && !isRelated) {
      ContextMemory updated = JsonUtils.deepCopy(current, ContextMemory.class);
      List<EntityReference> related = new ArrayList<>(listOrEmpty(current.getRelatedEntities()));
      related.add(source);
      updated.setRelatedEntities(related);
      update(null, current, updated, Entity.ADMIN_USER_NAME);
    }
    addRelationship(
        source.getId(),
        memoryId,
        source.getType(),
        Entity.CONTEXT_MEMORY,
        Relationship.MENTIONED_IN);
  }

  /**
   * Whether linking this memory to another source keeps it readable there. It stays anchored to
   * its own file, so only a memory every reader of that file can reach is safe to share.
   */
  public boolean hasOrgWideAnchor(ContextMemory memory) {
    EntityReference anchor = getPrimaryEntity(memory);
    return anchor == null
        || (Entity.CONTEXT_FILE.equals(anchor.getType()) && isOrgWideFile(anchor));
  }

  private static boolean isOrgWideFile(EntityReference file) {
    boolean orgWide;
    try {
      orgWide = ContextFileVisibility.isOrgWide(Entity.getEntity(file, "", Include.NON_DELETED));
    } catch (EntityNotFoundException e) {
      orgWide = false;
    }
    return orgWide;
  }

  public boolean hasOtherSources(UUID memoryId, EntityReference source) {
    return findFrom(memoryId, Entity.CONTEXT_MEMORY, Relationship.MENTIONED_IN, null).stream()
        .anyMatch(
            other ->
                !other.getId().equals(source.getId()) || !other.getType().equals(source.getType()));
  }

  public void releaseExtractedMemory(UUID memoryId, EntityReference source) {
    List<EntityReference> otherSources =
        findFrom(memoryId, Entity.CONTEXT_MEMORY, Relationship.MENTIONED_IN, null).stream()
            .filter(
                other ->
                    !other.getId().equals(source.getId())
                        || !other.getType().equals(source.getType()))
            .toList();
    if (otherSources.isEmpty()) {
      delete(Entity.ADMIN_USER_NAME, memoryId, false, true);
      return;
    }

    boolean wasPrimary = hasSourceRelationship(memoryId, source, Relationship.APPLIED_TO);
    boolean wasRelated = hasSourceRelationship(memoryId, source, Relationship.RELATED_TO);
    reparentSharedMemory(memoryId, source, otherSources.getFirst(), wasPrimary, wasRelated);
    deleteRelationship(
        source.getId(),
        source.getType(),
        memoryId,
        Entity.CONTEXT_MEMORY,
        Relationship.MENTIONED_IN);
    if (wasPrimary) {
      deleteRelationship(
          source.getId(),
          source.getType(),
          memoryId,
          Entity.CONTEXT_MEMORY,
          Relationship.APPLIED_TO);
    }
    if (wasRelated) {
      deleteRelationship(
          source.getId(),
          source.getType(),
          memoryId,
          Entity.CONTEXT_MEMORY,
          Relationship.RELATED_TO);
    }
  }

  private boolean hasSourceRelationship(
      UUID memoryId, EntityReference source, Relationship relationship) {
    return findFrom(memoryId, Entity.CONTEXT_MEMORY, relationship, source.getType(), Include.ALL)
        .stream()
        .anyMatch(reference -> reference.getId().equals(source.getId()));
  }

  private void reparentSharedMemory(
      UUID memoryId,
      EntityReference source,
      EntityReference replacement,
      boolean wasPrimary,
      boolean wasRelated) {
    ContextMemory current =
        get(
            null,
            memoryId,
            getFields("sourceEntity,primaryEntity,relatedEntities"),
            Include.NON_DELETED,
            false);
    boolean sourceEntityMatches =
        current.getSourceEntity() != null
            && current.getSourceEntity().getId().equals(source.getId());
    boolean replacementIsRelated =
        wasPrimary
            && listOrEmpty(current.getRelatedEntities()).stream()
                .anyMatch(related -> related.getId().equals(replacement.getId()));
    if (!sourceEntityMatches && !wasPrimary && !wasRelated && !replacementIsRelated) {
      return;
    }
    ContextMemory updated = JsonUtils.deepCopy(current, ContextMemory.class);
    if (sourceEntityMatches) {
      updated.setSourceEntity(replacement);
    }
    if (wasPrimary) {
      updated.setPrimaryEntity(replacement);
    }
    if (wasRelated || replacementIsRelated) {
      updated.setRelatedEntities(
          listOrEmpty(current.getRelatedEntities()).stream()
              .filter(
                  related ->
                      !related.getId().equals(source.getId())
                          && (!wasPrimary || !related.getId().equals(replacement.getId())))
              .toList());
    }
    update(null, current, updated, Entity.ADMIN_USER_NAME);
  }

  /**
   * Releases every knowledge pill linked to a Context Center source. A pill still linked to another
   * source remains active; a pill whose last source is removed is hard-deleted.
   *
   * <p>The lookup uses {@link Include#ALL} because a hard delete runs the soft-delete pass first:
   * by the time the hard pass reaches here the pills this method already soft-deleted are invisible
   * to a NON_DELETED lookup, which used to leave them stranded as permanent tombstones.
   */
  public void deleteExtractedMemories(UUID sourceId, String sourceType) {
    List<EntityReference> refs =
        findTo(sourceId, sourceType, Relationship.MENTIONED_IN, Entity.CONTEXT_MEMORY, Include.ALL);
    EntityReference source = new EntityReference().withId(sourceId).withType(sourceType);
    for (EntityReference ref : refs) {
      releaseExtractedMemory(ref.getId(), source);
    }
  }
}
