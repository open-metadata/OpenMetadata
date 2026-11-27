package org.openmetadata.service.search.queries;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.FloatNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryDsl;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryDsl;
import org.openmetadata.service.search.security.ContextMemorySearchVisibility;
import org.openmetadata.service.util.EntityUtil;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;

/** Both engines render the same ranking shell and the same memory visibility rule. */
public class SearchQueryDslParityTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final List<String> SHELL_KEYS = List.of("functions", "score_mode", "boost_mode");

  private final SearchQueryDsl openSearch = new OpenSearchQueryDsl(new JacksonJsonpMapper());
  private final SearchQueryDsl elastic =
      new ElasticQueryDsl(new es.co.elastic.clients.json.jackson.JacksonJsonpMapper());

  /** The search settings OpenMetadata ships. */
  public static SearchSettings shippedSearchSettings() throws IOException {
    List<String> files =
        EntityUtil.getJsonDataResources(".*json/data/settings/searchSettings.json$");
    String json =
        CommonUtil.getResourceAsStream(EntityRepository.class.getClassLoader(), files.getFirst());
    return JsonUtils.readValue(json, SearchSettings.class);
  }

  /**
   * The data asset query for {@code orders} over {@code dataAsset} with the shipped settings. The
   * source builder factories resolve index names through the search repository, so one that maps
   * each name to itself is stubbed for the call.
   */
  public static String shippedDataAssetQuery(SearchQueryDsl dsl) throws IOException {
    SearchSettings settings = shippedSearchSettings();
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexNameWithoutAlias(anyString()))
        .thenAnswer(invocation -> invocation.getArgument(0));
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(repository);
      return dsl.dataAssetQueryJson(settings, "dataAsset", "orders");
    }
  }

  @Test
  void dataAssetQuery_hasTheSameRankingShellOnBothEngines() throws Exception {
    JsonNode openSearchShell = functionScore(shippedDataAssetQuery(openSearch));
    JsonNode elasticShell = functionScore(shippedDataAssetQuery(elastic));

    assertFalse(openSearchShell.isMissingNode());
    for (String key : SHELL_KEYS) {
      assertEquals(
          atFloatPrecision(openSearchShell.get(key)), atFloatPrecision(elasticShell.get(key)), key);
    }
  }

  @Test
  void memoryVisibility_rendersTheSameRuleOnBothEngines() throws Exception {
    String openSearchRule =
        openSearch.toJson(
            new ContextMemorySearchVisibility(openSearch.queryBuilderFactory())
                .buildOrgWideOnlyFilter());
    String elasticRule =
        elastic.toJson(
            new ContextMemorySearchVisibility(elastic.queryBuilderFactory())
                .buildOrgWideOnlyFilter());

    assertEquals(MAPPER.readTree(openSearchRule), MAPPER.readTree(elasticRule));
  }

  /**
   * The OpenSearch client writes boost weights as 32-bit floats (0.30000001192092896) where the
   * Elasticsearch client writes 0.3. Both engines read them as floats, so they are compared at that
   * precision.
   */
  private static JsonNode atFloatPrecision(JsonNode node) {
    JsonNode result = node;
    if (node.isFloatingPointNumber()) {
      result = FloatNode.valueOf(node.floatValue());
    } else if (node.isContainerNode()) {
      result = node.deepCopy();
      roundChildren(result);
    }
    return result;
  }

  private static void roundChildren(JsonNode container) {
    if (container instanceof ObjectNode object) {
      object.properties().forEach(entry -> entry.setValue(atFloatPrecision(entry.getValue())));
    }
    if (container instanceof ArrayNode array) {
      for (int i = 0; i < array.size(); i++) {
        array.set(i, atFloatPrecision(array.get(i)));
      }
    }
  }

  private static JsonNode functionScore(String queryJson) throws Exception {
    return MAPPER.readTree(queryJson).findPath("function_score");
  }
}
