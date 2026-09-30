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

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.OntologyAiProviderException;
import org.openmetadata.service.search.SearchRepository;

/** Retrieves likely existing concepts before proposing new glossary terms. */
final class OntologyMemoryExistingTermFinder {
  private static final int MAX_TERMS = 50;
  private static final int MAX_DESCRIPTION_CHARS = 1_000;
  private static final String INDEX = "glossary_term_search_index";

  private final SearchRepository searchRepository;

  OntologyMemoryExistingTermFinder(final SearchRepository searchRepository) {
    this.searchRepository = searchRepository;
  }

  List<OntologyAiCompletionGateway.TermContext> find(
      final List<OntologyAiCompletionGateway.MemoryContext> memories) {
    final String query = OntologyMemoryGlossarySelector.query(memories);
    if (query.isBlank() || searchRepository == null) {
      throw new OntologyAiProviderException("Existing glossary terms could not be checked");
    }
    try {
      return parse(searchRepository.search(request(query), null).getEntity());
    } catch (IOException | RuntimeException exception) {
      throw new OntologyAiProviderException("Existing glossary term search failed", exception);
    }
  }

  private SearchRequest request(final String query) {
    return new SearchRequest()
        .withIndex(searchRepository.getIndexOrAliasName(INDEX))
        .withQuery(query)
        .withSize(MAX_TERMS)
        .withFrom(0)
        .withDeleted(false)
        .withFetchSource(true)
        .withTrackTotalHits(false);
  }

  private static List<OntologyAiCompletionGateway.TermContext> parse(final Object body)
      throws IOException {
    if (!(body instanceof String json)) {
      throw new OntologyAiProviderException("Existing glossary term search returned no JSON");
    }
    final JsonNode hits = JsonUtils.readTree(json).path("hits").path("hits");
    if (!hits.isArray()) {
      throw new OntologyAiProviderException("Existing glossary term search returned no hits array");
    }
    final List<OntologyAiCompletionGateway.TermContext> terms = new ArrayList<>();
    for (final JsonNode hit : hits) {
      final JsonNode source = hit.path("_source");
      final String id = source.path("id").asText(null);
      final String name = source.path("fullyQualifiedName").asText(null);
      if (id != null && name != null) {
        terms.add(
            new OntologyAiCompletionGateway.TermContext(
                UUID.fromString(id), name, description(source), null));
      }
    }
    return List.copyOf(terms);
  }

  private static String description(final JsonNode source) {
    final String value = source.path("description").asText("");
    return value.substring(0, Math.min(value.length(), MAX_DESCRIPTION_CHARS));
  }
}
