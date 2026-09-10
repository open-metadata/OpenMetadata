package org.openmetadata.service.context.center;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Lexical recall over {@code context_memory_search_index}. Lexical is sufficient here on purpose:
 * the reconciler's precision gate is word-overlap Jaccard, so a semantically-similar hit that
 * shares no vocabulary would be rejected by the gate anyway — vector recall could not change an
 * outcome, only cost more. Cross-corpus semantic dedup belongs to the scheduled reconciliation
 * pass, not extraction time.
 */
@Slf4j
public class SearchMemoryDuplicateProbe implements MemoryDuplicateProbe {

  private static final String MEMORY_INDEX = "context_memory_search_index";
  private static final int PROBE_SIZE = 10;
  private static final int MAX_QUERY_CHARS = 1000;
  private static final int MIN_TOKEN_CHARS = 3;

  @Override
  public List<ProbeHit> findSimilar(ContextMemory candidate) {
    try {
      String query = probeQuery(candidate);
      if (query.isBlank()) {
        return List.of();
      }
      SearchRequest request =
          new SearchRequest()
              .withQuery(query)
              .withIndex(Entity.getSearchRepository().getIndexOrAliasName(MEMORY_INDEX))
              .withSize(PROBE_SIZE)
              .withFrom(0)
              .withFetchSource(true)
              .withTrackTotalHits(false)
              .withSortFieldParam("_score")
              .withSortOrder("desc")
              .withDeleted(false)
              .withIncludeSourceFields(List.of("id", "question", "answer", "sourceType"));
      Response response =
          Entity.getSearchRepository()
              .search(request, SubjectContext.getSubjectContext(Entity.ADMIN_USER_NAME));
      return parseHits((String) response.getEntity());
    } catch (Exception e) {
      // Dedup is best-effort by design: a search outage must degrade to "create the pill",
      // exactly like the chat tool's probe, never fail the extraction run.
      LOG.debug("Memory duplicate probe failed; proceeding without cross-source dedup", e);
      return List.of();
    }
  }

  /**
   * Recall query over the candidate's title and question, as an OR of its distinct words.
   *
   * <p>Both shape choices are load-bearing. The search layer applies AND semantics to a bare query
   * string, so passing the candidate's prose verbatim required every word to occur in one stored
   * memory — a single non-matching token returned zero hits, which made this probe find nothing at
   * all and silently disabled cross-source dedup. Joining the words with OR restores should-style
   * recall; precision is not this method's job, since the reconciler re-scores every hit through
   * the deterministic gate.
   *
   * <p>The answer is excluded because its generic prose dilutes ranking: with it, an exact
   * duplicate placed 7th of the 10 hits fetched, and on a large corpus would fall out of the window
   * entirely. Title plus question ranks the same duplicate 2nd, matching the gate's own weighting
   * of question over answer. Tokens shorter than three characters are dropped and duplicates
   * collapsed, exactly as {@link MemoryTextSimilarity} tokenizes, so recall and the gate agree on
   * what a word is.
   */
  String probeQuery(ContextMemory candidate) {
    String text =
        String.join(
            " ",
            candidate.getTitle() == null ? "" : candidate.getTitle(),
            candidate.getQuestion() == null ? "" : candidate.getQuestion());
    Set<String> seen = new LinkedHashSet<>();
    for (String word : text.toLowerCase(Locale.ROOT).split("\\W+")) {
      if (word.length() >= MIN_TOKEN_CHARS) {
        seen.add(word);
      }
    }
    String query = String.join(" OR ", seen);
    return query.length() > MAX_QUERY_CHARS ? truncateAtClause(query) : query;
  }

  /** Trims an over-long query back to its last whole OR clause, never mid-operator. */
  private String truncateAtClause(String query) {
    String clipped = query.substring(0, MAX_QUERY_CHARS);
    int lastClause = clipped.lastIndexOf(" OR ");
    return lastClause < 0 ? clipped : clipped.substring(0, lastClause);
  }

  private List<ProbeHit> parseHits(String json) {
    List<ProbeHit> hits = new ArrayList<>();
    ArrayNode rawHits = (ArrayNode) JsonUtils.extractValue(json, "hits", "hits");
    if (rawHits == null) {
      return hits;
    }
    for (JsonNode hit : rawHits) {
      JsonNode source = hit.path("_source");
      String id = source.path("id").asText(null);
      if (id == null) {
        continue;
      }
      try {
        hits.add(
            new ProbeHit(
                UUID.fromString(id),
                source.path("question").asText(null),
                source.path("answer").asText(null),
                source.path("sourceType").asText(null)));
      } catch (IllegalArgumentException badId) {
        // A malformed id in the index is that document's problem, not this run's.
      }
    }
    return hits;
  }
}
