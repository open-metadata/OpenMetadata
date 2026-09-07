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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.data.InstantiateOntologyPattern;
import org.openmetadata.schema.api.data.OntologyIriPreviewRequest;
import org.openmetadata.schema.api.data.OntologyPatternTermInput;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyRelationship;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.service.ontology.OntologyPatternCatalog.PatternDefinition;
import org.openmetadata.service.ontology.OntologyPatternCatalog.PatternEdge;
import org.openmetadata.service.ontology.OntologyPatternCatalog.PatternNode;
import org.openmetadata.service.ontology.OntologyPatternCatalog.PatternRole;
import org.openmetadata.service.util.FullyQualifiedName;

final class OntologyPatternDraftFactory {
  private static final double INITIAL_VERSION = 0.1D;
  private final OntologyPatternCatalog catalog;
  private final OntologyPatternRequestValidator validator;
  private final OntologyIriMinter iriMinter;
  private final RelationshipTypeLookup relationshipTypes;
  private final Clock clock;

  OntologyPatternDraftFactory(
      final OntologyPatternCatalog catalog,
      final OntologyPatternRequestValidator validator,
      final OntologyIriMinter iriMinter,
      final RelationshipTypeLookup relationshipTypes,
      final Clock clock) {
    this.catalog = catalog;
    this.validator = validator;
    this.iriMinter = iriMinter;
    this.relationshipTypes = relationshipTypes;
    this.clock = clock;
  }

  Draft create(
      final Glossary glossary, final InstantiateOntologyPattern request, final String user) {
    validator.validate(request);
    final PatternDefinition definition = catalog.require(request.getPatternType());
    final List<CreatedTerm> createdTerms = createTerms(glossary, request, definition, user);
    final List<OntologyRelationship> relationships =
        createRelationships(definition, createdTerms, user);
    final List<OntologyChangeOperation> operations = operations(createdTerms, relationships);
    return new Draft(operations, references(createdTerms), relationships);
  }

  private List<CreatedTerm> createTerms(
      final Glossary glossary,
      final InstantiateOntologyPattern request,
      final PatternDefinition definition,
      final String user) {
    final List<CreatedTerm> terms = new ArrayList<>();
    for (final PatternNode node : definition.nodes()) {
      final GlossaryTerm term =
          createTerm(glossary, validator.termInput(request, node.role()), node, terms, user);
      terms.add(new CreatedTerm(node.role(), term));
    }
    return List.copyOf(terms);
  }

  private GlossaryTerm createTerm(
      final Glossary glossary,
      final OntologyPatternTermInput input,
      final PatternNode node,
      final List<CreatedTerm> createdTerms,
      final String user) {
    final UUID id = UUID.randomUUID();
    final EntityReference parent = parentReference(node.parent(), createdTerms);
    final String parentFqn =
        parent == null ? glossary.getFullyQualifiedName() : parent.getFullyQualifiedName();
    return new GlossaryTerm()
        .withId(id)
        .withName(input.getName())
        .withDisplayName(displayName(input))
        .withDescription(input.getDescription())
        .withFullyQualifiedName(FullyQualifiedName.add(parentFqn, input.getName()))
        .withGlossary(glossary.getEntityReference())
        .withParent(parent)
        .withIri(mintIri(glossary, input.getName(), id))
        .withVersion(INITIAL_VERSION)
        .withEntityStatus(EntityStatus.DRAFT)
        .withProvider(ProviderType.USER)
        .withUpdatedBy(user)
        .withUpdatedAt(clock.millis());
  }

  private static String displayName(final OntologyPatternTermInput input) {
    final String displayName =
        nullOrEmpty(input.getDisplayName()) || input.getDisplayName().isBlank()
            ? input.getName()
            : input.getDisplayName();
    return displayName;
  }

  private java.net.URI mintIri(
      final Glossary glossary, final String termName, final UUID candidateId) {
    final OntologyIriPreviewRequest request =
        new OntologyIriPreviewRequest()
            .withGlossaryId(glossary.getId())
            .withTermName(termName)
            .withCandidateId(candidateId);
    return iriMinter.preview(glossary, request).getIri();
  }

  private static EntityReference parentReference(
      final PatternRole parentRole, final List<CreatedTerm> createdTerms) {
    final EntityReference parent =
        parentRole == null ? null : requireCreatedTerm(createdTerms, parentRole).reference();
    return parent;
  }

  private List<OntologyRelationship> createRelationships(
      final PatternDefinition definition, final List<CreatedTerm> createdTerms, final String user) {
    return definition.edges().stream()
        .map(edge -> createRelationship(edge, createdTerms, user))
        .toList();
  }

  private OntologyRelationship createRelationship(
      final PatternEdge edge, final List<CreatedTerm> createdTerms, final String user) {
    final RelationshipType relationshipType = relationshipTypes.require(edge.relationshipType());
    return new OntologyRelationship()
        .withId(UUID.randomUUID())
        .withFromTerm(requireCreatedTerm(createdTerms, edge.from()).reference())
        .withToTerm(requireCreatedTerm(createdTerms, edge.to()).reference())
        .withRelationshipType(relationshipType.getEntityReference())
        .withProvenance(RelationProvenance.MANUAL)
        .withStatus(EntityStatus.DRAFT)
        .withCreatedBy(user)
        .withCreatedAt(clock.millis());
  }

  private static List<OntologyChangeOperation> operations(
      final List<CreatedTerm> createdTerms, final List<OntologyRelationship> relationships) {
    final List<OntologyChangeOperation> operations = new ArrayList<>();
    createdTerms.stream()
        .map(OntologyPatternDraftFactory::createOperation)
        .forEach(operations::add);
    relationships.stream()
        .map(OntologyPatternDraftFactory::relationshipOperation)
        .forEach(operations::add);
    return List.copyOf(operations);
  }

  private static OntologyChangeOperation createOperation(final CreatedTerm createdTerm) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.CREATE_TERM)
        .withTerm(createdTerm.term())
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static OntologyChangeOperation relationshipOperation(
      final OntologyRelationship relationship) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.ADD_RELATIONSHIP)
        .withTargetId(relationship.getFromTerm().getId())
        .withRelationship(relationship)
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static CreatedTerm requireCreatedTerm(
      final List<CreatedTerm> createdTerms, final PatternRole role) {
    return createdTerms.stream()
        .filter(created -> created.role() == role)
        .findFirst()
        .orElseThrow(
            () -> new IllegalStateException("Pattern role '" + role.key() + "' is missing"));
  }

  private static List<EntityReference> references(final List<CreatedTerm> createdTerms) {
    return createdTerms.stream().map(CreatedTerm::reference).toList();
  }

  @FunctionalInterface
  interface RelationshipTypeLookup {
    RelationshipType require(String name);
  }

  record Draft(
      List<OntologyChangeOperation> operations,
      List<EntityReference> terms,
      List<OntologyRelationship> relationships) {
    Draft {
      operations = List.copyOf(operations);
      terms = List.copyOf(terms);
      relationships = List.copyOf(relationships);
    }
  }

  private record CreatedTerm(PatternRole role, GlossaryTerm term) {
    EntityReference reference() {
      return term.getEntityReference();
    }
  }
}
