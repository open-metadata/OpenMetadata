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

package org.openmetadata.service.drive.memory;

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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.ListFilter;

/**
 * Keyword-searches the glossary-term, metric, and glossary indexes to surface the top-k candidates
 * that most closely match a ContextMemory. Results are passed to the memory agent so it can
 * decide REUSE / CREATE / SKIP without hallucinating new names for existing entities.
 *
 * <p>All axes fail-safe: a search error returns an empty list for THAT axis and logs a warning;
 * grounding never propagates exceptions out of {@link #fetchCandidates}.
 */
@Slf4j
public class MemoryGrounding {
  static final int MAX_CANDIDATES = 20;
  static final int MAX_GLOSSARIES = 200;

  private static final String METRIC_SEARCH_INDEX = "metric_search_index";
  private static final String TYPE_TERM = "glossaryTerm";
  private static final String TYPE_METRIC = "metric";
  private static final String TYPE_GLOSSARY = "glossary";
  private static final String FIELD_GLOSSARY = "glossary";

  public MemoryContext fetchCandidates(ContextMemory memory) {
    final String text = groundingText(memory);
    final List<MemoryCandidate> terms = searchTopK(GLOSSARY_TERM_SEARCH_INDEX, TYPE_TERM, text);
    final List<MemoryCandidate> metrics = searchTopK(METRIC_SEARCH_INDEX, TYPE_METRIC, text);
    final List<MemoryCandidate> glossaries = listAllGlossaries();
    final SiblingContext siblings = fetchSiblings(memory);
    return new MemoryContext(terms, metrics, glossaries, siblings.terms(), siblings.glossaryFqn());
  }

  /**
   * Lists every existing glossary straight from the repository (not the search index, which lags
   * behind sibling glossaries minted moments earlier) so the agent reuses one instead of minting a
   * near-duplicate. Bounded by {@link #MAX_GLOSSARIES}; fail-safe to empty on error.
   */
  private List<MemoryCandidate> listAllGlossaries() {
    List<MemoryCandidate> result = List.of();
    try {
      final GlossaryRepository repo =
          (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
      final List<Glossary> all =
          repo.listAll(repo.getFields(""), new ListFilter(Include.NON_DELETED));
      result = toGlossaryCandidates(all);
    } catch (RuntimeException ex) {
      LOG.warn("MemoryGrounding: listing glossaries failed: {}", ex.getMessage());
    }
    return result;
  }

  private List<MemoryCandidate> toGlossaryCandidates(List<Glossary> all) {
    final List<Glossary> capped =
        all.size() > MAX_GLOSSARIES ? all.subList(0, MAX_GLOSSARIES) : all;
    final List<MemoryCandidate> out = new ArrayList<>();
    for (final Glossary g : capped) {
      out.add(
          new MemoryCandidate(
              TYPE_GLOSSARY, g.getFullyQualifiedName(), g.getName(), g.getDescription()));
    }
    return out;
  }

  /**
   * Reads the terms already derived from the memory's same-document siblings, and the glossary they
   * predominantly live in. These come from the repository (current despite search-index lag, since
   * derivation runs serially) so the agent can REUSE them and connect new terms to them. Fail-safe
   * to empty.
   */
  private SiblingContext fetchSiblings(ContextMemory memory) {
    SiblingContext result = new SiblingContext(List.of(), null);
    final EntityReference source = memory.getSourceEntity();
    if (source != null) {
      try {
        result = collectSiblings(memory, source);
      } catch (RuntimeException ex) {
        LOG.warn(
            "MemoryGrounding: sibling lookup failed for memory {}: {}",
            memory.getId(),
            ex.getMessage());
      }
    }
    return result;
  }

  private SiblingContext collectSiblings(ContextMemory memory, EntityReference source) {
    final ContextMemoryRepository memoryRepo =
        (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
    final GlossaryTermRepository termRepo =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    final List<ContextMemory> siblings =
        memoryRepo.listExtractedMemories(source.getId(), source.getType());
    final List<MemoryCandidate> terms = new ArrayList<>();
    final Map<String, Integer> glossaryFreq = new HashMap<>();
    for (final ContextMemory sib : siblings) {
      if (!sib.getId().equals(memory.getId()) && terms.size() < MAX_CANDIDATES) {
        addSiblingTerms(sib, termRepo, terms, glossaryFreq);
      }
    }
    return new SiblingContext(terms, mostFrequent(glossaryFreq));
  }

  private void addSiblingTerms(
      ContextMemory sib,
      GlossaryTermRepository termRepo,
      List<MemoryCandidate> terms,
      Map<String, Integer> glossaryFreq) {
    final List<EntityReference> derived =
        termRepo.findFrom(
            sib.getId(), Entity.CONTEXT_MEMORY, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM);
    for (final EntityReference ref : derived) {
      final GlossaryTerm term = termRepo.get(null, ref.getId(), termRepo.getFields(FIELD_GLOSSARY));
      terms.add(
          new MemoryCandidate(
              TYPE_TERM, term.getFullyQualifiedName(), term.getName(), term.getDescription()));
      countGlossary(term, glossaryFreq);
    }
  }

  private void countGlossary(GlossaryTerm term, Map<String, Integer> freq) {
    if (term.getGlossary() != null && term.getGlossary().getFullyQualifiedName() != null) {
      freq.merge(term.getGlossary().getFullyQualifiedName(), 1, Integer::sum);
    }
  }

  private String mostFrequent(Map<String, Integer> freq) {
    String result = null;
    int best = 0;
    for (final Map.Entry<String, Integer> entry : freq.entrySet()) {
      if (entry.getValue() > best) {
        best = entry.getValue();
        result = entry.getKey();
      }
    }
    return result;
  }

  /** The terms derived from a memory's siblings and the glossary they predominantly live in. */
  private record SiblingContext(List<MemoryCandidate> terms, String glossaryFqn) {}

  private List<MemoryCandidate> searchTopK(String index, String type, String text) {
    List<MemoryCandidate> result = List.of();
    try {
      final SearchRequest request = buildRequest(index, text);
      final Response response = Entity.getSearchRepository().search(request, null);
      result = parseHits((String) response.getEntity(), type);
    } catch (java.io.IOException | RuntimeException ex) {
      LOG.warn("MemoryGrounding: keyword search failed for index '{}': {}", index, ex.getMessage());
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

  private List<MemoryCandidate> parseHits(String json, String type) {
    final List<MemoryCandidate> candidates = new ArrayList<>();
    final Object hitsRaw = JsonUtils.extractValue(json, HITS, HITS);
    if (hitsRaw instanceof ArrayNode hits) {
      for (final JsonNode hit : hits) {
        final String fqn = JsonUtils.extractValue(hit, SEARCH_SOURCE, FULLY_QUALIFIED_NAME);
        final String name = JsonUtils.extractValue(hit, SEARCH_SOURCE, Entity.FIELD_NAME);
        final String description =
            JsonUtils.extractValue(hit, SEARCH_SOURCE, Entity.FIELD_DESCRIPTION);
        if (fqn != null && name != null) {
          candidates.add(new MemoryCandidate(type, fqn, name, description));
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
