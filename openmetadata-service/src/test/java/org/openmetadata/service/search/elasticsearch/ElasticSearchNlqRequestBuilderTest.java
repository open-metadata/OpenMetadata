package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import es.co.elastic.clients.elasticsearch._types.FieldValue;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * The NLQ happy path used to run the LLM-transformed query with only context-memory visibility
 * applied — no RBAC clause, no queryFilter, no deleted filter — while the fallback path applied all
 * three. Results therefore differed depending on whether the NLQ provider happened to answer.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ElasticSearchNlqRequestBuilderTest {

  private static final String TRANSFORMED_QUERY = "{\"match_all\":{}}";
  private static final String RBAC_MARKER = "rbac_marker";

  private SearchRepository searchRepository;
  private SearchRepository previousSearchRepository;

  @BeforeEach
  void setUp() {
    // Entity.searchRepository is process-global and the JVM is reused across test classes, so the
    // previous value is restored in tearDown to keep other tests order-independent.
    previousSearchRepository = Entity.getSearchRepository();
    searchRepository = mock(SearchRepository.class);
    when(searchRepository.getIndexNameWithoutAlias(anyString()))
        .thenAnswer(invocation -> invocation.getArgument(0));
    Entity.setSearchRepository(searchRepository);
  }

  @AfterEach
  void tearDown() {
    Entity.setSearchRepository(previousSearchRepository);
  }

  @Test
  void nlqRequestCarriesTheRbacClause() throws Exception {
    Query rbacQuery = termQuery(RBAC_MARKER);
    ElasticQueryBuilder rbacBuilder = mock(ElasticQueryBuilder.class);
    when(rbacBuilder.buildV2()).thenReturn(rbacQuery);
    RBACConditionEvaluator evaluator = mock(RBACConditionEvaluator.class);
    when(evaluator.evaluateConditions(any())).thenReturn(rbacBuilder);

    try (MockedStatic<SettingsCache> settings = accessControl(true)) {
      ElasticSearchRequestBuilder builder =
          manager(evaluator)
              .buildNlqRequestBuilder(request(null, null), subject(), TRANSFORMED_QUERY);

      assertTrue(containsFilter(builder.query(), rbacQuery), "RBAC clause missing from NLQ query");
    }
  }

  @Test
  void nlqRequestMergesTheCallerQueryFilter() throws Exception {
    try (MockedStatic<SettingsCache> settings = accessControl(false)) {
      ElasticSearchRequestBuilder builder =
          manager(null)
              .buildNlqRequestBuilder(
                  request("{\"term\":{\"service.name.keyword\":\"snowflake\"}}", null),
                  subject(),
                  TRANSFORMED_QUERY);

      assertNotNull(builder.query());
      assertTrue(
          containsTermOnField(builder.query(), "service.name.keyword"),
          "queryFilter was dropped from the NLQ query");
    }
  }

  @Test
  void nlqRequestHonoursTheDeletedFlag() throws Exception {
    try (MockedStatic<SettingsCache> settings = accessControl(false)) {
      ElasticSearchRequestBuilder builder =
          manager(null).buildNlqRequestBuilder(request(null, true), subject(), TRANSFORMED_QUERY);

      assertTrue(
          containsTermOnField(builder.query(), "deleted"), "deleted filter missing from NLQ query");
    }
  }

  @Test
  void deletedFilterTreatsAClusterAliasPrefixedIndexAsTheDataAssetAlias() throws Exception {
    // doSearch strips the clusterAlias prefix before comparing against the dataAsset/all aliases,
    // which selects the lenient branch that also keeps documents carrying no "deleted" field. The
    // NLQ path has to strip it the same way, or a cluster-alias deployment silently drops those
    // documents.
    when(searchRepository.getIndexNameWithoutAlias("collate_prod_dataAsset"))
        .thenReturn("dataAsset");

    try (MockedStatic<SettingsCache> settings = accessControl(false)) {
      org.openmetadata.schema.search.SearchRequest request =
          request(null, true).withIndex("collate_prod_dataAsset");

      ElasticSearchRequestBuilder builder =
          manager(null).buildNlqRequestBuilder(request, subject(), TRANSFORMED_QUERY);

      assertEquals(
          2,
          builder.query().bool().should().size(),
          "prefixed dataAsset alias took the strict deleted branch");
    }
  }

  /** Walks the bool tree looking for a term clause on {@code field}. */
  private static boolean containsTermOnField(Query query, String field) {
    boolean found = false;
    if (query != null) {
      if (query.isTerm()) {
        found = field.equals(query.term().field());
      } else if (query.isBool()) {
        found =
            java.util.stream.Stream.of(
                    query.bool().must(),
                    query.bool().should(),
                    query.bool().filter(),
                    query.bool().mustNot())
                .flatMap(List::stream)
                .anyMatch(child -> containsTermOnField(child, field));
      }
    }
    return found;
  }

  private static boolean containsFilter(Query query, Query expected) {
    return query != null
        && query.isBool()
        && (query.bool().filter().contains(expected)
            || query.bool().must().stream().anyMatch(m -> containsFilter(m, expected)));
  }

  private static Query termQuery(String field) {
    return Query.of(q -> q.term(t -> t.field(field).value(FieldValue.of(true))));
  }

  private ElasticSearchSearchManager manager(RBACConditionEvaluator evaluator) {
    return new ElasticSearchSearchManager(null, evaluator, "", null);
  }

  private static org.openmetadata.schema.search.SearchRequest request(
      String queryFilter, Boolean deleted) {
    return new org.openmetadata.schema.search.SearchRequest()
        .withQuery("which tables hold customer data")
        .withIndex("dataAsset")
        .withFrom(0)
        .withSize(10)
        .withQueryFilter(queryFilter)
        .withDeleted(deleted);
  }

  private static SubjectContext subject() {
    User user = new User().withId(UUID.randomUUID()).withName("analyst").withRoles(List.of());
    SubjectContext subjectContext = mock(SubjectContext.class);
    when(subjectContext.isAdmin()).thenReturn(false);
    when(subjectContext.isBot()).thenReturn(false);
    when(subjectContext.user()).thenReturn(user);
    return subjectContext;
  }

  private static MockedStatic<SettingsCache> accessControl(boolean enabled) {
    MockedStatic<SettingsCache> settings = mockStatic(SettingsCache.class);
    SearchSettings searchSettings =
        new SearchSettings()
            .withGlobalSettings(new GlobalSettings().withEnableAccessControl(enabled));
    settings
        .when(() -> SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class))
        .thenReturn(searchSettings);
    return settings;
  }
}
