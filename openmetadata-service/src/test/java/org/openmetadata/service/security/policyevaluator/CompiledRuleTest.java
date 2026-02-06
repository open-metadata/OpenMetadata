package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.ALL_RESOURCES;
import static org.openmetadata.service.Entity.DATA_ASSETS;
import static org.openmetadata.service.Entity.DATA_ASSET_TYPES;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.policies.accessControl.Rule;

class CompiledRuleTest {
  private static final List<String> RESOURCE_LIST =
      listOf("all", "table", "topic", "database", "databaseService");

  @Test
  void testResourceMatchAll() {
    // Rule with resource set to ALL_RESOURCES matches all the resources
    CompiledRule rule =
        new CompiledRule(new Rule().withName("test").withResources(List.of(ALL_RESOURCES)));
    for (String resourceName : RESOURCE_LIST) {
      assertTrue(rule.matchResource(resourceName));
    }
  }

  @Test
  void testResourceMatch() {
    // Create a random list of resources
    Random random = new Random();
    Set<String> ruleResources = new HashSet<>();
    for (int i = 0; i < 3; i++) {
      String res = RESOURCE_LIST.get(random.nextInt(4));
      if (!res.equalsIgnoreCase(ALL_RESOURCES)) {
        ruleResources.add(res);
      }
    }

    assertTrue(ruleResources.size() > 0); // Ensure we are setting at least one resource in a rule

    CompiledRule rule =
        new CompiledRule(new Rule().withName("test").withResources(new ArrayList<>(ruleResources)));
    for (String resource : RESOURCE_LIST) {
      assertEquals(
          rule.matchResource(resource),
          ruleResources.contains(resource),
          "Resource name " + resource + " not matched");
    }
  }

  @Test
  void testResourceMatchDataAssets() {
    // Rule with resource set to DATA_ASSETS should match only data asset types
    CompiledRule rule =
        new CompiledRule(new Rule().withName("test").withResources(List.of(DATA_ASSETS)));

    // Data assets should match
    assertTrue(rule.matchResource("table"), "table should match dataAsset");
    assertTrue(rule.matchResource("topic"), "topic should match dataAsset");
    assertTrue(rule.matchResource("database"), "database should match dataAsset");
    assertTrue(rule.matchResource("databaseSchema"), "databaseSchema should match dataAsset");
    assertTrue(rule.matchResource("dashboard"), "dashboard should match dataAsset");
    assertTrue(rule.matchResource("pipeline"), "pipeline should match dataAsset");
    assertTrue(rule.matchResource("mlmodel"), "mlmodel should match dataAsset");
    assertTrue(rule.matchResource("container"), "container should match dataAsset");
    assertTrue(rule.matchResource("searchIndex"), "searchIndex should match dataAsset");

    // Services should NOT match
    assertFalse(
        rule.matchResource("databaseService"), "databaseService should NOT match dataAsset");
    assertFalse(
        rule.matchResource("messagingService"), "messagingService should NOT match dataAsset");
    assertFalse(
        rule.matchResource("dashboardService"), "dashboardService should NOT match dataAsset");
    assertFalse(
        rule.matchResource("pipelineService"), "pipelineService should NOT match dataAsset");
    assertFalse(rule.matchResource("mlmodelService"), "mlmodelService should NOT match dataAsset");
    assertFalse(rule.matchResource("storageService"), "storageService should NOT match dataAsset");

    // Administrative entities should NOT match
    assertFalse(rule.matchResource("user"), "user should NOT match dataAsset");
    assertFalse(rule.matchResource("team"), "team should NOT match dataAsset");
    assertFalse(rule.matchResource("role"), "role should NOT match dataAsset");
    assertFalse(rule.matchResource("policy"), "policy should NOT match dataAsset");
  }

  @Test
  void testDataAssetTypesIncludesExpectedEntities() {
    // Verify the DATA_ASSET_TYPES set includes the expected entity types
    assertTrue(DATA_ASSET_TYPES.contains("table"));
    assertTrue(DATA_ASSET_TYPES.contains("topic"));
    assertTrue(DATA_ASSET_TYPES.contains("database"));
    assertTrue(DATA_ASSET_TYPES.contains("databaseSchema"));
    assertTrue(DATA_ASSET_TYPES.contains("dashboard"));
    assertTrue(DATA_ASSET_TYPES.contains("pipeline"));
    assertTrue(DATA_ASSET_TYPES.contains("mlmodel"));
    assertTrue(DATA_ASSET_TYPES.contains("container"));
    assertTrue(DATA_ASSET_TYPES.contains("searchIndex"));
    assertTrue(DATA_ASSET_TYPES.contains("chart"));
    assertTrue(DATA_ASSET_TYPES.contains("dashboardDataModel"));
    assertTrue(DATA_ASSET_TYPES.contains("storedProcedure"));
    assertTrue(DATA_ASSET_TYPES.contains("glossaryTerm"));
    assertTrue(DATA_ASSET_TYPES.contains("tag"));
    assertTrue(DATA_ASSET_TYPES.contains("metric"));

    // Verify services are NOT in DATA_ASSET_TYPES
    assertFalse(DATA_ASSET_TYPES.contains("databaseService"));
    assertFalse(DATA_ASSET_TYPES.contains("messagingService"));
    assertFalse(DATA_ASSET_TYPES.contains("dashboardService"));
    assertFalse(DATA_ASSET_TYPES.contains("pipelineService"));
    assertFalse(DATA_ASSET_TYPES.contains("mlmodelService"));
    assertFalse(DATA_ASSET_TYPES.contains("storageService"));

    // Verify administrative entities are NOT in DATA_ASSET_TYPES
    assertFalse(DATA_ASSET_TYPES.contains("user"));
    assertFalse(DATA_ASSET_TYPES.contains("team"));
    assertFalse(DATA_ASSET_TYPES.contains("role"));
    assertFalse(DATA_ASSET_TYPES.contains("policy"));
  }
}
