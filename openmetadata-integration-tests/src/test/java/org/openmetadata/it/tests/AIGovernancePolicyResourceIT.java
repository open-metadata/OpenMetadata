/*
 *  Copyright 2021 Collate
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.ai.CreateAIGovernancePolicy;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.entity.ai.PolicyType;
import org.openmetadata.sdk.fluent.AIGovernancePolicies;

/**
 * Integration tests for AIGovernancePolicy API using the fluent SDK.
 *
 * <p>Tests the creation, retrieval, listing, update, and deletion of AI Governance Policies using
 * the fluent API pattern from org.openmetadata.sdk.fluent.AIGovernancePolicies.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AIGovernancePolicyResourceIT {

  @BeforeAll
  static void setup() {
    AIGovernancePolicies.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void test_createAndGetAIGovernancePolicy(TestNamespace ns) {
    String policyName = ns.prefix("testPolicy");

    AIGovernancePolicy policy =
        AIGovernancePolicies.create()
            .name(policyName)
            .withPolicyType(PolicyType.DataAccess)
            .withDescription("Test AI governance policy")
            .withEnforcementLevel(CreateAIGovernancePolicy.EnforcementLevel.BLOCKING)
            .execute();

    assertNotNull(policy);
    assertNotNull(policy.getId());
    assertEquals(policyName, policy.getName());
    assertEquals("Test AI governance policy", policy.getDescription());
    assertEquals(
        AIGovernancePolicy.EnforcementLevel.BLOCKING.value(), policy.getEnforcementLevel().value());
  }

  @Test
  void test_getAIGovernancePolicyByName(TestNamespace ns) {
    String policyName = ns.prefix("namedPolicy");

    AIGovernancePolicy created =
        AIGovernancePolicies.create()
            .name(policyName)
            .withPolicyType(PolicyType.ModelApproval)
            .withDescription("Policy to retrieve by name")
            .withEnforcementLevel(CreateAIGovernancePolicy.EnforcementLevel.WARNING)
            .execute();

    AIGovernancePolicy retrieved = AIGovernancePolicies.getByName(created.getFullyQualifiedName());

    assertNotNull(retrieved);
    assertEquals(created.getId(), retrieved.getId());
    assertEquals(policyName, retrieved.getName());
    assertEquals(
        AIGovernancePolicy.EnforcementLevel.WARNING.value(),
        retrieved.getEnforcementLevel().value());
  }

  @Test
  void test_listAIGovernancePolicies(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      AIGovernancePolicies.create()
          .name(ns.prefix("listPolicy" + i))
          .withPolicyType(PolicyType.ComplianceCheck)
          .withDescription("Policy " + i + " for list test")
          .withEnforcementLevel(CreateAIGovernancePolicy.EnforcementLevel.BLOCKING)
          .execute();
    }

    List<AIGovernancePolicies.FluentAIGovernancePolicy> policies =
        AIGovernancePolicies.list().limit(100).fetch();

    assertNotNull(policies);
    assertTrue(policies.size() >= 3);
  }

  @Test
  void test_updateAIGovernancePolicyDescription(TestNamespace ns) {
    String policyName = ns.prefix("updatePolicy");

    AIGovernancePolicy policy =
        AIGovernancePolicies.create()
            .name(policyName)
            .withPolicyType(PolicyType.SecurityControl)
            .withDescription("Original description")
            .withEnforcementLevel(CreateAIGovernancePolicy.EnforcementLevel.BLOCKING)
            .execute();

    AIGovernancePolicy updated =
        AIGovernancePolicies.find(policy.getId().toString())
            .fetch()
            .withDescription("Updated description")
            .save()
            .get();

    assertEquals("Updated description", updated.getDescription());
    assertTrue(updated.getVersion() > policy.getVersion());
  }

  @Test
  void test_updateAIGovernancePolicyDisplayName(TestNamespace ns) {
    String policyName = ns.prefix("displayNamePolicy");

    AIGovernancePolicy policy =
        AIGovernancePolicies.create()
            .name(policyName)
            .withPolicyType(PolicyType.CostControl)
            .withDescription("Test policy")
            .withEnforcementLevel(CreateAIGovernancePolicy.EnforcementLevel.WARNING)
            .execute();

    AIGovernancePolicy updated =
        AIGovernancePolicies.find(policy.getId().toString())
            .fetch()
            .withDisplayName("Updated Display Name")
            .save()
            .get();

    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_deleteAIGovernancePolicy(TestNamespace ns) {
    String policyName = ns.prefix("deletePolicy");

    AIGovernancePolicy policy =
        AIGovernancePolicies.create()
            .name(policyName)
            .withPolicyType(PolicyType.BiasThreshold)
            .withDescription("Policy to delete")
            .withEnforcementLevel(CreateAIGovernancePolicy.EnforcementLevel.BLOCKING)
            .execute();

    String policyId = policy.getId().toString();

    AIGovernancePolicies.find(policyId).delete().confirm();

    assertThrows(
        Exception.class,
        () -> AIGovernancePolicies.get(policyId),
        "Deleted policy should not be retrievable");
  }

  @Test
  void test_createAIGovernancePolicyWithDisplayName(TestNamespace ns) {
    String policyName = ns.prefix("policyWithDisplay");

    AIGovernancePolicy policy =
        AIGovernancePolicies.create()
            .name(policyName)
            .withPolicyType(PolicyType.PerformanceStandard)
            .withDisplayName("My Policy Display Name")
            .withDescription("Policy with display name")
            .withEnforcementLevel(CreateAIGovernancePolicy.EnforcementLevel.BLOCKING)
            .execute();

    assertNotNull(policy);
    assertEquals("My Policy Display Name", policy.getDisplayName());
  }

  @Test
  void test_createAIGovernancePolicyWithEnforcementLevels(TestNamespace ns) {
    CreateAIGovernancePolicy.EnforcementLevel[] levels = {
      CreateAIGovernancePolicy.EnforcementLevel.BLOCKING,
      CreateAIGovernancePolicy.EnforcementLevel.WARNING
    };

    for (CreateAIGovernancePolicy.EnforcementLevel level : levels) {
      String policyName = ns.prefix("policy_" + level.value());

      AIGovernancePolicy policy =
          AIGovernancePolicies.create()
              .name(policyName)
              .withPolicyType(PolicyType.DataAccess)
              .withDescription("Policy with enforcement level: " + level.value())
              .withEnforcementLevel(level)
              .execute();

      assertNotNull(policy);
      assertEquals(level.value(), policy.getEnforcementLevel().value());
    }
  }

  @Test
  void test_findByNameWithFields(TestNamespace ns) {
    String policyName = ns.prefix("fieldsPolicy");

    AIGovernancePolicy created =
        AIGovernancePolicies.create()
            .name(policyName)
            .withPolicyType(PolicyType.ModelApproval)
            .withDescription("Policy to test field retrieval")
            .withEnforcementLevel(CreateAIGovernancePolicy.EnforcementLevel.WARNING)
            .execute();

    AIGovernancePolicy retrieved =
        AIGovernancePolicies.findByName(created.getFullyQualifiedName())
            .includeOwners()
            .fetch()
            .get();

    assertNotNull(retrieved);
    assertEquals(created.getId(), retrieved.getId());
  }

  @Test
  void test_hardDeleteAIGovernancePolicy(TestNamespace ns) {
    String policyName = ns.prefix("hardDeletePolicy");

    AIGovernancePolicy policy =
        AIGovernancePolicies.create()
            .name(policyName)
            .withPolicyType(PolicyType.ComplianceCheck)
            .withDescription("Policy to hard delete")
            .withEnforcementLevel(CreateAIGovernancePolicy.EnforcementLevel.BLOCKING)
            .execute();

    String policyId = policy.getId().toString();

    AIGovernancePolicies.find(policyId).delete().permanently().confirm();

    assertThrows(
        Exception.class,
        () -> AIGovernancePolicies.get(policyId),
        "Hard deleted policy should not be retrievable");
  }

  @Test
  void test_listAIGovernancePoliciesWithLimit(TestNamespace ns) {
    for (int i = 0; i < 5; i++) {
      AIGovernancePolicies.create()
          .name(ns.prefix("limitPolicy" + i))
          .withPolicyType(PolicyType.SecurityControl)
          .withDescription("Policy " + i + " for limit test")
          .withEnforcementLevel(CreateAIGovernancePolicy.EnforcementLevel.WARNING)
          .execute();
    }

    List<AIGovernancePolicies.FluentAIGovernancePolicy> policies =
        AIGovernancePolicies.list().limit(3).fetch();

    assertNotNull(policies);
    assertTrue(policies.size() >= 3);
  }

  @Test
  void test_getAIGovernancePolicyById(TestNamespace ns) {
    String policyName = ns.prefix("idPolicy");

    AIGovernancePolicy created =
        AIGovernancePolicies.create()
            .name(policyName)
            .withPolicyType(PolicyType.CostControl)
            .withDescription("Policy to retrieve by ID")
            .withEnforcementLevel(CreateAIGovernancePolicy.EnforcementLevel.BLOCKING)
            .execute();

    AIGovernancePolicy retrieved = AIGovernancePolicies.get(created.getId().toString());

    assertNotNull(retrieved);
    assertEquals(created.getId(), retrieved.getId());
    assertEquals(policyName, retrieved.getName());
  }

  @Test
  void test_fluentAPIChaining(TestNamespace ns) {
    String policyName = ns.prefix("chainedPolicy");

    AIGovernancePolicy policy =
        AIGovernancePolicies.create()
            .name(policyName)
            .withPolicyType(PolicyType.DataAccess)
            .withDisplayName("Chained Policy")
            .withDescription("Original description")
            .withEnforcementLevel(CreateAIGovernancePolicy.EnforcementLevel.BLOCKING)
            .now();

    AIGovernancePolicy updated =
        AIGovernancePolicies.find(policy.getId())
            .fetch()
            .withDescription("Updated via fluent API")
            .withDisplayName("Updated Chained Policy")
            .save()
            .get();

    assertEquals("Updated via fluent API", updated.getDescription());
    assertEquals("Updated Chained Policy", updated.getDisplayName());
  }
}
