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

package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.core.UriInfo;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyRelationship;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyAxiomRepository;

public final class OntologyChangeOperationExecutor {
  private static final String TERM_EDIT_FIELDS = "attributes,conceptMappings";
  private final GlossaryTermRepository termRepository;
  private final OntologyAxiomRepository axiomRepository;
  private final Clock clock;

  public OntologyChangeOperationExecutor(
      final GlossaryTermRepository termRepository,
      final OntologyAxiomRepository axiomRepository,
      final Clock clock) {
    this.termRepository = termRepository;
    this.axiomRepository = axiomRepository;
    this.clock = clock;
  }

  public OperationOutcome execute(
      final UriInfo uriInfo, final String user, final OntologyChangeOperation operation) {
    final OperationOutcome outcome =
        switch (operation.getOperationType()) {
          case CREATE_TERM, UPDATE_TERM -> upsertTerm(uriInfo, user, operation);
          case DELETE_TERM -> deleteTerm(user, operation);
          case ADD_RELATIONSHIP -> addRelationship(uriInfo, user, operation);
          case UPDATE_RELATIONSHIP -> updateRelationship(uriInfo, user, operation);
          case DELETE_RELATIONSHIP -> deleteRelationship(uriInfo, user, operation);
          case UPSERT_ATTRIBUTE -> upsertAttribute(uriInfo, user, operation);
          case DELETE_ATTRIBUTE -> deleteAttribute(uriInfo, user, operation);
          case UPSERT_MAPPING -> upsertMapping(uriInfo, user, operation);
          case DELETE_MAPPING -> deleteMapping(uriInfo, user, operation);
          case UPSERT_AXIOM -> upsertAxiom(uriInfo, user, operation);
          case DELETE_AXIOM -> deleteAxiom(user, operation);
        };
    return outcome;
  }

  private OperationOutcome upsertTerm(
      final UriInfo uriInfo, final String user, final OntologyChangeOperation operation) {
    final GlossaryTerm term = JsonUtils.deepCopy(operation.getTerm(), GlossaryTerm.class);
    prepareTerm(term, user);
    final boolean isUpdate =
        operation.getOperationType() == OntologyChangeOperationType.UPDATE_TERM;
    termRepository.prepareInternal(term, isUpdate);
    return outcome(termRepository.createOrUpdate(uriInfo, term, user).getEntity());
  }

  private OperationOutcome deleteTerm(final String user, final OntologyChangeOperation operation) {
    final GlossaryTerm term = term(operation.getTargetId(), Include.ALL);
    final GlossaryTerm deleted =
        Boolean.TRUE.equals(term.getDeleted())
            ? term
            : termRepository.delete(user, operation.getTargetId(), false, false).entity();
    return outcome(deleted);
  }

  private OperationOutcome addRelationship(
      final UriInfo uriInfo, final String user, final OntologyChangeOperation operation) {
    final OntologyRelationship relationship = operation.getRelationship();
    final GlossaryTerm term =
        termRepository
            .addTermRelation(
                uriInfo, user, relationship.getFromTerm().getId(), termRelation(relationship))
            .getEntity();
    return outcome(term);
  }

  private OperationOutcome updateRelationship(
      final UriInfo uriInfo, final String user, final OntologyChangeOperation operation) {
    final OntologyRelationship relationship = operation.getRelationship();
    final GlossaryTerm term =
        termRepository
            .updateTermRelation(
                uriInfo,
                user,
                relationship.getFromTerm().getId(),
                relationship.getToTerm().getId(),
                termRelation(relationship))
            .getEntity();
    return outcome(term);
  }

  private OperationOutcome deleteRelationship(
      final UriInfo uriInfo, final String user, final OntologyChangeOperation operation) {
    final OntologyRelationship relationship = operation.getRelationship();
    final GlossaryTerm term =
        termRepository
            .removeTermRelation(
                uriInfo,
                user,
                relationship.getFromTerm().getId(),
                relationship.getToTerm().getId(),
                relationship.getRelationshipType().getName())
            .getEntity();
    return outcome(term);
  }

  private static TermRelation termRelation(final OntologyRelationship relationship) {
    return new TermRelation()
        .withId(relationship.getId())
        .withTerm(relationship.getToTerm())
        .withRelationType(relationship.getRelationshipType().getName())
        .withRelationshipType(relationship.getRelationshipType())
        .withProvenance(relationship.getProvenance())
        .withStatus(relationship.getStatus())
        .withCreatedBy(relationship.getCreatedBy())
        .withCreatedAt(relationship.getCreatedAt());
  }

