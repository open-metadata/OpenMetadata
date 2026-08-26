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

package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.api.lineage.LineageLevelKind;
import org.openmetadata.schema.api.lineage.LineageScene;
import org.openmetadata.schema.api.lineage.LineageSceneEdge;
import org.openmetadata.schema.api.lineage.LineageSceneField;
import org.openmetadata.schema.api.lineage.LineageSceneNode;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.Datum;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TempLineageTable;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.lineage.LineageGraphConfiguration;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class LineageSceneResolverTest {
  private static final LineageSceneResolver RESOLVER = new LineageSceneResolver();
  private static final String SNOWFLAKE_SERVICE = "snowflake";
  private static final String POWERBI_SERVICE = "powerbi";
  private static final String KAFKA_SERVICE = "kafka";
  private static final String ORDERS = "snowflake.shop.public.orders";
  private static final String CUSTOMERS = "snowflake.shop.public.customers";
  private static final String SALES_DASHBOARD = "powerbi.sales.dashboard";
  private static final String EXEC_DASHBOARD = "powerbi.exec.dashboard";
  private static final String ORDERS_TOPIC = "kafka.orders";
  private static final String CUSTOMERS_TOPIC = "kafka.customers";

  @Test
  void layerSceneAggregatesConcreteEdgesByService() {
    SearchLineageResult lineage =
        result(
            List.of(
                table(ORDERS, SNOWFLAKE_SERVICE, List.of("id")),
                dashboard(SALES_DASHBOARD),
                dashboard(EXEC_DASHBOARD)),
            List.of(
                edge("orders-sales", ORDERS, Entity.TABLE, SALES_DASHBOARD, Entity.DASHBOARD),
                edge("orders-exec", ORDERS, Entity.TABLE, EXEC_DASHBOARD, Entity.DASHBOARD)));

    LineageScene scene =
        RESOLVER.resolveScene(
            ORDERS, Entity.TABLE, LineageLens.SERVICE, LineageBand.LAYER, lineage, 200);

    assertEquals(LineageBand.LAYER, scene.getBand());
    assertEquals(2, scene.getNodes().size());
    assertTrue(
        scene.getNodes().stream()
            .allMatch(node -> node.getLevelKind() == LineageLevelKind.SERVICE));

    assertEquals(1, scene.getEdges().size());
    LineageSceneEdge rollup = scene.getEdges().get(0);
    assertTrue(Boolean.TRUE.equals(rollup.getIsRollup()));
    assertEquals(2, rollup.getWeight());
    assertEquals("2", rollup.getLabel());
  }

  @Test
  void layerSceneKeepsAncestorWhenConcreteEdgesCollapseToSelfLoop() {
    SearchLineageResult lineage =
        result(
            List.of(
                table(ORDERS, SNOWFLAKE_SERVICE, List.of("id")),
                table(CUSTOMERS, SNOWFLAKE_SERVICE, List.of("customer_id"))),
            List.of(edge("same-service", ORDERS, Entity.TABLE, CUSTOMERS, Entity.TABLE)));

    LineageScene scene =
        RESOLVER.resolveScene(
            ORDERS, Entity.TABLE, LineageLens.SERVICE, LineageBand.LAYER, lineage, 200);

    assertEquals(LineageBand.LAYER, scene.getBand());
    assertEquals(1, scene.getNodes().size());
    assertEquals(LineageLevelKind.SERVICE, scene.getNodes().get(0).getLevelKind());
    assertEquals(SNOWFLAKE_SERVICE, scene.getNodes().get(0).getFullyQualifiedName());
    assertTrue(scene.getEdges().isEmpty());
  }

  @Test
  void rootSceneHonorsRequestedAssetBand() {
    SearchLineageResult lineage =
        result(
            List.of(table(ORDERS, SNOWFLAKE_SERVICE, List.of("id")), dashboard(SALES_DASHBOARD)),
            List.of(edge("orders-sales", ORDERS, Entity.TABLE, SALES_DASHBOARD, Entity.DASHBOARD)));

    LineageScene scene =
        RESOLVER.resolveScene(null, null, LineageLens.SERVICE, LineageBand.ASSET, lineage, 200);

    assertEquals(LineageBand.ASSET, scene.getBand());
    assertEquals(2, scene.getNodes().size());
    assertTrue(
        scene.getNodes().stream()
            .allMatch(node -> node.getLevelKind() != LineageLevelKind.SERVICE));
  }

  @Test
  void rootLayerServicesAreDrillable() {
    SearchLineageResult lineage =
        result(
            List.of(
                service(SNOWFLAKE_SERVICE, Entity.DATABASE_SERVICE, "snowflake"),
                service(POWERBI_SERVICE, Entity.DASHBOARD_SERVICE, "powerbi")),
            List.of(
                edge(
                    "service-rollup",
                    SNOWFLAKE_SERVICE,
                    Entity.DATABASE_SERVICE,
                    POWERBI_SERVICE,
                    Entity.DASHBOARD_SERVICE)));

    LineageScene scene =
        RESOLVER.resolveScene(null, null, LineageLens.SERVICE, LineageBand.LAYER, lineage, 200);

    assertEquals(LineageBand.LAYER, scene.getBand());
    assertEquals(2, scene.getNodes().size());
    assertTrue(
        scene.getNodes().stream().allMatch(node -> Boolean.TRUE.equals(node.getIsExpandable())));
  }

  @Test
  void rootLayerServicesAggregateContainedAssetCountsWhenServiceEdgesExist() {
    SearchLineageResult lineage =
        result(
            List.of(
                service(SNOWFLAKE_SERVICE, Entity.DATABASE_SERVICE, "snowflake"),
                service(POWERBI_SERVICE, Entity.DASHBOARD_SERVICE, "powerbi"),
                table(ORDERS, SNOWFLAKE_SERVICE, List.of("id")),
                table(CUSTOMERS, SNOWFLAKE_SERVICE, List.of("customer_id")),
                dashboard(SALES_DASHBOARD)),
            List.of(
                edge(
                    "service-rollup",
                    SNOWFLAKE_SERVICE,
                    Entity.DATABASE_SERVICE,
                    POWERBI_SERVICE,
                    Entity.DASHBOARD_SERVICE)));

    LineageScene scene =
        RESOLVER.resolveScene(null, null, LineageLens.SERVICE, LineageBand.LAYER, lineage, 200);

    assertEquals(LineageBand.LAYER, scene.getBand());
    assertEquals(2, scene.getNodes().size());
    LineageSceneNode snowflake = nodeByFqn(scene, SNOWFLAKE_SERVICE);
    LineageSceneNode powerbi = nodeByFqn(scene, POWERBI_SERVICE);
    assertEquals(2, snowflake.getChildrenCount());
    assertEquals(2, snowflake.getCounts().get(LineageLevelKind.TABLE.value()));
    assertEquals(1, powerbi.getChildrenCount());
    assertEquals(1, powerbi.getCounts().get(LineageLevelKind.DASHBOARD.value()));
  }

  @Test
  void rootLayerServicesUseSyntheticSearchTotalAssetCounts() {
    SearchLineageResult lineage =
        result(
            List.of(
                service(SNOWFLAKE_SERVICE, Entity.DATABASE_SERVICE, "snowflake"),
                syntheticCount(Entity.TABLE, SNOWFLAKE_SERVICE, 40)),
            List.of());

    LineageScene scene =
        RESOLVER.resolveScene(null, null, LineageLens.SERVICE, LineageBand.LAYER, lineage, 200);

    LineageSceneNode snowflake = nodeByFqn(scene, SNOWFLAKE_SERVICE);

    assertEquals(1, scene.getNodes().size());
    assertEquals(40, snowflake.getChildrenCount());
    assertEquals(40, snowflake.getCounts().get(LineageLevelKind.TABLE.value()));
  }

  @Test
  void domainAndDataProductRootEntitiesUseTheirOwnLensReferences() {
    String domainFqn = "analytics";
    SearchLineageResult domainLineage =
        result(
            List.of(
                rootEntity(Entity.DOMAIN, domainFqn),
                syntheticLensCount(Entity.TABLE, "domains", Entity.DOMAIN, domainFqn, 7)),
            List.of());

    LineageScene domainScene =
        RESOLVER.resolveScene(
            null, null, LineageLens.DOMAIN, LineageBand.LAYER, domainLineage, 200);

    assertEquals(
        7, nodeByFqn(domainScene, domainFqn).getCounts().get(LineageLevelKind.TABLE.value()));

    String dataProductFqn = "customer360";
    SearchLineageResult dataProductLineage =
        result(
            List.of(
                rootEntity(Entity.DATA_PRODUCT, dataProductFqn),
                syntheticLensCount(
                    Entity.TABLE, "dataProducts", Entity.DATA_PRODUCT, dataProductFqn, 9)),
            List.of());

    LineageScene dataProductScene =
        RESOLVER.resolveScene(
            null, null, LineageLens.DATA_PRODUCT, LineageBand.LAYER, dataProductLineage, 200);

    assertEquals(
        9,
        nodeByFqn(dataProductScene, dataProductFqn)
            .getCounts()
            .get(LineageLevelKind.TABLE.value()));
  }

  @Test
  void serviceFocusedMessagingSceneSkipsAbsentDatabaseAndSchemaLevels() {
    SearchLineageResult lineage =
        result(
            List.of(topic(ORDERS_TOPIC, KAFKA_SERVICE), topic(CUSTOMERS_TOPIC, KAFKA_SERVICE)),
            List.of(edge("topic-edge", ORDERS_TOPIC, Entity.TOPIC, CUSTOMERS_TOPIC, Entity.TOPIC)));

    LineageScene scene =
        RESOLVER.resolveScene(
            KAFKA_SERVICE,
            Entity.MESSAGING_SERVICE,
            LineageLens.SERVICE,
            LineageBand.ASSET,
            lineage,
            200);

    assertEquals(LineageBand.ASSET, scene.getBand());
    assertEquals(2, scene.getNodes().size());
    assertTrue(
        scene.getNodes().stream().allMatch(node -> node.getLevelKind() == LineageLevelKind.TOPIC));
    assertTrue(
        scene.getBreadcrumb().stream()
            .anyMatch(
                crumb ->
                    KAFKA_SERVICE.equals(crumb.getFullyQualifiedName())
                        && crumb.getLevelKind() == LineageLevelKind.SERVICE));
  }

  @Test
  void serviceFocusedRelationalSceneShowsDatabaseBeforeSchemas() {
    SearchLineageResult lineage =
        result(
            List.of(
                table(
                    "snowflake.shop.collate_shop.orders",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "collate_shop",
                    List.of("id")),
                table(
                    "snowflake.shop.banking.accounts",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "banking",
                    List.of("account_id")),
                table(
                    "snowflake.shop.analytics.daily_sales",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "analytics",
                    List.of("sale_id"))),
            List.of());

    LineageScene scene =
        RESOLVER.resolveScene(
            SNOWFLAKE_SERVICE,
            Entity.DATABASE_SERVICE,
            LineageLens.SERVICE,
            LineageBand.ASSET,
            lineage,
            200);

    assertEquals(LineageBand.ASSET, scene.getBand());
    assertEquals(1, scene.getNodes().size());
    assertTrue(
        scene.getNodes().stream()
            .allMatch(node -> node.getLevelKind() == LineageLevelKind.DATABASE));
    assertEquals(SNOWFLAKE_SERVICE + ".shop", scene.getNodes().get(0).getFullyQualifiedName());
    assertEquals(3, scene.getNodes().get(0).getChildrenCount());
    assertEquals(3, scene.getNodes().get(0).getCounts().get(LineageLevelKind.TABLE.value()));
  }

  @Test
  void serviceFocusedRelationalSceneUsesSyntheticDatabaseAssetCounts() {
    SearchLineageResult lineage =
        result(
            List.of(
                table(
                    "snowflake.shop.collate_shop.orders",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "collate_shop",
                    List.of("id")),
                table(
                    "snowflake.shop.collate_shop.customers",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "collate_shop",
                    List.of("customer_id")),
                syntheticDatabaseCount(Entity.TABLE, SNOWFLAKE_SERVICE, "shop", 40)),
            List.of());

    LineageScene scene =
        RESOLVER.resolveScene(
            SNOWFLAKE_SERVICE,
            Entity.DATABASE_SERVICE,
            LineageLens.SERVICE,
            LineageBand.ASSET,
            lineage,
            200);

    LineageSceneNode shop = nodeByFqn(scene, SNOWFLAKE_SERVICE + ".shop");

    assertEquals(40, shop.getChildrenCount());
    assertEquals(40, shop.getCounts().get(LineageLevelKind.TABLE.value()));
  }

  @Test
  void databaseFocusedRelationalSceneShowsSchemasBeforeTables() {
    SearchLineageResult lineage =
        result(
            List.of(
                table(
                    "snowflake.shop.collate_shop.orders",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "collate_shop",
                    List.of("id")),
                table(
                    "snowflake.shop.collate_shop.customers",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "collate_shop",
                    List.of("customer_id")),
                table(
                    "snowflake.shop.banking.accounts",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "banking",
                    List.of("account_id")),
                table(
                    "snowflake.shop.analytics.daily_sales",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "analytics",
                    List.of("sale_id"))),
            List.of());

    LineageScene scene =
        RESOLVER.resolveScene(
            SNOWFLAKE_SERVICE + ".shop",
            Entity.DATABASE,
            LineageLens.SERVICE,
            LineageBand.ASSET,
            lineage,
            200);

    assertEquals(LineageBand.ASSET, scene.getBand());
    assertEquals(3, scene.getNodes().size());
    assertTrue(
        scene.getNodes().stream().allMatch(node -> node.getLevelKind() == LineageLevelKind.SCHEMA));
    assertTrue(
        scene.getNodes().stream()
            .map(node -> node.getFullyQualifiedName())
            .allMatch(fqn -> fqn.startsWith(SNOWFLAKE_SERVICE + ".shop.")));
    LineageSceneNode collateShop = nodeByFqn(scene, SNOWFLAKE_SERVICE + ".shop.collate_shop");
    assertEquals(2, collateShop.getChildrenCount());
    assertEquals(2, collateShop.getCounts().get(LineageLevelKind.TABLE.value()));
  }

  @Test
  void databaseFocusedRelationalSceneUsesSyntheticSchemaAssetCounts() {
    SearchLineageResult lineage =
        result(
            List.of(
                table(
                    "snowflake.shop.shopify.orders",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "shopify",
                    List.of("id")),
                table(
                    "snowflake.shop.shopify.customers",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "shopify",
                    List.of("customer_id")),
                syntheticSchemaCount(Entity.TABLE, SNOWFLAKE_SERVICE, "shop", "shopify", 40)),
            List.of());

    LineageScene scene =
        RESOLVER.resolveScene(
            SNOWFLAKE_SERVICE + ".shop",
            Entity.DATABASE,
            LineageLens.SERVICE,
            LineageBand.ASSET,
            lineage,
            200);

    LineageSceneNode shopify = nodeByFqn(scene, SNOWFLAKE_SERVICE + ".shop.shopify");

    assertEquals(40, shopify.getChildrenCount());
    assertEquals(40, shopify.getCounts().get(LineageLevelKind.TABLE.value()));
  }

  @Test
  void subjectAwareAggregationReportProducesNormalizedRootCounts() {
    String rootField = "service.fullyQualifiedName.keyword";
    DataQualityReport report =
        new DataQualityReport()
            .withData(
                List.of(
                    new Datum()
                        .withAdditionalProperty(rootField, "Snowflake")
                        .withAdditionalProperty("entityType", "TABLE")
                        .withAdditionalProperty("document_count", "7"),
                    new Datum()
                        .withAdditionalProperty(rootField, "Snowflake")
                        .withAdditionalProperty("entityType", "TOPIC")
                        .withAdditionalProperty("document_count", "2")));

    LineageSceneResolver.RootAssetCounts result =
        LineageSceneResolver.rootAssetCounts(report, rootField);

    assertEquals(Map.of("snowflake", Map.of(Entity.TABLE, 7, Entity.TOPIC, 2)), result.counts());
    assertFalse(result.truncated());
  }

  @Test
  void subjectAwareAggregationReportProducesNormalizedContainerCounts() {
    String bucketField = "databaseSchema.fullyQualifiedName.keyword";
    DataQualityReport report =
        new DataQualityReport()
            .withData(
                List.of(
                    new Datum()
                        .withAdditionalProperty(bucketField, "Snowflake.Shop.Shopify")
                        .withAdditionalProperty("document_count", "8")));

    assertEquals(
        Map.of("snowflake.shop.shopify", 8),
        LineageSceneResolver.aggregationCounts(report, bucketField));
  }

  @Test
  void sceneAssetSearchRequestRetainsPolicyAwareFieldFilter() {
    SubjectContext subjectContext =
        new SubjectContext(
            new User()
                .withName("restricted-user")
                .withRoles(List.of(new EntityReference().withName("DomainOnlyAccessRole")))
                .withDomains(List.of(new EntityReference().withFullyQualifiedName("Engineering"))),
            null);
    String queryFilter =
        LineageSceneResolver.fieldQuery(
            "service.fullyQualifiedName.keyword",
            "snowflake",
            "upstreamLineage.docId",
            subjectContext);

    SearchRequest request =
        LineageSceneResolver.sceneAssetSearchRequest(
            Entity.TABLE, false, 25, List.of("id", "fullyQualifiedName"), queryFilter);
    JsonNode must = JsonUtils.readTree(request.getQueryFilter()).at("/query/bool/must");

    assertEquals(Entity.TABLE, request.getIndex());
    assertEquals(25, request.getSize());
    assertTrue(Boolean.TRUE.equals(request.getTrackTotalHits()));
    assertFalse(Boolean.TRUE.equals(request.getIncludeAggregations()));
    assertEquals(
        "snowflake", must.get(0).at("/wildcard/service.fullyQualifiedName.keyword/value").asText());
    assertTrue(
        must.get(0)
            .at("/wildcard/service.fullyQualifiedName.keyword/case_insensitive")
            .asBoolean());
    assertEquals("upstreamLineage.docId", must.get(1).at("/exists/field").asText());
    assertEquals(
        "Engineering", must.get(2).at("/bool/should/1/term/domains.fullyQualifiedName").asText());
  }

  @Test
  void domainAccessClauseIncludesAssignedDescendantsAndDomainlessAssets() {
    SubjectContext subjectContext =
        new SubjectContext(
            new User()
                .withName("restricted-user")
                .withRoles(List.of(new EntityReference().withName("DomainOnlyAccessRole")))
                .withDomains(List.of(new EntityReference().withFullyQualifiedName("Engineering"))),
            null);

    JsonNode clause =
        JsonUtils.readTree(
            JsonUtils.pojoToJson(LineageSceneResolver.domainAccessClause(subjectContext)));
    JsonNode conditions = clause.path("bool").path("should");

    assertEquals(3, conditions.size());
    assertEquals(1, clause.path("bool").path("minimum_should_match").asInt());
    assertEquals(
        "domains.fullyQualifiedName",
        conditions.get(0).at("/bool/must_not/0/exists/field").asText());
    assertEquals("Engineering", conditions.get(1).at("/term/domains.fullyQualifiedName").asText());
    assertEquals(
        "Engineering.", conditions.get(2).at("/prefix/domains.fullyQualifiedName").asText());
  }

  @Test
  void rootLineageParticipantQueryIncludesDomainAccessClause() {
    SubjectContext subjectContext =
        new SubjectContext(
            new User()
                .withName("restricted-user")
                .withRoles(List.of(new EntityReference().withName("DomainOnlyAccessRole")))
                .withDomains(List.of(new EntityReference().withFullyQualifiedName("Engineering"))),
            null);

    JsonNode must =
        JsonUtils.readTree(LineageSceneResolver.rootLineageParticipantQuery("", subjectContext))
            .at("/query/bool/must");

    assertEquals(2, must.size());
    assertEquals("upstreamLineage.docId", must.get(0).at("/exists/field").asText());
    assertEquals(
        "Engineering", must.get(1).at("/bool/should/1/term/domains.fullyQualifiedName").asText());
  }

  @Test
  void sceneCacheKeyIncludesTraversalDepths() {
    LineageSceneCache.Key shallow =
        new LineageSceneCache.Key(LineageLens.SERVICE, LineageBand.LAYER, 1, 1, 100, "", false);
    LineageSceneCache.Key deeperUpstream =
        new LineageSceneCache.Key(LineageLens.SERVICE, LineageBand.LAYER, 2, 1, 100, "", false);
    LineageSceneCache.Key deeperDownstream =
        new LineageSceneCache.Key(LineageLens.SERVICE, LineageBand.LAYER, 1, 2, 100, "", false);

    assertNotEquals(shallow, deeperUpstream);
    assertNotEquals(shallow, deeperDownstream);
  }

  @Test
  void sceneCacheTreatsNullKeyAsMiss() {
    LineageSceneCache cache = new LineageSceneCache(LineageGraphConfiguration.getDefault());

    assertTrue(cache.get(null).isEmpty());
  }

  @Test
  void bestEffortTasksSkipIndividualIoFailures() throws IOException {
    List<LineageSceneResolver.IOTask<String>> tasks =
        List.of(
            LineageSceneResolver.bestEffortTask("first child", () -> "first"),
            LineageSceneResolver.bestEffortTask(
                "failed child",
                () -> {
                  throw new IOException("transient search failure");
                }),
            LineageSceneResolver.bestEffortTask("last child", () -> "last"));

    assertEquals(List.of("first", "last"), LineageSceneResolver.runBounded(tasks, 2));
  }

  @Test
  void duplicateEdgeAcrossDirectionMapsHasConcreteWeightOne() {
    EsLineageData concreteEdge = edge("same-edge", ORDERS, Entity.TABLE, CUSTOMERS, Entity.TABLE);
    SearchLineageResult lineage =
        result(
            List.of(
                table(ORDERS, SNOWFLAKE_SERVICE, List.of("id")),
                table(CUSTOMERS, SNOWFLAKE_SERVICE, List.of("customer_id"))),
            List.of(concreteEdge));
    lineage.withUpstreamEdges(new LinkedHashMap<>(Map.of("upstream-copy", concreteEdge)));

    LineageScene scene =
        RESOLVER.resolveScene(
            ORDERS, Entity.TABLE, LineageLens.SERVICE, LineageBand.ASSET, lineage, 200);

    assertEquals(1, scene.getEdges().size());
    assertEquals(1, scene.getEdges().get(0).getWeight());
    assertFalse(Boolean.TRUE.equals(scene.getEdges().get(0).getIsRollup()));
  }

  @Test
  void concreteEdgeCarriesPipelineAndDescription() {
    EntityReference pipeline =
        new EntityReference()
            .withId(uuid("daily-pipeline"))
            .withType(Entity.PIPELINE)
            .withName("daily-pipeline");
    EsLineageData concreteEdge =
        edge("edge-details", ORDERS, Entity.TABLE, CUSTOMERS, Entity.TABLE)
            .withDescription("Curated orders")
            .withPipeline(pipeline);
    SearchLineageResult lineage =
        result(
            List.of(
                table(ORDERS, SNOWFLAKE_SERVICE, List.of("id")),
                table(CUSTOMERS, SNOWFLAKE_SERVICE, List.of("customer_id"))),
            List.of(concreteEdge));

    LineageScene scene =
        RESOLVER.resolveScene(
            ORDERS, Entity.TABLE, LineageLens.SERVICE, LineageBand.ASSET, lineage, 200);

    assertEquals("Curated orders", scene.getEdges().get(0).getDescription());
    assertEquals(pipeline, scene.getEdges().get(0).getPipeline());
  }

  @Test
  void assetSceneExpandsTemporaryLineageTableHops() {
    String rawOrders = "sample_data.ecommerce_db.shopify.raw_order";
    String factOrders = "sample_data.ecommerce_db.shopify.fact_orders";
    EsLineageData concreteEdge =
        edge("temp-lineage", rawOrders, Entity.TABLE, factOrders, Entity.TABLE)
            .withTempLineageTables(
                List.of(
                    new TempLineageTable()
                        .withFromEntity(rawOrders)
                        .withToEntity("tmp_order_staging"),
                    new TempLineageTable()
                        .withFromEntity("tmp_order_staging")
                        .withToEntity("tmp_order_enriched"),
                    new TempLineageTable()
                        .withFromEntity("tmp_order_enriched")
                        .withToEntity(factOrders)));
    SearchLineageResult lineage =
        result(
            List.of(
                table(rawOrders, "sample_data", "ecommerce_db", "shopify", List.of("id")),
                table(factOrders, "sample_data", "ecommerce_db", "shopify", List.of("id"))),
            List.of(concreteEdge));

    LineageScene scene =
        RESOLVER.resolveScene(
            rawOrders, Entity.TABLE, LineageLens.SERVICE, LineageBand.ASSET, lineage, 200);

    Map<String, String> nodeIds = nodeIdsByFqn(scene);
    Set<String> sceneEdges =
        scene.getEdges().stream()
            .map(edge -> edge.getFrom() + "->" + edge.getTo())
            .collect(Collectors.toSet());

    assertEquals(4, scene.getNodes().size());
    assertEquals(3, scene.getEdges().size());
    assertTrue(
        Boolean.TRUE.equals(
            nodeByFqn(scene, "tmp_order_staging").getSourceEntity().get("isTempTable")));
    assertTrue(
        Boolean.TRUE.equals(
            nodeByFqn(scene, "tmp_order_enriched").getSourceEntity().get("isTempTable")));
    assertTrue(
        sceneEdges.contains(nodeIds.get(rawOrders) + "->" + nodeIds.get("tmp_order_staging")));
    assertTrue(
        sceneEdges.contains(
            nodeIds.get("tmp_order_staging") + "->" + nodeIds.get("tmp_order_enriched")));
    assertTrue(
        sceneEdges.contains(nodeIds.get("tmp_order_enriched") + "->" + nodeIds.get(factOrders)));
    assertFalse(sceneEdges.contains(nodeIds.get(rawOrders) + "->" + nodeIds.get(factOrders)));
  }

  @Test
  void assetSceneAppliesNodeLimitToTemporaryLineageTableHops() {
    String rawOrders = "sample_data.ecommerce_db.shopify.raw_order";
    String factOrders = "sample_data.ecommerce_db.shopify.fact_orders";
    EsLineageData concreteEdge =
        edge("temp-lineage", rawOrders, Entity.TABLE, factOrders, Entity.TABLE)
            .withTempLineageTables(
                List.of(
                    new TempLineageTable()
                        .withFromEntity(rawOrders)
                        .withToEntity("tmp_order_staging"),
                    new TempLineageTable()
                        .withFromEntity("tmp_order_staging")
                        .withToEntity("tmp_order_enriched"),
                    new TempLineageTable()
                        .withFromEntity("tmp_order_enriched")
                        .withToEntity(factOrders)));
    SearchLineageResult lineage =
        result(
            List.of(
                table(rawOrders, "sample_data", "ecommerce_db", "shopify", List.of("id")),
                table(factOrders, "sample_data", "ecommerce_db", "shopify", List.of("id"))),
            List.of(concreteEdge));

    LineageScene scene =
        RESOLVER.resolveScene(
            rawOrders, Entity.TABLE, LineageLens.SERVICE, LineageBand.ASSET, lineage, 3);

    Set<String> visibleNodeIds =
        scene.getNodes().stream().map(LineageSceneNode::getId).collect(Collectors.toSet());

    assertEquals(3, scene.getNodes().size());
    assertEquals(1, scene.getHiddenNodeCount());
    assertTrue(
        scene.getEdges().stream()
            .allMatch(
                edge ->
                    visibleNodeIds.contains(edge.getFrom())
                        && visibleNodeIds.contains(edge.getTo())));
  }

  @Test
  void concreteEdgeIgnoresAdditionalPipelineFields() {
    UUID pipelineId = uuid("daily-pipeline");
    Map<String, Object> pipeline =
        Map.of(
            "id",
            pipelineId.toString(),
            "type",
            Entity.PIPELINE,
            "name",
            "daily-pipeline",
            "serviceType",
            "Airflow");
    EsLineageData concreteEdge =
        edge("edge-details", ORDERS, Entity.TABLE, CUSTOMERS, Entity.TABLE).withPipeline(pipeline);
    SearchLineageResult lineage =
        result(
            List.of(
                table(ORDERS, SNOWFLAKE_SERVICE, List.of("id")),
                table(CUSTOMERS, SNOWFLAKE_SERVICE, List.of("customer_id"))),
            List.of(concreteEdge));

    LineageScene scene =
        RESOLVER.resolveScene(
            ORDERS, Entity.TABLE, LineageLens.SERVICE, LineageBand.ASSET, lineage, 200);

    EntityReference scenePipeline = scene.getEdges().get(0).getPipeline();
    assertNotNull(scenePipeline);
    assertEquals(pipelineId, scenePipeline.getId());
    assertEquals(Entity.PIPELINE, scenePipeline.getType());
    assertEquals("daily-pipeline", scenePipeline.getName());
  }

  @Test
  void sourceEntityPayloadIsTrimmedByBand() {
    Map<String, Object> entity = table(ORDERS, SNOWFLAKE_SERVICE, List.of("id"));
    entity.put("owners", List.of(ref(Entity.USER, "owner", "owner")));
    entity.put("upstreamLineage", List.of(Map.of("docId", "edge-id")));

    Map<String, Object> assetPayload =
        LineageSceneResolver.trimSourceEntity(entity, LineageBand.ASSET);
    Map<String, Object> fieldPayload =
        LineageSceneResolver.trimSourceEntity(entity, LineageBand.FIELD);

    assertTrue(assetPayload.containsKey("id"));
    assertFalse(assetPayload.containsKey("columns"));
    assertFalse(assetPayload.containsKey("owners"));
    assertFalse(assetPayload.containsKey("upstreamLineage"));
    assertTrue(fieldPayload.containsKey("columns"));
    assertFalse(fieldPayload.containsKey("upstreamLineage"));
  }

  @Test
  void storedProcedureAndDashboardDataModelAreAssetKinds() {
    String procedureFqn = "snowflake.shop.public.refresh_orders";
    String modelFqn = "powerbi.sales.sales_model";
    SearchLineageResult lineage =
        result(
            List.of(
                asset(Entity.STORED_PROCEDURE, procedureFqn, SNOWFLAKE_SERVICE, "snowflake"),
                asset(Entity.DASHBOARD_DATA_MODEL, modelFqn, POWERBI_SERVICE, "powerbi")),
            List.of(
                edge(
                    "procedure-model",
                    procedureFqn,
                    Entity.STORED_PROCEDURE,
                    modelFqn,
                    Entity.DASHBOARD_DATA_MODEL)));

    LineageScene scene =
        RESOLVER.resolveScene(
            procedureFqn,
            Entity.STORED_PROCEDURE,
            LineageLens.SERVICE,
            LineageBand.ASSET,
            lineage,
            200);

    assertTrue(
        scene.getNodes().stream()
            .anyMatch(node -> node.getLevelKind() == LineageLevelKind.STORED_PROCEDURE));
    assertTrue(
        scene.getNodes().stream()
            .anyMatch(node -> node.getLevelKind() == LineageLevelKind.DASHBOARD_DATA_MODEL));
  }

  @Test
  void truncationPinsFocusThenRanksByChildrenCount() {
    String wideTable = "snowflake.shop.public.wide_table";
    String narrowTable = "snowflake.shop.public.narrow_table";
    SearchLineageResult lineage =
        result(
            List.of(
                table(ORDERS, SNOWFLAKE_SERVICE, List.of("id")),
                table(wideTable, SNOWFLAKE_SERVICE, numberedColumns("wide_", 8)),
                table(narrowTable, SNOWFLAKE_SERVICE, List.of("narrow"))),
            List.of());

    LineageScene scene =
        RESOLVER.resolveScene(
            ORDERS, Entity.TABLE, LineageLens.SERVICE, LineageBand.FIELD, lineage, 2);

    assertEquals(2, scene.getNodes().size());
    assertTrue(
        scene.getNodes().stream().anyMatch(node -> ORDERS.equals(node.getFullyQualifiedName())));
    assertTrue(
        scene.getNodes().stream().anyMatch(node -> wideTable.equals(node.getFullyQualifiedName())));
    assertFalse(
        scene.getNodes().stream()
            .anyMatch(node -> narrowTable.equals(node.getFullyQualifiedName())));
  }

  @Test
  void serviceFocusedRelationalSceneProjectsTableEdgesToDatabaseEdges() {
    String shopOrders = "snowflake.shop.collate_shop.orders";
    String financeAccounts = "snowflake.finance.banking.accounts";
    SearchLineageResult lineage =
        result(
            List.of(
                table(shopOrders, SNOWFLAKE_SERVICE, "shop", "collate_shop", List.of("id")),
                table(
                    financeAccounts,
                    SNOWFLAKE_SERVICE,
                    "finance",
                    "banking",
                    List.of("account_id"))),
            List.of(
                edge("database-rollup", shopOrders, Entity.TABLE, financeAccounts, Entity.TABLE)));

    LineageScene scene =
        RESOLVER.resolveScene(
            SNOWFLAKE_SERVICE,
            Entity.DATABASE_SERVICE,
            LineageLens.SERVICE,
            LineageBand.ASSET,
            lineage,
            200);

    Map<String, String> nodeIdsByFqn = nodeIdsByFqn(scene);
    LineageSceneEdge rollup = scene.getEdges().get(0);

    assertEquals(LineageBand.ASSET, scene.getBand());
    assertEquals(2, scene.getNodes().size());
    assertTrue(
        scene.getNodes().stream()
            .allMatch(node -> node.getLevelKind() == LineageLevelKind.DATABASE));
    assertTrue(Boolean.TRUE.equals(rollup.getIsRollup()));
    assertEquals(nodeIdsByFqn.get("snowflake.shop"), rollup.getFrom());
    assertEquals(nodeIdsByFqn.get("snowflake.finance"), rollup.getTo());
  }

  @Test
  void databaseFocusedRelationalSceneProjectsTableEdgesToSchemaEdges() {
    String orders = "snowflake.shop.collate_shop.orders";
    String accounts = "snowflake.shop.banking.accounts";
    SearchLineageResult lineage =
        result(
            List.of(
                table(orders, SNOWFLAKE_SERVICE, "shop", "collate_shop", List.of("id")),
                table(accounts, SNOWFLAKE_SERVICE, "shop", "banking", List.of("account_id"))),
            List.of(edge("schema-rollup", orders, Entity.TABLE, accounts, Entity.TABLE)));

    LineageScene scene =
        RESOLVER.resolveScene(
            SNOWFLAKE_SERVICE + ".shop",
            Entity.DATABASE,
            LineageLens.SERVICE,
            LineageBand.ASSET,
            lineage,
            200);

    Map<String, String> nodeIdsByFqn = nodeIdsByFqn(scene);
    LineageSceneEdge rollup = scene.getEdges().get(0);

    assertEquals(LineageBand.ASSET, scene.getBand());
    assertEquals(2, scene.getNodes().size());
    assertTrue(
        scene.getNodes().stream().allMatch(node -> node.getLevelKind() == LineageLevelKind.SCHEMA));
    assertTrue(Boolean.TRUE.equals(rollup.getIsRollup()));
    assertEquals(nodeIdsByFqn.get("snowflake.shop.collate_shop"), rollup.getFrom());
    assertEquals(nodeIdsByFqn.get("snowflake.shop.banking"), rollup.getTo());
  }

  @Test
  void schemaFocusedSceneProjectsIndexedUpstreamLineageBetweenTables() {
    String rawOrder = "snowflake.shop.shopify.raw_order";
    String factOrder = "snowflake.shop.shopify.fact_order";
    Map<String, Object> factOrderTable =
        table(factOrder, SNOWFLAKE_SERVICE, "shop", "shopify", List.of("id"));
    factOrderTable.put(
        "upstreamLineage", List.of(indexedUpstreamEdge("raw-fact", rawOrder, Entity.TABLE)));

    SearchLineageResult lineage =
        result(
            List.of(
                table(rawOrder, SNOWFLAKE_SERVICE, "shop", "shopify", List.of("id")),
                factOrderTable),
            List.of());

    LineageScene scene =
        RESOLVER.resolveScene(
            SNOWFLAKE_SERVICE + ".shop.shopify",
            Entity.DATABASE_SCHEMA,
            LineageLens.SERVICE,
            LineageBand.ASSET,
            lineage,
            200);

    Map<String, String> nodeIdsByFqn = nodeIdsByFqn(scene);
    LineageSceneEdge edge = scene.getEdges().get(0);

    assertEquals(LineageBand.ASSET, scene.getBand());
    assertEquals(2, scene.getNodes().size());
    assertEquals(1, scene.getEdges().size());
    assertEquals(nodeIdsByFqn.get(rawOrder), edge.getFrom());
    assertEquals(nodeIdsByFqn.get(factOrder), edge.getTo());
  }

  @Test
  void serviceFocusedSceneSeedsContainedChildrenWhenParentRollupEdgesExist() {
    SearchLineageResult lineage =
        result(
            List.of(
                service(SNOWFLAKE_SERVICE, Entity.DATABASE_SERVICE, "snowflake"),
                service(POWERBI_SERVICE, Entity.DASHBOARD_SERVICE, "powerbi"),
                table(
                    "snowflake.shop.collate_shop.orders",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "collate_shop",
                    List.of("id")),
                table(
                    "snowflake.shop.banking.accounts",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "banking",
                    List.of("account_id")),
                table(
                    "snowflake.shop.analytics.daily_sales",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "analytics",
                    List.of("sale_id"))),
            List.of(
                edge(
                    "service-rollup",
                    SNOWFLAKE_SERVICE,
                    Entity.DATABASE_SERVICE,
                    POWERBI_SERVICE,
                    Entity.DASHBOARD_SERVICE)));

    LineageScene scene =
        RESOLVER.resolveScene(
            SNOWFLAKE_SERVICE,
            Entity.DATABASE_SERVICE,
            LineageLens.SERVICE,
            LineageBand.ASSET,
            lineage,
            200);

    assertEquals(LineageBand.ASSET, scene.getBand());
    assertEquals(1, scene.getNodes().size());
    assertTrue(
        scene.getNodes().stream()
            .allMatch(node -> node.getLevelKind() == LineageLevelKind.DATABASE));
    assertTrue(scene.getEdges().isEmpty());
  }

  @Test
  void serviceFocusedSceneTruncatesContainedChildren() {
    SearchLineageResult lineage =
        result(
            List.of(
                table(
                    "snowflake.shop.collate_shop.orders",
                    SNOWFLAKE_SERVICE,
                    "shop",
                    "collate_shop",
                    List.of("id")),
                table(
                    "snowflake.finance.banking.accounts",
                    SNOWFLAKE_SERVICE,
                    "finance",
                    "banking",
                    List.of("account_id")),
                table(
                    "snowflake.analytics.analytics.daily_sales",
                    SNOWFLAKE_SERVICE,
                    "analytics",
                    "analytics",
                    List.of("sale_id"))),
            List.of());

    LineageScene scene =
        RESOLVER.resolveScene(
            SNOWFLAKE_SERVICE,
            Entity.DATABASE_SERVICE,
            LineageLens.SERVICE,
            LineageBand.ASSET,
            lineage,
            2);

    assertEquals(2, scene.getNodes().size());
    assertEquals(1, scene.getHiddenNodeCount());
    assertTrue(
        scene.getNodes().stream()
            .allMatch(node -> node.getLevelKind() == LineageLevelKind.DATABASE));
  }

  @Test
  void fieldSceneResolvesBareColumnNamesToFieldEndpoints() {
    SearchLineageResult lineage =
        result(
            List.of(
                table(ORDERS, SNOWFLAKE_SERVICE, List.of("id")),
                table(CUSTOMERS, SNOWFLAKE_SERVICE, List.of("customer_id"))),
            List.of(
                edge(
                    "column-edge",
                    ORDERS,
                    Entity.TABLE,
                    CUSTOMERS,
                    Entity.TABLE,
                    new ColumnLineage()
                        .withFromColumns(List.of("id"))
                        .withToColumn("customer_id"))));

    LineageScene scene =
        RESOLVER.resolveScene(
            ORDERS, Entity.TABLE, LineageLens.SERVICE, LineageBand.FIELD, lineage, 200);

    assertEquals(LineageBand.FIELD, scene.getBand());
    assertEquals(2, scene.getNodes().size());
    assertTrue(scene.getNodes().stream().allMatch(node -> node.getFields().size() == 1));
    LineageSceneEdge fieldEdge = scene.getEdges().get(0);
    assertTrue(fieldEdge.getFrom().endsWith("::field::" + ORDERS + ".id"));
    assertTrue(fieldEdge.getTo().endsWith("::field::" + CUSTOMERS + ".customer_id"));
  }

  @Test
  void fieldSceneIncludesApiEndpointRequestAndResponseSchemaFields() {
    String endpointFqn = "api.service.collection.endpoint";
    Map<String, Object> endpoint = asset(Entity.API_ENDPOINT, endpointFqn, "api-service", "rest");
    endpoint.put(
        "requestSchema", Map.of("schemaFields", List.of(column(endpointFqn, "request_id"))));
    endpoint.put(
        "responseSchema", Map.of("schemaFields", List.of(column(endpointFqn, "response_id"))));

    LineageScene scene =
        RESOLVER.resolveScene(
            endpointFqn,
            Entity.API_ENDPOINT,
            LineageLens.SERVICE,
            LineageBand.FIELD,
            result(List.of(endpoint), List.of()),
            200);

    LineageSceneNode endpointNode = nodeByFqn(scene, endpointFqn);
    assertEquals(
        Set.of("request_id", "response_id"),
        endpointNode.getFields().stream()
            .map(LineageSceneField::getName)
            .collect(Collectors.toSet()));

    Map<String, Object> fieldPayload =
        LineageSceneResolver.trimSourceEntity(endpoint, LineageBand.FIELD);
    assertTrue(fieldPayload.containsKey("requestSchema"));
    assertTrue(fieldPayload.containsKey("responseSchema"));
  }

  @Test
  void fieldScenePrefersExactApiEndpointFieldFqnWhenSchemaFieldsShareName() {
    String endpointFqn = "api.service.collection.endpoint";
    String requestFieldFqn = endpointFqn + ".requestSchema.default";
    String responseFieldFqn = endpointFqn + ".responseSchema.default";
    Map<String, Object> endpoint = asset(Entity.API_ENDPOINT, endpointFqn, "api-service", "rest");
    endpoint.put(
        "requestSchema",
        Map.of("schemaFields", List.of(column(endpointFqn + ".requestSchema", "default"))));
    endpoint.put(
        "responseSchema",
        Map.of("schemaFields", List.of(column(endpointFqn + ".responseSchema", "default"))));

    SearchLineageResult lineage =
        result(
            List.of(table(ORDERS, SNOWFLAKE_SERVICE, List.of("id")), endpoint),
            List.of(
                edge(
                    "api-column-edge",
                    ORDERS,
                    Entity.TABLE,
                    endpointFqn,
                    Entity.API_ENDPOINT,
                    new ColumnLineage()
                        .withFromColumns(List.of(ORDERS + ".id"))
                        .withToColumn(responseFieldFqn))));

    LineageScene scene =
        RESOLVER.resolveScene(
            ORDERS, Entity.TABLE, LineageLens.SERVICE, LineageBand.FIELD, lineage, 200);

    LineageSceneEdge fieldEdge = scene.getEdges().get(0);
    assertTrue(fieldEdge.getTo().endsWith("::field::" + responseFieldFqn));
    assertFalse(fieldEdge.getTo().endsWith("::field::" + requestFieldFqn));
  }

  @Test
  void fieldSceneCapsVisibleFieldsToCurrentPageSize() {
    List<String> sourceColumns = numberedColumns("source_", 12);
    List<String> targetColumns = numberedColumns("target_", 12);
    List<ColumnLineage> columnLineage =
        IntStream.range(0, 12)
            .mapToObj(
                index ->
                    new ColumnLineage()
                        .withFromColumns(List.of(sourceColumns.get(index)))
                        .withToColumn(targetColumns.get(index)))
            .toList();
    SearchLineageResult lineage =
        result(
            List.of(
                table(ORDERS, SNOWFLAKE_SERVICE, sourceColumns),
                table(CUSTOMERS, SNOWFLAKE_SERVICE, targetColumns)),
            List.of(
                edge(
                    "wide-column-edge",
                    ORDERS,
                    Entity.TABLE,
                    CUSTOMERS,
                    Entity.TABLE,
                    columnLineage)));

    LineageScene scene =
        RESOLVER.resolveScene(
            ORDERS, Entity.TABLE, LineageLens.SERVICE, LineageBand.FIELD, lineage, 200);

    assertEquals(10, scene.getEdges().size());
    assertTrue(scene.getNodes().stream().allMatch(node -> node.getFields().size() == 10));
    assertTrue(scene.getNodes().stream().allMatch(node -> node.getHiddenChildrenCount() == 2));
  }

  private static SearchLineageResult result(
      List<Map<String, Object>> entities, List<EsLineageData> edges) {
    Map<String, NodeInformation> nodes = new LinkedHashMap<>();
    for (Map<String, Object> entity : entities) {
      nodes.put(
          String.valueOf(entity.get("fullyQualifiedName")),
          new NodeInformation().withEntity(entity));
    }
    Map<String, EsLineageData> downstreamEdges = new LinkedHashMap<>();
    for (EsLineageData edge : edges) {
      downstreamEdges.put(edge.getDocUniqueId(), edge);
    }
    return new SearchLineageResult().withNodes(nodes).withDownstreamEdges(downstreamEdges);
  }

  private static Map<String, String> nodeIdsByFqn(LineageScene scene) {
    Map<String, String> nodeIdsByFqn = new LinkedHashMap<>();
    scene.getNodes().forEach(node -> nodeIdsByFqn.put(node.getFullyQualifiedName(), node.getId()));
    return nodeIdsByFqn;
  }

  private static LineageSceneNode nodeByFqn(LineageScene scene, String fqn) {
    return scene.getNodes().stream()
        .filter(node -> fqn.equals(node.getFullyQualifiedName()))
        .findFirst()
        .orElseThrow();
  }

  private static EsLineageData edge(
      String id, String fromFqn, String fromType, String toFqn, String toType) {
    return edge(id, fromFqn, fromType, toFqn, toType, (ColumnLineage) null);
  }

  private static EsLineageData indexedUpstreamEdge(String id, String fromFqn, String fromType) {
    return new EsLineageData()
        .withDocUniqueId(id)
        .withSource("Manual")
        .withFromEntity(relationshipRef(fromFqn, fromType));
  }

  private static EsLineageData edge(
      String id,
      String fromFqn,
      String fromType,
      String toFqn,
      String toType,
      ColumnLineage columnLineage) {
    EsLineageData edge =
        new EsLineageData()
            .withDocUniqueId(id)
            .withSource("Manual")
            .withFromEntity(relationshipRef(fromFqn, fromType))
            .withToEntity(relationshipRef(toFqn, toType));
    if (columnLineage != null) {
      edge.withColumns(List.of(columnLineage));
    }
    return edge;
  }

  private static EsLineageData edge(
      String id,
      String fromFqn,
      String fromType,
      String toFqn,
      String toType,
      List<ColumnLineage> columnLineage) {
    EsLineageData edge =
        new EsLineageData()
            .withDocUniqueId(id)
            .withSource("Manual")
            .withFromEntity(relationshipRef(fromFqn, fromType))
            .withToEntity(relationshipRef(toFqn, toType));
    if (columnLineage != null) {
      edge.withColumns(columnLineage);
    }
    return edge;
  }

  private static Map<String, Object> table(
      String fqn, String serviceName, List<String> columnNames) {
    return table(fqn, serviceName, "shop", "public", columnNames);
  }

  private static Map<String, Object> table(
      String fqn,
      String serviceName,
      String databaseName,
      String schemaName,
      List<String> columnNames) {
    Map<String, Object> entity = asset(Entity.TABLE, fqn, serviceName, "snowflake");
    entity.put("database", ref(Entity.DATABASE, serviceName + "." + databaseName, databaseName));
    entity.put(
        "databaseSchema",
        ref(
            Entity.DATABASE_SCHEMA,
            serviceName + "." + databaseName + "." + schemaName,
            schemaName));
    entity.put("columns", columnNames.stream().map(name -> column(fqn, name)).toList());
    return entity;
  }

  private static Map<String, Object> topic(String fqn, String serviceName) {
    return asset(Entity.TOPIC, fqn, serviceName, "kafka");
  }

  private static Map<String, Object> dashboard(String fqn) {
    return asset(Entity.DASHBOARD, fqn, POWERBI_SERVICE, "powerbi");
  }

  private static Map<String, Object> service(String fqn, String entityType, String serviceType) {
    Map<String, Object> entity = new LinkedHashMap<>();
    entity.put("id", id(fqn));
    entity.put("name", fqn.substring(fqn.lastIndexOf('.') + 1));
    entity.put("fullyQualifiedName", fqn);
    entity.put("entityType", entityType);
    entity.put("serviceType", serviceType);
    return entity;
  }

  private static Map<String, Object> rootEntity(String entityType, String fqn) {
    Map<String, Object> entity = new LinkedHashMap<>();
    entity.put("id", id(fqn));
    entity.put("name", fqn);
    entity.put("fullyQualifiedName", fqn);
    entity.put("entityType", entityType);
    return entity;
  }

  private static Map<String, Object> asset(
      String entityType, String fqn, String serviceName, String serviceType) {
    Map<String, Object> entity = new LinkedHashMap<>();
    entity.put("id", id(fqn));
    entity.put("name", fqn.substring(fqn.lastIndexOf('.') + 1));
    entity.put("fullyQualifiedName", fqn);
    entity.put("entityType", entityType);
    entity.put("serviceType", serviceType);
    entity.put("service", serviceRef(serviceName, serviceType));
    return entity;
  }

  private static Map<String, Object> syntheticCount(
      String entityType, String serviceName, int count) {
    Map<String, Object> entity =
        asset(
            entityType,
            "__lineage_scene_count__." + serviceName + "." + entityType,
            serviceName,
            "snowflake");
    entity.put("lineageSceneCount", count);
    entity.put("lineageSceneSyntheticCount", true);
    return entity;
  }

  private static Map<String, Object> syntheticLensCount(
      String entityType, String lensField, String lensEntityType, String lensFqn, int count) {
    Map<String, Object> entity =
        rootEntity(entityType, "__lineage_scene_count__." + lensFqn + "." + entityType);
    entity.put("lineageSceneCount", count);
    entity.put("lineageSceneSyntheticCount", true);
    entity.put(lensField, List.of(ref(lensEntityType, lensFqn, lensFqn)));
    return entity;
  }

  private static Map<String, Object> syntheticDatabaseCount(
      String entityType, String serviceName, String databaseName, int count) {
    Map<String, Object> entity =
        syntheticCount(
            entityType, "__lineage_scene_count__." + serviceName + "." + databaseName, count);
    entity.put("service", serviceRef(serviceName, "snowflake"));
    entity.put("database", ref(Entity.DATABASE, serviceName + "." + databaseName, databaseName));
    return entity;
  }

  private static Map<String, Object> syntheticSchemaCount(
      String entityType, String serviceName, String databaseName, String schemaName, int count) {
    Map<String, Object> entity =
        syntheticDatabaseCount(entityType, serviceName, databaseName + "." + schemaName, count);
    entity.put("database", ref(Entity.DATABASE, serviceName + "." + databaseName, databaseName));
    entity.put(
        "databaseSchema",
        ref(
            Entity.DATABASE_SCHEMA,
            serviceName + "." + databaseName + "." + schemaName,
            schemaName));
    return entity;
  }

  private static Map<String, Object> column(String assetFqn, String name) {
    Map<String, Object> column = new LinkedHashMap<>();
    column.put("name", name);
    column.put("fullyQualifiedName", assetFqn + "." + name);
    column.put("dataType", "INT");
    return column;
  }

  private static List<String> numberedColumns(String prefix, int count) {
    return IntStream.range(0, count).mapToObj(index -> prefix + index).toList();
  }

  private static Map<String, Object> serviceRef(String name, String serviceType) {
    return switch (serviceType) {
      case "kafka" -> ref(Entity.MESSAGING_SERVICE, name, name);
      case "powerbi" -> ref(Entity.DASHBOARD_SERVICE, name, name);
      default -> ref(Entity.DATABASE_SERVICE, name, name);
    };
  }

  private static Map<String, Object> ref(String type, String fqn, String name) {
    Map<String, Object> ref = new LinkedHashMap<>();
    ref.put("id", id(fqn));
    ref.put("type", type);
    ref.put("name", name);
    ref.put("fullyQualifiedName", fqn);
    return ref;
  }

  private static RelationshipRef relationshipRef(String fqn, String type) {
    return new RelationshipRef().withId(uuid(fqn)).withType(type).withFullyQualifiedName(fqn);
  }

  private static String id(String value) {
    return uuid(value).toString();
  }

  private static UUID uuid(String value) {
    return UUID.nameUUIDFromBytes(value.getBytes(StandardCharsets.UTF_8));
  }
}
