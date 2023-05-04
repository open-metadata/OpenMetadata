package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.ALL_RESOURCES;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.policies.accessControl.Rule;

class CompiledRuleTest {
  private static final List<String> RESOURCE_LIST = listOf("all", "table", "topic", "database", "databaseService");

  @Test
  void testResourceMatchAll() {
    // Rule with resource set to ALL_RESOURCES matches all the resources
    CompiledRule rule = new CompiledRule(new Rule().withName("test").withResources(List.of(ALL_RESOURCES)));
    for (String resourceName : RESOURCE_LIST) {
      assertTrue(rule.matchResource(resourceName));
    }
  }

  @Test
  void testResourceMatch() {
    // Create a random list of resources
    Random random = new Random();
    List<String> ruleResources = new ArrayList<>();
    for (String resource : RESOURCE_LIST) {
      if (random.nextBoolean() && !resource.equalsIgnoreCase(ALL_RESOURCES)) {
        ruleResources.add(resource);
      }
    }
    assertTrue(ruleResources.size() > 0); // Ensure we are setting at least one resource in a rule

    CompiledRule rule = new CompiledRule(new Rule().withName("test").withResources(ruleResources));
    for (String resource : RESOURCE_LIST) {
      assertEquals(
          rule.matchResource(resource), ruleResources.contains(resource), "Resource name " + resource + " not matched");
    }
  }
}
