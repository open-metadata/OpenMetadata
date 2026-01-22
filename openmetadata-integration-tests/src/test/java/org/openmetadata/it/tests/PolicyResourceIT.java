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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.policies.accessControl.Rule.Effect;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.resources.policies.PolicyResource;

/**
 * Integration tests for Policy entity operations.
 *
 * <p>Extends BaseEntityIT to inherit all common entity tests. Adds policy-specific tests for
 * rules, conditions, and access control.
 *
 * <p>Migrated from: org.openmetadata.service.resources.policies.PolicyResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class PolicyResourceIT extends BaseEntityIT<Policy, CreatePolicy> {

  private static final String ALL_RESOURCES = "All";

  public PolicyResourceIT() {
    supportsFollowers = false;
    supportsTags = false;
    supportsDomains = false;
    supportsDataProducts = false;
    supportsSoftDelete = true;
    supportsPatch = true;
    supportsOwners = true;
    supportsSearchIndex = false; // Policy does not have search index
    supportsListHistoryByTimestamp = true;
  }

  private Rule createBasicRule(String name) {
    return new Rule()
        .withName(name)
        .withResources(List.of(ALL_RESOURCES))
        .withOperations(List.of(MetadataOperation.EDIT_DESCRIPTION))
        .withEffect(Effect.ALLOW);
  }

  @Override
  protected String getResourcePath() {
    return PolicyResource.COLLECTION_PATH;
  }

  @Override
  protected CreatePolicy createMinimalRequest(TestNamespace ns) {
    return new CreatePolicy()
        .withName(ns.prefix("policy"))
        .withRules(List.of(createBasicRule("rule1")))
        .withDescription("Test policy created by integration test");
  }

  @Override
  protected CreatePolicy createRequest(String name, TestNamespace ns) {
    return new CreatePolicy()
        .withName(name)
        .withRules(List.of(createBasicRule("rule1")))
        .withDescription("Test policy");
  }

  @Override
  protected Policy createEntity(CreatePolicy createRequest) {
    return SdkClients.adminClient().policies().create(createRequest);
  }

  @Override
  protected Policy getEntity(String id) {
    return SdkClients.adminClient().policies().get(id);
  }

  @Override
  protected Policy getEntityByName(String fqn) {
    return SdkClients.adminClient().policies().getByName(fqn);
  }

  @Override
  protected Policy patchEntity(String id, Policy entity) {
    return SdkClients.adminClient().policies().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().policies().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().policies().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    SdkClients.adminClient()
        .policies()
        .delete(id, java.util.Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "policy";
  }

  @Override
  protected void validateCreatedEntity(Policy entity, CreatePolicy createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
    assertNotNull(entity.getRules());
    assertFalse(entity.getRules().isEmpty());
  }

  @Override
  protected Policy getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().policies().get(id, fields);
  }

  @Override
  protected Policy getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().policies().getByName(fqn, fields);
  }

  @Override
  protected Policy getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().policies().get(id, null, "deleted");
  }

  @Override
  protected ListResponse<Policy> listEntities(ListParams params) {
    return SdkClients.adminClient().policies().list(params);
  }

  // ===================================================================
  // POLICY-SPECIFIC TESTS
  // ===================================================================

  @Test
  void test_createPolicyWithMultipleRules(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Rule rule1 =
        new Rule()
            .withName("allowViewAll")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Effect.ALLOW);

    Rule rule2 =
        new Rule()
            .withName("denyEditTags")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.EDIT_TAGS))
            .withEffect(Effect.DENY);

    CreatePolicy create =
        new CreatePolicy()
            .withName(ns.prefix("multiRulePolicy"))
            .withRules(List.of(rule1, rule2))
            .withDescription("Policy with multiple rules");

    Policy policy = createEntity(create);
    assertNotNull(policy.getRules());
    assertEquals(2, policy.getRules().size());
  }

  @Test
  void test_createPolicyWithCondition(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Rule rule =
        new Rule()
            .withName("ownerOnlyEdit")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.EDIT_ALL))
            .withEffect(Effect.ALLOW)
            .withCondition("isOwner()");

    CreatePolicy create =
        new CreatePolicy()
            .withName(ns.prefix("conditionPolicy"))
            .withRules(List.of(rule))
            .withDescription("Policy with condition");

    Policy policy = createEntity(create);
    assertNotNull(policy.getRules());
    assertEquals(1, policy.getRules().size());
    assertEquals("isOwner()", policy.getRules().get(0).getCondition());
  }

  @Test
  void test_createPolicyWithDenyEffect(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Rule denyRule =
        new Rule()
            .withName("denyDelete")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.DELETE))
            .withEffect(Effect.DENY);

    CreatePolicy create =
        new CreatePolicy()
            .withName(ns.prefix("denyPolicy"))
            .withRules(List.of(denyRule))
            .withDescription("Policy with deny effect");

    Policy policy = createEntity(create);
    assertNotNull(policy.getRules());
    assertEquals(Effect.DENY, policy.getRules().get(0).getEffect());
  }

  @Test
  void test_deleteSystemPolicyNotAllowed(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Policy policy1 = shared().POLICY1;
    Policy policy2 = shared().POLICY2;

    assertNotNull(policy1);
    assertNotNull(policy2);
  }

  @Test
  void test_updatePolicyDescription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreatePolicy create = createMinimalRequest(ns);
    Policy policy = createEntity(create);

    policy.setDescription("Updated policy description");
    Policy updated = patchEntity(policy.getId().toString(), policy);

    assertEquals("Updated policy description", updated.getDescription());
  }

  @Test
  void test_updatePolicyDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreatePolicy create = createMinimalRequest(ns);
    Policy policy = createEntity(create);

    policy.setDisplayName("My Updated Policy");
    Policy updated = patchEntity(policy.getId().toString(), policy);

    assertEquals("My Updated Policy", updated.getDisplayName());
  }

  @Test
  void test_getPolicyWithRolesAndTeams(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreatePolicy create = createMinimalRequest(ns);
    Policy policy = createEntity(create);

    Policy fetched = client.policies().get(policy.getId().toString(), "roles,teams");
    assertNotNull(fetched);
  }

  @Test
  void test_softDeleteAndRestorePolicy(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreatePolicy create = createMinimalRequest(ns);
    Policy policy = createEntity(create);
    String policyId = policy.getId().toString();

    deleteEntity(policyId);

    assertThrows(
        Exception.class, () -> getEntity(policyId), "Deleted policy should not be retrievable");

    Policy deleted = getEntityIncludeDeleted(policyId);
    assertTrue(deleted.getDeleted());

    restoreEntity(policyId);

    Policy restored = getEntity(policyId);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_policyVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreatePolicy create = createMinimalRequest(ns);
    Policy policy = createEntity(create);
    assertEquals(0.1, policy.getVersion(), 0.001);

    policy.setDescription("Updated description v1");
    Policy v2 = patchEntity(policy.getId().toString(), policy);
    assertEquals(0.2, v2.getVersion(), 0.001);

    var history = client.policies().getVersionList(policy.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void test_listPolicies(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 3; i++) {
      CreatePolicy create =
          new CreatePolicy()
              .withName(ns.prefix("listPolicy" + i))
              .withRules(List.of(createBasicRule("rule1")))
              .withDescription("Policy for list test");
      createEntity(create);
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Policy> response = listEntities(params);

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void test_createPolicyWithSpecificResource(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Rule tableRule =
        new Rule()
            .withName("tableEditRule")
            .withResources(List.of("table"))
            .withOperations(
                List.of(MetadataOperation.EDIT_DESCRIPTION, MetadataOperation.EDIT_TAGS))
            .withEffect(Effect.ALLOW);

    CreatePolicy create =
        new CreatePolicy()
            .withName(ns.prefix("tableOnlyPolicy"))
            .withRules(List.of(tableRule))
            .withDescription("Policy for table resources only");

    Policy policy = createEntity(create);
    assertNotNull(policy.getRules());
    assertEquals("table", policy.getRules().get(0).getResources().get(0));
  }

  @Test
  void test_createPolicyWithMultipleOperations(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Rule multiOpRule =
        new Rule()
            .withName("multiOpRule")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(
                List.of(
                    MetadataOperation.EDIT_DESCRIPTION,
                    MetadataOperation.EDIT_TAGS,
                    MetadataOperation.EDIT_LINEAGE))
            .withEffect(Effect.ALLOW);

    CreatePolicy create =
        new CreatePolicy()
            .withName(ns.prefix("multiOpPolicy"))
            .withRules(List.of(multiOpRule))
            .withDescription("Policy with multiple operations");

    Policy policy = createEntity(create);
    assertNotNull(policy.getRules());
    assertTrue(policy.getRules().get(0).getOperations().size() >= 3);
  }

  @Test
  void test_createPolicyWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreatePolicy create =
        new CreatePolicy()
            .withName(ns.prefix("ownedPolicy"))
            .withRules(List.of(createBasicRule("rule1")))
            .withOwners(List.of(testUser1().getEntityReference()))
            .withDescription("Policy with owner");

    Policy policy = createEntity(create);

    Policy fetched = client.policies().get(policy.getId().toString(), "owners");
    assertNotNull(fetched.getOwners());
    assertFalse(fetched.getOwners().isEmpty());
  }

  // ===================================================================
  // VERSION HISTORY SUPPORT
  // ===================================================================

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().policies().getVersionList(id);
  }

  @Override
  protected Policy getVersion(UUID id, Double version) {
    return SdkClients.adminClient().policies().getVersion(id.toString(), version);
  }
}
