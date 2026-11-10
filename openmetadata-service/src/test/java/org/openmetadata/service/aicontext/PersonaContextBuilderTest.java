/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.data.MetricAssetDirection;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.aicontext.AssetContext;
import org.openmetadata.schema.type.aicontext.DataQuality;
import org.openmetadata.schema.type.aicontext.LineageEdgeContext;
import org.openmetadata.schema.type.aicontext.Observability;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.schema.type.personaContext.SearchScope;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;

class PersonaContextBuilderTest {
  @ParameterizedTest
  @ValueSource(strings = {Entity.DATA_PRODUCT, Entity.DASHBOARD})
  void dataProductMembersKeepTheirLightweightContext(String ruleEntityType) {
    ContextRule rule =
        new ContextRule()
            .withName("Rendered assets")
            .withEntityType(ruleEntityType)
            .withFullyRendered(true);
    Persona persona =
        persona().withContextDefinition(new PersonaContextDefinition().withRules(List.of(rule)));
    var selected =
        new PersonaContextBuilder.SelectedEntity(
            null,
            Map.of(),
            new AIContext()
                .withEntityType(Entity.DASHBOARD)
                .withFullyQualifiedName("service.dashboard"),
            null,
            null,
            List.of());
    PersonaContextBuilder builder =
        new PersonaContextBuilder(persona, mock(SearchRepository.class)) {
          @Override
          List<RuleMaterialization> selectRules(PersonaContextDefinition definition) {
            return List.of(new RuleMaterialization(rule, 1, List.of(selected)));
          }
        };
    AIContext heavy =
        new AIContext()
            .withUpstream(List.of("service.source"))
            .withObservability(
                new Observability().withDataQuality(new DataQuality().withTotal(1).withPassed(1)));
    try (MockedConstruction<AIContextBuilder> enrichment =
        mockConstruction(
            AIContextBuilder.class, (mock, context) -> when(mock.build()).thenReturn(heavy))) {
      AIContext result = builder.build().context().getRules().getFirst().getEntities().getFirst();
      boolean productMember = Entity.DATA_PRODUCT.equals(ruleEntityType);
      assertEquals(productMember ? List.of() : heavy.getUpstream(), result.getUpstream());
      assertEquals(productMember ? null : heavy.getObservability(), result.getObservability());
      assertEquals(productMember ? 0 : 1, enrichment.constructed().size());
    }
  }

