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
}
