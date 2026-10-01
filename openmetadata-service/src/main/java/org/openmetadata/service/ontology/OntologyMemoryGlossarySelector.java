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
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.SearchRepository;

/** Selects a semantic glossary fit from a bounded retrieval set. */
@Slf4j
final class OntologyMemoryGlossarySelector {
  private static final int MAX_CANDIDATES = 50;
  private static final int MAX_SEARCH_CANDIDATES = 40;
  private static final int MAX_RELEVANT_TERMS = 5;
  private static final int MAX_GLOSSARY_DESCRIPTION_CHARS = 1_000;
  private static final int MAX_QUERY_WORDS = 32;
  private static final int MAX_QUERY_WORDS_PER_MEMORY = 8;
  // Three characters keeps the acronyms (ARR, NPS, SLA) that glossary-worthy memories often define.
  private static final int MIN_QUERY_WORD_LENGTH = 3;
  private static final Pattern QUERY_WORD_SEPARATOR = Pattern.compile("[^\\p{L}\\p{N}]+");
  private static final double MIN_MATCH_CONFIDENCE = 0.7D;
  private static final Pattern NAME = Pattern.compile("[A-Za-z][A-Za-z0-9_-]{0,127}");
  private static final Set<String> QUERY_STOP_WORDS =
      Set.of(
          "about", "all", "and", "any", "are", "can", "does", "for", "from", "has", "have", "how",
          "into", "its", "not", "our", "should", "than", "that", "the", "their", "them", "then",
          "there", "they", "this", "was", "were", "what", "when", "where", "which", "who", "why",
          "with", "you", "your");

  private final GlossaryRepository repository;
  private final SearchRepository searchRepository;
  private final OntologyAiCompletionGateway gateway;

  OntologyMemoryGlossarySelector(
      final GlossaryRepository repository,
      final SearchRepository searchRepository,
      final OntologyAiCompletionGateway gateway) {
    this.repository = repository;
    this.searchRepository = searchRepository;
    this.gateway = gateway;
  }

  Selection select(
      final List<OntologyAiCompletionGateway.MemoryContext> memories,
      final List<OntologyAiCompletionGateway.TermContext> existingTerms) {
    final List<Glossary> candidates = candidates(memories);
    final var prompt =
        new OntologyAiCompletionGateway.GlossaryMatchPrompt(
            memories,
            candidates.stream()
                .map(
                    glossary ->
                        new OntologyAiCompletionGateway.GlossaryContext(
                            glossary.getId(),
                            glossary.getName(),
                            truncate(glossary.getDescription()),
                            relevantTerms(glossary, existingTerms)))
                .toList());
    final var completion = gateway.matchGlossary(prompt);
    return choose(completion, candidates);
  }

  private static List<OntologyAiCompletionGateway.TermContext> relevantTerms(
      final Glossary glossary, final List<OntologyAiCompletionGateway.TermContext> existingTerms) {
    final String prefix = glossary.getFullyQualifiedName() + ".";
    return existingTerms.stream()
        .filter(term -> term.name().startsWith(prefix))
        .limit(MAX_RELEVANT_TERMS)
        .toList();
  }

  Selection choose(
      final OntologyAiCompletionGateway.Completion<
              OntologyAiCompletionGateway.GlossaryMatchCandidate>
          completion,
      final List<Glossary> candidates) {
    OntologyAiOutputValidator.requireCompletion(completion);
    if (completion.items().size() != 1 || completion.items().getFirst() == null) {
      throw OntologyAiOutputValidator.invalid("glossary selection requires one result");
    }
    final var match = completion.items().getFirst();
    requireValidMatch(match);
    final Glossary existing =
        candidates.stream()
            .filter(candidate -> candidate.getId().equals(match.glossaryId()))
            .findFirst()
            .orElse(null);
    if (match.glossaryId() != null && existing == null) {
      throw OntologyAiOutputValidator.invalid("glossary selection invented an identifier");
    }
    if (existing != null && match.confidence() >= MIN_MATCH_CONFIDENCE) {
      return new Selection(
          existing, false, match.confidence(), match.rationale(), completion.modelId());
    }
    final Glossary proposed = proposedGlossary(match);
    // Include deleted glossaries: a soft-deleted namesake still owns the name, so planning to
    // create it would only fail when a steward applies the draft.
    final var named =
        repository.getByNameOrNull(
            null,
            proposed.getName(),
            repository.getFields("ontologyConfiguration"),
            Include.ALL,
            false);
    if (named.isPresent()
        && !Boolean.TRUE.equals(named.get().getDeleted())
        && isEditable(named.get())) {
      return new Selection(
          named.get(), false, match.confidence(), match.rationale(), completion.modelId());
    }
    if (named.isPresent()) {
      throw OntologyAiOutputValidator.invalid(
          "proposed glossary name belongs to a read-only or deleted glossary");
    }
    return new Selection(
        proposed, true, match.confidence(), match.rationale(), completion.modelId());
  }

