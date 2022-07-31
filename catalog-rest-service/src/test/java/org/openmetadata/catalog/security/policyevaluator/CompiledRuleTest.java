package org.openmetadata.catalog.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.resources.policies.PolicyResource;
import org.openmetadata.catalog.type.ResourceDescriptor;

class CompiledRuleTest {
  @Test
  void testResourceMatchAll() throws IOException {
    // Rule with resource set to "all" matches all the resources
    CompiledRule rule = new CompiledRule(new Rule().withName("test").withResources(List.of("all")));
    List<ResourceDescriptor> resourceDescriptors = listOrEmpty(PolicyResource.getResourceDescriptors());
    assertTrue(resourceDescriptors.size() > 0);

    for (ResourceDescriptor resourceDescriptor : resourceDescriptors) {
      assertTrue(CompiledRule.matchResource(rule, resourceDescriptor.getName()));
    }
  }

  @Test
  void testResourceMatch() throws IOException {
    List<ResourceDescriptor> resourceDescriptors = listOrEmpty(PolicyResource.getResourceDescriptors());

    // Create a random list of resources
    Random random = new Random();
    List<String> ruleResources = new ArrayList<>();
    for (ResourceDescriptor resourceDescriptor : resourceDescriptors) {
      if (random.nextBoolean() && !resourceDescriptor.getName().equals("all")) {
        ruleResources.add(resourceDescriptor.getName());
      }
    }
    assertTrue(ruleResources.size() > 0); // Ensure we are setting at least one resource in a rule

    CompiledRule rule = new CompiledRule(new Rule().withName("test").withResources(ruleResources));
    for (ResourceDescriptor resourceDescriptor : resourceDescriptors) {
      String resourceName = resourceDescriptor.getName();
      assertEquals(
          CompiledRule.matchResource(rule, resourceName),
          ruleResources.contains(resourceName),
          "Resource name " + resourceName + " not matched");
    }
  }
}
