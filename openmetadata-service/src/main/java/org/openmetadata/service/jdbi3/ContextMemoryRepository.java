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
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.context.ContextMemoryResource;
import org.openmetadata.service.search.vector.ContextMemoryBodyTextContributor;
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
public class ContextMemoryRepository implements EntityPolicy<ContextMemory> {

  static final String FIELD_PRIMARY_ENTITY = "primaryEntity";

  static final String FIELD_RELATED_ENTITIES = "relatedEntities";
  static final String FIELD_SOURCE_FILE = "sourceFile";
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

  public ContextMemoryRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                ContextMemoryResource.COLLECTION_PATH,
                Entity.CONTEXT_MEMORY,
                ContextMemory.class,
                Entity.getCollectionDAO().contextMemoryDAO()),
            new EntityPolicyContext.WriteFields(PATCH_FIELDS, UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
  }

  @Override
  public void setFields(ContextMemory entity, Fields fields, RelationIncludes relationIncludes) {
    if (fields.contains(FIELD_PRIMARY_ENTITY)) {
      entity.setPrimaryEntity(getPrimaryEntity(entity));
    }
    if (fields.contains(FIELD_RELATED_ENTITIES)) {
      entity.setRelatedEntities(getRelatedEntities(entity));
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
  public void clearFields(ContextMemory entity, Fields fields) {
    if (!fields.contains(FIELD_PRIMARY_ENTITY)) {
      entity.setPrimaryEntity(null);
    }
    if (!fields.contains(FIELD_RELATED_ENTITIES)) {
      entity.setRelatedEntities(null);
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
    fetchAndSetSources(entities, fields);
    fieldLoading().populate(entities, fields);
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
        context()
            .dependencies()
            .daos()
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
        context()
            .dependencies()
            .daos()
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
        relationships()
            .from(
                new EntityRelationshipReader.Selection(
                    entity.getId(), Entity.CONTEXT_MEMORY, Relationship.APPLIED_TO, null),
                Include.NON_DELETED);
    if (nullOrEmpty(refs)) {
      // Fallback for data written before the APPLIED_TO migration. Filter out domain refs
      // because domains use the same HAS relationship type (domain --HAS--> contextMemory).
      refs =
          relationships()
              .from(
                  new EntityRelationshipReader.Selection(
                      entity.getId(), Entity.CONTEXT_MEMORY, Relationship.HAS, null),
                  Include.NON_DELETED)
              .stream()
              .filter(r -> !Entity.DOMAIN.equals(r.getType()))
              .toList();
    }
    return nullOrEmpty(refs) ? null : refs.getFirst();
  }

  private List<EntityReference> getRelatedEntities(ContextMemory entity) {
    return relationships()
        .from(
            new EntityRelationshipReader.Selection(
                entity.getId(), Entity.CONTEXT_MEMORY, Relationship.RELATED_TO, null),
            Include.NON_DELETED);
  }

  /** The single Context Center source (file or page) a memory was extracted from, via MENTIONED_IN. */
  private EntityReference getSourceEntity(ContextMemory entity) {
    List<EntityReference> refs =
        relationships()
            .from(
                new EntityRelationshipReader.Selection(
                    entity.getId(), Entity.CONTEXT_MEMORY, Relationship.MENTIONED_IN, null),
                Include.NON_DELETED);
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
    Map<UUID, EntityReference> sourceById = new HashMap<>();
    List<CollectionDAO.EntityRelationshipObject> records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(entities),
                Relationship.MENTIONED_IN.ordinal(),
                Include.NON_DELETED);
    Map<String, EntityReference> refById = resolveReferencesByType(records);
    for (CollectionDAO.EntityRelationshipObject record : records) {
      EntityReference ref = refById.get(record.getFromId());
      if (ref != null) {
        sourceById.putIfAbsent(UUID.fromString(record.getToId()), ref);
      }
    }
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

  @Override
  public void storeEntity(ContextMemory entity, boolean update) {
    persistence().store(entity, update);
  }

  @Override
  public void storeRelationships(ContextMemory entity) {
    // Add-only: addRelationship upserts, so re-running on update is idempotent. Stale-edge
    // cleanup on update is handled in ContextMemoryUpdater via updateFromRelationship(s),
    // which deletes only the specific changed refs. A blanket deleteTo here would also wipe
    // the framework's domain --HAS--> memory edge (storeDomains runs before storeRelationships).
    if (entity.getPrimaryEntity() != null) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  entity.getPrimaryEntity().getId(),
                  entity.getId(),
                  entity.getPrimaryEntity().getType(),
                  Entity.CONTEXT_MEMORY,
                  Relationship.APPLIED_TO),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
    for (var relatedEntity : listOrEmpty(entity.getRelatedEntities())) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  relatedEntity.getId(),
                  entity.getId(),
                  relatedEntity.getType(),
                  Entity.CONTEXT_MEMORY,
                  Relationship.RELATED_TO),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
    // Distinct relationship types (CONTAINS for root-ancestor, PARENT_OF for direct parent)
    // so the two hierarchies resolve independently and neither collides with the framework's
    // HAS edges (domains).
    if (entity.getRootMemory() != null) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  entity.getRootMemory().getId(),
                  entity.getId(),
                  Entity.CONTEXT_MEMORY,
                  Entity.CONTEXT_MEMORY,
                  Relationship.CONTAINS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
    if (entity.getParentMemory() != null) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  entity.getParentMemory().getId(),
                  entity.getId(),
                  Entity.CONTEXT_MEMORY,
                  Entity.CONTEXT_MEMORY,
                  Relationship.PARENT_OF),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }

    if (entity.getSourceEntity() != null) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  entity.getSourceEntity().getId(),
                  entity.getId(),
                  entity.getSourceEntity().getType(),
                  Entity.CONTEXT_MEMORY,
                  Relationship.MENTIONED_IN),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  private static List<EntityReference> asRefList(EntityReference ref) {
    return ref == null ? List.of() : List.of(ref);
  }

  // ------------------------------------------------------------------
  // Lifecycle enforcement
  // ------------------------------------------------------------------
  /**
   * Valid status transitions:
   *   DRAFT → ACTIVE
   *   DRAFT → ARCHIVED
   *   ACTIVE → ARCHIVED
   *   ARCHIVED → ACTIVE (re-activate)
   *
   * Invalid:
   *   ARCHIVED → DRAFT (cannot revert to draft)
   *   ACTIVE → DRAFT (cannot revert to draft)
   */
  private static final Map<ContextMemoryStatus, Set<ContextMemoryStatus>> VALID_TRANSITIONS =
      Map.of(
          ContextMemoryStatus.DRAFT,
          Set.of(ContextMemoryStatus.ACTIVE, ContextMemoryStatus.ARCHIVED),
          ContextMemoryStatus.ACTIVE,
          Set.of(ContextMemoryStatus.ARCHIVED),
          ContextMemoryStatus.ARCHIVED,
          Set.of(ContextMemoryStatus.ACTIVE));

  /**
   * Validate that a status transition is allowed.
   */
  public static void validateStatusTransition(ContextMemoryStatus from, ContextMemoryStatus to) {
    if (from == to) {
      // No change
      return;
    }
    Set<ContextMemoryStatus> allowed = VALID_TRANSITIONS.get(from);
    if (allowed == null) {
      throw new BadRequestException(
          String.format("No transitions defined for status %s", from.value()));
    }
    if (!allowed.contains(to)) {
      throw new BadRequestException(
          String.format(
              "Invalid memory status transition from %s to %s. Allowed transitions from %s: %s",
              from.value(), to.value(), from.value(), allowed));
    }
  }

  @Override
  public EntityUpdater<ContextMemory> getUpdater(
      ContextMemory original,
      ContextMemory updated,
      EntityOperation operation,
      ChangeSource source) {
    return new ContextMemoryUpdater(original, updated, operation).mutation();
  }

  public class ContextMemoryUpdater implements EntitySpecificMutation<ContextMemory> {

    public ContextMemoryUpdater(
        ContextMemory original, ContextMemory updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(EntityUpdater<ContextMemory> entityUpdate, boolean consolidatingChanges) {
      flipToManualOnUserEdit();
      entityUpdate.recordChange(
          "title", entityUpdate.getOriginal().getTitle(), entityUpdate.getUpdated().getTitle());
      entityUpdate.recordChange(
          "summary",
          entityUpdate.getOriginal().getSummary(),
          entityUpdate.getUpdated().getSummary());
      entityUpdate.recordChange(
          "question",
          entityUpdate.getOriginal().getQuestion(),
          entityUpdate.getUpdated().getQuestion());
      entityUpdate.recordChange(
          "answer", entityUpdate.getOriginal().getAnswer(), entityUpdate.getUpdated().getAnswer());
      entityUpdate.recordChange(
          "memoryType",
          entityUpdate.getOriginal().getMemoryType(),
          entityUpdate.getUpdated().getMemoryType());
      entityUpdate.recordChange(
          "memoryScope",
          entityUpdate.getOriginal().getMemoryScope(),
          entityUpdate.getUpdated().getMemoryScope());
      entityUpdate.recordChange(
          "sourceType",
          entityUpdate.getOriginal().getSourceType(),
          entityUpdate.getUpdated().getSourceType());
      entityUpdate.recordChange(
          "pinned", entityUpdate.getOriginal().getPinned(), entityUpdate.getUpdated().getPinned());
      entityUpdate.recordChange(
          "sourceConversation",
          entityUpdate.getOriginal().getSourceConversation(),
          entityUpdate.getUpdated().getSourceConversation());
      entityUpdate.recordChange(
          "sourceHumanMessage",
          entityUpdate.getOriginal().getSourceHumanMessage(),
          entityUpdate.getUpdated().getSourceHumanMessage());
      entityUpdate.recordChange(
          "sourceAssistantMessage",
          entityUpdate.getOriginal().getSourceAssistantMessage(),
          entityUpdate.getUpdated().getSourceAssistantMessage());
      entityUpdate.recordChange(
          "machineRepresentation",
          entityUpdate.getOriginal().getMachineRepresentation(),
          entityUpdate.getUpdated().getMachineRepresentation());
      // Validate lifecycle transition before recording status change
      if (entityUpdate.getOriginal().getStatus() != null
          && entityUpdate.getUpdated().getStatus() != null
          && entityUpdate.getOriginal().getStatus() != entityUpdate.getUpdated().getStatus()) {
        validateStatusTransition(
            entityUpdate.getOriginal().getStatus(), entityUpdate.getUpdated().getStatus());
      }
      entityUpdate.recordChange(
          "status", entityUpdate.getOriginal().getStatus(), entityUpdate.getUpdated().getStatus());
      entityUpdate.recordChange(
          "shareConfig",
          entityUpdate.getOriginal().getShareConfig(),
          entityUpdate.getUpdated().getShareConfig());
      // Relationship-backed fields: these helpers record the version change and delete only
      // the specific changed refs (never a blanket delete), so the framework's
      // domain --HAS--> memory edge is left intact.
      entityUpdate.updateFromRelationships(
          new EntityRelationshipUpdates.Target(
              FIELD_PRIMARY_ENTITY,
              entityUpdate.getOriginal().getId(),
              Entity.CONTEXT_MEMORY,
              Entity.CONTEXT_MEMORY,
              Relationship.APPLIED_TO),
          new EntityRelationshipUpdates.References(
              asRefList(entityUpdate.getOriginal().getPrimaryEntity()),
              asRefList(entityUpdate.getUpdated().getPrimaryEntity())));
      entityUpdate.updateFromRelationships(
          new EntityRelationshipUpdates.Target(
              FIELD_RELATED_ENTITIES,
              entityUpdate.getOriginal().getId(),
              Entity.CONTEXT_MEMORY,
              Entity.CONTEXT_MEMORY,
              Relationship.RELATED_TO),
          new EntityRelationshipUpdates.References(
              listOrEmpty(entityUpdate.getOriginal().getRelatedEntities()),
              listOrEmpty(entityUpdate.getUpdated().getRelatedEntities())));
      entityUpdate.updateFromRelationship(
          new EntityRelationshipUpdates.Target(
              "rootMemory",
              entityUpdate.getOriginal().getId(),
              Entity.CONTEXT_MEMORY,
              Entity.CONTEXT_MEMORY,
              Relationship.CONTAINS),
          entityUpdate.getOriginal().getRootMemory(),
          entityUpdate.getUpdated().getRootMemory());
      entityUpdate.updateFromRelationship(
          new EntityRelationshipUpdates.Target(
              "parentMemory",
              entityUpdate.getOriginal().getId(),
              Entity.CONTEXT_MEMORY,
              Entity.CONTEXT_MEMORY,
              Relationship.PARENT_OF),
          entityUpdate.getOriginal().getParentMemory(),
          entityUpdate.getUpdated().getParentMemory());
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
      if (entityUpdate.getOperation() == EntityOperation.PATCH
          && entityUpdate.getUpdated().getSourceType() == entityUpdate.getOriginal().getSourceType()
          && isAutomatedSource(entityUpdate.getOriginal().getSourceType())
          && extractionManagedFieldChanged()) {
        entityUpdate.getUpdated().setSourceType(ContextMemorySourceType.MANUAL);
      }
    }

    /** True when a PATCH edited a field the extraction reconciler would otherwise overwrite. */
    private boolean extractionManagedFieldChanged() {
      return ContextMemoryRepository.extractionManagedFieldChanged(
          entityUpdate.getOriginal(), entityUpdate.getUpdated());
    }

    private void updateSourceEntityRelationship() {
      // Preserve the stored source when an update omits it. sourceEntity is a relationship-derived
      // field that a partial fetch leaves null (e.g. the ontology hash stamp and re-extraction load
      // the memory via getFields("")), and a null here would otherwise delete the MENTIONED_IN edge
      // that links the pill to its source file/page -- orphaning it from memoryCount, the
      // sourceEntityId listing, and the article's derived ontologies. A genuine re-parent still
      // works: it supplies a non-null ref, so this guard does not fire.
      if (entityUpdate.getUpdated().getSourceEntity() == null) {
        entityUpdate.getUpdated().setSourceEntity(entityUpdate.getOriginal().getSourceEntity());
      }
      // Plural form with single-element lists so the stale edge is removed under its OWN entity
      // type and the new one added under its own. The singular updateFromRelationship took one
      // fromType for both delete and add, which orphaned the old edge when the source changed type
      // (e.g. ContextFile -> Page). Mirrors how primaryEntity is reconciled above.
      entityUpdate.updateFromRelationships(
          new EntityRelationshipUpdates.Target(
              FIELD_SOURCE_ENTITY,
              entityUpdate.getOriginal().getId(),
              Entity.CONTEXT_MEMORY,
              Entity.CONTEXT_MEMORY,
              Relationship.MENTIONED_IN),
          new EntityRelationshipUpdates.References(
              asRefList(entityUpdate.getOriginal().getSourceEntity()),
              asRefList(entityUpdate.getUpdated().getSourceEntity())));
    }

    private final EntityUpdater<ContextMemory> entityUpdate;

    public EntityUpdater<ContextMemory> mutation() {
      return entityUpdate;
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
        relationships()
            .to(
                new EntityRelationshipReader.Selection(
                    sourceId, sourceType, Relationship.MENTIONED_IN, Entity.CONTEXT_MEMORY),
                Include.NON_DELETED);
    if (refs.isEmpty()) {
      return new ArrayList<>();
    }
    // Batch-load in one query instead of a get() per ref (avoids N+1). Reconciliation only reads
    // stored fields (question/status/answer/...), so the relationship-free fetch is sufficient.
    List<UUID> ids = refs.stream().map(EntityReference::getId).toList();
    return lookup().byIds(ids, Include.NON_DELETED);
  }

  /**
   * Hard-deletes every knowledge pill linked to a Context Center source, whichever kind of delete
   * the source got. A pill is derived data, regenerable from its source, so a deleted source must
   * not leave one behind in any form — a soft-deleted pill is an invisible row that still occupies
   * an FQN and keeps its search/vector entry until something reindexes it.
   *
   * <p>The lookup uses {@link Include#ALL} because a hard delete runs the soft-delete pass first:
   * by the time the hard pass reaches here the pills this method already soft-deleted are invisible
   * to a NON_DELETED lookup, which used to leave them stranded as permanent tombstones.
   */
  public void deleteExtractedMemories(UUID sourceId, String sourceType) {
    List<EntityReference> refs =
        relationships()
            .to(
                new EntityRelationshipReader.Selection(
                    sourceId, sourceType, Relationship.MENTIONED_IN, Entity.CONTEXT_MEMORY),
                Include.ALL);
    for (EntityReference ref : refs) {
      deletes().byId(Entity.ADMIN_USER_NAME, ref.getId(), false, true);
    }
  }

  private final EntityPolicyContext<ContextMemory> entityContext;

  @Override
  public final EntityPolicyContext<ContextMemory> context() {
    return entityContext;
  }
}
