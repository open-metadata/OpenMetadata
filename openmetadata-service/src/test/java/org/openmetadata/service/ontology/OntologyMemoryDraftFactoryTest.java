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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;

class OntologyMemoryDraftFactoryTest {
  private final OntologyMemoryDraftFactory factory = new OntologyMemoryDraftFactory();
  private final UUID memoryId = UUID.randomUUID();
  private final Glossary glossary =
      new Glossary()
          .withId(UUID.randomUUID())
          .withName("business")
          .withFullyQualifiedName("business");

  @Test
  void createsReviewableOperationWithMemoryAndModelProvenance() {
    final CreateOntologyChangeSet draft =
        factory
            .create(
                42, existing(), Set.of(memoryId), completion(candidate("customer")), fqn -> false)
            .orElseThrow();

    assertEquals("memory-glossary-42", draft.getName());
    assertEquals(1, draft.getUndoCursor());
    final OntologyChangeOperation operation = draft.getOperations().getFirst();
    assertEquals(OntologyChangeOperationType.CREATE_TERM, operation.getOperationType());
    assertEquals(Set.of(memoryId), operation.getSourceMemoryIds());
    assertEquals("test-model", operation.getModelId());
    assertEquals("Grounded in the memory", operation.getRationale());
    assertEquals(0.9D, operation.getConfidence());
    assertEquals("business.customer", operation.getTerm().getFullyQualifiedName());
    assertEquals(EntityStatus.DRAFT, operation.getTerm().getEntityStatus());
  }

  @Test
  void proposesGlossaryBeforeTermsAndLeavesCreationForApply() {
    final var selection =
        new OntologyMemoryGlossarySelector.Selection(
            glossary.withDescription("Business concepts"),
            true,
            0.85D,
            "No matching glossary",
            "selection-model");
    final CreateOntologyChangeSet draft =
        factory
            .create(
                42, selection, Set.of(memoryId), completion(candidate("customer")), fqn -> false)
            .orElseThrow();

    assertEquals(2, draft.getOperations().size());
    assertEquals(2, draft.getUndoCursor());
    assertEquals(
        OntologyChangeOperationType.CREATE_GLOSSARY,
        draft.getOperations().getFirst().getOperationType());
    assertEquals(glossary.getId(), draft.getOperations().getFirst().getGlossary().getId());
    assertEquals(
        draft.getOperations().getFirst().getGlossary().getId(),
        draft.getOperations().getLast().getTerm().getGlossary().getId());
    assertEquals(Set.of(memoryId), draft.getOperations().getFirst().getSourceMemoryIds());
  }

  @Test
  void skipsInvalidNamesAndExistingTermsWithoutCreatingAnEmptyDraft() {
    assertTrue(
        factory
            .create(42, existing(), Set.of(memoryId), completion(candidate(":::")), fqn -> false)
            .isEmpty());
    assertTrue(
        factory
            .create(
                42, existing(), Set.of(memoryId), completion(candidate("customer")), fqn -> true)
            .isEmpty());
  }

  @Test
  void normalizesReadableAiNamesBeforeCheckingForDuplicates() {
    final CreateOntologyChangeSet draft =
        factory
            .create(
                42,
                existing(),
                Set.of(memoryId),
                completion(candidate("Inactive Customer")),
                fqn -> false)
            .orElseThrow();
    assertEquals(
        "business.inactive_customer",
        draft.getOperations().getFirst().getTerm().getFullyQualifiedName());
    assertTrue(
        factory
            .create(
                43,
                existing(),
                Set.of(memoryId),
                completion(candidate("Inactive Customer")),
                fqn -> fqn.equals("business.inactive_customer"))
            .isEmpty());
  }

  @Test
  void removesRedundantGlossaryPrefixFromLocalTermName() {
    final CreateOntologyChangeSet draft =
        factory
            .create(
                42,
                existing(),
                Set.of(memoryId),
                completion(candidate("business_inactive_customer")),
                fqn -> false)
            .orElseThrow();

    assertEquals(
        "business.inactive_customer",
        draft.getOperations().getFirst().getTerm().getFullyQualifiedName());
  }

  @Test
  void skipsCandidatesFromUnknownMemories() {
    final var unrelated =
        new OntologyAiCompletionGateway.MemoryTermCandidate(
            UUID.randomUUID(), "customer", "Customer", "A buyer", 0.9D, "Unrelated");

    assertTrue(
        factory
            .create(42, existing(), Set.of(memoryId), completion(unrelated), fqn -> false)
            .isEmpty());
  }

  @Test
  void createsNoDraftForNoSuggestionOrUncertainSuggestion() {
    assertTrue(
        factory
            .create(
                42,
                existing(),
                Set.of(memoryId),
                new OntologyAiCompletionGateway.Completion<>("test-model", List.of()),
                fqn -> false)
            .isEmpty());
    final var uncertain =
        new OntologyAiCompletionGateway.MemoryTermCandidate(
            memoryId, "customer", "Customer", "A buyer", 0.79D, "Possible concept");
    assertTrue(
        factory
            .create(42, existing(), Set.of(memoryId), completion(uncertain), fqn -> false)
            .isEmpty());
  }

  private OntologyAiCompletionGateway.MemoryTermCandidate candidate(final String name) {
    return new OntologyAiCompletionGateway.MemoryTermCandidate(
        memoryId, name, "Customer", "A buyer", 0.9D, "Grounded in the memory");
  }

  private OntologyAiCompletionGateway.Completion<OntologyAiCompletionGateway.MemoryTermCandidate>
      completion(final OntologyAiCompletionGateway.MemoryTermCandidate candidate) {
    return new OntologyAiCompletionGateway.Completion<>("test-model", List.of(candidate));
  }

  private OntologyMemoryGlossarySelector.Selection existing() {
    return new OntologyMemoryGlossarySelector.Selection(glossary, false, 1D, null, null);
  }
}
