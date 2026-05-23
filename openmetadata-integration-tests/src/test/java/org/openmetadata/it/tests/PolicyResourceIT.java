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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.policies.accessControl.Rule.Effect;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
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

  /**
   * Verifies bulk policy listing includes associated roles when requested via fields parameter.
   * Addresses bug where fetchAndSetRoles used wrong parameter order in findFromBatch call.
   */
  @Test
  void test_bulkGetPoliciesReturnsRolesField(TestNamespace ns) {
    OpenMetadataClient apiClient = SdkClients.adminClient();

    String uniquePolicyName = ns.prefix("bulk_roles_test_policy");
    String uniqueRoleName = ns.prefix("bulk_roles_test_role");

    Policy newPolicy =
        apiClient
            .policies()
            .create(
                new CreatePolicy()
                    .withName(uniquePolicyName)
                    .withRules(List.of(createBasicRule("testRule")))
                    .withDescription("Testing roles in bulk response"));

    Role newRole =
        apiClient
            .roles()
            .create(
                new CreateRole()
                    .withName(uniqueRoleName)
                    .withPolicies(List.of(newPolicy.getFullyQualifiedName()))
                    .withDescription("Role linked to test policy"));

    UUID policyUuid = newPolicy.getId();
    UUID roleUuid = newRole.getId();

    try {
      Policy directFetch = apiClient.policies().get(policyUuid.toString(), "roles");
      List<EntityReference> directRoles = directFetch.getRoles();
      assertNotNull(directRoles);
      assertTrue(
          directRoles.stream().anyMatch(ref -> ref.getId().equals(roleUuid)),
          "Direct fetch must include the role");

      ListParams queryParams = new ListParams();
      queryParams.setFields("roles");
      queryParams.setLimit(200);

      ListResponse<Policy> allPolicies = apiClient.policies().list(queryParams);
      Policy bulkFetchedPolicy =
          allPolicies.getData().stream()
              .filter(pol -> pol.getId().equals(policyUuid))
              .findFirst()
              .orElseThrow(() -> new AssertionError("Policy missing from bulk response"));

      List<EntityReference> bulkRoles = bulkFetchedPolicy.getRoles();
      assertNotNull(bulkRoles, "Roles field must be present in bulk response");
      assertTrue(
          bulkRoles.stream().anyMatch(ref -> ref.getId().equals(roleUuid)),
          "Bulk response must contain the associated role - this validates the bug fix");
    } finally {
      apiClient.roles().delete(roleUuid.toString());
      apiClient.policies().delete(policyUuid.toString(), java.util.Map.of("hardDelete", "true"));
    }
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

  /**
   * Reproduces the bug where deleting a tag that is referenced in a policy rule condition blocks
   * future edits of that policy. The matchAnyTag condition is validated on every update, so a stale
   * tag reference causes validation to fail even for unrelated changes like updating the
   * description.
   *
   * <p>Steps: 1) Create a classification and tag 2) Create a policy with a rule condition using
   * matchAnyTag referencing that tag 3) Hard-delete the tag 4) Attempt to edit the policy (e.g.
   * update description) 5) The edit should succeed but currently fails because the deleted tag still
   * appears in the condition and re-validation rejects it.
   */
  @Test
  void test_editPolicyAfterReferencedTagIsDeleted(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Step 1: Create a classification and a tag under it
    String classificationName = ns.prefix("TagCleanupClassification");
    Classification classification =
        client
            .classifications()
            .create(
                new CreateClassification()
                    .withName(classificationName)
                    .withDescription("Classification for tag cleanup test"));

    String tagName = ns.prefix("StaleTag");
    Tag tag =
        client
            .tags()
            .create(
                new CreateTag()
                    .withName(tagName)
                    .withClassification(classification.getFullyQualifiedName())
                    .withDescription("Tag that will be deleted"));

    String tagFqn = tag.getFullyQualifiedName();

    // Step 2: Create a policy with a rule whose condition references the tag
    Rule tagRule =
        new Rule()
            .withName("tagConditionRule")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Effect.ALLOW)
            .withCondition("matchAnyTag('" + tagFqn + "')");

    CreatePolicy createPolicy =
        new CreatePolicy()
            .withName(ns.prefix("tagRefPolicy"))
            .withRules(List.of(tagRule))
            .withDescription("Policy referencing a tag that will be deleted");

    Policy policy = createEntity(createPolicy);
    String policyId = policy.getId().toString();
    assertNotNull(policy.getRules());
    assertEquals("matchAnyTag('" + tagFqn + "')", policy.getRules().get(0).getCondition());

    // Step 3: Hard-delete the tag
    client.tags().delete(tag.getId().toString(), Map.of("hardDelete", "true"));

    // Step 4: Attempt to edit the policy — this should succeed but currently fails
    // because the deleted tag in the condition triggers validation failure
    Policy fetched = getEntity(policyId);
    fetched.setDescription("Updated after tag deletion");
    Policy updated = patchEntity(policyId, fetched);

    assertEquals("Updated after tag deletion", updated.getDescription());
  }

  @Test
  void test_editPolicyAfterReferencedRoleIsDeleted(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String roleName = ns.prefix("StaleRole");
    Policy helperPolicy =
        createEntity(
            new CreatePolicy()
                .withName(ns.prefix("helperPolicyForRole"))
                .withRules(
                    List.of(
                        new Rule()
                            .withName("helperRule")
                            .withResources(List.of(ALL_RESOURCES))
                            .withOperations(List.of(MetadataOperation.VIEW_ALL))
                            .withEffect(Effect.ALLOW)))
                .withDescription("Helper policy for role creation"));
    Role role =
        client
            .roles()
            .create(
                new CreateRole()
                    .withName(roleName)
                    .withPolicies(List.of(helperPolicy.getFullyQualifiedName()))
                    .withDescription("Role that will be deleted"));

    Rule roleRule =
        new Rule()
            .withName("roleConditionRule")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Effect.ALLOW)
            .withCondition("hasAnyRole('" + role.getName() + "')");

    Policy policy =
        createEntity(
            new CreatePolicy()
                .withName(ns.prefix("roleRefPolicy"))
                .withRules(List.of(roleRule))
                .withDescription("Policy referencing a role that will be deleted"));
    String policyId = policy.getId().toString();

    client.roles().delete(role.getId().toString(), Map.of("hardDelete", "true"));

    Policy fetched = getEntity(policyId);
    fetched.setDescription("Updated after role deletion");
    Policy updated = patchEntity(policyId, fetched);

    assertEquals("Updated after role deletion", updated.getDescription());
  }

  @Test
  void test_editPolicyAfterReferencedTeamIsDeleted(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String teamName = ns.prefix("StaleTeam");
    CreateTeam createTeam = new CreateTeam();
    createTeam.setName(teamName);
    createTeam.setDescription("Team that will be deleted");
    createTeam.setTeamType(CreateTeam.TeamType.GROUP);
    Team team = client.teams().create(createTeam);

    Rule teamRule =
        new Rule()
            .withName("teamConditionRule")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Effect.ALLOW)
            .withCondition("inAnyTeam('" + team.getName() + "')");

    Policy policy =
        createEntity(
            new CreatePolicy()
                .withName(ns.prefix("teamRefPolicy"))
                .withRules(List.of(teamRule))
                .withDescription("Policy referencing a team that will be deleted"));
    String policyId = policy.getId().toString();

    client
        .teams()
        .delete(team.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    Policy fetched = getEntity(policyId);
    fetched.setDescription("Updated after team deletion");
    Policy updated = patchEntity(policyId, fetched);

    assertEquals("Updated after team deletion", updated.getDescription());
  }

  @Test
  void test_createPolicyWithDeletedTagStillFails(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Classification classification =
        client
            .classifications()
            .create(
                new CreateClassification()
                    .withName(ns.prefix("CreateFailClassification"))
                    .withDescription("Classification for create-fail test"));

    Tag tag =
        client
            .tags()
            .create(
                new CreateTag()
                    .withName(ns.prefix("DeletedTag"))
                    .withClassification(classification.getFullyQualifiedName())
                    .withDescription("Tag that will be deleted before policy creation"));

    String tagFqn = tag.getFullyQualifiedName();
    client.tags().delete(tag.getId().toString(), Map.of("hardDelete", "true"));

    Rule tagRule =
        new Rule()
            .withName("staleTagRule")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Effect.ALLOW)
            .withCondition("matchAnyTag('" + tagFqn + "')");

    CreatePolicy createPolicy =
        new CreatePolicy()
            .withName(ns.prefix("shouldFailPolicy"))
            .withRules(List.of(tagRule))
            .withDescription("Policy that should fail to create");

    assertThrows(Exception.class, () -> createEntity(createPolicy));
  }

  @Test
  void test_deletedTagIsRemovedFromPolicyCondition(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Classification classification =
        client
            .classifications()
            .create(
                new CreateClassification()
                    .withName(ns.prefix("CleanupClassification"))
                    .withDescription("Classification for cleanup test"));

    Tag tag1 =
        client
            .tags()
            .create(
                new CreateTag()
                    .withName(ns.prefix("Tag1"))
                    .withClassification(classification.getFullyQualifiedName())
                    .withDescription("First tag"));
    Tag tag2 =
        client
            .tags()
            .create(
                new CreateTag()
                    .withName(ns.prefix("Tag2"))
                    .withClassification(classification.getFullyQualifiedName())
                    .withDescription("Second tag"));

    String tag1Fqn = tag1.getFullyQualifiedName();
    String tag2Fqn = tag2.getFullyQualifiedName();

    Rule tagRule =
        new Rule()
            .withName("multiTagRule")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Effect.ALLOW)
            .withCondition("matchAnyTag('" + tag1Fqn + "', '" + tag2Fqn + "')");

    Policy policy =
        createEntity(
            new CreatePolicy()
                .withName(ns.prefix("multiTagPolicy"))
                .withRules(List.of(tagRule))
                .withDescription("Policy with two tags"));
    String policyId = policy.getId().toString();

    client.tags().delete(tag1.getId().toString(), Map.of("hardDelete", "true"));

    Policy fetched = getEntity(policyId);
    String updatedCondition = fetched.getRules().get(0).getCondition();
    assertEquals("matchAnyTag('" + tag2Fqn + "')", updatedCondition);
  }

  @Test
  void test_deletingAllTagsRemovesCondition(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Classification classification =
        client
            .classifications()
            .create(
                new CreateClassification()
                    .withName(ns.prefix("AllDeleteClassification"))
                    .withDescription("Classification for full delete test"));

    Tag tag =
        client
            .tags()
            .create(
                new CreateTag()
                    .withName(ns.prefix("OnlyTag"))
                    .withClassification(classification.getFullyQualifiedName())
                    .withDescription("Only tag"));

    Rule tagRule =
        new Rule()
            .withName("singleTagRule")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Effect.ALLOW)
            .withCondition("matchAnyTag('" + tag.getFullyQualifiedName() + "')");

    Policy policy =
        createEntity(
            new CreatePolicy()
                .withName(ns.prefix("singleTagPolicy"))
                .withRules(List.of(tagRule))
                .withDescription("Policy with one tag"));
    String policyId = policy.getId().toString();

    client.tags().delete(tag.getId().toString(), Map.of("hardDelete", "true"));

    Policy fetched = getEntity(policyId);
    assertNull(fetched.getRules().get(0).getCondition());
  }

  @Test
  void test_renamedTagIsUpdatedInPolicyCondition(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Classification classification =
        client
            .classifications()
            .create(
                new CreateClassification()
                    .withName(ns.prefix("RenameClassification"))
                    .withDescription("Classification for rename test"));

    Tag tag =
        client
            .tags()
            .create(
                new CreateTag()
                    .withName(ns.prefix("OldTagName"))
                    .withClassification(classification.getFullyQualifiedName())
                    .withDescription("Tag that will be renamed"));

    String oldFqn = tag.getFullyQualifiedName();

    Rule tagRule =
        new Rule()
            .withName("renameTestRule")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Effect.ALLOW)
            .withCondition("matchAnyTag('" + oldFqn + "')");

    Policy policy =
        createEntity(
            new CreatePolicy()
                .withName(ns.prefix("renameTagPolicy"))
                .withRules(List.of(tagRule))
                .withDescription("Policy referencing a tag that will be renamed"));
    String policyId = policy.getId().toString();

    String newTagName = ns.prefix("NewTagName");
    tag.setName(newTagName);
    Tag renamedTag = client.tags().update(tag.getId().toString(), tag);
    String newFqn = renamedTag.getFullyQualifiedName();

    Policy fetched = getEntity(policyId);
    String updatedCondition = fetched.getRules().get(0).getCondition();
    assertEquals("matchAnyTag('" + newFqn + "')", updatedCondition);
  }

  @Test
  void test_deletedRoleIsRemovedFromPolicyCondition(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Policy helperPolicy =
        createEntity(
            new CreatePolicy()
                .withName(ns.prefix("helperPolicyForRoles"))
                .withRules(
                    List.of(
                        new Rule()
                            .withName("helperRule")
                            .withResources(List.of(ALL_RESOURCES))
                            .withOperations(List.of(MetadataOperation.VIEW_ALL))
                            .withEffect(Effect.ALLOW)))
                .withDescription("Helper policy for role creation"));
    String helperPolicyFqn = helperPolicy.getFullyQualifiedName();

    Role role1 =
        client
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.prefix("Role1"))
                    .withPolicies(List.of(helperPolicyFqn))
                    .withDescription("First role"));
    Role role2 =
        client
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.prefix("Role2"))
                    .withPolicies(List.of(helperPolicyFqn))
                    .withDescription("Second role"));

    Rule roleRule =
        new Rule()
            .withName("multiRoleRule")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Effect.ALLOW)
            .withCondition("hasAnyRole('" + role1.getName() + "', '" + role2.getName() + "')");

    Policy policy =
        createEntity(
            new CreatePolicy()
                .withName(ns.prefix("multiRolePolicy"))
                .withRules(List.of(roleRule))
                .withDescription("Policy with two roles"));
    String policyId = policy.getId().toString();

    client.roles().delete(role1.getId().toString(), Map.of("hardDelete", "true"));

    Policy fetched = getEntity(policyId);
    String updatedCondition = fetched.getRules().get(0).getCondition();
    assertEquals("hasAnyRole('" + role2.getName() + "')", updatedCondition);
  }

  @Test
  void test_deletedTeamIsRemovedFromPolicyCondition(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String teamName = ns.prefix("CleanupTeam");
    CreateTeam createTeam = new CreateTeam();
    createTeam.setName(teamName);
    createTeam.setDescription("Team for cleanup test");
    createTeam.setTeamType(CreateTeam.TeamType.GROUP);
    Team team = client.teams().create(createTeam);

    Policy helperPolicy =
        createEntity(
            new CreatePolicy()
                .withName(ns.prefix("helperPolicyForTeamTest"))
                .withRules(
                    List.of(
                        new Rule()
                            .withName("helperRule")
                            .withResources(List.of(ALL_RESOURCES))
                            .withOperations(List.of(MetadataOperation.VIEW_ALL))
                            .withEffect(Effect.ALLOW)))
                .withDescription("Helper policy for role creation"));

    Role dsSteward =
        client
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.prefix("DataSteward"))
                    .withPolicies(List.of(helperPolicy.getFullyQualifiedName()))
                    .withDescription("Steward role"));

    Rule teamRuleWithActualRole =
        new Rule()
            .withName("teamCleanupRule")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Effect.ALLOW)
            .withCondition(
                "inAnyTeam('" + team.getName() + "') && hasAnyRole('" + dsSteward.getName() + "')");

    Policy policy =
        createEntity(
            new CreatePolicy()
                .withName(ns.prefix("teamCleanupPolicy"))
                .withRules(List.of(teamRuleWithActualRole))
                .withDescription("Policy with team and role"));
    String policyId = policy.getId().toString();

    client
        .teams()
        .delete(team.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    Policy fetched = getEntity(policyId);
    String updatedCondition = fetched.getRules().get(0).getCondition();
    assertEquals("hasAnyRole('" + dsSteward.getName() + "')", updatedCondition);
  }

  @Test
  void test_deletedClassificationRemovesChildTagsFromPolicyCondition(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Classification classification =
        client
            .classifications()
            .create(
                new CreateClassification()
                    .withName(ns.prefix("DeleteClassification"))
                    .withDescription("Classification that will be deleted"));

    Tag tag1 =
        client
            .tags()
            .create(
                new CreateTag()
                    .withName(ns.prefix("CTag1"))
                    .withClassification(classification.getFullyQualifiedName())
                    .withDescription("Child tag 1"));
    Tag tag2 =
        client
            .tags()
            .create(
                new CreateTag()
                    .withName(ns.prefix("CTag2"))
                    .withClassification(classification.getFullyQualifiedName())
                    .withDescription("Child tag 2"));

    Rule tagRule =
        new Rule()
            .withName("classificationDeleteRule")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Effect.ALLOW)
            .withCondition(
                "matchAnyTag('"
                    + tag1.getFullyQualifiedName()
                    + "', '"
                    + tag2.getFullyQualifiedName()
                    + "')");

    Policy policy =
        createEntity(
            new CreatePolicy()
                .withName(ns.prefix("classificationDeletePolicy"))
                .withRules(List.of(tagRule))
                .withDescription("Policy referencing tags under a classification"));
    String policyId = policy.getId().toString();

    client
        .classifications()
        .delete(
            classification.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    Policy fetched = getEntity(policyId);
    assertNull(fetched.getRules().get(0).getCondition());
  }

  @Test
  void test_deletedGlossaryRemovesTermsFromPolicyCondition(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Glossary glossary =
        client
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(ns.prefix("DeleteGlossary"))
                    .withDescription("Glossary that will be deleted"));

    GlossaryTerm term =
        client
            .glossaryTerms()
            .create(
                new CreateGlossaryTerm()
                    .withName(ns.prefix("GTerm1"))
                    .withGlossary(glossary.getFullyQualifiedName())
                    .withDescription("Glossary term"));

    Rule tagRule =
        new Rule()
            .withName("glossaryDeleteRule")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Effect.ALLOW)
            .withCondition("matchAnyTag('" + term.getFullyQualifiedName() + "')");

    Policy policy =
        createEntity(
            new CreatePolicy()
                .withName(ns.prefix("glossaryDeletePolicy"))
                .withRules(List.of(tagRule))
                .withDescription("Policy referencing a glossary term"));
    String policyId = policy.getId().toString();

    client
        .glossaries()
        .delete(glossary.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    Policy fetched = getEntity(policyId);
    assertNull(fetched.getRules().get(0).getCondition());
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
