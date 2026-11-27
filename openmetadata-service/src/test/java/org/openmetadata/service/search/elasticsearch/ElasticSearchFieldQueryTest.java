package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.json.JsonData;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.ElasticsearchTransport;
import java.io.StringWriter;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class ElasticSearchFieldQueryTest {
  private final AtomicReference<SearchRequest> request = new AtomicReference<>();
  private final JacksonJsonpMapper mapper = new JacksonJsonpMapper();
  private MockedStatic<Entity> entity;
  private ElasticSearchSearchManager manager;
  private ElasticsearchClient client;

  @BeforeEach
  void setUp() throws Exception {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexOrAliasName(Entity.TABLE)).thenReturn("table_search_index");
    entity = mockStatic(Entity.class);
    entity.when(Entity::getSearchRepository).thenReturn(repository);
    ElasticsearchTransport transport = mock(ElasticsearchTransport.class);
    when(transport.jsonpMapper()).thenReturn(mapper);
    client = mock(ElasticsearchClient.class);
    when(client._transport()).thenReturn(transport);
    when(client.search(any(SearchRequest.class), eq(JsonData.class)))
        .thenAnswer(
            invocation -> {
              request.set(invocation.getArgument(0));
              return SearchResponse.of(
                  response ->
                      response
                          .took(1)
                          .timedOut(false)
                          .shards(shards -> shards.total(1).successful(1).failed(0))
                          .hits(hits -> hits.hits(List.of())));
            });
    manager = new ElasticSearchSearchManager(client, null, "", null);
  }

  @AfterEach
  void tearDown() {
    entity.close();
  }

  @Test
  void legacyFieldQueriesKeepEngineDefaultsAndCaseSensitiveMatching() throws Exception {
    manager.searchByField("name", "Orders*", Entity.TABLE, false, 10, 5, null).close();

    assertEquals(List.of("table_search_index"), request.get().index());
    assertEquals(10, request.get().from());
    assertEquals(5, request.get().size());
    assertNull(request.get().trackTotalHits());
    assertTrue(request.get().sort().isEmpty());
    assertNull(requestJson().findValue("case_insensitive"));
    assertTrue(requestJson().toString().contains(Entity.CONTEXT_MEMORY));
  }

  @Test
  void sceneFieldQueriesApplyProjectionExistsAndDisabledHitCounting() throws Exception {
    manager
        .searchByFieldWithOptions(
            "name", "Orders*", Entity.TABLE, false, 0, 5, List.of("id"), "lineage", false)
        .close();

    assertFalse(request.get().trackTotalHits().enabled());
    assertEquals(List.of("id"), request.get().source().filter().includes());
    // The visibility filter carries an exists clause of its own, so the projection's is found
    // by its field rather than by position.
    assertTrue(
        requestJson().findValues("exists").stream()
            .anyMatch(node -> "lineage".equals(node.path("field").asText())));
    assertTrue(requestJson().findValue("case_insensitive").asBoolean());
    assertEquals(1, request.get().sort().size());
    assertTrue(requestJson().toString().contains(Entity.CONTEXT_MEMORY));
    assertTrue(requestJson().toString().contains("\"Entity\""));
  }

  @Test
  void sceneTermQueriesPreserveLiteralValuesAndCanCountHits() throws Exception {
    manager
        .searchByTerms(
            "id", List.of("literal*", "literal?"), Entity.TABLE, true, 0, 5, List.of(), true)
        .close();

    assertTrue(request.get().trackTotalHits().enabled());
    assertNull(request.get().source());
    assertTrue(requestJson().toString().contains(Entity.CONTEXT_MEMORY));
    assertTrue(requestJson().toString().contains("\"Entity\""));
    // The visibility filter also uses a terms clause, so the caller's is found by its field.
    JsonNode idTerms =
        requestJson().findValues("terms").stream()
            .filter(node -> node.has("id"))
            .findFirst()
            .orElseThrow();
    assertEquals(
        List.of("literal*", "literal?"), JsonUtils.convertValue(idTerms.path("id"), List.class));
  }

  /**
   * The field query is built outside the request builder, so it has to add the caller's search
   * access policies itself; without them a denied caller reads documents the listing hides.
   */
  @Test
  void fieldQueriesCarryTheCallersAccessPolicies() throws Exception {
    SubjectContext caller = mock(SubjectContext.class);
    ElasticQueryBuilder policies = mock(ElasticQueryBuilder.class);
    when(policies.buildV2())
        .thenReturn(Query.of(q -> q.term(t -> t.field("owners.id").value("caller-policy"))));
    RBACConditionEvaluator evaluator = mock(RBACConditionEvaluator.class);
    when(evaluator.evaluateConditions(caller)).thenReturn(policies);
    ElasticSearchSearchManager policyAware =
        new ElasticSearchSearchManager(client, evaluator, "", null);

    try (MockedStatic<SettingsCache> settings = mockStatic(SettingsCache.class)) {
      settings
          .when(() -> SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class))
          .thenReturn(
              new SearchSettings()
                  .withGlobalSettings(new GlobalSettings().withEnableAccessControl(true)));
      policyAware.searchByField("name", "Orders*", Entity.TABLE, false, 0, 5, caller).close();
    }

    assertTrue(requestJson().toString().contains("caller-policy"));
  }

  private JsonNode requestJson() throws Exception {
    StringWriter writer = new StringWriter();
    try (var generator = mapper.jsonProvider().createGenerator(writer)) {
      request.get().serialize(generator, mapper);
    }
    return JsonUtils.readTree(writer.toString());
  }
}
