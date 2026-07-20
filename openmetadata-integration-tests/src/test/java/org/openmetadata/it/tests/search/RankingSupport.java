package org.openmetadata.it.tests.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalInt;
import java.util.concurrent.Callable;
import org.awaitility.Awaitility;
import org.awaitility.core.ConditionTimeoutException;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.search.RelevancyFixtures;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Minimal search helpers for the per-entity-type ranking suite ({@link SearchEntityRankingIT}):
 * runs a lexical query through the SDK ({@code client.search().query(q).index(idx).execute()}),
 * parses the raw Elasticsearch/OpenSearch response into a small ranked view, and provides the
 * token / tier-tag / schema fixtures the seeders need.
 *
 * <p>Ranking-<em>knob</em> mechanics (tier, field, usage boosts) are already covered on tables by
 * {@code SearchRelevancyPreviewIT} via {@code /v1/search/preview}; this suite adds the missing
 * <em>per-entity-type</em> coverage, so it only needs read-back ordering — no settings mutation.
 */
final class RankingSupport {

  private RankingSupport() {}

  static final String TIER1_TAG = "Tier.Tier1";
  private static final Duration INDEX_WAIT = Duration.ofSeconds(30);
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  /** A hit's identifying and ranking fields. */
  record Hit(String name, String fqn, double score, String tier) {
    boolean matches(String token) {
      return contains(name, token) || contains(fqn, token);
    }
  }

  /** Parsed, score-descending view of a search response. */
  record SearchResult(List<Hit> hits) {

    List<String> names() {
      return hits.stream().map(Hit::name).toList();
    }

    boolean contains(String token) {
      return hits.stream().anyMatch(hit -> hit.matches(token));
    }

    /** 0-based rank (position in score-descending order) of the first hit matching {@code token}. */
    OptionalInt rankOf(String token) {
      OptionalInt rank = OptionalInt.empty();
      for (int i = 0; i < hits.size() && rank.isEmpty(); i++) {
        if (hits.get(i).matches(token)) {
          rank = OptionalInt.of(i);
        }
      }
      return rank;
    }
  }

  /** Run {@code query} against {@code index} via the SDK and parse the ranked hits. */
  static SearchResult search(OpenMetadataClient client, String index, String query) {
    try {
      String body = client.search().query(query).index(index).from(0).size(50).execute();
      return parse(body);
    } catch (Exception e) {
      throw new IllegalStateException("search failed for index=" + index + " q=" + query, e);
    }
  }

  private static SearchResult parse(String body) throws Exception {
    JsonNode hitsNode = OBJECT_MAPPER.readTree(body).path("hits").path("hits");
    List<Hit> hits = new ArrayList<>();
    for (JsonNode hit : hitsNode) {
      JsonNode source = hit.path("_source");
      hits.add(
          new Hit(
              text(source, "name"),
              text(source, "fullyQualifiedName"),
              hit.path("_score").asDouble(0.0),
              text(source.path("tier"), "tagFQN")));
    }
    return new SearchResult(hits);
  }

  /** Poll (never sleep) until {@code condition} holds; returns {@code false} on timeout. */
  static boolean awaitTrue(Callable<Boolean> condition) {
    try {
      Awaitility.await()
          .atMost(INDEX_WAIT)
          .pollInterval(Duration.ofMillis(500))
          .ignoreExceptions()
          .until(condition);
      return true;
    } catch (ConditionTimeoutException timeout) {
      return false;
    }
  }

  /** Create a database service + database + schema and return the schema FQN entities hang off. */
  static String createSchemaFqn(TestNamespace ns) {
    return DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
  }

  /**
   * A unique, <b>hex-free</b> search term (letters g–v). OpenMetadata embeds a hex run-id in every
   * entity name, so a hex query token ngram-matches those names and adds variable text score that
   * breaks controlled score-ties. Mapping each hex digit into g–v yields a token that cannot collide
   * with the hex names, keeping the text match exactly equal across seeded entities.
   */
  static String uniqueTerm(TestNamespace ns) {
    String hex = ns.uniqueShortId();
    StringBuilder term = new StringBuilder("zz");
    for (int i = 0; i < hex.length(); i++) {
      term.append((char) ('g' + Character.digit(hex.charAt(i), 16)));
    }
    return term.toString();
  }

  static TagLabel classificationTag(String tagFqn) {
    return RelevancyFixtures.tierLabel(tagFqn);
  }

  private static String text(JsonNode node, String field) {
    JsonNode value = node.path(field);
    return value.isMissingNode() || value.isNull() ? null : value.asText();
  }

  private static boolean contains(String value, String token) {
    return value != null && token != null && value.contains(token);
  }
}
