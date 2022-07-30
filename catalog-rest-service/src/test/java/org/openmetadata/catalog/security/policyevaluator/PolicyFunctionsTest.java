package org.openmetadata.catalog.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.resources.policies.PolicyResource;
import org.openmetadata.catalog.type.ResourceDescriptor;

class PolicyFunctionsTest {

  @Test
  void testResourceMatchAll() throws IOException {
    // Rule with resource set to "all" matches all the resources
    Rule rule = new Rule().withName("test").withResources(List.of("all"));
    List<ResourceDescriptor> resourceDescriptors = listOrEmpty(PolicyResource.getResourceDescriptors());
    assertTrue(resourceDescriptors.size() > 0);

    for (ResourceDescriptor resourceDescriptor : resourceDescriptors) {
      assertTrue(PolicyFunctions.matchResource(resourceDescriptor.getName(), rule));
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

    Rule rule = new Rule().withName("test").withResources(ruleResources);
    for (ResourceDescriptor resourceDescriptor : resourceDescriptors) {
      String resourceName = resourceDescriptor.getName();
      assertEquals(
          PolicyFunctions.matchResource(resourceName, rule),
          ruleResources.contains(resourceName),
          "Resource name " + resourceName + " not matched");
    }
  }
}
