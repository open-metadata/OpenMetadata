/*
 *  Copyright 2026 Collate
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

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.UriInfo;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyChangeApplicationResult;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.ontology.OntologyChangeSetValidator;
import org.openmetadata.service.resources.ontology.OntologyChangeSetResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RestUtil.PutResponse;

@Repository
public class OntologyChangeSetRepository implements EntityPolicy<OntologyChangeSet> {

  private static final String UPDATE_FIELDS =
      "operations,undoCursor,state,reviewTask,applicationResult";

  public OntologyChangeSetRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                OntologyChangeSetResource.COLLECTION_PATH,
                Entity.ONTOLOGY_CHANGE_SET,
                OntologyChangeSet.class,
                Entity.getCollectionDAO().ontologyChangeSetDAO()),
            new EntityPolicyContext.WriteFields(UPDATE_FIELDS, UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
  }

  @Override
  public void setFields(
      final OntologyChangeSet entity,
      final Fields fields,
      final RelationIncludes relationIncludes) {}

  @Override
  public void clearFields(final OntologyChangeSet entity, final Fields fields) {}

  @Override
  public void prepare(final OntologyChangeSet entity, final boolean update) {
    entity.setFullyQualifiedName(entity.getName());
    entity.setState(entity.getState() == null ? OntologyChangeSetState.DRAFT : entity.getState());
    if (entity.getUpdatedAt() == null) {
      entity.setUpdatedAt(System.currentTimeMillis());
    }
    entity.setGlossaries(validateGlossaries(entity.getGlossaries()));
    OntologyChangeSetValidator.normalizeAndValidate(entity);
    validateStateResult(entity);
  }

  private static List<EntityReference> validateGlossaries(
      final List<EntityReference> glossaryReferences) {
    final Set<UUID> glossaryIds = new HashSet<>();
    final List<EntityReference> glossaries =
        listOrEmpty(glossaryReferences).stream()
            .map(OntologyChangeSetRepository::requireEditableGlossary)
            .map(Glossary::getEntityReference)
            .toList();
    if (glossaries.isEmpty()
        || glossaries.stream().anyMatch(ref -> !glossaryIds.add(ref.getId()))) {
      throw new BadRequestException("Ontology change sets require unique editable glossaries");
    }
    return glossaries;
  }

  private static Glossary requireEditableGlossary(final EntityReference reference) {
    final Glossary glossary = resolveGlossary(reference);
    final boolean isReadOnly =
        glossary.getOntologyConfiguration() != null
            && Boolean.TRUE.equals(glossary.getOntologyConfiguration().getReadOnly());
    if (isReadOnly) {
      throw new BadRequestException("Reference ontology '" + glossary.getName() + "' is read-only");
    }
    return glossary;
  }

  private static Glossary resolveGlossary(final EntityReference reference) {
    if (reference.getId() != null) {
      return Entity.getEntity(Entity.GLOSSARY, reference.getId(), "", Include.NON_DELETED);
    }
    return Entity.getEntityByName(
        Entity.GLOSSARY, reference.getFullyQualifiedName(), "", Include.NON_DELETED);
  }

  private static void validateStateResult(final OntologyChangeSet entity) {
    final OntologyChangeApplicationResult result = entity.getApplicationResult();
    if (entity.getState() == OntologyChangeSetState.APPLIED
        && (result == null || !Integer.valueOf(0).equals(result.getOperationsFailed()))) {
      throw new BadRequestException(
          "An applied ontology change set requires a successful application result");
    }
    if (entity.getState() == OntologyChangeSetState.APPLY_FAILED && result == null) {
      throw new BadRequestException("A failed ontology change set requires an application result");
    }
  }

  @Override
  public void storeEntity(final OntologyChangeSet entity, final boolean update) {
    persistence().store(entity, update);
  }

  @Override
  public void storeRelationships(final OntologyChangeSet entity) {
    for (final EntityReference glossary : entity.getGlossaries()) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  glossary.getId(),
                  entity.getId(),
                  Entity.GLOSSARY,
                  Entity.ONTOLOGY_CHANGE_SET,
                  Relationship.CONTAINS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  public PutResponse<OntologyChangeSet> replaceOperations(
      final UriInfo uriInfo,
      final String user,
      final UUID id,
      final List<OntologyChangeOperation> operations,
      final int undoCursor) {
    final OntologyChangeSet updated = editableCopy(id);
    updated.setOperations(operations);
    updated.setUndoCursor(undoCursor);
    return persist(uriInfo, updated, user);
  }

  public PutResponse<OntologyChangeSet> moveCursor(
      final UriInfo uriInfo, final String user, final UUID id, final int delta) {
    final OntologyChangeSet updated = editableCopy(id);
    final int cursor = updated.getUndoCursor() + delta;
    updated.setUndoCursor(cursor);
    return persist(uriInfo, updated, user);
  }

  public PutResponse<OntologyChangeSet> transition(
      final UriInfo uriInfo,
      final String user,
      final UUID id,
      final OntologyChangeSetState state,
      final OntologyChangeApplicationResult result) {
    final OntologyChangeSet updated = copy(id);
    validateTransition(updated.getState(), state);
    updated.setState(state);
    updated.setApplicationResult(result);
    return persist(uriInfo, updated, user);
  }

  private PutResponse<OntologyChangeSet> persist(
      final UriInfo uriInfo, final OntologyChangeSet updated, final String user) {
    preparation().prepare(updated, true);
    return creates().upsert(uriInfo, updated, new EntityCommandActor(user, null), false);
  }

  private OntologyChangeSet editableCopy(final UUID id) {
    final OntologyChangeSet changeSet = copy(id);
    if (changeSet.getState() != OntologyChangeSetState.DRAFT
        && changeSet.getState() != OntologyChangeSetState.APPLY_FAILED) {
      throw new BadRequestException(
          "Ontology change set '" + id + "' is not editable in state " + changeSet.getState());
    }
    return changeSet;
  }

  private OntologyChangeSet copy(final UUID id) {
    final OntologyChangeSet current =
        reads()
            .byId(
                id,
                new EntityReadService.Query(
                    null,
                    fieldPolicy().parse(UPDATE_FIELDS),
                    RelationIncludes.fromInclude(Include.NON_DELETED),
                    false));
    return JsonUtils.deepCopy(current, OntologyChangeSet.class);
  }

  private static void validateTransition(
      final OntologyChangeSetState original, final OntologyChangeSetState updated) {
    final boolean isAllowed =
        switch (original) {
          case DRAFT -> Set.of(
                  OntologyChangeSetState.SUBMITTED,
                  OntologyChangeSetState.APPLIED,
                  OntologyChangeSetState.APPLY_FAILED,
                  OntologyChangeSetState.DISCARDED)
              .contains(updated);
          case SUBMITTED -> Set.of(
                  OntologyChangeSetState.APPLIED,
                  OntologyChangeSetState.APPLY_FAILED,
                  OntologyChangeSetState.DISCARDED)
              .contains(updated);
          case APPLY_FAILED -> Set.of(
                  OntologyChangeSetState.DRAFT,
                  OntologyChangeSetState.APPLIED,
                  OntologyChangeSetState.APPLY_FAILED,
                  OntologyChangeSetState.DISCARDED)
              .contains(updated);
          case APPLIED, DISCARDED -> false;
        };
    if (!isAllowed) {
      throw new BadRequestException(
          "Ontology change set transition from " + original + " to " + updated + " is not allowed");
    }
  }

  @Override
  public EntityUpdater<OntologyChangeSet> getUpdater(
      final OntologyChangeSet original,
      final OntologyChangeSet updated,
      final EntityOperation operation,
      final ChangeSource changeSource) {
    return new OntologyChangeSetUpdater(original, updated, operation).mutation();
  }

  public class OntologyChangeSetUpdater implements EntitySpecificMutation<OntologyChangeSet> {

    OntologyChangeSetUpdater(
        final OntologyChangeSet original,
        final OntologyChangeSet updated,
        final EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(
        EntityUpdater<OntologyChangeSet> entityUpdate, final boolean consolidatingChanges) {
      if (!entityUpdate
          .getOriginal()
          .getGlossaries()
          .equals(entityUpdate.getUpdated().getGlossaries())) {
        throw new BadRequestException("Ontology change set scope is immutable");
      }
      entityUpdate.recordChange(
          "operations",
          entityUpdate.getOriginal().getOperations(),
          entityUpdate.getUpdated().getOperations(),
          true);
      entityUpdate.recordChange(
          "undoCursor",
          entityUpdate.getOriginal().getUndoCursor(),
          entityUpdate.getUpdated().getUndoCursor());
      entityUpdate.recordChange(
          "state", entityUpdate.getOriginal().getState(), entityUpdate.getUpdated().getState());
      entityUpdate.recordChange(
          "reviewTask",
          entityUpdate.getOriginal().getReviewTask(),
          entityUpdate.getUpdated().getReviewTask());
      entityUpdate.recordChange(
          "applicationResult",
          entityUpdate.getOriginal().getApplicationResult(),
          entityUpdate.getUpdated().getApplicationResult());
    }

    private final EntityUpdater<OntologyChangeSet> entityUpdate;

    public EntityUpdater<OntologyChangeSet> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<OntologyChangeSet> entityContext;

  @Override
  public final EntityPolicyContext<OntologyChangeSet> context() {
    return entityContext;
  }
}
