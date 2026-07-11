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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.aicontext.AssetContext;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;

class PersonaContextBuilderTest {

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
            eq(rule.getQueryFilter()),
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
            isNull(),
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
          protected List<SelectedEntity> expandDataProductAssets(SelectedEntity dataProduct) {
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
                    null));
          }
        };
    ContextRule rule =
        new ContextRule()
            .withName("Customer data product")
            .withEntityType(Entity.DATA_PRODUCT)
            .withMaxAssets(1)
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

  private static Persona persona() {
    return new Persona()
        .withId(UUID.fromString("11111111-1111-1111-1111-111111111111"))
        .withName("businessAnalyst")
        .withFullyQualifiedName("businessAnalyst");
  }
}
