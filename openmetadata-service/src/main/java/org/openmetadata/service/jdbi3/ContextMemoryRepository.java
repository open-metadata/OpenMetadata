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
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.context.ContextMemoryResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository(name = "ContextMemoryRepository")
public class ContextMemoryRepository extends EntityRepository<ContextMemory> {

  public ContextMemoryRepository() {
    super(
        ContextMemoryResource.COLLECTION_PATH,
        Entity.CONTEXT_MEMORY,
        ContextMemory.class,
        Entity.getCollectionDAO().contextMemoryDAO(),
        "",
        "");
    supportsSearch = false;
  }

  @Override
  protected void setFields(ContextMemory entity, Fields fields, RelationIncludes relationIncludes) {
    // ContextMemory stores its fields in the entity JSON for now.
  }

  @Override
  protected void clearFields(ContextMemory entity, Fields fields) {
    // ContextMemory stores its fields in the entity JSON for now.
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
    EntityUtil.populateEntityReferences(entity.getRelatedEntities());

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
    // storeRelationships re-runs on every update; clear prior inbound edges first so a changed
    // or removed primaryEntity/relatedEntities/root/parent link does not leave orphan rows.
    deleteTo(entity.getId(), Entity.CONTEXT_MEMORY, Relationship.HAS, null);
    deleteTo(entity.getId(), Entity.CONTEXT_MEMORY, Relationship.RELATED_TO, null);
    deleteTo(entity.getId(), Entity.CONTEXT_MEMORY, Relationship.CONTAINS, Entity.CONTEXT_MEMORY);

    if (entity.getPrimaryEntity() != null) {
      addRelationship(
          entity.getPrimaryEntity().getId(),
          entity.getId(),
          entity.getPrimaryEntity().getType(),
          Entity.CONTEXT_MEMORY,
          Relationship.HAS);
    }

    for (var relatedEntity : listOrEmpty(entity.getRelatedEntities())) {
      addRelationship(
          relatedEntity.getId(),
          entity.getId(),
          relatedEntity.getType(),
          Entity.CONTEXT_MEMORY,
          Relationship.RELATED_TO);
    }

    // Distinct relationship types so the root-ancestor and direct-parent hierarchies
    // can be resolved independently when read back from the relationship table.
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
          Relationship.HAS);
    }
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
      recordChange("title", original.getTitle(), updated.getTitle());
      recordChange("summary", original.getSummary(), updated.getSummary());
      recordChange("question", original.getQuestion(), updated.getQuestion());
      recordChange("answer", original.getAnswer(), updated.getAnswer());
      recordChange("memoryType", original.getMemoryType(), updated.getMemoryType());
      recordChange("memoryScope", original.getMemoryScope(), updated.getMemoryScope());
      recordChange("primaryEntity", original.getPrimaryEntity(), updated.getPrimaryEntity());
      recordChange(
          "relatedEntities", original.getRelatedEntities(), updated.getRelatedEntities(), true);
      recordChange("rootMemory", original.getRootMemory(), updated.getRootMemory());
      recordChange("parentMemory", original.getParentMemory(), updated.getParentMemory());
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

      // usageCount and lastUsedAt are AI-retrieval telemetry, intentionally excluded from
      // version history so routine retrieval does not churn the entity version.
    }
  }
}
