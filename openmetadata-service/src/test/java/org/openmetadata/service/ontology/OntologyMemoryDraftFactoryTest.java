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
            .create(42, glossary, Set.of(memoryId), completion(candidate("customer")), fqn -> false)
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
  void skipsInvalidNamesAndExistingTermsWithoutCreatingAnEmptyDraft() {
    assertTrue(
        factory
            .create(
                42,
                glossary,
                Set.of(memoryId),
                completion(candidate("invalid::name")),
                fqn -> false)
            .isEmpty());
    assertTrue(
        factory
            .create(42, glossary, Set.of(memoryId), completion(candidate("customer")), fqn -> true)
            .isEmpty());
  }

  @Test
  void skipsCandidatesFromUnknownMemories() {
    final var unrelated =
        new OntologyAiCompletionGateway.MemoryTermCandidate(
            UUID.randomUUID(), "customer", "Customer", "A buyer", 0.9D, "Unrelated");

    assertTrue(
        factory
            .create(42, glossary, Set.of(memoryId), completion(unrelated), fqn -> false)
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
}
