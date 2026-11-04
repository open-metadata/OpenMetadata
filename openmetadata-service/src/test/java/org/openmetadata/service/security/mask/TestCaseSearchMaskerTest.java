package org.openmetadata.service.security.mask;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.vector.TestCaseBodyTextContributor;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.security.Authorizer;

class TestCaseSearchMaskerTest {
  private static final String TEST_INDEX = "cluster_test_case_search_index";
  private static final String RESULT_INDEX = "cluster_test_case_result_search_index";
  private static final String TABLE_FQN = "service.db.schema.customers";
  private static final String TEST_FQN = TABLE_FQN + ".SSN.ssn_format";
  private static final UUID TEST_ID = UUID.randomUUID();

  @Test
  void bypassesResponseParsingForUnrestrictedCallers() {
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext context = mock(SecurityContext.class);
    when(authorizer.authorizePII(context, null)).thenReturn(true);
    Response original = Response.ok("not parsed").build();
    assertSame(
        original,
        TestCaseSearchMasker.mask(original, authorizer, context, TEST_INDEX, RESULT_INDEX));
  }

  @Test
  void bypassesResponseParsingForUnrelatedIndexes() {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getEntityTypesForIndex("table")).thenReturn(List.of(Entity.TABLE));
    Response original = Response.ok("not parsed").build();
    assertSame(
        original,
        TestCaseSearchMasker.maskSearch(
            original,
            mock(Authorizer.class),
            mock(SecurityContext.class),
            repository,
            new SearchRequest().withIndex("table")));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "table,test_case_search_index*",
        "table,test_case_search_index_rebuild_123",
        "test_case_search_index?"
      })
  void projectsMixedAndPatternIndexSelections(String index) {
    SearchRepository repository = aggregationRepository(false);
    when(repository.getEntityTypesForIndex(anyString())).thenReturn(List.of(Entity.TABLE));
    try (MockedStatic<Entity> entity = mockTable()) {
      Response visible =
          TestCaseSearchMasker.maskSearch(
              response(hit(TEST_INDEX, testCaseSource())),
              mock(Authorizer.class),
              mock(SecurityContext.class),
              repository,
              new SearchRequest().withIndex(index));
      assertFalse(((String) visible.getEntity()).contains("Sensitive description"));
    }
  }

  @Test
  void mixedIndexAggregationUsesTheConservativeFieldProjection() throws Exception {
    SearchRepository repository = aggregationRepository(true);
    when(repository.getEntityTypesForIndex(anyString())).thenReturn(List.of(Entity.TABLE));
    when(repository.aggregate(any(AggregationRequest.class), isNull()))
        .thenReturn(aggregationScope(hit(RESULT_INDEX, Map.of("testCaseFQN", TEST_FQN))));
    try (MockedStatic<Entity> entity = mockTable()) {
      entity
          .when(() -> Entity.getEntityByName(Entity.TEST_CASE, TEST_FQN, "", Include.ALL))
          .thenReturn(linkedTestCase());
      assertThrows(
          BadRequestException.class,
          () ->
              TestCaseSearchMasker.maskAggregation(
                  new AggregationRequest()
                      .withIndex("table,test_case_result_search_index*")
                      .withFieldName("testResultValue.value.keyword"),
                  mock(Authorizer.class),
                  mock(SecurityContext.class),
                  new TestCaseSearchMasker.AggregationContext(repository, null)));
    }
  }

  @Test
  void filtersConfiguredAggregationAliasesAndScripts() {
    SearchSettings settings =
        new SearchSettings()
            .withGlobalSettings(
                new GlobalSettings()
                    .withAggregations(
                        List.of(
                            new Aggregation()
                                .withName("thresholds")
                                .withField("parameterValues.value.keyword"),
                            new Aggregation()
                                .withName("computed")
                                .withScript("doc['description'].value"))))
            .withAssetTypeConfigurations(
                List.of(
                    new AssetTypeConfiguration()
                        .withAggregations(
                            List.of(
                                new Aggregation()
                                    .withName("measure")
                                    .withField("testResultValue.value.keyword")))));
    ObjectNode aggregations =
        (ObjectNode)
            JsonUtils.valueToTree(
                Map.of(
                    "sterms#thresholds",
                        Map.of("buckets", List.of(Map.of("key", "private_parameter"))),
                    "computed", Map.of("buckets", List.of(Map.of("key", "private_description"))),
                    "measure", Map.of("buckets", List.of(Map.of("key", "private_result"))),
                    "tags.tagFQN", Map.of("buckets", List.of(Map.of("key", "Public")))));
    assertTrue(TestCaseAggregationMasker.filterAutomatic(aggregations, settings));
    assertEquals(1, aggregations.size());
    assertTrue(aggregations.has("tags.tagFQN"));
  }

  @Test
  void keepsTestCaseMetadataFacetsAndUsesTheResultFieldAllowlist() {
    ObjectNode cases =
        JsonUtils.readTree(
                "{\"testDefinition.name.keyword\":{},\"timestamp\":{},\"customResultField\":{}}")
            .deepCopy();
    ObjectNode results = cases.deepCopy();
    assertFalse(
        TestCaseAggregationMasker.filterAutomatic(
            cases, new SearchSettings(), TestCaseSearchMasker.Projection.TEST_CASES));
    assertTrue(
        TestCaseAggregationMasker.filterAutomatic(
            results, new SearchSettings(), TestCaseSearchMasker.Projection.RESULTS));
    assertEquals(3, cases.size());
    assertEquals(1, results.size());
    assertTrue(results.has("timestamp"));
  }

  @ParameterizedTest
  @CsvSource({
    "false,false,false",
    "false,true,false",
    "true,false,false",
    "true,true,false",
    "false,false,true",
    "false,true,true",
    "true,false,true",
    "true,true,true"
  })
  void checksTheFullAggregationScopeForColumnAccess(
      boolean authorized, boolean result, boolean typed) throws Exception {
    SearchRepository repository = aggregationRepository(result);
    ObjectNode scopedHit =
        hit(
            result ? RESULT_INDEX : TEST_INDEX,
            result ? Map.of("testCaseFQN", TEST_FQN) : testCaseSource());
    Response scoped = aggregationScope(scopedHit);
    if (typed) {
      ObjectNode scope = JsonUtils.readTree((String) scoped.getEntity()).deepCopy();
      ObjectNode bucket =
          (ObjectNode) scope.path("aggregations").path("id.keyword").path("buckets").get(0);
      bucket.set("top_hits#top", bucket.remove("top"));
      ((ObjectNode) scope.path("_shards"))
          .put("total", 1.0)
          .put("successful", 1.0)
          .put("failed", 0.0);
      scoped = Response.ok(scope.toString()).build();
    }
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext context = mock(SecurityContext.class);
    when(authorizer.authorizePII(context, List.of())).thenReturn(authorized);
    AggregationRequest request =
        new AggregationRequest()
            .withIndex(result ? RESULT_INDEX : TEST_INDEX)
            .withFieldName(
                result ? "testResultValue.value.keyword" : "parameterValues.value.keyword");
    Response original =
        Response.ok(
                "{\"aggregations\":{\"values\":{\"buckets\":[{\"key\":\"private_parameter\"}]}}}")
            .build();
    when(repository.aggregate(any(AggregationRequest.class), isNull()))
        .thenReturn(scoped, original);
    try (MockedStatic<Entity> entity = mockTable()) {
      entity
          .when(() -> Entity.getEntityByName(Entity.TEST_CASE, TEST_FQN, "", Include.ALL))
          .thenReturn(linkedTestCase());
      if (authorized) {
        assertSame(
            original,
            TestCaseSearchMasker.maskAggregation(
                request,
                authorizer,
                context,
                new TestCaseSearchMasker.AggregationContext(repository, null)));
      } else {
        assertThrows(
            BadRequestException.class,
            () ->
                TestCaseSearchMasker.maskAggregation(
                    request,
                    authorizer,
                    context,
                    new TestCaseSearchMasker.AggregationContext(repository, null)));
      }
    }
  }

  @ParameterizedTest
  @EnumSource(ScopeState.class)
  void rejectsIncompleteAggregationScopes(ScopeState condition) throws Exception {
    SearchRepository repository = aggregationRepository(false);
    ObjectNode root =
        JsonUtils.readTree((String) aggregationScope(hit(TEST_INDEX, testCaseSource())).getEntity())
            .deepCopy();
    ObjectNode scope = (ObjectNode) root.path("aggregations").path("id.keyword");
    switch (condition) {
      case MISSING -> root.remove("aggregations");
      case TRUNCATED -> scope.put("sum_other_doc_count", 1);
      case LIMIT -> {
        JsonNode bucket = scope.path("buckets").get(0).deepCopy();
        for (int i = 0; i < 1000; i++) {
          ((ArrayNode) scope.path("buckets")).add(bucket);
        }
      }
      case EMPTY_TOP -> ((ObjectNode) scope.path("buckets").get(0)).remove("top");
      case MISSING_ID -> ((ObjectNode) root.path("hits").path("total")).put("value", 2);
      case DUPLICATE_ID -> ((ObjectNode) scope.path("buckets").get(0)).put("doc_count", 2);
      case TIMED_OUT -> root.put("timed_out", true);
      case TERMINATED_EARLY -> root.put("terminated_early", true);
      case FAILED_SHARD -> ((ObjectNode) root.path("_shards")).put("failed", 1);
      case INCOMPLETE_SHARDS -> ((ObjectNode) root.path("_shards")).put("total", 2);
      case FRACTIONAL_SHARDS -> ((ObjectNode) root.path("_shards"))
          .put("total", 1.5)
          .put("successful", 1.5);
      case NEGATIVE_SHARDS -> ((ObjectNode) root.path("_shards"))
          .put("total", -1)
          .put("successful", -1);
      case UNAVAILABLE -> {}
    }
    Response probe =
        condition == ScopeState.UNAVAILABLE
            ? Response.status(503).build()
            : Response.ok(root).build();
    when(repository.aggregate(any(AggregationRequest.class), isNull())).thenReturn(probe);
    assertThrows(
        BadRequestException.class,
        () ->
            new TestCaseAggregationMasker(
                    new TestCaseSearchMasker.AggregationContext(repository, null), ignored -> false)
                .prepare(
                    new AggregationRequest()
                        .withIndex(TEST_INDEX)
                        .withFieldName("parameterValues.value.keyword")));
  }

  private enum ScopeState {
    MISSING,
    TRUNCATED,
    LIMIT,
    UNAVAILABLE,
    EMPTY_TOP,
    MISSING_ID,
    DUPLICATE_ID,
    TIMED_OUT,
    TERMINATED_EARLY,
    FAILED_SHARD,
    INCOMPLETE_SHARDS,
    FRACTIONAL_SHARDS,
    NEGATIVE_SHARDS
  }

  private static SearchRepository aggregationRepository(boolean result) {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexOrAliasName(Entity.TEST_CASE)).thenReturn(TEST_INDEX);
    when(repository.getIndexOrAliasName(Entity.TEST_CASE_RESULT)).thenReturn(RESULT_INDEX);
    when(repository.getEntityTypesForIndex(anyString()))
        .thenReturn(List.of(result ? Entity.TEST_CASE_RESULT : Entity.TEST_CASE));
    return repository;
  }

  @Test
  void freezesTheAuthorizedScopeBeforeCalculatingAggregationBuckets() throws Exception {
    SearchRepository repository = aggregationRepository(false);
    ObjectNode emptyScope =
        JsonUtils.readTree((String) aggregationScope(hit(TEST_INDEX, testCaseSource())).getEntity())
            .deepCopy();
    ((ObjectNode) emptyScope.path("hits").path("total")).put("value", 0);
    ((ObjectNode) emptyScope.path("aggregations").path("id.keyword")).putArray("buckets");
    when(repository.aggregate(any(AggregationRequest.class), isNull()))
        .thenAnswer(
            call -> {
              AggregationRequest request = call.getArgument(0);
              if (request.getFieldName().equals("id.keyword")) {
                return Response.ok(emptyScope.toString()).build();
              }
              boolean frozenEmptyScope =
                  JsonUtils.readTree(request.getQuery()).path("query").has("match_none");
              return Response.ok(
                      JsonUtils.pojoToJson(
                          Map.of(
                              "aggregations",
                              Map.of(
                                  "values",
                                  Map.of(
                                      "buckets",
                                      frozenEmptyScope
                                          ? List.of()
                                          : List.of(Map.of("key", "private_parameter")))))))
                  .build();
            });
    Response visible =
        TestCaseSearchMasker.maskAggregation(
            new AggregationRequest()
                .withIndex(TEST_INDEX)
                .withFieldName("parameterValues.value.keyword")
                .withQuery("{\"function_score\":{\"random_score\":{},\"min_score\":0.5}}"),
            mock(Authorizer.class),
            mock(SecurityContext.class),
            new TestCaseSearchMasker.AggregationContext(repository, null));
    assertFalse(((String) visible.getEntity()).contains("private_parameter"));
  }

  private static Response aggregationScope(ObjectNode hit) {
    return Response.ok(
            JsonUtils.pojoToJson(
                Map.of(
                    "_shards",
                    Map.of("total", 1, "successful", 1, "failed", 0),
                    "hits",
                    Map.of("total", Map.of("value", 1, "relation", "eq")),
                    "aggregations",
                    Map.of(
                        "id.keyword",
                        Map.of(
                            "sum_other_doc_count",
                            0,
                            "buckets",
                            List.of(
                                Map.of(
                                    "doc_count",
                                    1,
                                    "key",
                                    TEST_ID.toString(),
                                    "top",
                                    JsonUtils.readTree((String) response(hit).getEntity()))))))))
        .build();
  }

  @Test
  void filtersAutomaticAggregationsAndTheirTopHits() {
    ObjectNode body = JsonUtils.readTree((String) response().getEntity()).deepCopy();
    ObjectNode aggregations = body.putObject("aggregations");
    aggregations
        .putObject("parameterValues.value.keyword")
        .putArray("buckets")
        .addObject()
        .put("key", "private_parameter");
    ObjectNode bucket =
        aggregations
            .putObject("tags.tagFQN")
            .putArray("buckets")
            .addObject()
            .put("key", "PII.Sensitive");
    bucket.set(
        "top",
        JsonUtils.readTree((String) response(hit(TEST_INDEX, testCaseSource())).getEntity()));
    try (MockedStatic<Entity> entity = mockTable();
        MockedStatic<SettingsCache> settings = mockStatic(SettingsCache.class)) {
      settings
          .when(() -> SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class))
          .thenReturn(new SearchSettings());
      JsonNode visible =
          JsonUtils.readTree(
              (String)
                  mask(Response.ok(body.toString()).build(), mock(Authorizer.class)).getEntity());
      assertFalse(visible.path("aggregations").has("parameterValues.value.keyword"));
      assertEquals(
          "PII.Sensitive",
          visible
              .path("aggregations")
              .path("tags.tagFQN")
              .path("buckets")
              .get(0)
              .path("key")
              .asText());
      assertFalse(visible.toString().contains("Sensitive description"));
      assertFalse(visible.toString().contains("private_parameter"));
    }
  }

  @Test
  void masksSearchSourcesHighlightsAndStoredFieldsWithoutChangingTheCachedBody() {
    ObjectNode sensitive = hit(TEST_INDEX, testCaseSource());
    sensitive.putObject("highlight").put("description", "Sensitive description");
    sensitive.putObject("fields").put("parameterValues.value", "^078-");
    ObjectNode plain = hit("cluster_table_search_index", testCaseSource());
    Response original = response(sensitive, plain);
    String cachedBody = (String) original.getEntity();

    try (MockedStatic<Entity> entity = mockTable()) {
      Response masked = mask(original, mock(Authorizer.class));
      JsonNode hits = JsonUtils.readTree((String) masked.getEntity()).path("hits").path("hits");
      JsonNode source = hits.get(0).path("_source");
      assertEquals("ssn_format [MASKED]", source.path("name").asText());
      assertFalse(source.has("description"));
      assertFalse(source.has("parameterValues"));
      assertFalse(source.has("testCaseResult"));
      assertFalse(source.has("incidentStatus"));
      assertFalse(hits.get(0).has("highlight"));
      assertFalse(hits.get(0).has("fields"));
      assertEquals(
          "Sensitive description", hits.get(1).path("_source").path("description").asText());
      assertEquals(cachedBody, original.getEntity());
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void resolvesProjectedAndSourcelessHitsByIdentity(boolean fetchSource) {
    ObjectNode hit =
        hit(TEST_INDEX + "_rebuild_123", Map.of("description", "Sensitive description"));
    if (!fetchSource) {
      hit.remove("_source");
    }
    hit.putObject("highlight").put("description", "Sensitive description");
    Response original = response(hit);

    try (MockedStatic<Entity> entity = mockTable()) {
      entity
          .when(() -> Entity.getEntity(Entity.TEST_CASE, TEST_ID, "", Include.ALL))
          .thenReturn(linkedTestCase());

      Response masked = mask(original, mock(Authorizer.class));
      JsonNode maskedHit =
          JsonUtils.readTree((String) masked.getEntity()).path("hits").path("hits").get(0);
      assertFalse(maskedHit.has("highlight"));
      assertFalse(maskedHit.path("_source").has("description"));
    }
  }

  @Test
  void masksDerivedTextCopiesInSearchSources() {
    TestCase testCase =
        linkedTestCase()
            .withId(TEST_ID)
            .withName("check")
            .withFullyQualifiedName(TEST_FQN)
            .withDescription("private_description")
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue().withName("regex").withValue("private_parameter")));
    ObjectNode hit = hit(TEST_INDEX, JsonUtils.getMap(testCase));
    EmbeddingClient client = mock(EmbeddingClient.class);
    when(client.embed(anyString())).thenReturn(new float[] {0.1f, 0.2f});
    // Use the contributor without registering a global extractor that changes other tests.
    testCase.setDescription(TestCaseBodyTextContributor.INSTANCE.extractor().extract(testCase));
    ObjectNode fields =
        JsonUtils.convertValue(
            VectorDocBuilder.buildEmbeddingFields(testCase, client), ObjectNode.class);
    assertTrue(fields.path("textToEmbed").asText().contains("private_parameter"));
    ((ObjectNode) hit.path("_source")).setAll(fields);

    try (MockedStatic<Entity> entity = mockTable()) {
      String visible = (String) mask(response(hit), mock(Authorizer.class)).getEntity();
      JsonNode source =
          JsonUtils.readTree(visible).path("hits").path("hits").get(0).path("_source");
      assertFalse(source.has("textToEmbed"));
      assertFalse(source.has("textToLLMContext"));
      assertFalse(visible.contains("private_description"));
      assertFalse(visible.contains("private_parameter"));
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void appliesColumnPolicyToSearchExplanationsWithoutSource(boolean authorized) {
    ObjectNode hit = hit(TEST_INDEX, Map.of());
    hit.remove("_source");
    ObjectNode explanation = hit.putObject("_explanation");
    explanation.put("description", "ConstantScore(description:private_description)");
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext context = mock(SecurityContext.class);
    when(authorizer.authorizePII(context, List.of())).thenReturn(authorized);
    try (MockedStatic<Entity> entity = mockTable()) {
      entity
          .when(() -> Entity.getEntity(Entity.TEST_CASE, TEST_ID, "", Include.ALL))
          .thenReturn(linkedTestCase());

      String visible =
          (String)
              TestCaseSearchMasker.mask(
                      response(hit), authorizer, context, TEST_INDEX, RESULT_INDEX)
                  .getEntity();
      JsonNode visibleHit = JsonUtils.readTree(visible).path("hits").path("hits").get(0);
      assertEquals(authorized, visibleHit.has("_explanation"));
      assertEquals(authorized, visible.contains("private_description"));
      if (authorized) {
        assertEquals(explanation, visibleHit.path("_explanation"));
      }
    }
  }

  @Test
  void masksResultSearchAndInnerHitsUsingTheSameColumnPolicy() {
    ObjectNode result =
        hit(
            RESULT_INDEX,
            Map.of(
                "testCaseFQN",
                TEST_FQN,
                "timestamp",
                123L,
                "result",
                "Sensitive failure",
                "sampleData",
                "Sensitive sample",
                "testCase",
                testCaseSource()));
    result
        .putObject("inner_hits")
        .set(
            "tests",
            JsonUtils.readTree((String) response(hit(TEST_INDEX, testCaseSource())).getEntity()));

    try (MockedStatic<Entity> entity = mockTable()) {
      entity
          .when(() -> Entity.getEntityByName(Entity.TEST_CASE, TEST_FQN, "", Include.ALL))
          .thenReturn(linkedTestCase());

      JsonNode maskedHit =
          JsonUtils.readTree((String) mask(response(result), mock(Authorizer.class)).getEntity())
              .path("hits")
              .path("hits")
              .get(0);
      JsonNode source = maskedHit.path("_source");
      assertEquals(TEST_FQN, source.path("testCaseFQN").asText());
      assertEquals(123L, source.path("timestamp").asLong());
      assertFalse(source.has("result"));
      assertFalse(source.has("sampleData"));
      assertFalse(source.has("testCase"));
      assertFalse(
          maskedHit
              .path("inner_hits")
              .path("tests")
              .path("hits")
              .path("hits")
              .get(0)
              .path("_source")
              .has("description"));
    }
  }

  @Test
  void resolvesProjectedResultHitsByIdentity() {
    ObjectNode result = hit(RESULT_INDEX, Map.of("result", "Sensitive failure"));
    EntityTimeSeriesRepository<TestCaseResult> repository = mock(EntityTimeSeriesRepository.class);
    when(repository.getById(TEST_ID)).thenReturn(new TestCaseResult().withTestCaseFQN(TEST_FQN));

    try (MockedStatic<Entity> entity = mockTable()) {
      entity
          .when(() -> Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESULT))
          .thenReturn(repository);
      entity
          .when(() -> Entity.getEntityByName(Entity.TEST_CASE, TEST_FQN, "", Include.ALL))
          .thenReturn(linkedTestCase());

      JsonNode source =
          JsonUtils.readTree((String) mask(response(result), mock(Authorizer.class)).getEntity())
              .path("hits")
              .path("hits")
              .get(0)
              .path("_source");
      assertFalse(source.has("result"));
    }
  }

  @Test
  void masksOrphanedProjectedHitsAndLeavesAuthorizedResponsesIntact() {
    Response original = response(hit(TEST_INDEX, Map.of("description", "Sensitive description")));
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext context = mock(SecurityContext.class);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntity(Entity.TEST_CASE, TEST_ID, "", Include.ALL))
          .thenThrow(new EntityNotFoundException("deleted"));
      when(authorizer.authorizePII(context, null)).thenReturn(false, true);

      Response masked =
          TestCaseSearchMasker.mask(original, authorizer, context, TEST_INDEX, RESULT_INDEX);
      assertFalse(((String) masked.getEntity()).contains("Sensitive description"));
      assertSame(
          original,
          TestCaseSearchMasker.mask(original, authorizer, context, TEST_INDEX, RESULT_INDEX));
    }
  }

  @Test
  void leavesOtherResponsesIntact() {
    Authorizer authorizer = mock(Authorizer.class);
    Response failure = Response.status(503).entity("unavailable").build();
    Response nonString = Response.ok(Map.of("hits", List.of())).build();
    Response noTests = response(hit("cluster_table_search_index", Map.of("name", "customers")));

    assertSame(failure, mask(failure, authorizer));
    assertSame(nonString, mask(nonString, authorizer));
    assertSame(noTests, mask(noTests, authorizer));
  }

  @ParameterizedTest
  @CsvSource({
    "false, testCaseResult.testResultValue.value.keyword",
    "false, parameterValues.value.keyword",
    "true, testResultValue.value.keyword"
  })
  void rejectsSortsThatWouldReturnFilteredValuesInCursors(boolean result, String sortField) {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexOrAliasName(Entity.TEST_CASE)).thenReturn(TEST_INDEX);
    when(repository.getIndexOrAliasName(Entity.TEST_CASE_RESULT)).thenReturn(RESULT_INDEX);
    ObjectNode hit =
        hit(
            result ? RESULT_INDEX : TEST_INDEX,
            result ? Map.of("testCaseFQN", TEST_FQN) : testCaseSource());
    hit.putArray("sort").add("Sensitive value").add(TEST_ID.toString());
    try (MockedStatic<Entity> entity = mockTable()) {
      if (result) {
        entity
            .when(() -> Entity.getEntityByName(Entity.TEST_CASE, TEST_FQN, "", Include.ALL))
            .thenReturn(linkedTestCase());
      }
      assertThrows(
          BadRequestException.class,
          () ->
              TestCaseSearchMasker.mask(
                  response(hit),
                  mock(Authorizer.class),
                  mock(SecurityContext.class),
                  repository,
                  sortField));
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void keepsPermittedCursorsAndAuthorizedSorts(boolean authorized) {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexOrAliasName(Entity.TEST_CASE)).thenReturn(TEST_INDEX);
    when(repository.getIndexOrAliasName(Entity.TEST_CASE_RESULT)).thenReturn(RESULT_INDEX);
    ObjectNode hit = hit(TEST_INDEX, testCaseSource());
    hit.putArray("sort").add("sort value").add(TEST_ID.toString());
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(authorizer.authorizePII(securityContext, List.of())).thenReturn(authorized);
    try (MockedStatic<Entity> entity = mockTable()) {
      Response visible =
          TestCaseSearchMasker.mask(
              response(hit),
              authorizer,
              securityContext,
              repository,
              authorized ? "testCaseResult.testResultValue.value.keyword" : "name.keyword");
      assertEquals(
          hit.path("sort"),
          JsonUtils.readTree((String) visible.getEntity())
              .path("hits")
              .path("hits")
              .get(0)
              .path("sort"));
    }
  }

  private static Response mask(Response response, Authorizer authorizer) {
    return TestCaseSearchMasker.mask(
        response, authorizer, mock(SecurityContext.class), TEST_INDEX, RESULT_INDEX);
  }

  private static MockedStatic<Entity> mockTable() {
    MockedStatic<Entity> entity = mockStatic(Entity.class);
    entity
        .when(
            () ->
                Entity.getEntityByName(Entity.TABLE, TABLE_FQN, "owners,tags,columns", Include.ALL))
        .thenReturn(
            new Table()
                .withOwners(List.of())
                .withColumns(
                    List.of(
                        new Column()
                            .withName("ssn")
                            .withTags(
                                List.of(new TagLabel().withTagFQN(PIIMasker.SENSITIVE_PII_TAG))))));
    return entity;
  }

  private static TestCase linkedTestCase() {
    return new TestCase().withEntityLink("<#E::table::" + TABLE_FQN + "::columns::SSN>");
  }

  private static Map<String, Object> testCaseSource() {
    return Map.of(
        "name", "ssn_format",
        "entityLink", linkedTestCase().getEntityLink(),
        "description", "Sensitive description",
        "parameterValues", List.of(Map.of("name", "regex", "value", "^078-")),
        "incidentStatus", Map.of("failureSummary", "Incident details"),
        "testCaseResult", Map.of("result", "Sensitive failure"));
  }

  private static ObjectNode hit(String index, Map<String, Object> source) {
    ObjectNode hit =
        JsonUtils.convertValue(
            Map.of("_index", index, "_id", TEST_ID.toString(), "_source", source),
            ObjectNode.class);
    return hit;
  }

  private static Response response(ObjectNode... hits) {
    return Response.ok(JsonUtils.pojoToJson(Map.of("hits", Map.of("hits", List.of(hits))))).build();
  }
}
