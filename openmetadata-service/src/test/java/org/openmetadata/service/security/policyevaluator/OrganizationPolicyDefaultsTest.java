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

package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.secrets.JsonSchemas;

/**
 * Keeps the default rules on ownership in step with the entity types: a new type that lives in a
 * service, or that stores permissions, fails here until its author decides how its owners are
 * limited. ADR:2026-11-09-only-data-assets-can-be-claimed-by-default
 */
class OrganizationPolicyDefaultsTest {
  private static final String SEED = "json/data/policy/OrganizationPolicy.json";
  private static final String CLAIM_RULE = "OrganizationPolicy-NoOwner-Rule";
  private static final String POLICY_EDIT_RULE = "OrganizationPolicy-OwnerNoPolicyEdit-Rule";

  /** Types that live in a service but are part of OpenMetadata's own setup, not source data. */
  private static final Map<String, String> NOT_CLAIMABLE =
      Map.of("ingestionPipeline", "OpenMetadata's own job that ingests from the service");

  /** Types that store permissions and whose owners are limited by something other than the rule. */
  private static final Map<String, String> PERMISSIONS_GUARDED_ELSEWHERE =
      Map.of(
          "team",
          "Only admins add roles or policies to a team (TeamResource.authorizeGrants)",
          "aiGovernancePolicy",
          "Its rules are AI compliance rules, evaluated by resources/ai/PolicyEvaluator, not"
              + " access control");

  private static final List<String> PERMISSION_FIELDS =
      List.of("rules", "policies", "roles", "defaultRoles");

  private static Map<String, JsonNode> entities;
  private static Policy seed;

  @BeforeAll
  static void load() {
    entities = new TreeMap<>();
    JsonSchemas.load().entities().forEach(ref -> entities.put(typeOf(ref.path()), ref.node()));
    assertTrue(entities.size() > 50, "Expected the entity schemas on the classpath");
    seed = readSeed();
  }

  @Test
  void everyTypeInAServiceIsClaimableOrNamedNotClaimable() {
    Set<String> claimable = resourcesOf(CLAIM_RULE);
    Set<String> undecided = new TreeSet<>();
    entities.forEach(
        (type, schema) -> {
          if (hasProperty(schema, "service")
              && !claimable.contains(type)
              && !NOT_CLAIMABLE.containsKey(type)) {
            undecided.add(type);
          }
        });
    assertEquals(
        Set.of(),
        undecided,
        "Add each type to "
            + CLAIM_RULE
            + " in OrganizationPolicy.json and the migration, or to NOT_CLAIMABLE with a reason");
  }

  @Test
  void everyClaimableTypeExistsAndHasOwners() {
    Set<String> invalid = new TreeSet<>();
    for (String type : resourcesOf(CLAIM_RULE)) {
      JsonNode schema = entities.get(type);
      if (schema == null || !hasProperty(schema, "owners")) {
        invalid.add(type);
      }
    }
    assertEquals(Set.of(), invalid, "Claimable types must be entity types with owners");
  }

  @Test
  void claimRuleKeepsItsShape() {
    Rule rule = rule(CLAIM_RULE);
    assertEquals(Rule.Effect.ALLOW, rule.getEffect());
    assertEquals(List.of(MetadataOperation.EDIT_OWNERS), rule.getOperations());
    assertEquals("noOwner()", rule.getCondition());
  }

  @Test
  void everyTypeThatStoresPermissionsLimitsItsOwners() {
    Rule denyRule = rule(POLICY_EDIT_RULE);
    assertEquals(Rule.Effect.DENY, denyRule.getEffect());
    assertEquals("isOwner()", denyRule.getCondition());
    assertTrue(denyRule.getOperations().contains(MetadataOperation.EDIT_ALL));
    assertTrue(denyRule.getOperations().contains(MetadataOperation.DELETE));
    Set<String> covered = resourcesOf(POLICY_EDIT_RULE);
    Set<String> uncovered = new TreeSet<>();
    entities.forEach(
        (type, schema) -> {
          if (hasProperty(schema, "owners")
              && PERMISSION_FIELDS.stream().anyMatch(field -> hasProperty(schema, field))
              && !covered.contains(type)
              && !PERMISSIONS_GUARDED_ELSEWHERE.containsKey(type)) {
            uncovered.add(type);
          }
        });
    assertEquals(
        Set.of(),
        uncovered,
        "Add each type to "
            + POLICY_EDIT_RULE
            + " in OrganizationPolicy.json and the migration, or to PERMISSIONS_GUARDED_ELSEWHERE");
  }

  private static Set<String> resourcesOf(String ruleName) {
    return new TreeSet<>(rule(ruleName).getResources());
  }

  private static Rule rule(String name) {
    return seed.getRules().stream()
        .filter(rule -> name.equals(rule.getName()))
        .findFirst()
        .orElseThrow(() -> new AssertionError(name + " is missing from " + SEED));
  }

  private static boolean hasProperty(JsonNode schema, String property) {
    return schema.path("properties").has(property);
  }

  private static String typeOf(String path) {
    return path.substring(path.lastIndexOf('/') + 1, path.length() - ".json".length());
  }

  private static Policy readSeed() {
    try (InputStream stream =
        OrganizationPolicyDefaultsTest.class.getClassLoader().getResourceAsStream(SEED)) {
      return JsonUtils.readValue(new String(stream.readAllBytes()), Policy.class);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
