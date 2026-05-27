package org.openmetadata.it.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import org.openmetadata.it.server.ServerHandle;

/**
 * Assertions over the live search engine — index existence, doc counts, alias resolution,
 * doc shape, presence of fields. All assertions hit the engine directly via {@link SearchClient}
 * to validate what reindex actually wrote (rather than what the SDK reports).
 */
public final class SearchAssertions {

  private final SearchClient search;

  public SearchAssertions(final ServerHandle server) {
    this.search = new SearchClient(server);
  }

  public boolean indexExists(final String indexOrAlias) {
    return search.exists("/" + indexOrAlias);
  }

  public long count(final String indexOrAlias) {
    final JsonNode body = search.get("/" + indexOrAlias + "/_count");
    return body.path("count").asLong();
  }

  public long countByEntityType(final String alias, final String entityType) {
    final String body = "{\"query\":{\"term\":{\"entityType\":\"" + entityType + "\"}}}";
    final JsonNode response = search.post("/" + alias + "/_count", body);
    return response.path("count").asLong();
  }

  public List<String> indicesForAlias(final String alias) {
    final JsonNode body = search.get("/_alias/" + alias);
    final List<String> indices = new ArrayList<>();
    final Iterator<Map.Entry<String, JsonNode>> fields = body.fields();
    while (fields.hasNext()) {
      indices.add(fields.next().getKey());
    }
    return indices;
  }

  public List<String> listIndices(final String pattern) {
    final JsonNode body = search.get("/_cat/indices/" + pattern + "?format=json&h=index");
    final List<String> result = new ArrayList<>();
    body.forEach(node -> result.add(node.path("index").asText()));
    return result;
  }

  /**
   * Whether any OM entity id appears in more than one document under the alias — the exact
   * duplicate check behind the no-duplicates-during-reindex invariant. A non-atomic alias swap
   * leaves the alias transiently spanning both the old and new backing index, so the same
   * logical entity is returned twice; a {@code terms} aggregation on {@code id.keyword} with
   * {@code min_doc_count=2} surfaces exactly that.
   *
   * <p>Aggregating on {@code id.keyword} rather than {@code _id} works without enabling
   * fielddata; OM sets the doc {@code _id} equal to the entity id so the two values match. This
   * is exact on a single-shard index (the OM test indices are created single-shard from the
   * static mapping), unlike an approximate {@code cardinality} aggregation, which can differ
   * from the doc count by a handful purely from HyperLogLog error and produce false positives.
   */
  public boolean hasDuplicateIds(final String alias) {
    final String body =
        "{\"size\":0,\"aggs\":{\"dupes\":{\"terms\":{\"field\":\"id.keyword\","
            + "\"min_doc_count\":2,\"size\":1}}}}";
    final JsonNode response = search.post("/" + alias + "/_search", body);
    return !response.path("aggregations").path("dupes").path("buckets").isEmpty();
  }

  public void assertCountAtLeast(final String indexOrAlias, final long minimum) {
    final long actual = count(indexOrAlias);
    assertThat(actual)
        .as("Document count for %s should be >= %d", indexOrAlias, minimum)
        .isGreaterThanOrEqualTo(minimum);
  }

  public void assertCountEquals(final String indexOrAlias, final long expected) {
    final long actual = count(indexOrAlias);
    assertThat(actual)
        .as("Document count for %s should equal %d", indexOrAlias, expected)
        .isEqualTo(expected);
  }

  public void assertEntityIndexed(final String alias, final String entityType, final String fqn) {
    final String body =
        "{\"query\":{\"bool\":{\"must\":["
            + "{\"term\":{\"entityType\":\""
            + entityType
            + "\"}},"
            + "{\"term\":{\"fullyQualifiedName\":\""
            + escape(fqn)
            + "\"}}"
            + "]}}}";
    final JsonNode response = search.post("/" + alias + "/_count", body);
    final long count = response.path("count").asLong();
    assertThat(count).as("%s '%s' should be indexed in %s", entityType, fqn, alias).isEqualTo(1);
  }

  public void assertEntityNotIndexed(
      final String alias, final String entityType, final String fqn) {
    final String body =
        "{\"query\":{\"bool\":{\"must\":["
            + "{\"term\":{\"entityType\":\""
            + entityType
            + "\"}},"
            + "{\"term\":{\"fullyQualifiedName\":\""
            + escape(fqn)
            + "\"}}"
            + "]}}}";
    final JsonNode response = search.post("/" + alias + "/_count", body);
    final long count = response.path("count").asLong();
    assertThat(count).as("%s '%s' should NOT be indexed in %s", entityType, fqn, alias).isZero();
  }

  public void assertNoOrphanedIndices(final String entityIndexBaseName) {
    final List<String> indices = listIndices(entityIndexBaseName + "*");
    final List<String> aliasOwned = indicesForAlias(entityIndexBaseName);
    assertThat(indices)
        .as("No prefixed/orphaned indices should remain for %s", entityIndexBaseName)
        .containsExactlyInAnyOrderElementsOf(aliasOwned);
  }

  private static String escape(final String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }
}
