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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.llm.LLMCompletionClient;

public final class LlmOntologyAiCompletionGateway implements OntologyAiCompletionGateway {
  private static final String RELATIONSHIP_PROMPT =
      """
      Return only a JSON array of relationship candidates. Use only supplied term and relationship-type UUIDs. Each item must contain sourceTermId, targetTermId, relationshipTypeId, confidence from 0 to 1, and rationale. Never invent identifiers.
      """;
  private static final String MAPPING_PROMPT =
      """
      Return only a JSON array of standards mappings. Each item must contain sourceTermId, conceptIri, mappingType (EXACT_MATCH, CLOSE_MATCH, BROAD_MATCH, NARROW_MATCH, RELATED_MATCH, or SAME_AS), optional schemeIri and source, targetLabel, confidence from 0 to 1, and rationale. Never invent a source term identifier.
      """;
  private static final String SPARQL_PROMPT =
      """
      Return a one-item JSON array containing query and explanation. The query must be read-only SPARQL SELECT, ASK, CONSTRUCT, or DESCRIBE; it must not contain SERVICE, FROM, FROM NAMED, or an update operation. Use explicit prefixes and always expose the generated query for review.
      """;
  private static final String DOMAIN_PROMPT =
      """
      Return only a JSON array of ontology concepts ordered parent before child. Each item must contain a unique machine-safe name, displayName, description, and optional parentName that exactly matches an earlier item. Do not return more concepts than requested.
      """;

  private final LLMCompletionClient client;

  public LlmOntologyAiCompletionGateway(final LLMCompletionClient client) {
    this.client = client;
  }

  @Override
  public Completion<RelationshipCandidate> suggestRelationships(final RelationshipPrompt prompt) {
    return complete(RELATIONSHIP_PROMPT, prompt, RelationshipCandidate.class);
  }

  @Override
  public Completion<MappingCandidate> suggestMappings(final MappingPrompt prompt) {
    return complete(MAPPING_PROMPT, prompt, MappingCandidate.class);
  }

  @Override
  public Completion<SparqlCandidate> generateSparql(final NaturalLanguagePrompt prompt) {
    return complete(SPARQL_PROMPT, prompt, SparqlCandidate.class);
  }

  @Override
  public Completion<DomainConceptCandidate> generateDomainDraft(final DomainPrompt prompt) {
    return complete(DOMAIN_PROMPT, prompt, DomainConceptCandidate.class);
  }

  private <T> Completion<T> complete(
      final String systemPrompt, final Object prompt, final Class<T> responseType) {
    final List<T> items =
        client.completeStructured(systemPrompt, JsonUtils.pojoToJson(prompt), responseType);
    return new Completion<>(client.getModelId(), items);
  }
}
