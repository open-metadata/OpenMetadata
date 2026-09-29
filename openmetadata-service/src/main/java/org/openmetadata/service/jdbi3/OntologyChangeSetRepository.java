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
import org.openmetadata.service.ontology.OntologyChangeSetValidator;
import org.openmetadata.service.resources.ontology.OntologyChangeSetResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RestUtil.PutResponse;

@Repository
public class OntologyChangeSetRepository extends EntityRepository<OntologyChangeSet> {
  private static final String UPDATE_FIELDS =
      "operations,undoCursor,state,reviewTask,applicationResult";

  public OntologyChangeSetRepository() {
    super(
        OntologyChangeSetResource.COLLECTION_PATH,
        Entity.ONTOLOGY_CHANGE_SET,
        OntologyChangeSet.class,
        Entity.getCollectionDAO().ontologyChangeSetDAO(),
        UPDATE_FIELDS,
        UPDATE_FIELDS);
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
    store(entity, update);
  }

  @Override
  public void storeRelationships(final OntologyChangeSet entity) {
    for (final EntityReference glossary : entity.getGlossaries()) {
      addRelationship(
          glossary.getId(),
          entity.getId(),
          Entity.GLOSSARY,
          Entity.ONTOLOGY_CHANGE_SET,
          Relationship.CONTAINS);
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
    prepareInternal(updated, true);
    return createOrUpdate(uriInfo, updated, user);
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
        get(null, id, getFields(UPDATE_FIELDS), Include.NON_DELETED, false);
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
  public EntityUpdater getUpdater(
      final OntologyChangeSet original,
      final OntologyChangeSet updated,
      final Operation operation,
      final ChangeSource changeSource) {
    return new OntologyChangeSetUpdater(original, updated, operation);
  }

  public class OntologyChangeSetUpdater extends EntityUpdater {
    OntologyChangeSetUpdater(
        final OntologyChangeSet original,
        final OntologyChangeSet updated,
        final Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(final boolean consolidatingChanges) {
      if (!original.getGlossaries().equals(updated.getGlossaries())) {
        throw new BadRequestException("Ontology change set scope is immutable");
      }
      recordChange("operations", original.getOperations(), updated.getOperations(), true);
      recordChange("undoCursor", original.getUndoCursor(), updated.getUndoCursor());
      recordChange("state", original.getState(), updated.getState());
      recordChange("reviewTask", original.getReviewTask(), updated.getReviewTask());
      recordChange(
          "applicationResult", original.getApplicationResult(), updated.getApplicationResult());
    }
  }
}