  private List<Glossary> candidates(
      final List<OntologyAiCompletionGateway.MemoryContext> memories) {
    final LinkedHashMap<UUID, Glossary> candidates = new LinkedHashMap<>();
    search(memories).forEach(glossary -> candidates.putIfAbsent(glossary.getId(), glossary));
    repository
        .listAfter(
            null,
            repository.getFields("ontologyConfiguration"),
            new ListFilter(Include.NON_DELETED),
            MAX_CANDIDATES,
            null)
        .getData()
        .stream()
        .filter(OntologyMemoryGlossarySelector::isEditable)
        .forEach(glossary -> candidates.putIfAbsent(glossary.getId(), glossary));
    return candidates.values().stream().limit(MAX_CANDIDATES).toList();
  }

  private List<Glossary> search(final List<OntologyAiCompletionGateway.MemoryContext> memories) {
    final String query = query(memories);
    if (query.isBlank() || searchRepository == null) {
      return List.of();
    }
    try {
      return searchResults(query);
    } catch (IOException | RuntimeException exception) {
      LOG.warn("Glossary search unavailable for memory derivation", exception);
      return List.of();
    }
  }

  private List<Glossary> searchResults(final String query) throws IOException {
    final SearchRequest request =
        new SearchRequest()
            .withIndex(searchRepository.getIndexOrAliasName("glossary_search_index"))
            .withQuery(query)
            .withSize(MAX_SEARCH_CANDIDATES)
            .withFrom(0)
            .withDeleted(false)
            .withFetchSource(true)
            .withTrackTotalHits(false);
    final Response response = searchRepository.search(request, null);
    final JsonNode hits =
        JsonUtils.readTree((String) response.getEntity()).path("hits").path("hits");
    if (!hits.isArray()) {
      return List.of();
    }
    final LinkedHashSet<UUID> ids = new LinkedHashSet<>();
    for (final JsonNode hit : hits) {
      final String value = hit.path("_source").path("id").asText(null);
      if (value != null) {
        ids.add(UUID.fromString(value));
      }
    }
    return ids.stream()
        .map(this::glossaryOrNull)
        .filter(glossary -> glossary != null && isEditable(glossary))
        .toList();
  }

  // The index can briefly lag a delete; one stale hit must not discard every other candidate.
  private Glossary glossaryOrNull(final UUID id) {
    try {
      return repository.get(null, id, repository.getFields("ontologyConfiguration"));
    } catch (EntityNotFoundException exception) {
      return null;
    }
  }

  static String query(final List<OntologyAiCompletionGateway.MemoryContext> memories) {
    return memories.stream()
        .flatMap(memory -> queryWords(memory).limit(MAX_QUERY_WORDS_PER_MEMORY))
        .distinct()
        .limit(MAX_QUERY_WORDS)
        .reduce((left, right) -> left + " OR " + right)
        .orElse("");
  }

  private static Stream<String> queryWords(final OntologyAiCompletionGateway.MemoryContext memory) {
    return Stream.of(memory.summary(), memory.question(), memory.answer())
        .filter(text -> text != null && !text.isBlank())
        .flatMap(QUERY_WORD_SEPARATOR::splitAsStream)
        .map(word -> word.toLowerCase(Locale.ROOT))
        .filter(word -> word.codePointCount(0, word.length()) >= MIN_QUERY_WORD_LENGTH)
        .filter(word -> !QUERY_STOP_WORDS.contains(word))
        .distinct();
  }

  private static String truncate(final String description) {
    return description == null || description.length() <= MAX_GLOSSARY_DESCRIPTION_CHARS
        ? description
        : description.substring(0, MAX_GLOSSARY_DESCRIPTION_CHARS);
  }

  private static boolean isEditable(final Glossary glossary) {
    return glossary.getOntologyConfiguration() == null
        || !Boolean.TRUE.equals(glossary.getOntologyConfiguration().getReadOnly());
  }

  private static void requireValidMatch(
      final OntologyAiCompletionGateway.GlossaryMatchCandidate match) {
    if (!Double.isFinite(match.confidence())
        || match.confidence() < 0D
        || match.confidence() > 1D
        || match.rationale() == null
        || match.rationale().isBlank()
        || match.rationale().length() > 2_000) {
      throw OntologyAiOutputValidator.invalid("invalid glossary selection confidence or rationale");
    }
  }

  private static Glossary proposedGlossary(
      final OntologyAiCompletionGateway.GlossaryMatchCandidate match) {
    if (match.newGlossaryName() == null
        || !NAME.matcher(match.newGlossaryName()).matches()
        || match.newGlossaryDisplayName() == null
        || match.newGlossaryDisplayName().isBlank()
        || match.newGlossaryDisplayName().length() > 256
        || match.newGlossaryDescription() == null
        || match.newGlossaryDescription().isBlank()
        || match.newGlossaryDescription().length() > 4_000) {
      throw OntologyAiOutputValidator.invalid("no valid new glossary was proposed");
    }
    return new Glossary()
        .withId(UUID.randomUUID())
        .withName(match.newGlossaryName())
        .withFullyQualifiedName(match.newGlossaryName())
        .withDisplayName(match.newGlossaryDisplayName())
        .withDescription(match.newGlossaryDescription())
        .withVersion(0.1D)
        .withProvider(ProviderType.USER);
  }

  record Selection(
      Glossary glossary, boolean create, double confidence, String rationale, String modelId) {}
}
