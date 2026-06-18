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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.api.lineage.LineageLevelKind;
import org.openmetadata.schema.api.lineage.LineageScene;
import org.openmetadata.schema.api.lineage.LineageSceneEdge;
import org.openmetadata.schema.api.lineage.LineageSceneNode;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.service.Entity;

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
