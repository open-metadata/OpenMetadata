/*
 * Copyright 2024 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.service.drive.ontology;

import static org.openmetadata.service.search.SearchClient.GLOSSARY_TERM_SEARCH_INDEX;
import static org.openmetadata.service.search.SearchConstants.DEFAULT_SORT_FIELD;
import static org.openmetadata.service.search.SearchConstants.DEFAULT_SORT_ORDER;
import static org.openmetadata.service.search.SearchConstants.FULLY_QUALIFIED_NAME;
import static org.openmetadata.service.search.SearchConstants.HITS;
import static org.openmetadata.service.search.SearchConstants.SEARCH_SOURCE;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * Keyword-searches the glossary-term, metric, and glossary indexes to surface the top-k candidates
 * that most closely match a ContextMemory. Results are passed to the ontology agent so it can
 * decide REUSE / CREATE / SKIP without hallucinating new names for existing entities.
 *
 * <p>All axes fail-safe: a search error returns an empty list for THAT axis and logs a warning;
 * grounding never propagates exceptions out of {@link #fetchCandidates}.
 */
@Slf4j
public class OntologyGrounding {
  static final int MAX_CANDIDATES = 20;

  private static final String GLOSSARY_SEARCH_INDEX = "glossary_search_index";
  private static final String METRIC_SEARCH_INDEX = "metric_search_index";
  private static final String TYPE_TERM = "glossaryTerm";
  private static final String TYPE_METRIC = "metric";
  private static final String TYPE_GLOSSARY = "glossary";

  public OntologyContext fetchCandidates(ContextMemory memory) {
    final String text = groundingText(memory);
    final List<OntologyCandidate> terms = searchTopK(GLOSSARY_TERM_SEARCH_INDEX, TYPE_TERM, text);
    final List<OntologyCandidate> metrics = searchTopK(METRIC_SEARCH_INDEX, TYPE_METRIC, text);
    final List<OntologyCandidate> glossaries =
        searchTopK(GLOSSARY_SEARCH_INDEX, TYPE_GLOSSARY, text);
    return new OntologyContext(terms, metrics, glossaries);
  }

  private List<OntologyCandidate> searchTopK(String index, String type, String text) {
    List<OntologyCandidate> result = List.of();
    try {
      final SearchRequest request = buildRequest(index, text);
      final Response response = Entity.getSearchRepository().search(request, null);
      result = parseHits((String) response.getEntity(), type);
    } catch (java.io.IOException | RuntimeException ex) {
      LOG.warn(
          "OntologyGrounding: keyword search failed for index '{}': {}", index, ex.getMessage());
    }
    return result;
  }

  private SearchRequest buildRequest(String index, String text) {
    return new SearchRequest()
        .withQuery(text)
        .withIndex(Entity.getSearchRepository().getIndexOrAliasName(index))
        .withSize(MAX_CANDIDATES)
        .withFrom(0)
        .withFetchSource(true)
        .withTrackTotalHits(false)
        .withSortFieldParam(DEFAULT_SORT_FIELD)
        .withDeleted(false)
        .withSortOrder(DEFAULT_SORT_ORDER)
        .withIncludeSourceFields(new ArrayList<>());
  }

  private List<OntologyCandidate> parseHits(String json, String type) {
    final List<OntologyCandidate> candidates = new ArrayList<>();
    final Object hitsRaw = JsonUtils.extractValue(json, HITS, HITS);
    if (hitsRaw instanceof ArrayNode hits) {
      for (final JsonNode hit : hits) {
        final String fqn = JsonUtils.extractValue(hit, SEARCH_SOURCE, FULLY_QUALIFIED_NAME);
        final String name = JsonUtils.extractValue(hit, SEARCH_SOURCE, Entity.FIELD_NAME);
        final String description =
            JsonUtils.extractValue(hit, SEARCH_SOURCE, Entity.FIELD_DESCRIPTION);
        if (fqn != null && name != null) {
          candidates.add(new OntologyCandidate(type, fqn, name, description));
        }
      }
    }
    return candidates;
  }

  private String groundingText(ContextMemory m) {
    return String.join(
        " ",
        StringUtils.defaultString(m.getTitle()),
        StringUtils.defaultString(m.getQuestion()),
        StringUtils.defaultString(m.getAnswer()));
  }
}
