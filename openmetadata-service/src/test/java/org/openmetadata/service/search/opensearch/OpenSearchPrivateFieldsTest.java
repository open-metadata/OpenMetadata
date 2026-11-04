package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
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
import org.openmetadata.search.IndexMapping;
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
 * A search of users by a caller who may not read emails carries no email in what it returns and
 * does not match on one (ADR:2026-11-03-search-applies-the-same-access-rules-as-entity-reads).
 */
class OpenSearchPrivateFieldsTest {
  private static final String USER_INDEX = "user_search_index";
  private static final String EMAIL = "email";
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
    when(repository.getIndexMapping(Entity.USER))
        .thenReturn(
            IndexMapping.builder()
                .indexName(USER_INDEX)
                .alias(Entity.USER)
                .parentAliases(List.of())
                .childAliases(List.of())
                .build());
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
  void aUserSearchLeavesEmailOutAndOffTheQueryFieldsForCallersWhoMayNotReadIt() throws Exception {
    OpenSearchSearchManager manager = new OpenSearchSearchManager(client, null, "", null);

    manager.search(userSearch("jane@acme.com"), caller(false)).close();
    assertFalse(sent.isEmpty());
    for (SearchRequest request : sent) {
      assertEquals(List.of(EMAIL), request.source().filter().excludes());
      assertFalse(queryFields(json(request)).anyMatch(field -> field.startsWith(EMAIL)));
    }

    sent.clear();
    manager.search(userSearch("jane@acme.com"), caller(true)).close();
    assertTrue(sent.getFirst().source().filter().excludes().isEmpty());
    assertTrue(queryFields(json(sent.getFirst())).anyMatch(field -> field.startsWith(EMAIL)));
  }

  @Test
  void aFieldQueryOnUsersLeavesEmailOutForCallersWhoMayNotReadIt() throws Exception {
    OpenSearchSearchManager manager = new OpenSearchSearchManager(client, null, "", null);

    manager.searchByField("name.keyword", "*", USER_INDEX, false, 0, 10, caller(false)).close();
    assertEquals(List.of(EMAIL), sent.getLast().source().filter().excludes());

    manager.searchByField("name.keyword", "*", USER_INDEX, false, 0, 10, caller(true)).close();
    assertNull(sent.getLast().source());
  }

  @Test
  void aUserAggregationKeepsEmailOutOfTopHitsAndItsTextOffEmailFields() throws Exception {
    new OpenSearchAggregationManager(client).aggregate(userAggregation(), caller(false)).close();
    JsonNode json = json(sent.getLast());

    assertFalse(json.findValues("top_hits").isEmpty());
    for (JsonNode topHits : json.findValues("top_hits")) {
      assertEquals(EMAIL, topHits.at("/_source/excludes/0").asText(), topHits.toString());
    }
    for (JsonNode queryString : json.findValues("query_string")) {
      assertFalse(queryString.path("fields").isEmpty(), "searches every field: " + queryString);
    }
    assertFalse(queryFields(json).anyMatch(field -> field.startsWith(EMAIL)));

    new OpenSearchAggregationManager(client).aggregate(userAggregation(), caller(true)).close();
    assertTrue(json(sent.getLast()).at("/aggregations").toString().contains("\"includes\""));
    assertFalse(json(sent.getLast()).at("/aggregations").toString().contains("\"" + EMAIL + "\""));
  }

  @Test
  void anNlqTranslationNamingEmailRunsAsKeywordSearchForCallersWhoMayNotReadIt() throws Exception {
    NLQService nlqService = mock(NLQService.class);
    when(nlqService.transformNaturalLanguageQuery(any(), any()))
        .thenReturn("{\"query\":{\"prefix\":{\"email.keyword\":\"j\"}}}");
    OpenSearchSearchManager manager = new OpenSearchSearchManager(client, null, "", nlqService);

    manager.searchWithNLQ(userSearch("users whose email starts with j"), caller(false)).close();
    assertFalse(sent.isEmpty());
    for (SearchRequest request : sent) {
      assertFalse(withWrappersDecoded(json(request)).contains("email.keyword"));
    }

    sent.clear();
    manager.searchWithNLQ(userSearch("users whose email starts with j"), caller(true)).close();
    assertTrue(withWrappersDecoded(json(sent.getFirst())).contains("email.keyword"));
  }

  private static org.openmetadata.schema.search.SearchRequest userSearch(String query) {
    return new org.openmetadata.schema.search.SearchRequest()
        .withQuery(query)
        .withIndex(USER_INDEX)
        .withFrom(0)
        .withSize(10)
        .withFetchSource(true)
        .withDeleted(false)
        .withSortFieldParam("_score")
        .withSortOrder("desc");
  }

  private static AggregationRequest userAggregation() {
    return new AggregationRequest()
        .withIndex(USER_INDEX)
        .withFieldName("name.keyword")
        .withFieldValue("")
        .withQuery("jane@acme.com")
        .withSourceFields(List.of("*"))
        .withSize(10);
  }

  /** Every field a full-text clause of the request searches, boosts included. */
  private static Stream<String> queryFields(JsonNode json) {
    List<String> fields = new ArrayList<>();
    json.findValues("fields").stream()
        .filter(JsonNode::isArray)
        .forEach(array -> array.forEach(field -> fields.add(field.asText())));
    return fields.stream();
  }

  /** A query OpenSearch runs from JSON is sent base64-encoded in a wrapper query. */
  private static String withWrappersDecoded(JsonNode json) {
    StringBuilder text = new StringBuilder(json.toString());
    for (JsonNode wrapper : json.findValues("wrapper")) {
      text.append(
          new String(
              Base64.getDecoder().decode(wrapper.path("query").asText()), StandardCharsets.UTF_8));
    }
    return text.toString();
  }

  private static JsonNode json(SearchRequest request) {
    return JsonUtils.readTree(request.toJsonString());
  }

  private static SubjectContext caller(boolean admin) {
    User user = new User().withId(UUID.randomUUID()).withName("analyst").withRoles(List.of());
    SubjectContext subjectContext = mock(SubjectContext.class);
    when(subjectContext.isAdmin()).thenReturn(admin);
    when(subjectContext.isBot()).thenReturn(false);
    when(subjectContext.user()).thenReturn(user);
    return subjectContext;
  }
}
