package org.openmetadata.service.context.center;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;
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

  /** Free-text recall query; lucene operators stripped so candidate text cannot break the query. */
  private String probeQuery(ContextMemory candidate) {
    String joined =
        String.join(
                " ",
                candidate.getTitle() == null ? "" : candidate.getTitle(),
                candidate.getQuestion() == null ? "" : candidate.getQuestion(),
                candidate.getAnswer() == null ? "" : candidate.getAnswer())
            .replaceAll("[+\\-!(){}\\[\\]^\"~*?:\\\\/&|=<>]", " ")
            .trim();
    return joined.length() > MAX_QUERY_CHARS ? joined.substring(0, MAX_QUERY_CHARS) : joined;
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