  private OperationOutcome upsertAttribute(
      final UriInfo uriInfo, final String user, final OntologyChangeOperation operation) {
    final GlossaryTerm term = editableTerm(operation.getTargetId());
    final OntologyAttribute attribute = operation.getAttribute();
    final List<OntologyAttribute> attributes = new ArrayList<>(listOrEmpty(term.getAttributes()));
    attributes.removeIf(existing -> existing.getId().equals(attribute.getId()));
    attributes.add(attribute);
    term.setAttributes(attributes);
    return persistTerm(uriInfo, user, term);
  }

  private OperationOutcome deleteAttribute(
      final UriInfo uriInfo, final String user, final OntologyChangeOperation operation) {
    final GlossaryTerm term = editableTerm(operation.getTargetId());
    final List<OntologyAttribute> attributes = new ArrayList<>(listOrEmpty(term.getAttributes()));
    attributes.removeIf(attribute -> attribute.getId().equals(operation.getAttribute().getId()));
    term.setAttributes(attributes);
    return persistTerm(uriInfo, user, term);
  }

  private OperationOutcome upsertMapping(
      final UriInfo uriInfo, final String user, final OntologyChangeOperation operation) {
    final GlossaryTerm term = editableTerm(operation.getTargetId());
    final List<ConceptMapping> mappings = new ArrayList<>(listOrEmpty(term.getConceptMappings()));
    mappings.removeIf(existing -> sameMapping(existing, operation.getMapping()));
    mappings.add(operation.getMapping());
    term.setConceptMappings(mappings);
    return persistTerm(uriInfo, user, term);
  }

  private OperationOutcome deleteMapping(
      final UriInfo uriInfo, final String user, final OntologyChangeOperation operation) {
    final GlossaryTerm term = editableTerm(operation.getTargetId());
    final List<ConceptMapping> mappings = new ArrayList<>(listOrEmpty(term.getConceptMappings()));
    mappings.removeIf(existing -> sameMapping(existing, operation.getMapping()));
    term.setConceptMappings(mappings);
    return persistTerm(uriInfo, user, term);
  }

  private static boolean sameMapping(final ConceptMapping first, final ConceptMapping second) {
    return first.getMappingType() == second.getMappingType()
        && first.getConceptIri().equals(second.getConceptIri())
        && Objects.equals(first.getSchemeIri(), second.getSchemeIri());
  }

  private GlossaryTerm editableTerm(final UUID termId) {
    final GlossaryTerm term =
        termRepository.get(
            null, termId, termRepository.getFields(TERM_EDIT_FIELDS), Include.NON_DELETED, false);
    return JsonUtils.deepCopy(term, GlossaryTerm.class);
  }

  private GlossaryTerm term(final UUID termId, final Include include) {
    return termRepository.get(null, termId, termRepository.getFields(""), include, false);
  }

  private OperationOutcome persistTerm(
      final UriInfo uriInfo, final String user, final GlossaryTerm term) {
    prepareTerm(term, user);
    termRepository.prepareInternal(term, true);
    return outcome(termRepository.createOrUpdate(uriInfo, term, user).getEntity());
  }

  private void prepareTerm(final GlossaryTerm term, final String user) {
    term.setUpdatedBy(user);
    term.setUpdatedAt(clock.millis());
  }

  private OperationOutcome upsertAxiom(
      final UriInfo uriInfo, final String user, final OntologyChangeOperation operation) {
    final OntologyAxiom axiom = JsonUtils.deepCopy(operation.getAxiom(), OntologyAxiom.class);
    axiom.setUpdatedBy(user);
    axiom.setUpdatedAt(clock.millis());
    axiomRepository.prepareInternal(axiom, operation.getTargetId() != null);
    return outcome(axiomRepository.createOrUpdate(uriInfo, axiom, user).getEntity());
  }

  private OperationOutcome deleteAxiom(final String user, final OntologyChangeOperation operation) {
    final OntologyAxiom axiom =
        axiomRepository.get(
            null, operation.getTargetId(), axiomRepository.getFields(""), Include.ALL, false);
    final OntologyAxiom deleted =
        Boolean.TRUE.equals(axiom.getDeleted())
            ? axiom
            : axiomRepository.delete(user, operation.getTargetId(), false, false).entity();
    return outcome(deleted);
  }

  private static OperationOutcome outcome(final EntityInterface entity) {
    return new OperationOutcome(entity.getEntityReference(), entity.getVersion());
  }

  public record OperationOutcome(EntityReference entity, Double entityVersion) {}
}
