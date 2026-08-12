package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.service.Entity;

/**
 * Regression guard for the Data-Insights "Group By custom property" 500s (issues #2, #3): an
 * aggregation over a custom-property field threw {@code search_phase_execution_exception} and
 * failed the shard. Two root causes were reported:
 * <ul>
 *   <li>#2 — aggregating an {@code extension.*} field that was a non-aggregatable
 *       {@code flat_object}.
 *   <li>#3 — a {@code value_count} aggregation on a <i>string</i> custom property
 *       ({@code columndatepivot}) failed the shard.
 * </ul>
 *
 * <p>The fix moved custom properties into a {@code nested customPropertiesTyped} object with typed
 * sub-fields ({@code stringValue} keyword, {@code longValue} long, …) that <i>are</i> aggregatable.
 * This test asserts the aggregation that used to 500 now succeeds (the engine returns aggregation
 * buckets, not a shard failure) — independent of how many docs carry a custom property. {@link
 * SearchClient} throws on a non-2xx engine response, so "doesn't 500" is asserted by the call not
 * throwing plus an {@code aggregations} node in the body.
 *
 * <p><b>Generalizes to</b>: every index carrying {@code customPropertiesTyped} (33 entity types).
 * We exercise the table index as the representative; the mapping is shared, so a regression there
 * is a regression everywhere.
 */
class CustomPropertyAggregationIT {

  @Test
  void valueCountOnStringCustomPropertyDoesNotFailTheShard() {
    final ServerHandle server = OssTestServer.defaultHandle();
    final String index = new IndexAliasInspector(server).indexNameFor(Entity.TABLE);
    final SearchClient search = new SearchClient(server);

    // The #3 repro: a value_count aggregation on the string custom-property sub-field, run inside
    // the nested customPropertiesTyped scope. On the old flat_object/text mapping this 500'd.
    final String nestedValueCount =
        "{\"size\":0,\"aggs\":{\"cp\":{\"nested\":{\"path\":\"customPropertiesTyped\"},"
            + "\"aggs\":{\"strVals\":{\"value_count\":{\"field\":\"customPropertiesTyped.stringValue\"}}}}}}";

    final JsonNode[] holder = new JsonNode[1];
    assertThatCode(() -> holder[0] = search.search(index, nestedValueCount))
        .as("value_count on customPropertiesTyped.stringValue must not fail the shard")
        .doesNotThrowAnyException();

    assertThat(holder[0].path("aggregations").path("cp").has("strVals"))
        .as("aggregation returned buckets (no search_phase_execution_exception)")
        .isTrue();
  }

  @Test
  void termsAggregationOnKeywordCustomPropertyDoesNotFailTheShard() {
    final ServerHandle server = OssTestServer.defaultHandle();
    final String index = new IndexAliasInspector(server).indexNameFor(Entity.TABLE);
    final SearchClient search = new SearchClient(server);

    // The #2 repro shape: group-by (terms agg) on a custom-property keyword sub-field.
    final String nestedTerms =
        "{\"size\":0,\"aggs\":{\"cp\":{\"nested\":{\"path\":\"customPropertiesTyped\"},"
            + "\"aggs\":{\"byName\":{\"terms\":{\"field\":\"customPropertiesTyped.name\",\"size\":10}}}}}}";

    assertThatCode(() -> search.search(index, nestedTerms))
        .as("terms agg (Group By) on a custom-property keyword must not fail the shard")
        .doesNotThrowAnyException();
  }
}
