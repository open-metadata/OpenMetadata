package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.nlq.NLQService;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.search.TotalHitsRelation;

/**
 * User text must reach OpenSearch with an explicit field list. A query_string without fields
 * searches every field in the mapping and can exceed the cluster's max_clause_count.
 */
class OpenSearchFieldlessQueryTest {
  private static final String TABLE_INDEX = "table_search_index";
  private static final String LONG_TOKEN = "exactec2274b037459fc6";
  private static SearchSettings searchSettings;

  private final List<SearchRequest> sent = new ArrayList<>();
  private MockedStatic<Entity> entity;
  private MockedStatic<SettingsCache> settings;
  private OpenSearchClient client;

  @BeforeAll
  static void loadShippedSearchSettings() throws Exception {
    List<String> files =
        EntityUtil.getJsonDataResources(".*json/data/settings/searchSettings.json$");
    String json =
        CommonUtil.getResourceAsStream(EntityRepository.class.getClassLoader(), files.getFirst());
    searchSettings = JsonUtils.readValue(json, SearchSettings.class);
  }

  @BeforeEach
  void setUp() throws Exception {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexOrAliasName(anyString())).thenAnswer(i -> i.getArgument(0));
    when(repository.getIndexNameWithoutAlias(anyString())).thenAnswer(i -> i.getArgument(0));
    entity = mockStatic(Entity.class);
    entity.when(Entity::getSearchRepository).thenReturn(repository);
    settings = mockStatic(SettingsCache.class);
    settings
        .when(() -> SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class))
        .thenReturn(searchSettings);
    client = mock(OpenSearchClient.class);
    when(client.search(any(SearchRequest.class), eq(JsonData.class)))
        .thenAnswer(
            invocation -> {
              sent.add(invocation.getArgument(0));
              return new SearchResponse.Builder<JsonData>()
                  .took(1)
                  .timedOut(false)
                  .shards(shards -> shards.total(1).successful(1).failed(0))
                  .hits(
                      hits ->
                          hits.total(t -> t.value(0).relation(TotalHitsRelation.Eq))
                              .hits(List.of()))
                  .build();
            });
  }

  @AfterEach
  void tearDown() {
    settings.close();
    entity.close();
  }

  @Test
  void nlqFallbackSearchesConfiguredFieldsAndKeepsTheRequestFilters() throws Exception {
    NLQService nlqService = mock(NLQService.class);
    when(nlqService.transformNaturalLanguageQuery(any(), any())).thenReturn(null);
    OpenSearchSearchManager manager = new OpenSearchSearchManager(client, null, "", nlqService);
    org.openmetadata.schema.search.SearchRequest request =
        new org.openmetadata.schema.search.SearchRequest()
            .withQuery(LONG_TOKEN + " customer orders")
            .withIndex(TABLE_INDEX)
            .withFrom(0)
            .withSize(10)
            .withDeleted(false)
            .withQueryFilter("{\"query\":{\"term\":{\"owners.name\":\"finance\"}}}")
            .withSortFieldParam("_score")
            .withSortOrder("desc");

    try (Response response = manager.searchWithNLQ(request, subject())) {
      assertEquals(200, response.getStatus());
    }

    assertFalse(sent.isEmpty());
    for (SearchRequest searchRequest : sent) {
      JsonNode json = json(searchRequest);
      assertEveryQueryStringHasFields(json);
      assertTrue(json.toString().contains("\"deleted\""), "deleted filter missing: " + json);
      assertTrue(
          withWrappersDecoded(json).contains("owners.name"), "query_filter missing: " + json);
    }
  }

  @Test
  void aggregateTextOnDataAssetIndexesSearchesConfiguredFields() throws Exception {
    for (String index : List.of(TABLE_INDEX, "dataAsset")) {
      for (String text : List.of(LONG_TOKEN, "customer orders")) {
        sent.clear();
        aggregate(index, text);
        JsonNode json = json(sent.getFirst());
        assertEveryQueryStringHasFields(json);
        assertTrue(json.toString().contains(text), "text missing for " + index + ": " + json);
      }
    }
  }

  @Test
  void aggregateKeepsJsonMatchAllAndBlankQueriesAsTheyWere() throws Exception {
    aggregate(TABLE_INDEX, "{\"query\":{\"term\":{\"entityType\":\"table\"}}}");
    assertTrue(json(sent.getLast()).toString().contains("\"wrapper\""));
    assertTrue(json(sent.getLast()).findValues("query_string").isEmpty());

    aggregate(TABLE_INDEX, "*");
    JsonNode matchAll = json(sent.getLast()).findValue("query_string");
    assertEquals("*", matchAll.path("query").asText());
    assertFalse(matchAll.has("fields"));

    aggregate(TABLE_INDEX, "");
    assertTrue(json(sent.getLast()).findValues("query_string").isEmpty());
  }

  @Test
  void aggregateKeepsFieldQualifiedFiltersOnDataAssets() throws Exception {
    String fqnFilter = "fullyQualifiedName:\"svc.db.\\\"Sales Schema\\\".orders\"";
    aggregate("dataAsset", fqnFilter);
    JsonNode json = json(sent.getLast());
    assertEveryQueryStringHasFields(json);
    assertTrue(
        json.findValues("query_string").stream()
            .anyMatch(node -> fqnFilter.equals(node.path("query").asText())),
        "field-qualified filter lost: " + json);
  }

  @Test
  void aggregateTextOnOtherIndexesIsUnchanged() throws Exception {
    aggregate("test_case_result_search_index", "testCaseStatus:Failed");
    JsonNode queryString = json(sent.getLast()).findValue("query_string");
    assertEquals("testCaseStatus:Failed", queryString.path("query").asText());
    assertFalse(queryString.has("fields"));
  }

  private void aggregate(String index, String query) throws Exception {
    new OpenSearchAggregationManager(client)
        .aggregate(
            new AggregationRequest()
                .withIndex(index)
                .withQuery(query)
                .withFieldName("entityType")
                .withFieldValue("")
                .withSize(10),
            null)
        .close();
  }

  private static void assertEveryQueryStringHasFields(JsonNode json) {
    for (JsonNode queryString : json.findValues("query_string")) {
      assertTrue(
          queryString.path("fields").isArray() && !queryString.path("fields").isEmpty(),
          "query_string without fields: " + queryString);
    }
  }

  /** query_filter is sent as a base64 wrapper query; decode it so the filter can be asserted on. */
  private static String withWrappersDecoded(JsonNode json) {
    StringBuilder text = new StringBuilder(json.toString());
    for (JsonNode wrapper : json.findValues("wrapper")) {
      text.append(new String(Base64.getDecoder().decode(wrapper.path("query").asText())));
    }
    return text.toString();
  }

  private static JsonNode json(SearchRequest request) throws Exception {
    return JsonUtils.readTree(request.toJsonString());
  }

  private static SubjectContext subject() {
    User user = new User().withId(UUID.randomUUID()).withName("analyst").withRoles(List.of());
    SubjectContext subjectContext = mock(SubjectContext.class);
    when(subjectContext.isAdmin()).thenReturn(false);
    when(subjectContext.isBot()).thenReturn(false);
    when(subjectContext.user()).thenReturn(user);
    return subjectContext;
  }
}
