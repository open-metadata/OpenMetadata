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

package org.openmetadata.service.resources.policies;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static java.util.Collections.emptyList;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.DEPARTMENT;
import static org.openmetadata.schema.entity.policies.accessControl.Rule.Effect.ALLOW;
import static org.openmetadata.schema.entity.policies.accessControl.Rule.Effect.DENY;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_ALL;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;
import static org.openmetadata.service.Entity.ALL_RESOURCES;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.exception.CatalogExceptionMessage.failedToEvaluate;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.EntityUtil.getRuleField;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import com.google.common.collect.Lists;
import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.policies.accessControl.Rule.Effect;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Function;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ResourceDescriptor;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.FunctionList;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.policies.PolicyResource.PolicyList;
import org.openmetadata.service.resources.policies.PolicyResource.ResourceDescriptorList;
import org.openmetadata.service.resources.teams.RoleResourceTest;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.policyevaluator.RuleEvaluator;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class PolicyResourceTest extends EntityResourceTest<Policy, CreatePolicy> {
  public static final TableResourceTest TABLE_TEST = new TableResourceTest();
  public static final TeamResourceTest TEAM_TEST = new TeamResourceTest();

  public PolicyResourceTest() {
    super(
        Entity.POLICY,
        Policy.class,
        PolicyList.class,
        "policies",
        PolicyResource.FIELDS,
        Entity.ORGANIZATION_POLICY_NAME);
  }

  public void setupPolicies() throws IOException {
    CREATE_ACCESS_PERMISSION_POLICY =
        createEntity(createAccessControlPolicyWithCreateRule(), ADMIN_AUTH_HEADERS);
    POLICY1 = createEntity(createRequest("policy1").withOwners(null), ADMIN_AUTH_HEADERS);
    POLICY2 = createEntity(createRequest("policy2").withOwners(null), ADMIN_AUTH_HEADERS);
    TEAM_ONLY_POLICY = getEntityByName("TeamOnlyPolicy", "", ADMIN_AUTH_HEADERS);
    TEAM_ONLY_POLICY_RULES = TEAM_ONLY_POLICY.getRules();
  }

  @Override
  public CreatePolicy createRequest(String name) {
    List<Rule> rules = new ArrayList<>();
    rules.add(
        accessControlRule(
            "rule1", List.of(ALL_RESOURCES), List.of(MetadataOperation.EDIT_DESCRIPTION), ALLOW));
    return createAccessControlPolicyWithRules(name, rules);
  }

  @Override
  @SneakyThrows
  public void validateCreatedEntity(
      Policy policy, CreatePolicy createRequest, Map<String, String> authHeaders) {
    if (createRequest.getLocation() != null) {
      assertEquals(createRequest.getLocation(), policy.getLocation().getId());
    }
    if (createRequest.getRules().size() > 1) {
      createRequest.getRules().sort(Comparator.comparing(Rule::getName));
    }
    policy.getRules().sort(Comparator.comparing(Rule::getName));
    assertEquals(createRequest.getRules(), policy.getRules());
  }

  @Override
  public void compareEntities(Policy expected, Policy updated, Map<String, String> authHeaders) {}

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("policyUrl")) {
      URI expectedPolicyUrl = (URI) expected;
      URI actualPolicyUrl = URI.create((String) actual);
      assertEquals(expectedPolicyUrl, actualPolicyUrl);
    } else if (fieldName.equals("location")) {
      assertEntityReferenceFieldChange(expected, actual);
    } else if (fieldName.equals("rules")) {
      @SuppressWarnings("unchecked")
      List<Rule> expectedRule = (List<Rule>) expected;
      List<Rule> actualRule = JsonUtils.readObjects(actual.toString(), Rule.class);
      assertEquals(expectedRule, actualRule);
    } else if (fieldName.startsWith("rules") && (fieldName.endsWith("effect"))) {
      Effect expectedEffect = (Effect) expected;
      Effect actualEffect = Effect.fromValue(actual.toString());
      assertEquals(expectedEffect, actualEffect);
    } else if (fieldName.startsWith("rules") && (fieldName.endsWith("operations"))) {
      assertEquals(expected.toString(), actual.toString());
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  @Test
  void post_validPolicies_as_admin_200_OK(TestInfo test) throws IOException {
    // Create valid policy
    CreatePolicy create = createRequest(test);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_AccessControlPolicyWithValidRules_200_ok(TestInfo test) throws IOException {
    List<Rule> rules = new ArrayList<>();
    rules.add(
        accessControlRule(
            List.of(ALL_RESOURCES), List.of(MetadataOperation.EDIT_DESCRIPTION), ALLOW));
    rules.add(
        accessControlRule(List.of(ALL_RESOURCES), List.of(MetadataOperation.EDIT_TAGS), DENY));
    CreatePolicy create = createAccessControlPolicyWithRules(getEntityName(test), rules);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_AccessControlPolicyWithInvalidRules_400_error(TestInfo test) {
    // Adding a rule without operation should be disallowed
    String policyName = getEntityName(test);
    List<Rule> rules = new ArrayList<>();
    rules.add(accessControlRule(List.of(ALL_RESOURCES), null, ALLOW));
    CreatePolicy create1 = createAccessControlPolicyWithRules(policyName, rules);
    assertResponse(
        () -> createEntity(create1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param operations must not be null]");

    // Adding a rule without resources should be disallowed
    policyName = getEntityName(test, 1);
    rules = new ArrayList<>();
    rules.add(accessControlRule(null, List.of(MetadataOperation.DELETE), ALLOW));
    CreatePolicy create2 = createAccessControlPolicyWithRules(policyName, rules);
    assertResponse(
        () -> createEntity(create2, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param resources must not be null]");
  }

  @Test
  void post_testResourceAndOperationsFiltering(TestInfo test) throws HttpResponseException {
    String policyName = getEntityName(test);
    List<Rule> rules = new ArrayList<>();

    // Resources TABLE and TAG are redundant with ALL_RESOURCES
    List<String> resources = listOf(ALL_RESOURCES, Entity.TABLE, Entity.TAG);

    // Operations VIEW_BASIC, VIEW_QUERIES is redundant with VIEW_ALL
    // Operations EDIT_TESTS, EDIT_TAGS is redundant with EDIT_ALL
    List<MetadataOperation> operations =
        listOf(
            VIEW_ALL,
            MetadataOperation.VIEW_BASIC,
            MetadataOperation.VIEW_QUERIES,
            EDIT_ALL,
            MetadataOperation.EDIT_TESTS,
            MetadataOperation.EDIT_TAGS);
    rules.add(accessControlRule(resources, operations, ALLOW));
    CreatePolicy create = createAccessControlPolicyWithRules(policyName, rules);
    Policy policy = createEntity(create, ADMIN_AUTH_HEADERS);

    assertEquals(listOf(ALL_RESOURCES), policy.getRules().get(0).getResources());
    assertEquals(listOf(EDIT_ALL, VIEW_ALL), policy.getRules().get(0).getOperations());
  }

  @Test
  void test_policiesWithInvalidConditions(TestInfo test) throws HttpResponseException {
    // This test checks to see if invalid expression is handled in Rule conditions by:
    // - Posting a policy that has a rule with invalid condition
    // - By checking validation api for rule conditions
    String policyName = getEntityName(test);

    // Ensure validation API works for the valid conditions
    for (String condition :
        List.of("isOwner()", "!isOwner()", "noOwner()", "isOwner() || noOwner()")) {
      validateCondition(condition); // No exception should be thrown
    }

    // No ending parenthesis
    failsToParse(policyName, "!matchAnyTag('tag1'");

    // No starting parenthesis
    failsToParse(policyName, "!matchAnyTag'tag1')");

    // Non-terminating quoted string 'unexpectedParam (missing end quote) or unexpectedParam'
    // (missing beginning quote)
    failsToParse(policyName, "!isOwner('unexpectedParam)");
    failsToParse(policyName, "!isOwner(unexpectedParam')");

    // Incomplete expressions - right operand problem
    failsToParse(policyName, "!isOwner() ||");
    failsToParse(policyName, "|| isOwner()");

    // Incomplete expressions
    failsToParse(policyName, "!");

    // isOwner() has Unexpected input parameter
    failsToEvaluate(policyName, "!isOwner('unexpectedParam')");

    // Invalid text
    failsToEvaluate(policyName, "a");
    failsToEvaluate(policyName, "abc");

    // Invalid tag names to expressions that have tag names as parameters
    validateCondition(
        policyName,
        "matchAllTags('invalidTag')",
        failedToEvaluate(entityNotFound(Entity.TAG, "invalidTag")));
    validateCondition(
        policyName,
        "matchAnyTag('invalidTag')",
        failedToEvaluate(entityNotFound(Entity.TAG, "invalidTag")));
    validateCondition(
        policyName,
        "inAnyTeam('invalidTeam')",
        failedToEvaluate(entityNotFound(Entity.TEAM, "invalidTeam")));
    validateCondition(
        policyName,
        "hasAnyRole('invalidRole')",
        failedToEvaluate(entityNotFound(Entity.ROLE, "invalidRole")));
  }

  @Test
  void delete_Disallowed() {
    List<EntityReference> policies = new ArrayList<>(DATA_CONSUMER_ROLE.getPolicies());
    policies.addAll(DATA_STEWARD_ROLE.getPolicies());
    policies.add(TEAM_ONLY_POLICY.getEntityReference());

    for (EntityReference policy : policies) {
      assertResponse(
          () -> deleteEntity(policy.getId(), ADMIN_AUTH_HEADERS),
          BAD_REQUEST,
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(policy.getName(), Entity.POLICY));
    }
  }

  private void failsToParse(String policyName, String condition) {
    validateCondition(policyName, condition, "Failed to parse");
  }

  private void failsToEvaluate(String policyName, String condition) {
    validateCondition(policyName, condition, "Failed to evaluate");
  }

  private void validateCondition(String policyName, String condition, String expectedReason) {
    Rule rule =
        accessControlRule(List.of(ALL_RESOURCES), List.of(MetadataOperation.ALL), ALLOW)
            .withCondition(condition);
    CreatePolicy create = createAccessControlPolicyWithRules(policyName, List.of(rule));
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, expectedReason);
    assertResponseContains(() -> validateCondition(condition), BAD_REQUEST, expectedReason);
  }

  @Test
  void patch_PolicyRules(TestInfo test) throws IOException {
    Rule rule1 = accessControlRule("rule1", List.of(ALL_RESOURCES), List.of(VIEW_ALL), ALLOW);
    Policy policy =
        createAndCheckEntity(createRequest(test).withRules(List.of(rule1)), ADMIN_AUTH_HEADERS);

    // Change existing rule1 fields
    String origJson = JsonUtils.pojoToJson(policy);
    ChangeDescription change = getChangeDescription(policy, MINOR_UPDATE);
    rule1
        .withDescription("description")
        .withEffect(DENY)
        .withResources(List.of("table"))
        .withOperations(List.of(EDIT_ALL))
        .withCondition("isOwner()");
    fieldAdded(change, getRuleField(rule1, FIELD_DESCRIPTION), "description");
    fieldUpdated(change, getRuleField(rule1, "effect"), ALLOW, DENY);
    fieldUpdated(
        change, getRuleField(rule1, "resources"), List.of(ALL_RESOURCES), List.of("table"));
    fieldUpdated(change, getRuleField(rule1, "operations"), List.of(VIEW_ALL), List.of(EDIT_ALL));
    fieldAdded(change, getRuleField(rule1, "condition"), "isOwner()");
    policy.setRules(List.of(rule1));
    policy = patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Change existing rule1 fields. Update description and condition
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(policy);
    change = getChangeDescription(policy, MINOR_UPDATE);
    rule1.withDescription("newDescription").withCondition("noOwner()");
    fieldUpdated(change, getRuleField(rule1, FIELD_DESCRIPTION), "description", "newDescription");
    fieldUpdated(change, getRuleField(rule1, "condition"), "isOwner()", "noOwner()");
    policy.setRules(List.of(rule1));
    policy = patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add a new rule - Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(policy);
    Rule newRule =
        accessControlRule(
            "newRule", List.of(ALL_RESOURCES), List.of(MetadataOperation.EDIT_DESCRIPTION), ALLOW);
    policy.getRules().add(newRule);
    change = getChangeDescription(policy, MINOR_UPDATE);
    fieldAdded(change, "rules", listOf(newRule));
    policy = patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Delete rule1 rule
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(policy);
    policy.setRules(List.of(newRule));
    change = getChangeDescription(policy, MINOR_UPDATE);
    fieldDeleted(change, "rules", List.of(rule1));
    patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void get_policyResources() throws HttpResponseException {
    // Get list of policy resources and make sure it has all the entities and other resources
    ResourceDescriptorList actualResourceDescriptors = getPolicyResources(ADMIN_AUTH_HEADERS);
    assertNotNull(actualResourceDescriptors.getData());

    // Ensure all entities are captured in resource descriptor list
    Set<String> entities = Entity.getEntityList();
    for (String entity : entities) {
      ResourceDescriptor resourceDescriptor =
          actualResourceDescriptors.getData().stream()
              .filter(rd -> rd.getName().equals(entity))
              .findFirst()
              .orElse(null);
      assertNotNull(
          resourceDescriptor, String.format("Resource descriptor not found for entity %s", entity));
    }
  }

  @Test
  void get_policyTeamsAndRoles(TestInfo test) throws IOException {
    // Ensure policy returns teams and roles that are part of

    // Create 5 policies
    List<Policy> policies = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      CreatePolicy create = createRequest(test, i);
      policies.add(createEntity(create, ADMIN_AUTH_HEADERS));
    }

    List<Team> teams = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      // Team X has Policy X
      CreateTeam createTeam =
          TEAM_TEST.createRequest(test, i).withPolicies(List.of(policies.get(i).getId()));
      teams.add(TEAM_TEST.createEntity(createTeam, ADMIN_AUTH_HEADERS));
    }

    // Create a role with all the policies
    RoleResourceTest roleResourceTest = new RoleResourceTest();
    CreateRole createRole =
        roleResourceTest.createRequest(test).withPolicies(EntityUtil.toFQNs(policies));
    Role role = roleResourceTest.createEntity(createRole, ADMIN_AUTH_HEADERS);

    // Get each policy and ensure the teams and roles are listed correctly
    for (int i = 0; i < 3; i++) {
      Policy getPolicy = getEntity(policies.get(i).getId(), "teams,roles", ADMIN_AUTH_HEADERS);
      assertReference(teams.get(i).getEntityReference(), getPolicy.getTeams().get(0));
      assertReference(role.getEntityReference(), getPolicy.getRoles().get(0));
    }
  }

  @Test
  void patch_usingFqn_PolicyRules(TestInfo test) throws IOException {
    Rule rule1 = accessControlRule("rule1", List.of(ALL_RESOURCES), List.of(VIEW_ALL), ALLOW);
    Policy policy =
        createAndCheckEntity(createRequest(test).withRules(List.of(rule1)), ADMIN_AUTH_HEADERS);

    // Change existing rule1 fields
    String origJson = JsonUtils.pojoToJson(policy);
    ChangeDescription change = getChangeDescription(policy, MINOR_UPDATE);
    rule1
        .withDescription("description")
        .withEffect(DENY)
        .withResources(List.of("table"))
        .withOperations(List.of(EDIT_ALL))
        .withCondition("isOwner()");
    fieldAdded(change, getRuleField(rule1, FIELD_DESCRIPTION), "description");
    fieldUpdated(change, getRuleField(rule1, "effect"), ALLOW, DENY);
    fieldUpdated(
        change, getRuleField(rule1, "resources"), List.of(ALL_RESOURCES), List.of("table"));
    fieldUpdated(change, getRuleField(rule1, "operations"), List.of(VIEW_ALL), List.of(EDIT_ALL));
    fieldAdded(change, getRuleField(rule1, "condition"), "isOwner()");
    policy.setRules(List.of(rule1));
    policy =
        patchEntityUsingFqnAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Change existing rule1 fields. Update description and condition
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(policy);
    change = getChangeDescription(policy, MINOR_UPDATE);
    rule1.withDescription("newDescription").withCondition("noOwner()");
    fieldUpdated(change, getRuleField(rule1, FIELD_DESCRIPTION), "description", "newDescription");
    fieldUpdated(change, getRuleField(rule1, "condition"), "isOwner()", "noOwner()");
    policy.setRules(List.of(rule1));
    policy =
        patchEntityUsingFqnAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add a new rule - Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(policy);
    Rule newRule =
        accessControlRule(
            "newRule", List.of(ALL_RESOURCES), List.of(MetadataOperation.EDIT_DESCRIPTION), ALLOW);
    policy.getRules().add(newRule);
    change = getChangeDescription(policy, MINOR_UPDATE);
    fieldAdded(change, "rules", listOf(newRule));
    policy =
        patchEntityUsingFqnAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Delete rule1 rule
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(policy);
    policy.setRules(List.of(newRule));
    change = getChangeDescription(policy, MINOR_UPDATE);
    // Revert all the changes made to rule1 to the state when it was added first
    fieldDeleted(change, "rules", List.of(rule1));
    patchEntityUsingFqnAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void get_policyFunctions() throws HttpResponseException {
    // Ensure all the functions for authoring policy rule conditions are returned
    List<Function> actualFunctions = getPolicyFunctions(ADMIN_AUTH_HEADERS).getData();
    List<Function> expectedFunctions =
        CollectionRegistry.getInstance().getFunctions(RuleEvaluator.class);
    assertEquals(expectedFunctions, actualFunctions);
  }

  @Test
  void test_roles_policies_scenarios() throws HttpResponseException {
    //
    // Create a team hierarchy:
    // - Organization has Team1 with user1 and Team2 with user2
    // - Team1 has Team11 with user11 and table11, and Team12 with user12 and table12
    // - Team2 has Team21 with user21 and Team22 with user22
    // - Team2 has DATA_STEWARD_ROLE which is inherited by user2, user21, and user22
    //
    CreateTeam createTeam = TEAM_TEST.createRequest("rolesPoliciesTeam1").withTeamType(DEPARTMENT);
    Team team1 = TEAM_TEST.createEntity(createTeam, ADMIN_AUTH_HEADERS);
    createTeam =
        TEAM_TEST
            .createRequest("rolesPoliciesTeam2")
            .withTeamType(DEPARTMENT)
            .withDefaultRoles(listOf(DATA_STEWARD_ROLE.getId()));
    Team team2 = TEAM_TEST.createEntity(createTeam, ADMIN_AUTH_HEADERS);
    createTeam = TEAM_TEST.createRequest("rolesPoliciesTeam11").withParents(listOf(team1.getId()));
    Team team11 = TEAM_TEST.createEntity(createTeam, ADMIN_AUTH_HEADERS);
    createTeam = TEAM_TEST.createRequest("rolesPoliciesTeam12").withParents(listOf(team1.getId()));
    Team team12 = TEAM_TEST.createEntity(createTeam, ADMIN_AUTH_HEADERS);
    createTeam = TEAM_TEST.createRequest("rolesPoliciesTeam21").withParents(listOf(team2.getId()));
    Team team21 = TEAM_TEST.createEntity(createTeam, ADMIN_AUTH_HEADERS);
    createTeam = TEAM_TEST.createRequest("rolesPoliciesTeam22").withParents(listOf(team2.getId()));
    Team team22 = TEAM_TEST.createEntity(createTeam, ADMIN_AUTH_HEADERS);

    // Create users - Team2 has default role DataSteward
    UserResourceTest userTest = new UserResourceTest();
    CreateUser createUser =
        userTest.createRequest("rolesAndPoliciesUser1").withTeams(listOf(team1.getId()));
    User user1 = userTest.createEntity(createUser, ADMIN_AUTH_HEADERS);
    createUser = userTest.createRequest("rolesAndPoliciesUser2").withTeams(listOf(team2.getId()));
    User user2 = userTest.createEntity(createUser, ADMIN_AUTH_HEADERS);
    createUser = userTest.createRequest("rolesAndPoliciesUser11").withTeams(listOf(team11.getId()));
    User user11 = userTest.createEntity(createUser, ADMIN_AUTH_HEADERS);
    createUser = userTest.createRequest("rolesAndPoliciesUser12").withTeams(listOf(team12.getId()));
    User user12 = userTest.createEntity(createUser, ADMIN_AUTH_HEADERS);
    createUser = userTest.createRequest("rolesAndPoliciesUser21").withTeams(listOf(team21.getId()));
    User user21 = userTest.createEntity(createUser, ADMIN_AUTH_HEADERS);
    createUser = userTest.createRequest("rolesAndPoliciesUser22").withTeams(listOf(team22.getId()));
    User user22 = userTest.createEntity(createUser, ADMIN_AUTH_HEADERS);

    // Create resources - table11 has PII sensitive tags
    CreateTable createTable =
        TABLE_TEST
            .createRequest("rolesAndPoliciesTable11")
            .withOwners(List.of(team11.getEntityReference()))
            .withTags(listOf(PII_SENSITIVE_TAG_LABEL));
    Table table11 = TABLE_TEST.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // table12 does not have PII
    createTable =
        TABLE_TEST
            .createRequest("rolesAndPoliciesTable12")
            .withOwners(List.of(team12.getEntityReference()));
    createTable.getColumns().forEach(c -> c.withTags(null)); // Clear all the tag labels
    Table table12 = TABLE_TEST.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Create policies
    Policy denyAllPIIAccess = createPolicy("disallowAllPIIAccess", "matchAnyTag('PII.Sensitive')");
    Policy denyPIIAccessExceptTeam11 =
        createPolicy(
            "denyPIIAccessExceptTeam11",
            "matchAnyTag('PII.Sensitive') && !inAnyTeam('rolesPoliciesTeam11')");
    Policy denyPIIAccessExceptTeam1 =
        createPolicy(
            "denyPIIAccessExceptTeam1",
            "matchAnyTag('PII.Sensitive') && !inAnyTeam('rolesPoliciesTeam1')");
    Policy denyPIIAccessExceptRole =
        createPolicy(
            "denyPIIAccessExceptRole",
            "matchAnyTag('PII.Sensitive') && !hasAnyRole('DataSteward')");

    // Array made of team, policy to attach to the team, allowed users list, denied users list,
    // entity being accessed
    Object[][] scenarios = {
      // 0 - TEAM_ONLY_POLICY attached to team11. Only user11 in team11 has access
      {
        team11,
        TEAM_ONLY_POLICY,
        listOf(user11),
        listOf(user1, user2, user12, user21, user22),
        table11
      },
      // 1 - TEAM_ONLY_POLICY attached to team1. All the users under team1 have access
      {
        team1,
        TEAM_ONLY_POLICY,
        listOf(user1, user11, user12),
        listOf(user2, user21, user22),
        table11
      },
      // 2 - denyPIIAccess attached to team1. No users can access table11 that has PII
      {
        team1,
        denyAllPIIAccess,
        emptyList(),
        listOf(user1, user2, user11, user12, user21, user22),
        table11
      },
      // 3 - denyPIIAccess attached to team1. All users can access table12 that has no PII
      {
        team1,
        denyAllPIIAccess,
        listOf(user1, user11, user12, user2, user21, user22),
        emptyList(),
        table12
      },
      // 4 - denyPIIAccessExceptTeam11 attached to team1. Only Team11 users can access table11 with
      // PII
      {
        team1,
        denyPIIAccessExceptTeam11,
        listOf(user11),
        listOf(user1, user2, user12, user21, user22),
        table11
      },
      // 5 - denyPIIAccessExceptTeam11 attached to team1. All users can access table12 that has no
      // PII
      {
        team1,
        denyPIIAccessExceptTeam11,
        listOf(user1, user11, user12, user2, user21, user22),
        emptyList(),
        table12
      },
      // 6 - denyPIIAccessExceptTeam11 attached to team11. Only Team11 users can access table11 with
      // PII
      {
        team11,
        denyPIIAccessExceptTeam11,
        listOf(user11),
        listOf(user1, user2, user12, user21, user22),
        table11
      },
      // 7 - denyPIIAccessExceptTeam11 attached to team11. All users can access table12 that has no
      // PII
      {
        team11,
        denyPIIAccessExceptTeam11,
        listOf(user1, user11, user12, user2, user21, user22),
        emptyList(),
        table12
      },
      // 8 - denyPIIAccessExceptTeam1 attached to team1. Only Team1 users can access table11 with
      // PII
      {
        team1,
        denyPIIAccessExceptTeam1,
        listOf(user1, user11, user12),
        listOf(user2, user21, user22),
        table11
      },
      // 9 - denyPIIAccessExceptTeam1 attached to team1. All users can access table12 that has no
      // PII
      {
        team1,
        denyPIIAccessExceptTeam1,
        listOf(user1, user11, user12, user2, user21, user22),
        emptyList(),
        table12
      },
      // 10 - denyPIIAccessExceptRole attached to team1. Only user2, user21 and user22 with
      // DataStewardRole can access
      {
        team1,
        denyPIIAccessExceptRole,
        listOf(user2, user21, user22),
        listOf(user1, user11, user12),
        table11
      },
      // 11- denyPIIAccessExceptRole attached to team1. All users can access table12 that has no PII
      {
        team1,
        denyPIIAccessExceptTeam1,
        listOf(user1, user11, user12, user2, user21, user22),
        emptyList(),
        table12
      },
    };
    for (int i = 0; i < scenarios.length; i++) {
      Object[] scenario = scenarios[i];
      testScenario(i, scenario);
    }
  }

  private Policy createPolicy(String name, String condition) throws HttpResponseException {
    validateCondition(condition); // No exception should be thrown
    Rule rule =
        new Rule()
            .withName(name)
            .withResources(listOf(ALL_RESOURCES))
            .withOperations(listOf(MetadataOperation.ALL))
            .withEffect(DENY)
            .withCondition(condition);
    CreatePolicy createPolicy = createRequest(name).withRules(listOf(rule));
    return createEntity(createPolicy, ADMIN_AUTH_HEADERS);
  }

  @SuppressWarnings("unchecked")
  private void testScenario(int index, Object[] scenario) throws HttpResponseException {
    Team team = (Team) scenario[0];
    Policy policy = (Policy) scenario[1];
    List<User> allowedUsers = (List<User>) scenario[2];
    List<User> disallowedUsers = (List<User>) scenario[3];
    Table table = (Table) scenario[4];
    addTeamPolicy(team, policy);
    LOG.info(
        "Testing scenario at {} with team:{} policy:{} table:{}",
        index,
        team.getName(),
        policy.getName(),
        table.getName());
    checkAccess(allowedUsers, disallowedUsers, table);
    removeTeamPolicy(team);
  }

  @Override
  public Policy validateGetWithDifferentFields(Policy policy, boolean byName)
      throws HttpResponseException {
    String fields = "";
    policy =
        byName
            ? getEntityByName(policy.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(policy.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(policy.getOwners(), policy.getLocation());

    // .../policies?fields=owner,displayName,policyUrl
    fields = "owners,location";
    policy =
        byName
            ? getEntityByName(policy.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(policy.getId(), fields, ADMIN_AUTH_HEADERS);
    // Field location is set during creation - tested elsewhere
    assertListNotNull(policy.getOwners() /*, policy.getLocation()*/);
    // Checks for other owner, tags, and followers is done in the base class
    return policy;
  }

  private CreatePolicy createAccessControlPolicyWithRules(String name, List<Rule> rules) {
    return new CreatePolicy()
        .withName(name)
        .withDescription("description")
        .withRules(rules)
        .withOwners(Lists.newArrayList(USER1_REF));
  }

  private CreatePolicy createAccessControlPolicyWithCreateRule() {
    return new CreatePolicy()
        .withName("CreatePermissionPolicy")
        .withDescription("Create User Permission")
        .withRules(
            List.of(
                new Rule()
                    .withName("CreatePermission")
                    .withResources(List.of(ALL_RESOURCES))
                    .withOperations(List.of(MetadataOperation.CREATE))
                    .withEffect(ALLOW)));
  }

  private void validateCondition(String expression) throws HttpResponseException {
    WebTarget target = getResource(collectionName + "/validation/condition/" + expression);
    TestUtils.get(target, ADMIN_AUTH_HEADERS);
  }

  public final ResourceDescriptorList getPolicyResources(Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(collectionName + "/resources");
    return TestUtils.get(target, ResourceDescriptorList.class, authHeaders);
  }

  public final FunctionList getPolicyFunctions(Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(collectionName + "/functions");
    return TestUtils.get(target, FunctionList.class, authHeaders);
  }

  private static Rule accessControlRule(
      List<String> resources, List<MetadataOperation> operations, Effect effect) {
    String name = "rule" + new Random().nextInt(21);
    return accessControlRule(name, resources, operations, effect);
  }

  private static Rule accessControlRule(
      String name, List<String> resources, List<MetadataOperation> operations, Effect effect) {
    return new Rule()
        .withName(name)
        .withResources(resources)
        .withOperations(operations)
        .withEffect(effect);
  }

  private void addTeamPolicy(Team team, Policy policy) throws HttpResponseException {
    String json = JsonUtils.pojoToJson(team);
    team.setPolicies(listOf(policy.getEntityReference()));
    TEAM_TEST.patchEntity(team.getId(), json, team, ADMIN_AUTH_HEADERS);
  }

  private void removeTeamPolicy(Team team) throws HttpResponseException {
    String json = JsonUtils.pojoToJson(team);
    team.setPolicies(null);
    TEAM_TEST.patchEntity(team.getId(), json, team, ADMIN_AUTH_HEADERS);
  }

  private void checkAccess(List<User> allowedUsers, List<User> deniedUsers, Table table)
      throws HttpResponseException {
    for (User allowed : allowedUsers) {
      LOG.info("Expecting access allowed for user:{}", allowed.getName());
      assertNotNull(TABLE_TEST.getEntity(table.getId(), "", authHeaders(allowed.getName())));
    }
    for (User deniedUser : deniedUsers) {
      LOG.info("Expecting access denied for user:{}", deniedUser.getName());
      assertResponseContains(
          () -> TABLE_TEST.getEntity(table.getId(), "", authHeaders(deniedUser.getName())),
          FORBIDDEN,
          "denied");
    }
  }
}
