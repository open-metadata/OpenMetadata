package org.openmetadata.it.tests.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalInt;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicReference;
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
  private static final Duration POLL_INTERVAL = Duration.ofMillis(500);
  private static final int TERM_HEX_LENGTH = 16;
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  /** A hit's name + fqn + score — enough to assert relative ranking. */
  record Hit(String name, String fqn, double score) {
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
              hit.path("_score").asDouble(0.0)));
    }
    return new SearchResult(hits);
  }

  /**
   * Poll (never sleep) until {@code condition} holds. Returns {@code null} once satisfied, or a
   * description of why it never became true.
   *
   * <p>Transient errors while a document is still being indexed are expected, so polling keeps
   * tolerating them — but the last one is retained and reported. Without that, a condition failing
   * on every single poll (a 4xx, a bad index name, a deserialization error) is indistinguishable
   * from genuine indexing lag: both surface only as "not indexed in time".
   */
  static String awaitOrReason(Callable<Boolean> condition) {
    AtomicReference<Exception> lastError = new AtomicReference<>();
    String reason = null;
    try {
      Awaitility.await()
          .atMost(INDEX_WAIT)
          .pollInterval(POLL_INTERVAL)
          .ignoreExceptions()
          .until(() -> evaluate(condition, lastError));
    } catch (ConditionTimeoutException timeout) {
      reason = describeTimeout(lastError.get());
    }
    return reason;
  }

  private static boolean evaluate(Callable<Boolean> condition, AtomicReference<Exception> lastError)
      throws Exception {
    boolean satisfied;
    try {
      satisfied = Boolean.TRUE.equals(condition.call());
    } catch (Exception pollFailure) {
      lastError.set(pollFailure);
      throw pollFailure;
    }
    return satisfied;
  }

  private static String describeTimeout(Exception lastError) {
    String reason = "not satisfied within " + INDEX_WAIT;
    if (lastError != null) {
      reason = reason + "; last error: " + lastError;
    }
    return reason;
  }

  /** Create a database service + database + schema and return the schema FQN entities hang off. */
  static String createSchemaFqn(TestNamespace ns) {
    return DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
  }

  /**
   * A unique, <b>hex-free</b> search term (letters g–v), drawn from its own full-entropy source.
   *
   * <p>The token must avoid two different collisions, and needs both to keep a scored tie exact.
   * OpenMetadata embeds a hex run-id in every entity name, so a hex token ngram-matches those names
   * — hence the g–v mapping. The token must equally not collide with the <em>other</em> tokens
   * minted for the same test, which is why the entropy is drawn here rather than from {@link
   * TestNamespace#uniqueShortId()}: that varies only in its last 4 of 16 characters, so tokens
   * derived from it shared a 14-character prefix. Seeders place a sibling token in every entity
   * name, so that shared prefix leaked a variable {@code name.ngram} / {@code displayName.ngram}
   * contribution into scores the ranking cases require to be exactly tied — measured at a ~12%
   * inversion rate on the tier-boost tie case.
   */
  static String uniqueTerm() {
    String hex = UUID.randomUUID().toString().replace("-", "").substring(0, TERM_HEX_LENGTH);
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
