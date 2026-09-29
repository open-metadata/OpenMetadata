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

import java.util.List;
import java.util.UUID;

public interface OntologyAiCompletionGateway {
  Completion<RelationshipCandidate> suggestRelationships(RelationshipPrompt prompt);

  Completion<MappingCandidate> suggestMappings(MappingPrompt prompt);

  Completion<SparqlCandidate> generateSparql(NaturalLanguagePrompt prompt);

  Completion<DomainConceptCandidate> generateDomainDraft(DomainPrompt prompt);

  Completion<MemoryTermCandidate> deriveTermsFromMemories(MemoryTermPrompt prompt);

  default Completion<GlossaryMatchCandidate> matchGlossary(final GlossaryMatchPrompt prompt) {
    throw new UnsupportedOperationException("Glossary matching is not available");
  }

  record Completion<T>(String modelId, List<T> items) {
    public Completion {
      items = List.copyOf(items);
    }
  }

  record TermContext(UUID id, String name, String description, Double version) {}

  record RelationshipTypeContext(
      UUID id, String key, String label, String predicate, String domain, String range) {}

  record RelationshipPrompt(
      List<TermContext> sourceTerms,
      List<TermContext> candidateTerms,
      List<RelationshipTypeContext> relationshipTypes,
      String instructions,
      int maxSuggestions) {}

  record MappingPrompt(
      List<TermContext> sourceTerms,
      List<String> standards,
      String instructions,
      int maxSuggestions) {}

  record NaturalLanguagePrompt(List<String> glossaries, String question) {}

  record DomainPrompt(String glossary, String description, int maxConcepts) {}

  record MemoryTermPrompt(String glossary, List<MemoryContext> memories, int maxTerms) {}

  record MemoryContext(UUID id, String question, String answer, String summary) {}

  record GlossaryContext(UUID id, String name, String description) {}

  record GlossaryMatchPrompt(List<MemoryContext> memories, List<GlossaryContext> glossaries) {}

  record GlossaryMatchCandidate(
      UUID glossaryId,
      String newGlossaryName,
      String newGlossaryDisplayName,
      String newGlossaryDescription,
      double confidence,
      String rationale) {}

  record RelationshipCandidate(
      UUID sourceTermId,
      UUID targetTermId,
      UUID relationshipTypeId,
      double confidence,
      String rationale) {}

  record MappingCandidate(
      UUID sourceTermId,
      String conceptIri,
      String mappingType,
      String schemeIri,
      String source,
      String targetLabel,
      double confidence,
      String rationale) {}

  record SparqlCandidate(String query, String explanation) {}

  record DomainConceptCandidate(
      String name, String displayName, String description, String parentName) {}

  record MemoryTermCandidate(
      UUID sourceMemoryId,
      String name,
      String displayName,
      String description,
      double confidence,
      String rationale) {}
}
