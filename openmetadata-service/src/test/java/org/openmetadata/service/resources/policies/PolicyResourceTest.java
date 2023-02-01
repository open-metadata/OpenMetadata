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

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.schema.entity.policies.accessControl.Rule.Effect.ALLOW;
import static org.openmetadata.schema.entity.policies.accessControl.Rule.Effect.DENY;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_ALL;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
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

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Random;
import javax.ws.rs.client.WebTarget;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateLocation;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.data.Location;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.policies.accessControl.Rule.Effect;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Function;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ResourceDescriptor;
import org.openmetadata.service.Entity;
import org.openmetadata.service.FunctionList;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.locations.LocationResourceTest;
import org.openmetadata.service.resources.policies.PolicyResource.PolicyList;
import org.openmetadata.service.resources.policies.PolicyResource.ResourceDescriptorList;
import org.openmetadata.service.resources.teams.RoleResourceTest;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.security.policyevaluator.RuleEvaluator;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ParallelizeTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@ParallelizeTest
public class PolicyResourceTest extends EntityResourceTest<Policy, CreatePolicy> {

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
    POLICY1 = createEntity(createRequest("policy1").withOwner(null), ADMIN_AUTH_HEADERS);
    POLICY2 = createEntity(createRequest("policy2").withOwner(null), ADMIN_AUTH_HEADERS);
    TEAM_ONLY_POLICY = getEntityByName("TeamOnlyPolicy", "", ADMIN_AUTH_HEADERS);
    TEAM_ONLY_POLICY_RULES = TEAM_ONLY_POLICY.getRules();
  }

  @Override
  public CreatePolicy createRequest(String name) {
    List<Rule> rules = new ArrayList<>();
    rules.add(accessControlRule("rule1", List.of("all"), List.of(MetadataOperation.EDIT_DESCRIPTION), ALLOW));
    return createAccessControlPolicyWithRules(name, rules);
  }

  @Override
  @SneakyThrows
  public void validateCreatedEntity(Policy policy, CreatePolicy createRequest, Map<String, String> authHeaders) {
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
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("policyUrl")) {
      URI expectedPolicyUrl = (URI) expected;
      URI actualPolicyUrl = URI.create((String) actual);
      assertEquals(expectedPolicyUrl, actualPolicyUrl);
    } else if (fieldName.equals("location")) {
      EntityReference expectedLocation = (EntityReference) expected;
      EntityReference actualLocation = JsonUtils.readValue(actual.toString(), EntityReference.class);
      assertEquals(expectedLocation.getId(), actualLocation.getId());
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
    rules.add(accessControlRule(List.of("all"), List.of(MetadataOperation.EDIT_DESCRIPTION), ALLOW));
    rules.add(accessControlRule(List.of("all"), List.of(MetadataOperation.EDIT_TAGS), DENY));
    CreatePolicy create = createAccessControlPolicyWithRules(getEntityName(test), rules);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_AccessControlPolicyWithInvalidRules_400_error(TestInfo test) {
    // Adding a rule without operation should be disallowed
    String policyName = getEntityName(test);
    List<Rule> rules = new ArrayList<>();
    rules.add(accessControlRule(List.of("all"), null, ALLOW));
    CreatePolicy create1 = createAccessControlPolicyWithRules(policyName, rules);
    assertResponse(() -> createEntity(create1, ADMIN_AUTH_HEADERS), BAD_REQUEST, "[operations must not be null]");

    // Adding a rule without resources should be disallowed
    policyName = getEntityName(test, 1);
    rules = new ArrayList<>();
    rules.add(accessControlRule(null, List.of(MetadataOperation.DELETE), ALLOW));
    CreatePolicy create2 = createAccessControlPolicyWithRules(policyName, rules);
    assertResponse(() -> createEntity(create2, ADMIN_AUTH_HEADERS), BAD_REQUEST, "[resources must not be null]");
  }

  @Test
  void test_policiesWithInvalidConditions(TestInfo test) throws HttpResponseException {
    // This test checks to see if invalid expression is handled in Rule conditions by:
    // - Posting a policy that has a rule with invalid condition
    // - By checking validation api for rule conditions
    String policyName = getEntityName(test);

    // Ensure validation API works for the valid conditions
    for (String condition : List.of("isOwner()", "!isOwner()", "noOwner()", "isOwner() || noOwner()")) {
      validateCondition(condition); // No exception should be thrown
    }

    // No ending parenthesis
    failsToParse(policyName, "!matchAnyTag('tag1'");

    // No starting parenthesis
    failsToParse(policyName, "!matchAnyTag'tag1')");

    // Non-terminating quoted string 'unexpectedParam (missing end quote) or unexpectedParam' (missing beginning quote)
    failsToParse(policyName, "!isOwner('unexpectedParam)");
    failsToParse(policyName, "!isOwner(unexpectedParam')");

    // Incomplete expressions - right operand problem
    failsToParse(policyName, "!isOwner() ||");
    failsToParse(policyName, "|| isOwner()");

    // Incomplete expressions
    failsToParse(policyName, "!");

    // isOwner() has Unexpected input parameter
    failsToEvaluate(policyName, "!isOwner('unexpectedParam')");

    // Invalid function name
    failsToEvaluate(policyName, "invalidFunction()");
    failsToEvaluate(policyName, "isOwner() || invalidFunction()");

    // Invalid text
    failsToEvaluate(policyName, "a");
    failsToEvaluate(policyName, "abc");
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
    Rule rule = accessControlRule(List.of("all"), List.of(MetadataOperation.ALL), ALLOW).withCondition(condition);
    CreatePolicy create = createAccessControlPolicyWithRules(policyName, List.of(rule));
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, expectedReason);
    assertResponseContains(() -> validateCondition(condition), BAD_REQUEST, expectedReason);
  }

  @Test
  void patch_PolicyAttributes_200_ok(TestInfo test) throws IOException {
    Policy policy = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS).withLocation(null);

    // Set enabled to false
    String origJson = JsonUtils.pojoToJson(policy);
    policy.setEnabled(false);
    ChangeDescription change = getChangeDescription(policy.getVersion());
    fieldUpdated(change, "enabled", true, false);
    policy = patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    Location location = createLocation();
    EntityReference locationReference = location.getEntityReference();

    // Add new field location
    origJson = JsonUtils.pojoToJson(policy);
    policy.setLocation(locationReference);
    change = getChangeDescription(policy.getVersion());
    fieldAdded(change, "location", locationReference);
    patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void patch_PolicyRules(TestInfo test) throws IOException {
    Rule rule1 = accessControlRule("rule1", List.of("all"), List.of(VIEW_ALL), ALLOW);
    Policy policy = createAndCheckEntity(createRequest(test).withRules(List.of(rule1)), ADMIN_AUTH_HEADERS);

    // Change existing rule1 fields
    String origJson = JsonUtils.pojoToJson(policy);
    ChangeDescription change = getChangeDescription(policy.getVersion());
    rule1
        .withDescription("description")
        .withEffect(DENY)
        .withResources(List.of("table"))
        .withOperations(List.of(EDIT_ALL))
        .withCondition("isOwner()");
    fieldAdded(change, getRuleField(rule1, FIELD_DESCRIPTION), "description");
    fieldUpdated(change, getRuleField(rule1, "effect"), ALLOW, DENY);
    fieldUpdated(change, getRuleField(rule1, "resources"), List.of("all"), List.of("table"));
    fieldUpdated(change, getRuleField(rule1, "operations"), List.of(VIEW_ALL), List.of(EDIT_ALL));
    fieldAdded(change, getRuleField(rule1, "condition"), "isOwner()");

    policy.setRules(List.of(rule1));
    policy = patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Change existing rule1 fields. Update description and condition
    origJson = JsonUtils.pojoToJson(policy);
    change = getChangeDescription(policy.getVersion());
    rule1.withDescription("newDescription").withCondition("noOwner()");
    fieldUpdated(change, getRuleField(rule1, FIELD_DESCRIPTION), "description", "newDescription");
    fieldUpdated(change, getRuleField(rule1, "condition"), "isOwner()", "noOwner()");

    policy.setRules(List.of(rule1));
    policy = patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add a new rule
    origJson = JsonUtils.pojoToJson(policy);
    Rule newRule = accessControlRule("newRule", List.of("all"), List.of(MetadataOperation.EDIT_DESCRIPTION), ALLOW);
    policy.getRules().add(newRule);
    change = getChangeDescription(policy.getVersion());
    fieldAdded(change, "rules", List.of(newRule));
    policy = patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Delete rule1 rule
    origJson = JsonUtils.pojoToJson(policy);
    policy.setRules(List.of(newRule));
    change = getChangeDescription(policy.getVersion());
    fieldDeleted(change, "rules", List.of(rule1));
    patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void get_policyResources() throws HttpResponseException {
    // Get list of policy resources and make sure it has all the entities and other resources
    ResourceDescriptorList actualResourceDescriptors = getPolicyResources(ADMIN_AUTH_HEADERS);
    assertNotNull(actualResourceDescriptors.getData());

    // Ensure all entities are captured in resource descriptor list
    List<String> entities = Entity.getEntityList();
    for (String entity : entities) {
      ResourceDescriptor resourceDescriptor =
          actualResourceDescriptors.getData().stream()
              .filter(rd -> rd.getName().equals(entity))
              .findFirst()
              .orElse(null);
      assertNotNull(resourceDescriptor);
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

    TeamResourceTest teamResourceTest = new TeamResourceTest();
    List<Team> teams = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      // Team X has Policy X
      CreateTeam createTeam = teamResourceTest.createRequest(test, i).withPolicies(List.of(policies.get(i).getId()));
      teams.add(teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS));
    }

    // Create a role with all the policies
    RoleResourceTest roleResourceTest = new RoleResourceTest();
    CreateRole createRole = roleResourceTest.createRequest(test).withPolicies(EntityUtil.toEntityReferences(policies));
    Role role = roleResourceTest.createEntity(createRole, ADMIN_AUTH_HEADERS);

    // Get each policy and ensure the teams and roles are listed correctly
    for (int i = 0; i < 3; i++) {
      Policy getPolicy = getEntity(policies.get(i).getId(), "teams,roles", ADMIN_AUTH_HEADERS);
      assertReference(teams.get(i).getEntityReference(), getPolicy.getTeams().get(0));
      assertReference(role.getEntityReference(), getPolicy.getRoles().get(0));
    }
  }

  @Test
  void get_policyFunctions() throws HttpResponseException {
    // Ensure all the functions for authoring policy rule conditions are returned
    List<Function> actualFunctions = getPolicyFunctions(ADMIN_AUTH_HEADERS).getData();
    List<Function> expectedFunctions = CollectionRegistry.getInstance().getFunctions(RuleEvaluator.class);
    assertEquals(expectedFunctions, actualFunctions);
  }

  @Override
  public Policy validateGetWithDifferentFields(Policy policy, boolean byName) throws HttpResponseException {
    String fields = "";
    policy =
        byName
            ? getEntityByName(policy.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(policy.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(policy.getOwner(), policy.getLocation());

    // .../policies?fields=owner,displayName,policyUrl
    fields = "owner,location";
    policy =
        byName
            ? getEntityByName(policy.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(policy.getId(), fields, ADMIN_AUTH_HEADERS);
    // Field location is set during creation - tested elsewhere
    assertListNotNull(policy.getOwner() /*, policy.getLocation()*/);
    // Checks for other owner, tags, and followers is done in the base class
    return policy;
  }

  private CreatePolicy createAccessControlPolicyWithRules(String name, List<Rule> rules) {
    return new CreatePolicy().withName(name).withDescription("description").withRules(rules).withOwner(USER1_REF);
  }

  private void validateCondition(String expression) throws HttpResponseException {
    WebTarget target = getResource(collectionName + "/validation/condition/" + expression);
    TestUtils.get(target, ADMIN_AUTH_HEADERS);
  }

  private Location createLocation() throws HttpResponseException {
    LocationResourceTest locationResourceTest = new LocationResourceTest();
    CreateLocation createLocation = locationResourceTest.createRequest("aws-s3", "", "", null);
    return TestUtils.post(getResource("locations"), createLocation, Location.class, ADMIN_AUTH_HEADERS);
  }

  public final ResourceDescriptorList getPolicyResources(Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(collectionName + "/resources");
    return TestUtils.get(target, ResourceDescriptorList.class, authHeaders);
  }

  public final FunctionList getPolicyFunctions(Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(collectionName + "/functions");
    return TestUtils.get(target, FunctionList.class, authHeaders);
  }

  private static Rule accessControlRule(List<String> resources, List<MetadataOperation> operations, Effect effect) {
    String name = "rule" + new Random().nextInt(21);
    return accessControlRule(name, resources, operations, effect);
  }

  private static Rule accessControlRule(
      String name, List<String> resources, List<MetadataOperation> operations, Effect effect) {
    return new Rule().withName(name).withResources(resources).withOperations(operations).withEffect(effect);
  }
}
