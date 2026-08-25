/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.getResourceAsStream;
import static org.openmetadata.common.utils.CommonUtil.getResources;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;

class AIGovernanceBuiltInDataTest {
  private static final long EXPECTED_POLICY_COUNT = 5L;
  private static final String FRAMEWORKS_PATH = "/aiGovernance/frameworks/";
  private static final String FRAMEWORK_INDEX = "/aiGovernance/frameworks/_index.json";
  private static final String POLICIES_PATH = "/aiGovernance/policies/";
  private static final Pattern AI_GOVERNANCE_DATA =
      Pattern.compile(".*json[/\\\\]data[/\\\\]aiGovernance[/\\\\].*\\.json$");

  @Test
  void onlyProductFrameworksAndPoliciesAreBundledAtStartup() throws IOException {
    final List<String> resources =
        getResources(AI_GOVERNANCE_DATA).stream()
            .map(resource -> resource.replace('\\', '/'))
            .toList();

    assertFalse(nullOrEmpty(resources));
    assertOnlyProductResources(resources);
    assertPolicyCount(resources);
    assertFrameworkControls(resources);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "target/classes/json/data/aiGovernance/policies/policy.json",
        "target\\classes\\json\\data\\aiGovernance\\policies\\policy.json"
      })
  void discoversAiGovernanceResourcesOnEveryPlatform(final String resource) {
    assertTrue(AI_GOVERNANCE_DATA.matcher(resource).matches());
  }

  private static void assertOnlyProductResources(final List<String> resources) {
    assertTrue(
        resources.stream()
            .allMatch(
                resource ->
                    resource.contains(FRAMEWORKS_PATH) || resource.contains(POLICIES_PATH)));
    assertTrue(resources.stream().anyMatch(resource -> resource.contains(FRAMEWORKS_PATH)));
    assertTrue(resources.stream().anyMatch(resource -> resource.contains(POLICIES_PATH)));
  }

  private static void assertPolicyCount(final List<String> resources) {
    assertEquals(
        EXPECTED_POLICY_COUNT,
        resources.stream().filter(resource -> resource.contains(POLICIES_PATH)).count());
  }

  private static void assertFrameworkControls(final List<String> resources) throws IOException {
    final List<String> frameworkBundles =
        resources.stream()
            .filter(resource -> resource.contains(FRAMEWORKS_PATH))
            .filter(resource -> !resource.contains(FRAMEWORK_INDEX))
            .toList();
    assertFalse(nullOrEmpty(frameworkBundles));
    for (final String resource : frameworkBundles) {
      final String json =
          getResourceAsStream(AIGovernanceBuiltInDataTest.class.getClassLoader(), resource);
      final JsonNode controls = JsonUtils.readTree(json).path("controls");
      assertTrue(controls.isArray() && !controls.isEmpty(), resource + " has no controls");
    }
  }
}
