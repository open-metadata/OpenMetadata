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
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.invalid;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.requireCompletion;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.requireEntityName;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.requireText;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.OntologyDomainDraftRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.util.FullyQualifiedName;

final class OntologyAiDomainDraftFactory {
  private static final double INITIAL_VERSION = 0.1D;

  CreateOntologyChangeSet create(
      final OntologyDomainDraftRequest request,
      final Glossary glossary,
      final OntologyAiCompletionGateway.Completion<
              OntologyAiCompletionGateway.DomainConceptCandidate>
          completion) {
    final List<OntologyChangeOperation> operations =
        operations(completion, glossary, request.getMaxConcepts());
    return new CreateOntologyChangeSet()
        .withName(request.getChangeSetName())
        .withDisplayName(request.getDisplayName())
        .withDescription(request.getDescription())
        .withGlossaries(Set.of(glossary.getFullyQualifiedName()))
        .withState(OntologyChangeSetState.DRAFT)
        .withOperations(operations)
        .withUndoCursor(operations.size())
        .withProvider(ProviderType.USER);
  }

  private static List<OntologyChangeOperation> operations(
      final OntologyAiCompletionGateway.Completion<
              OntologyAiCompletionGateway.DomainConceptCandidate>
          completion,
      final Glossary glossary,
      final int maximum) {
    requireCompletion(completion);
    if (completion.items().size() > maximum) {
      throw invalid("domain draft exceeds the requested concept limit");
    }
    final Set<String> names = new HashSet<>();
    final List<CreatedConcept> created = new ArrayList<>();
    final List<OntologyChangeOperation> operations = new ArrayList<>();
    for (final OntologyAiCompletionGateway.DomainConceptCandidate candidate : completion.items()) {
      operations.add(operation(candidate, glossary, names, created));
    }
    return List.copyOf(operations);
  }

  private static OntologyChangeOperation operation(
      final OntologyAiCompletionGateway.DomainConceptCandidate candidate,
      final Glossary glossary,
      final Set<String> names,
      final List<CreatedConcept> created) {
    final String name = requireEntityName(candidate.name());
    requireUniqueName(name, names);
    final EntityReference parent = requireParent(candidate.parentName(), created);
    final GlossaryTerm term = term(candidate, glossary, name, parent);
    created.add(new CreatedConcept(name, term.getEntityReference()));
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.CREATE_TERM)
        .withTerm(term)
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static GlossaryTerm term(
      final OntologyAiCompletionGateway.DomainConceptCandidate candidate,
      final Glossary glossary,
      final String name,
      final EntityReference parent) {
    requireText(candidate.displayName(), "domain concept display name");
    requireText(candidate.description(), "domain concept description");
    final String parentFqn =
        parent == null ? glossary.getFullyQualifiedName() : parent.getFullyQualifiedName();
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName(name)
        .withDisplayName(candidate.displayName())
        .withDescription(candidate.description())
        .withFullyQualifiedName(FullyQualifiedName.add(parentFqn, name))
        .withGlossary(glossary.getEntityReference())
        .withParent(parent)
        .withVersion(INITIAL_VERSION)
        .withEntityStatus(EntityStatus.DRAFT)
        .withProvider(ProviderType.USER);
  }

  private static EntityReference requireParent(
      final String parentName, final List<CreatedConcept> created) {
    EntityReference parent = null;
    if (!nullOrEmpty(parentName) && !parentName.isBlank()) {
      parent =
          created.stream()
              .filter(concept -> concept.name().equals(parentName))
              .map(CreatedConcept::reference)
              .findFirst()
              .orElseThrow(() -> invalid("domain parent must reference an earlier concept"));
    }
    return parent;
  }

  private static void requireUniqueName(final String name, final Set<String> names) {
    if (!names.add(name)) {
      throw invalid("domain concept names must be unique");
    }
  }

  private record CreatedConcept(String name, EntityReference reference) {}
}