  @Test
  void memberSelectionContinuesBeyondTheSearchEnginesCappedTotal() throws IOException {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.listWithDeepPagination(
            anyString(), isNull(), anyString(), any(), any(), anyInt(), nullable(Object[].class)))
        .thenAnswer(
            invocation -> {
              Object[] cursor = invocation.getArgument(6);
              int start = cursor == null ? 0 : Integer.parseInt(cursor[0].toString()) + 1;
              int end = Math.min(start + 100, 10001);
              return new SearchResultListMapper(
                  documents(start, end), 10000, end < 10001 ? new Object[] {end - 1} : null);
            });
    Authorizer authorizer = mock(Authorizer.class);
    AtomicInteger checked = new AtomicInteger();
    doAnswer(
            invocation -> {
              if (checked.getAndIncrement() < 10000) {
                throw new AuthorizationException("Hidden asset");
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(), any());
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository(anyString()))
          .thenReturn(mock(EntityRepository.class));
      var result =
          new PersonaContextBuilder(persona(), repository)
              .withSecurity(authorizer, mock(SecurityContext.class))
              .search(assetRule("Visible beyond total", "").withMaxAssets(1));
      assertEquals(1, result.documents().size());
      assertEquals(1, result.matched());
      assertEquals(
          "service.db.schema.table-10000", result.documents().getFirst().get("fullyQualifiedName"));
    }
  }

  @Test
  void dataProductSelectionPagesPastHiddenMembersAndReusesItsSourcePages() throws IOException {
    UUID productId = UUID.randomUUID();
    DataProductRepository products = mock(DataProductRepository.class);
    List<EntityReference> firstPage =
        documents(0, 1000).stream()
            .map(
                document ->
                    new EntityReference()
                        .withType(Entity.TABLE)
                        .withFullyQualifiedName(document.get("fullyQualifiedName").toString()))
            .toList();
    when(products.getDataProductAssets(productId, 1000, 0))
        .thenReturn(new ResultList<>(firstPage, 0, 1000, 1001));
    when(products.getDataProductAssets(productId, 1000, 1000))
        .thenReturn(
            new ResultList<>(
                List.of(
                    new EntityReference()
                        .withType(Entity.DASHBOARD)
                        .withFullyQualifiedName("allowed.dashboard")),
                1000,
                1000,
                1001));
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.listWithDeepPagination(
            eq(Entity.TABLE),
            isNull(),
            anyString(),
            any(),
            any(),
            anyInt(),
            nullable(Object[].class)))
        .thenAnswer(
            invocation -> {
              Object[] cursor = invocation.getArgument(6);
              int start = cursor == null ? 0 : Integer.parseInt(cursor[0].toString()) + 1;
              int end = Math.min(start + 100, 1000);
              return new SearchResultListMapper(
                  documents(start, end), 1000, end < 1000 ? new Object[] {end - 1} : null);
            });
    when(repository.listWithDeepPagination(
            eq(Entity.DASHBOARD), isNull(), anyString(), any(), any(), anyInt(), isNull()))
        .thenReturn(
            new SearchResultListMapper(
                List.of(Map.of("fullyQualifiedName", "allowed.dashboard")), 1));
    Authorizer authorizer = mock(Authorizer.class);
    doAnswer(
            invocation -> {
              OperationContext operation = invocation.getArgument(1);
              if (Entity.TABLE.equals(operation.getResource())) {
                throw new AuthorizationException("Hidden table");
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(), any());
    Persona persona = persona();
    PersonaContextSourceCache cache = new PersonaContextSourceCache();
    var product =
        new PersonaContextBuilder.SelectedEntity(
            productId.toString(),
            Map.of(),
            new AIContext().withEntityType(Entity.DATA_PRODUCT).withFullyQualifiedName("product"),
            null,
            null,
            List.of());
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository(anyString()))
          .thenReturn(mock(EntityRepository.class));
      entities.when(() -> Entity.getEntityRepository(Entity.DATA_PRODUCT)).thenReturn(products);
      for (int read = 0; read < 2; read++) {
        var members =
            new PersonaContextBuilder(persona, repository)
                .withSourceCache(cache)
                .withSecurity(authorizer, mock(SecurityContext.class))
                .expandDataProductAssets(product, 1);
        assertEquals(1, members.size());
        assertEquals("allowed.dashboard", members.getFirst().context().getFullyQualifiedName());
      }
      verify(products, times(1)).getDataProductAssets(productId, 1000, 0);
      verify(products, times(1)).getDataProductAssets(productId, 1000, 1000);
      verify(repository, times(11))
          .listWithDeepPagination(
              anyString(), isNull(), anyString(), any(), any(), anyInt(), nullable(Object[].class));
    }
  }

  @Test
  void memberSelectionContinuesBeyondTwoHiddenPages() throws IOException {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.listWithDeepPagination(
            anyString(), isNull(), anyString(), any(), any(), anyInt(), nullable(Object[].class)))
        .thenReturn(
            new SearchResultListMapper(documents(0, 100), 202, new Object[] {"99"}),
            new SearchResultListMapper(documents(100, 200), 202, new Object[] {"199"}),
            new SearchResultListMapper(documents(200, 202), 202));
    Authorizer authorizer = mock(Authorizer.class);
    AtomicInteger checked = new AtomicInteger();
    doAnswer(
            invocation -> {
              if (checked.getAndIncrement() < 200) {
                throw new AuthorizationException("Hidden asset");
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(), any());
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository(anyString()))
          .thenReturn(mock(EntityRepository.class));
      PersonaContextBuilder.RuleSearchResult result =
          new PersonaContextBuilder(persona(), repository)
              .withSecurity(authorizer, mock(SecurityContext.class))
              .search(assetRule("Visible tables", "").withMaxAssets(2));

      assertEquals(2, result.documents().size());
      assertEquals(2, result.matched());
      assertEquals(
          "service.db.schema.table-200", result.documents().getFirst().get("fullyQualifiedName"));
      assertEquals(
          "service.db.schema.table-201", result.documents().getLast().get("fullyQualifiedName"));
    }
  }

  @Test
  void aLimitedMemberDocumentDoesNotClaimItsSelectedCountIsTheTotal() throws IOException {
    SearchRepository repository = mock(SearchRepository.class);
    List<Map<String, Object>> page =
        IntStream.range(0, 100)
            .mapToObj(index -> Map.<String, Object>of("fullyQualifiedName", "table-" + index))
            .toList();
    when(repository.listWithDeepPagination(
            anyString(), isNull(), anyString(), any(), any(), anyInt(), isNull()))
        .thenReturn(new SearchResultListMapper(page, 1000, new Object[] {"99"}));
    Persona persona =
        persona()
            .withContextDefinition(
                new PersonaContextDefinition()
                    .withRules(List.of(assetRule("Limited selection", "").withMaxAssets(1))));
    PersonaContextSourceCache cache = new PersonaContextSourceCache();
    PersonaContextBuilder.MaterializedPersonaContext admin =
        new PersonaContextBuilder(persona, repository).withSourceCache(cache).build();
    assertEquals(1000, admin.context().getRules().getFirst().getMatched());
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository(anyString()))
          .thenReturn(mock(EntityRepository.class));
      PersonaContextBuilder.MaterializedPersonaContext result =
          new PersonaContextBuilder(persona, repository)
              .withSourceCache(cache)
              .withSecurity(mock(Authorizer.class), mock(SecurityContext.class))
              .build();

      assertEquals(1, result.context().getRules().getFirst().getEntities().size());
      assertNull(result.context().getRules().getFirst().getMatched());
      assertTrue(result.context().getTruncated());
      assertTrue(result.markdown().contains("selection limited; total matches unavailable"));
      assertTrue(result.markdown().contains("matched: null"));
      assertFalse(result.markdown().contains("1000 matched"));
    }
  }

  @Test
  void sharedSourcesStayWarmWhileEveryReadRechecksPermissionsAndCopiesContent() throws IOException {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.listWithDeepPagination(
            anyString(), isNull(), anyString(), any(), any(), anyInt(), isNull()))
        .thenReturn(
            new SearchResultListMapper(
                List.of(
                    Map.of(
                        "fullyQualifiedName",
                        "restricted.table",
                        "description",
                        "original content")),
                1));
    Persona persona =
        persona()
            .withContextDefinition(
                new PersonaContextDefinition().withRules(List.of(assetRule("Cached source", ""))));
    PersonaContextSourceCache cache = new PersonaContextSourceCache();
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext security = mock(SecurityContext.class);
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository(anyString()))
          .thenReturn(mock(EntityRepository.class));
      PersonaContextBuilder.MaterializedPersonaContext first =
          new PersonaContextBuilder(persona, repository)
              .withSourceCache(cache)
              .withSecurity(authorizer, security)
              .build();
      assertTrue(first.markdown().contains("original content"));
      first
          .context()
          .getRules()
          .getFirst()
          .getEntities()
          .getFirst()
          .setDescription("mutated response");

      doThrow(new AuthorizationException("Revoked"))
          .when(authorizer)
          .authorize(any(), any(), any());
      PersonaContextBuilder.MaterializedPersonaContext denied =
          new PersonaContextBuilder(persona, repository)
              .withSourceCache(cache)
              .withSecurity(authorizer, security)
              .build();
      assertFalse(denied.markdown().contains("restricted.table"));
      assertFalse(JsonUtils.pojoToJson(denied.context()).contains("original content"));

      doNothing().when(authorizer).authorize(any(), any(), any());
      PersonaContextBuilder.MaterializedPersonaContext restored =
          new PersonaContextBuilder(persona, repository)
              .withSourceCache(cache)
              .withSecurity(authorizer, security)
              .build();
      assertTrue(restored.markdown().contains("original content"));
      assertFalse(restored.markdown().contains("mutated response"));
      verify(repository, times(1))
          .listWithDeepPagination(
              anyString(), isNull(), anyString(), any(), any(), anyInt(), isNull());
      verify(authorizer, times(3)).authorize(any(), any(), any());
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"{", "[]", "{\"regexp\":{\"name\":\"[shop\"}}"})
  void invalidSavedScopesDoNotBlockContextOrReachSearchDefaults(String filter) throws IOException {
    SearchRepository repository = mock(SearchRepository.class);
    SearchClient client = mock(SearchClient.class);
    when(repository.getSearchClient()).thenReturn(client);
    when(repository.getIndexOrAliasName(Entity.TABLE)).thenReturn("tables");
    when(client.rawSearchRequest(anyString(), anyString(), anyString()))
        .thenReturn(new SearchClient.RawSearchResponse(200, "{\"valid\":false}"));
    when(repository.listWithDeepPagination(
            anyString(), isNull(), anyString(), any(), any(), anyInt(), nullable(Object[].class)))
        .thenReturn(
            new SearchResultListMapper(
                List.of(Map.of("fullyQualifiedName", "visible.preload")), 1));
    ContextRule broken = assetRule("Broken scope", filter).withFilteredInSearch(true);
    ContextRule healthy =
        assetRule("Healthy scope", "").withEntityType(Entity.DASHBOARD).withFilteredInSearch(true);
    ContextRule preload = assetRule("Preloaded tables", "");
    for (boolean includeHealthyScope : List.of(true, false)) {
      PersonaContextDefinition definition =
          new PersonaContextDefinition()
              .withRules(
                  includeHealthyScope
                      ? List.of(broken, healthy, preload)
                      : List.of(broken, preload));
      var result =
          new PersonaContextBuilder(persona().withContextDefinition(definition), repository)
              .withSourceCache(new PersonaContextSourceCache())
              .build();
      var scope = result.context().getSearchScope();
      assertEquals(
          includeHealthyScope ? List.of("Healthy scope") : List.of(),
          scope.getRules().stream().map(rule -> rule.getRuleName()).toList());
      assertFalse(scope.getEntityTypes().contains(Entity.TABLE));
      assertEquals(!includeHealthyScope, nullOrEmpty(scope.getQueryFilter()));
      assertEquals(
          "visible.preload",
          result.context().getRules().getFirst().getEntities().getFirst().getFullyQualifiedName());
      assertTrue(result.markdown().contains("visible.preload"));
      assertTrue(broken.getEnabled());
    }
  }

  @Test
  void metricKnowledgeLoadsEveryAssetThroughBoundedRepositoryPages() {
    UUID metricId = UUID.randomUUID();
    Metric metric = new Metric().withId(metricId).withName("revenue");
    MetricRepository repository = mock(MetricRepository.class);
    List<MetricAssetDirection> firstPage = metricAssets(0, 1000);
    List<MetricAssetDirection> secondPage = metricAssets(1000, 1001);
    when(repository.listAssets(metricId, 1000, 0, null, null, null))
        .thenReturn(new ResultList<>(firstPage, 0, 1000, 1001));
    when(repository.listAssets(metricId, 1000, 1000, null, null, null))
        .thenReturn(new ResultList<>(secondPage, 1000, 1000, 1001));

    PersonaContextBuilder.loadMetricAssets(metric, repository);

    assertEquals(1001, metric.getAssets().size());
    assertEquals(
        "service.db.schema.asset-0000", metric.getAssets().getFirst().getFullyQualifiedName());
    assertEquals(
        "service.db.schema.asset-1000", metric.getAssets().getLast().getFullyQualifiedName());
    verify(repository).listAssets(metricId, 1000, 0, null, null, null);
    verify(repository).listAssets(metricId, 1000, 1000, null, null, null);
  }

  @Test
  void metricKnowledgeUsesGenericFieldsThatExcludeTheUnboundedAssetRelationship() {
    assertEquals(
        "owners,tags,relatedMetrics", PersonaContextBuilder.knowledgeFields(Entity.METRIC));
  }

  @Test
  void searchUsesDeepPaginationAndHonorsRuleLimit() throws IOException {
    SearchRepository repository = mock(SearchRepository.class);
    PersonaContextBuilder builder = new PersonaContextBuilder(persona(), repository);
    ContextRule rule =
        new ContextRule()
            .withName("Semantic tables")
            .withEntityType(Entity.TABLE)
            .withQueryFilter("{\"term\":{\"tier.tagFQN\":\"Tier.Tier1\"}}")
            .withMaxAssets(150);
    List<Map<String, Object>> first = documents(0, 100);
    List<Map<String, Object>> second = documents(100, 150);

    when(repository.listWithDeepPagination(
            eq(Entity.TABLE),
            isNull(),
            eq(PersonaContextBuilder.activeEntityFilter(rule.getQueryFilter())),
            any(String[].class),
            any(SearchSortFilter.class),
            anyInt(),
            nullable(Object[].class)))
        .thenReturn(
            new SearchResultListMapper(first, 240, new Object[] {"table-099"}),
            new SearchResultListMapper(second, 240, new Object[] {"table-149"}));

    PersonaContextBuilder.RuleSearchResult result = builder.search(rule);

    assertEquals(240, result.matched());
    assertEquals(150, result.documents().size());
    assertEquals(
        "service.db.schema.table-000", result.documents().getFirst().get("fullyQualifiedName"));
    assertEquals(
        "service.db.schema.table-149", result.documents().getLast().get("fullyQualifiedName"));
  }

  @Test
  void activeEntityFilterAlwaysExcludesDeletedEntities() {
    var filtered =
        JsonUtils.readTree(
            PersonaContextBuilder.activeEntityFilter(
                "{\"query\":{\"term\":{\"tier.tagFQN\":\"Tier.Tier1\"}}}"));
    var empty = JsonUtils.readTree(PersonaContextBuilder.activeEntityFilter("{}"));

    assertEquals(false, filtered.at("/query/bool/filter/0/term/deleted").asBoolean());
    assertEquals("Tier.Tier1", filtered.at("/query/bool/filter/1/term/tier.tagFQN").asText());
    assertEquals(1, empty.at("/query/bool/filter").size());
    assertThrows(
        IllegalArgumentException.class, () -> PersonaContextBuilder.activeEntityFilter("[]"));
  }

  @Test
  void searchSurfacesTheUnderlyingSearchFailureWithItsCause() throws IOException {
    SearchRepository repository = mock(SearchRepository.class);
    PersonaContextBuilder builder = new PersonaContextBuilder(persona(), repository);
    ContextRule rule = new ContextRule().withName("Knowledge Articles").withEntityType(Entity.PAGE);
    IOException failure = new IOException("Failed to parse query filter: boom");
    when(repository.listWithDeepPagination(
            anyString(),
            nullable(String.class),
            anyString(),
            any(String[].class),
            any(SearchSortFilter.class),
            anyInt(),
            nullable(Object[].class)))
        .thenThrow(failure);

    ServiceUnavailableException thrown =
        assertThrows(ServiceUnavailableException.class, () -> builder.search(rule));

    assertSame(failure, thrown.getCause());
    assertTrue(thrown.getMessage().contains("Knowledge Articles"));
  }

  @Test
  void selectRulesDeduplicatesAnEntityUnderTheFirstMatchingRule() throws IOException {
    SearchRepository repository = mock(SearchRepository.class);
    Map<String, Object> document = documents(0, 1).getFirst();
    when(repository.listWithDeepPagination(
            eq(Entity.TABLE),
            isNull(),
            anyString(),
            any(String[].class),
            any(SearchSortFilter.class),
            anyInt(),
            nullable(Object[].class)))
        .thenReturn(new SearchResultListMapper(List.of(document), 1));
    ContextRule first = assetRule("First", "{\"term\":{\"domain\":\"one\"}}");
    ContextRule second = assetRule("Second", "{\"term\":{\"domain\":\"two\"}}");
    PersonaContextBuilder builder = new PersonaContextBuilder(persona(), repository);

    List<PersonaContextBuilder.RuleMaterialization> results =
        builder.selectRules(
            new PersonaContextDefinition().withRules(List.of(first, second)).withEnabled(true));

    assertEquals(1, results.getFirst().entities().size());
    assertEquals(0, results.getLast().entities().size());
    assertEquals(1, results.getLast().matched());
  }

  @Test
  void selectRulesPlacesAlwaysInContextRulesFirst() throws IOException {
    SearchRepository repository = mock(SearchRepository.class);
    Map<String, Object> document = documents(0, 1).getFirst();
    when(repository.listWithDeepPagination(
            eq(Entity.TABLE),
            isNull(),
            anyString(),
            any(String[].class),
            any(SearchSortFilter.class),
            anyInt(),
            nullable(Object[].class)))
        .thenReturn(new SearchResultListMapper(List.of(document), 1));
    ContextRule relevanceRule = assetRule("Relevant", "{\"term\":{\"domain\":\"one\"}}");
    ContextRule alwaysRule =
        assetRule("Always", "{\"term\":{\"domain\":\"two\"}}").withAlwaysInContext(true);

    List<PersonaContextBuilder.RuleMaterialization> results =
        new PersonaContextBuilder(persona(), repository)
            .selectRules(
                new PersonaContextDefinition()
                    .withRules(List.of(relevanceRule, alwaysRule))
                    .withEnabled(true));

    assertEquals("Always", results.getFirst().rule().getName());
    assertEquals(1, results.getFirst().entities().size());
    assertEquals(0, results.getLast().entities().size());
  }

  @Test
  void selectRulesSkipsSearchScopedRulesWithoutSearchingForThem() throws IOException {
    SearchRepository repository = mock(SearchRepository.class);
    ContextRule scopedRule = assetRule("Scoped", "").withFilteredInSearch(true);

    List<PersonaContextBuilder.RuleMaterialization> results =
        new PersonaContextBuilder(persona(), repository)
            .selectRules(
                new PersonaContextDefinition().withRules(List.of(scopedRule)).withEnabled(true));

    assertTrue(results.isEmpty());
    verify(repository, never())
        .listWithDeepPagination(
            anyString(),
            isNull(),
            anyString(),
            any(String[].class),
            any(SearchSortFilter.class),
            anyInt(),
            nullable(Object[].class));
  }

  @Test
  void buildCarriesThePromptOnTheStructuredDocumentOnly() {
    String prompt = "You assist finance analysts with quarterly revenue questions.";
    Persona persona =
        persona()
            .withContextDefinition(
                new PersonaContextDefinition().withEnabled(true).withPrompt(prompt));

    PersonaContextBuilder.MaterializedPersonaContext materialized =
        new PersonaContextBuilder(persona, mock(SearchRepository.class)).build();

    assertEquals(prompt, materialized.context().getPrompt());
    // Consumers frame the markdown as reference data, never instructions, so a prompt inside it
    // would be neutered by that framing.
    assertFalse(materialized.markdown().contains(prompt));
  }

  @Test
  void promptIsWithheldWhileTheContextIsDisabled() {
    Persona persona =
        persona()
            .withContextDefinition(
                new PersonaContextDefinition().withEnabled(false).withPrompt("Answer tersely."));

    PersonaContextBuilder.MaterializedPersonaContext materialized =
        new PersonaContextBuilder(persona, mock(SearchRepository.class)).build();

    assertNull(materialized.context().getPrompt());
  }

  @Test
  void searchScopeIsEmptyWhenNoRuleOptsIn() {
    ContextRule preloadedRule = assetRule("Preloaded", "{\"term\":{\"domain\":\"one\"}}");

    SearchScope scope =
        PersonaContextBuilder.searchScope(
            new PersonaContextDefinition().withRules(List.of(preloadedRule)).withEnabled(true));

    assertTrue(nullOrEmpty(scope.getEntityTypes()));
    assertTrue(nullOrEmpty(scope.getQueryFilter()));
  }

  @Test
  void searchScopeUnionsEachScopedRuleUnderItsOwnEntityType() {
    ContextRule tableRule =
        assetRule("Finance tables", "{\"term\":{\"domain\":\"finance\"}}")
            .withFilteredInSearch(true);
    ContextRule dashboardRule =
        new ContextRule()
            .withName("All dashboards")
            .withEntityType(Entity.DASHBOARD)
            .withEnabled(true)
            .withFilteredInSearch(true);

    SearchScope scope =
        PersonaContextBuilder.searchScope(
            new PersonaContextDefinition()
                .withRules(List.of(tableRule, dashboardRule))
                .withEnabled(true));

    assertEquals(
        Set.of(Entity.TABLE, Entity.DASHBOARD, Entity.GLOSSARY_TERM, Entity.PAGE, Entity.METRIC),
        scope.getEntityTypes());
    assertEquals(2, scope.getRules().size());
    JsonNode filter = JsonUtils.readTree(scope.getQueryFilter()).at("/query/bool/filter");
    assertEquals(false, filter.get(0).at("/term/deleted").asBoolean());
    JsonNode union = filter.get(1).get("bool");
    assertEquals(1, union.get("minimum_should_match").asInt());
    JsonNode tableClause = union.get("should").get(0).at("/bool/filter");
    assertEquals(Entity.TABLE, tableClause.get(0).at("/term/entityType").asText());
    assertEquals("finance", tableClause.get(1).at("/term/domain").asText());
    JsonNode dashboardClause = union.get("should").get(1).at("/bool/filter");
    assertEquals(Entity.DASHBOARD, dashboardClause.get(0).at("/term/entityType").asText());
    assertEquals(1, dashboardClause.size());
  }

  @Test
  void preloadedRulesDoNotWidenTheIndependentSearchScope() {
    ContextRule scopedTable =
        assetRule("Finance tables", "{\"term\":{\"domain\":\"finance\"}}")
            .withFilteredInSearch(true);
    ContextRule preloadedDashboard =
        new ContextRule()
            .withName("Executive dashboards")
            .withEntityType(Entity.DASHBOARD)
            .withEnabled(true)
            .withFilteredInSearch(false);

    SearchScope scope =
        PersonaContextBuilder.searchScope(
            new PersonaContextDefinition()
                .withRules(List.of(scopedTable, preloadedDashboard))
                .withEnabled(true));

    assertEquals(
        Set.of(Entity.TABLE, Entity.GLOSSARY_TERM, Entity.PAGE, Entity.METRIC),
        scope.getEntityTypes());
    JsonNode clauses =
        JsonUtils.readTree(scope.getQueryFilter()).at("/query/bool/filter/1/bool/should");
    assertEquals(
        Set.of(Entity.TABLE, Entity.GLOSSARY_TERM, Entity.PAGE, Entity.METRIC),
        Set.copyOf(clauses.findValuesAsText("entityType")));
  }

  @Test
  void preloadingDomainBDoesNotChangeTheDomainASearchFilter() {
    ContextRule scoped =
        assetRule("Domain A", "{\"term\":{\"domain\":\"A\"}}").withFilteredInSearch(true);
    ContextRule preload =
        assetRule("Domain B", "{\"term\":{\"domain\":\"B\"}}").withFilteredInSearch(false);
    String scopedOnly =
        PersonaContextBuilder.searchScope(new PersonaContextDefinition().withRules(List.of(scoped)))
            .getQueryFilter();
    String combined =
        PersonaContextBuilder.searchScope(
                new PersonaContextDefinition().withRules(List.of(scoped, preload)))
            .getQueryFilter();
    assertNotNull(scopedOnly);
    assertEquals(scopedOnly, combined);
  }

  @Test
  void deniedAssetsReachNeitherJsonNorMarkdownOrMatchedCounts() throws IOException {
    SearchRepository repository = mock(SearchRepository.class);
    Map<String, Object> document =
        Map.of("fullyQualifiedName", "restricted.table", "description", "restricted SQL");
    when(repository.listWithDeepPagination(
            anyString(), isNull(), anyString(), any(), any(), anyInt(), isNull()))
        .thenReturn(new SearchResultListMapper(List.of(document), 1, null, null));
    Authorizer authorizer = mock(Authorizer.class);
    doThrow(new AuthorizationException("Denied")).when(authorizer).authorize(any(), any(), any());
    Persona memberPersona =
        persona()
            .withContextDefinition(
                new PersonaContextDefinition()
                    .withRules(List.of(assetRule("Preloaded tables", ""))));
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository(anyString()))
          .thenReturn(mock(EntityRepository.class));
      PersonaContextBuilder.MaterializedPersonaContext result =
          new PersonaContextBuilder(memberPersona, repository)
              .withSecurity(authorizer, mock(SecurityContext.class))
              .build();

      assertFalse(result.markdown().contains("restricted.table"));
      assertFalse(JsonUtils.pojoToJson(result.context()).contains("restricted SQL"));
      assertEquals(0, result.context().getRules().getFirst().getMatched());
      assertTrue(result.context().getRules().getFirst().getEntities().isEmpty());
      PersonaContextBuilder.MaterializedPersonaContext allowed =
          new PersonaContextBuilder(memberPersona, repository)
              .withSecurity(mock(Authorizer.class), mock(SecurityContext.class))
              .build();
      assertTrue(allowed.markdown().contains("restricted.table"));
      assertTrue(JsonUtils.pojoToJson(allowed.context()).contains("restricted SQL"));
      assertEquals(1, allowed.context().getRules().getFirst().getMatched());
    }
  }

  @Test
  void multipleScopedRulesUnionRatherThanIntersect() {
    // Rules are OR-ed, so a second rule always WIDENS the scope. This is the one direction that is
    // not obvious from the schema, and it is what makes contradictory rules harmless: two rules
    // that
    // disagree select the union of both, never the empty set.
    ContextRule finance =
        assetRule("Finance", "{\"term\":{\"service.name.keyword\":\"finance\"}}")
            .withFilteredInSearch(true);
    ContextRule sales =
        assetRule("Sales", "{\"term\":{\"service.name.keyword\":\"sales\"}}")
            .withFilteredInSearch(true);

    SearchScope scope =
        PersonaContextBuilder.searchScope(
            new PersonaContextDefinition().withRules(List.of(finance, sales)).withEnabled(true));

    JsonNode union = JsonUtils.readTree(scope.getQueryFilter()).at("/query/bool/filter/1/bool");
    assertEquals(1, union.get("minimum_should_match").asInt(), "clauses are OR-ed, not AND-ed");
    assertEquals(5, union.get("should").size());
    assertEquals(
        Set.of(Entity.TABLE, Entity.GLOSSARY_TERM, Entity.PAGE, Entity.METRIC),
        scope.getEntityTypes(),
        "one scoped asset type plus searchable knowledge types");
  }

  @Test
  void aRuleWhoseAssetFilterMatchesNothingKeepsKnowledgeSearchable() {
    ContextRule contradictory =
        assetRule(
                "Impossible",
                "{\"bool\":{\"must\":[{\"term\":{\"service.name.keyword\":\"a\"}},"
                    + "{\"term\":{\"service.name.keyword\":\"b\"}}]}}")
            .withFilteredInSearch(true);

    SearchScope scope =
        PersonaContextBuilder.searchScope(
            new PersonaContextDefinition().withRules(List.of(contradictory)).withEnabled(true));

    JsonNode clause =
        JsonUtils.readTree(scope.getQueryFilter()).at("/query/bool/filter/1/bool/should/0");
    assertEquals(2, clause.at("/bool/filter/1/bool/must").size());
    assertEquals(
        Set.of(Entity.TABLE, Entity.GLOSSARY_TERM, Entity.PAGE, Entity.METRIC),
        scope.getEntityTypes());
  }

  @Test
  void scopedRulesOfDifferentEntityTypesEachContributeTheirOwnType() {
    ContextRule tables = assetRule("Tables", "").withFilteredInSearch(true);
    ContextRule dashboards =
        new ContextRule()
            .withName("Dashboards")
            .withEntityType(Entity.DASHBOARD)
            .withEnabled(true)
            .withFilteredInSearch(true);

    SearchScope scope =
        PersonaContextBuilder.searchScope(
            new PersonaContextDefinition()
                .withRules(List.of(tables, dashboards))
                .withEnabled(true));

    assertEquals(
        Set.of(Entity.TABLE, Entity.DASHBOARD, Entity.GLOSSARY_TERM, Entity.PAGE, Entity.METRIC),
        scope.getEntityTypes());
    JsonNode should =
        JsonUtils.readTree(scope.getQueryFilter()).at("/query/bool/filter/1/bool/should");
    assertEquals(Entity.TABLE, should.get(0).at("/bool/filter/0/term/entityType").asText());
    assertEquals(Entity.DASHBOARD, should.get(1).at("/bool/filter/0/term/entityType").asText());
  }

  @Test
  void knowledgeRulesAreNeverSearchScopedEvenWhenTheFlagIsSet() throws IOException {
    // A scoped knowledge rule would drop its articles/terms/metrics out of the document entirely
    // and put a knowledge type into an asset-search allowlist, where it means nothing.
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.listWithDeepPagination(
            eq(Entity.PAGE),
            isNull(),
            anyString(),
            any(String[].class),
            any(SearchSortFilter.class),
            anyInt(),
            nullable(Object[].class)))
        .thenReturn(new SearchResultListMapper(List.of(), 0));
    ContextRule knowledgeRule =
        new ContextRule()
            .withName("Articles")
            .withEntityType(Entity.PAGE)
            .withEnabled(true)
            .withFilteredInSearch(true);
    PersonaContextDefinition definition =
        new PersonaContextDefinition().withRules(List.of(knowledgeRule)).withEnabled(true);

    assertTrue(nullOrEmpty(PersonaContextBuilder.searchScope(definition).getQueryFilter()));
    assertEquals(
        1,
        new PersonaContextBuilder(persona(), repository).selectRules(definition).size(),
        "a knowledge rule must still be materialized despite the flag");
  }

  @Test
  void searchScopeIgnoresDisabledRulesAndDisabledDefinitions() {
    ContextRule disabledRule =
        assetRule("Disabled", "").withFilteredInSearch(true).withEnabled(false);
    ContextRule enabledRule = assetRule("Enabled", "").withFilteredInSearch(true);

    assertTrue(
        nullOrEmpty(
            PersonaContextBuilder.searchScope(
                    new PersonaContextDefinition()
                        .withRules(List.of(disabledRule))
                        .withEnabled(true))
                .getQueryFilter()));
    assertTrue(
        nullOrEmpty(
            PersonaContextBuilder.searchScope(
                    new PersonaContextDefinition()
                        .withRules(List.of(enabledRule))
                        .withEnabled(false))
                .getQueryFilter()));
  }

  @Test
  void parsesIndexedTableContextAndGlossaryFqns() {
    Map<String, Object> document =
        Map.of(
            "aiContext",
            Map.of(
                "table",
                Map.of("columns", List.of(Map.of("name", "order_id", "dataType", "BIGINT")))),
            "glossaryTags",
            List.of("Business.Order", "Business.Revenue"));

    AssetContext context = PersonaContextBuilder.assetContext(document);

    assertNotNull(context);
    assertEquals("order_id", context.getTable().getColumns().getFirst().getName());
    assertEquals(
        List.of("Business.Order", "Business.Revenue"),
        PersonaContextBuilder.glossaryFqns(document));
  }

  @Test
  void previewRejectsEntityTypesOutsideTheConfigurationRegistry() {
    ContextRule rule = new ContextRule().withName("Users").withEntityType(Entity.USER);

    assertThrows(IllegalArgumentException.class, () -> PersonaContextBuilder.preview(rule));
  }

  @Test
  void configurationRegistrySupportsEveryCuratedEntityType() {
    for (String entityType :
        List.of(
            Entity.API_COLLECTION,
            Entity.API_ENDPOINT,
            Entity.CHART,
            Entity.CONTAINER,
            Entity.DASHBOARD,
            Entity.DASHBOARD_DATA_MODEL,
            Entity.DATABASE,
            Entity.DATABASE_SCHEMA,
            Entity.DATA_PRODUCT,
            Entity.GLOSSARY_TERM,
            Entity.PAGE,
            Entity.METRIC,
            Entity.MLMODEL,
            Entity.PIPELINE,
            Entity.SEARCH_INDEX,
            Entity.STORED_PROCEDURE,
            Entity.TABLE,
            Entity.TOPIC)) {
      assertTrue(PersonaContextBuilder.supportsEntityType(entityType), entityType);
    }
  }

  @Test
  void indexesSelectedEntitiesByIdentityWithoutDeepEqualityLookups() {
    Map<String, Object> document = documents(0, 1).getFirst();
    AIContext context =
        new AIContext()
            .withEntityType(Entity.TABLE)
            .withFullyQualifiedName(String.valueOf(document.get("fullyQualifiedName")));
    PersonaContextBuilder.SelectedEntity firstEntity =
        new PersonaContextBuilder.SelectedEntity("id", document, context, null, null, List.of());
    PersonaContextBuilder.SelectedEntity equalButDistinctEntity =
        new PersonaContextBuilder.SelectedEntity("id", document, context, null, null, List.of());
    ContextRule firstRule = assetRule("First", "");
    ContextRule secondRule = assetRule("Second", "");

    assertEquals(firstEntity, equalButDistinctEntity);

    Map<PersonaContextBuilder.SelectedEntity, ContextRule> ruleByEntity =
        PersonaContextBuilder.indexRulesByEntity(
            List.of(
                new PersonaContextBuilder.RuleMaterialization(firstRule, 1, List.of(firstEntity)),
                new PersonaContextBuilder.RuleMaterialization(
                    secondRule, 1, List.of(equalButDistinctEntity))));

    assertSame(firstRule, ruleByEntity.get(firstEntity));
    assertSame(secondRule, ruleByEntity.get(equalButDistinctEntity));
  }

  @Test
  void applyHeavySectionsCopiesLineageEdgesAndDataQualityPerFlags() {
    LineageEdgeContext upstreamEdge =
        new LineageEdgeContext()
            .withFullyQualifiedName("svc.db.raw.orders")
            .withColumns(
                List.of(
                    new ColumnLineage()
                        .withFromColumns(List.of("svc.db.raw.orders.id"))
                        .withToColumn("svc.db.sch.orders.id")));
    LineageEdgeContext downstreamEdge =
        new LineageEdgeContext().withFullyQualifiedName("svc.db.analytics.orders");
    DataQuality dataQuality = new DataQuality().withTotal(3).withPassed(2).withFailed(1);
    AIContext heavy =
        new AIContext()
            .withUpstream(List.of("svc.db.raw.orders"))
            .withUpstreamEdges(List.of(upstreamEdge))
            .withDownstream(List.of("svc.db.analytics.orders"))
            .withDownstreamEdges(List.of(downstreamEdge))
            .withObservability(new Observability().withDataQuality(dataQuality));
    AIContext context = new AIContext();

    PersonaContextBuilder.applyHeavySections(context, heavy, true, true);

    assertSame(heavy.getUpstream(), context.getUpstream());
    assertSame(heavy.getUpstreamEdges(), context.getUpstreamEdges());
    assertSame(heavy.getDownstream(), context.getDownstream());
    assertSame(heavy.getDownstreamEdges(), context.getDownstreamEdges());
    assertSame(dataQuality, context.getObservability().getDataQuality());
  }

  @Test
  void applyHeavySectionsDoesNotCopyLineageWhenItWasNotRequested() {
    DataQuality dataQuality = new DataQuality().withTotal(1).withPassed(1);
    AIContext heavy =
        new AIContext()
            .withUpstream(List.of("svc.db.raw.orders"))
            .withUpstreamEdges(
                List.of(new LineageEdgeContext().withFullyQualifiedName("svc.db.raw.orders")))
            .withObservability(new Observability().withDataQuality(dataQuality));
    LineageEdgeContext existingEdge =
        new LineageEdgeContext().withFullyQualifiedName("svc.db.existing.orders");
    AIContext context =
        new AIContext()
            .withUpstream(List.of("svc.db.existing.orders"))
            .withUpstreamEdges(List.of(existingEdge));

    PersonaContextBuilder.applyHeavySections(context, heavy, false, true);

    assertEquals(List.of("svc.db.existing.orders"), context.getUpstream());
    assertEquals(List.of(existingEdge), context.getUpstreamEdges());
    assertSame(dataQuality, context.getObservability().getDataQuality());
  }

  @Test
  void fullyRenderedDataProductIncludesItsMemberAssetContexts() throws IOException {
    SearchRepository repository = mock(SearchRepository.class);
    String dataProductId = "22222222-2222-4222-8222-222222222222";
    Map<String, Object> document =
        Map.of(
            "id", dataProductId,
            "fullyQualifiedName", "sales.customer360",
            "displayName", "Customer 360");
    when(repository.listWithDeepPagination(
            eq(Entity.DATA_PRODUCT),
            isNull(),
            eq(PersonaContextBuilder.activeEntityFilter(null)),
            any(String[].class),
            any(SearchSortFilter.class),
            anyInt(),
            nullable(Object[].class)))
        .thenReturn(new SearchResultListMapper(List.of(document), 1));
    Map<String, Object> memberDocument =
        Map.of(
            "id",
            "33333333-3333-4333-8333-333333333333",
            "fullyQualifiedName",
            "sample_data.ecommerce_db.shopify.dim_customer");
    when(repository.listWithDeepPagination(
            eq(Entity.TABLE),
            isNull(),
            anyString(),
            any(String[].class),
            any(SearchSortFilter.class),
            anyInt(),
            nullable(Object[].class)))
        .thenReturn(new SearchResultListMapper(List.of(memberDocument), 1));
    PersonaContextBuilder builder =
        new PersonaContextBuilder(persona(), repository) {
          @Override
          protected List<SelectedEntity> expandDataProductAssets(
              SelectedEntity dataProduct, int maxAssets) {
            AIContext tableContext =
                new AIContext()
                    .withEntityType(Entity.TABLE)
                    .withFullyQualifiedName("sample_data.ecommerce_db.shopify.dim_customer")
                    .withDisplayName("dim_customer")
                    .withAssetContext(new AssetContext());
            return List.of(
                new SelectedEntity(
                    "33333333-3333-4333-8333-333333333333",
                    Map.of(
                        "id",
                        "33333333-3333-4333-8333-333333333333",
                        "fullyQualifiedName",
                        tableContext.getFullyQualifiedName()),
                    tableContext,
                    null,
                    null,
                    List.of()));
          }
        };
    ContextRule rule =
        new ContextRule()
            .withName("Customer data product")
            .withEntityType(Entity.DATA_PRODUCT)
            .withMaxAssets(2)
            .withEnabled(true)
            .withFullyRendered(true)
            .withSections(Set.of());
    ContextRule directTableRule =
        assetRule("Direct table", "{\"term\":{\"name\":\"dim_customer\"}}");

    List<PersonaContextBuilder.RuleMaterialization> results =
        builder.selectRules(
            new PersonaContextDefinition()
                .withRules(List.of(rule, directTableRule))
                .withEnabled(true));

    assertEquals(2, results.getFirst().entities().size());
    assertEquals(
        Entity.DATA_PRODUCT, results.getFirst().entities().getFirst().context().getEntityType());
    assertEquals(Entity.TABLE, results.getFirst().entities().getLast().context().getEntityType());
    assertEquals(0, results.getLast().entities().size());
    assertEquals(1, results.getLast().matched());
  }

  private static ContextRule assetRule(String name, String queryFilter) {
    return new ContextRule()
        .withName(name)
        .withEntityType(Entity.TABLE)
        .withQueryFilter(queryFilter)
        .withMaxAssets(10)
        .withEnabled(true)
        .withSections(Set.of());
  }

  private static List<Map<String, Object>> documents(int start, int end) {
    List<Map<String, Object>> documents = new ArrayList<>();
    IntStream.range(start, end)
        .forEach(
            index ->
                documents.add(
                    Map.of(
                        "id",
                        UUID.nameUUIDFromBytes(("table-" + index).getBytes()).toString(),
                        "fullyQualifiedName",
                        "service.db.schema.table-%03d".formatted(index))));
    return documents;
  }

  private static List<MetricAssetDirection> metricAssets(int start, int end) {
    return IntStream.range(start, end)
        .mapToObj(
            index ->
                new MetricAssetDirection()
                    .withAsset(
                        new EntityReference()
                            .withId(UUID.nameUUIDFromBytes(("asset-" + index).getBytes()))
                            .withType(Entity.TABLE)
                            .withFullyQualifiedName(
                                "service.db.schema.asset-%04d".formatted(index))))
        .toList();
  }

  private static Persona persona() {
    return new Persona()
        .withId(UUID.fromString("11111111-1111-1111-1111-111111111111"))
        .withName("businessAnalyst")
        .withFullyQualifiedName("businessAnalyst");
  }
}
