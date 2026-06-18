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
import org.openmetadata.schema.entity.context.OntologyStats;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.context.ContextMemoryResource;
import org.openmetadata.service.search.vector.ContextMemoryBodyTextContributor;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository(name = "ContextMemoryRepository")
public class ContextMemoryRepository extends EntityRepository<ContextMemory> {

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
    super(
        ContextMemoryResource.COLLECTION_PATH,
        Entity.CONTEXT_MEMORY,
        ContextMemory.class,
        Entity.getCollectionDAO().contextMemoryDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;
  }

  @Override
  protected void setFields(ContextMemory entity, Fields fields, RelationIncludes relationIncludes) {
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
  protected void clearFields(ContextMemory entity, Fields fields) {
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
      idsByType
          .computeIfAbsent(record.getFromEntity(), type -> new HashSet<>())
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
    Map<UUID, EntityReference> sourceById = new HashMap<>();
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
          ContextMemoryStatus.ACTIVE, Set.of(ContextMemoryStatus.ARCHIVED),
          ContextMemoryStatus.ARCHIVED, Set.of(ContextMemoryStatus.ACTIVE));

  /** Validate that a status transition is allowed. */
  public static void validateStatusTransition(ContextMemoryStatus from, ContextMemoryStatus to) {
    if (from == to) {
      return; // No change
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
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      flipToManualOnUserEdit();
      recordChange("title", original.getTitle(), updated.getTitle());
      recordChange("summary", original.getSummary(), updated.getSummary());
      recordChange("question", original.getQuestion(), updated.getQuestion());
      recordChange("answer", original.getAnswer(), updated.getAnswer());
      recordChange("memoryType", original.getMemoryType(), updated.getMemoryType());
      recordChange("memoryScope", original.getMemoryScope(), updated.getMemoryScope());
      recordChange("sourceType", original.getSourceType(), updated.getSourceType());
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

      // Validate lifecycle transition before recording status change
      if (original.getStatus() != null
          && updated.getStatus() != null
          && original.getStatus() != updated.getStatus()) {
        validateStatusTransition(original.getStatus(), updated.getStatus());
      }
      recordChange("status", original.getStatus(), updated.getStatus());

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

      recordOntologyStats();

      // usageCount and lastUsedAt are AI-retrieval telemetry, intentionally excluded from
      // version history so routine retrieval does not churn the entity version.
    }

    /**
     * ontologyStats is engine-managed telemetry. Preserve the stored value when an update omits it
     * so a user PUT never wipes it, and persist a fresh stamp with updateVersion=false so the
     * Ontology Agent does not churn the memory's version history on every derivation run.
     */
    private void recordOntologyStats() {
      if (updated.getOntologyStats() == null) {
        updated.setOntologyStats(original.getOntologyStats());
      }
      recordChange(
          "ontologyStats",
          original.getOntologyStats(),
          updated.getOntologyStats(),
          true,
          EntityUtil.objectMatch,
          false);
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
      return !Objects.equals(original.getTitle(), updated.getTitle())
          || !Objects.equals(original.getQuestion(), updated.getQuestion())
          || !Objects.equals(original.getAnswer(), updated.getAnswer())
          || !Objects.equals(original.getSummary(), updated.getSummary())
          || !Objects.equals(original.getMemoryType(), updated.getMemoryType());
    }

    private void updateSourceEntityRelationship() {
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

  /** Loads the knowledge pills currently linked to a Context Center source (file or page). */
  public List<ContextMemory> listExtractedMemories(UUID sourceId, String sourceType) {
    List<EntityReference> refs =
        findTo(sourceId, sourceType, Relationship.MENTIONED_IN, Entity.CONTEXT_MEMORY);
    if (refs.isEmpty()) {
      return new ArrayList<>();
    }
    // Batch-load in one query instead of a get() per ref (avoids N+1). Reconciliation only reads
    // stored fields (question/status/answer/...), so the relationship-free fetch is sufficient.
    List<UUID> ids = refs.stream().map(EntityReference::getId).toList();
    return find(ids, Include.NON_DELETED);
  }

  /** Deletes every knowledge pill linked to a Context Center source, propagating the delete flag. */
  public void deleteExtractedMemories(UUID sourceId, String sourceType, boolean hardDelete) {
    List<EntityReference> refs =
        findTo(sourceId, sourceType, Relationship.MENTIONED_IN, Entity.CONTEXT_MEMORY);
    for (EntityReference ref : refs) {
      delete(Entity.ADMIN_USER_NAME, ref.getId(), false, hardDelete);
    }
  }

  /**
   * Restores the soft-deleted knowledge pills linked to a Context Center source when that source is
   * restored. Uses Include.ALL because the pills are deleted at lookup time; restoreEntity is a
   * no-op on any that are already active.
   */
  public void restoreExtractedMemories(UUID sourceId, String sourceType) {
    List<EntityReference> refs =
        findTo(sourceId, sourceType, Relationship.MENTIONED_IN, Entity.CONTEXT_MEMORY, Include.ALL);
    for (EntityReference ref : refs) {
      restoreEntity(Entity.ADMIN_USER_NAME, ref.getId());
    }
  }

  /**
   * Persists new {@link OntologyStats} on a memory WITHOUT bumping its version. The engine calls
   * this after every derivation run. Using {@code updateVersion=false} inside {@link
   * ContextMemoryUpdater#recordOntologyStats()} means the JSON store is updated but the version
   * counter stays flat (no history churn). {@code postUpdate} DOES still fire ({@code
   * entityChanged=true}). The recursion loop is broken solely by the hash-gate in {@link
   * org.openmetadata.service.drive.ontology.OntologyProcessingEngine}: after the stamp, {@code
   * sourceHash == hashOf(memory)}, so a re-triggered run skips derivation. The hash-gate is
   * load-bearing — do NOT remove it.
   */
  public void stampOntologyStats(final ContextMemory memory, final OntologyStats stats) {
    final ContextMemory updated = JsonUtils.deepCopy(memory, ContextMemory.class);
    updated.setOntologyStats(stats);
    update(null, memory, updated, Entity.ADMIN_USER_NAME);
  }
}
