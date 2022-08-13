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

package org.openmetadata.catalog.resources.policies;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.catalog.entity.policies.accessControl.Rule.Effect.ALLOW;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;
import javax.ws.rs.client.WebTarget;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateLocation;
import org.openmetadata.catalog.api.policies.CreatePolicy;
import org.openmetadata.catalog.api.teams.CreateRole;
import org.openmetadata.catalog.api.teams.CreateTeam;
import org.openmetadata.catalog.entity.data.Location;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.entity.policies.accessControl.Rule.Effect;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.locations.LocationResourceTest;
import org.openmetadata.catalog.resources.policies.PolicyResource.PolicyList;
import org.openmetadata.catalog.resources.policies.PolicyResource.ResourceDescriptorList;
import org.openmetadata.catalog.resources.teams.RoleResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.type.PolicyType;
import org.openmetadata.catalog.type.ResourceDescriptor;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
public class PolicyResourceTest extends EntityResourceTest<Policy, CreatePolicy> {
  private static final String LOCATION_NAME = "aws-s3";
  private static Location location;

  public PolicyResourceTest() {
    super(Entity.POLICY, Policy.class, PolicyList.class, "policies", PolicyResource.FIELDS);
    supportsAuthorizedMetadataOperations = false; // TODO why
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    location = createLocation();
  }

  public void setupPolicies() throws HttpResponseException {
    POLICY1 = createEntity(createRequest("policy1"), ADMIN_AUTH_HEADERS);
    POLICY2 = createEntity(createRequest("policy2"), ADMIN_AUTH_HEADERS);
  }

  @Override
  public CreatePolicy createRequest(String name) {
    return new CreatePolicy().withName(name).withPolicyType(PolicyType.Lifecycle);
  }

  @Override
  @SneakyThrows
  public void validateCreatedEntity(Policy policy, CreatePolicy createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getPolicyType(), policy.getPolicyType());
    if (createRequest.getLocation() != null) {
      assertEquals(createRequest.getLocation(), policy.getLocation().getId());
    }
    assertEquals(createRequest.getRules(), EntityUtil.resolveRules(policy.getRules()));
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
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  @Test
  void post_PolicyWithoutPolicyType_400_badRequest(TestInfo test) {
    CreatePolicy create = createRequest(test).withPolicyType(null);
    assertResponse(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "[policyType must not be null]");
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
    rules.add(accessControlRule(List.of("all"), List.of(MetadataOperation.EDIT_TAGS), ALLOW));
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
  void post_policiesWithInvalidConditions(TestInfo test) {
    String policyName = getEntityName(test);
    Rule rule = accessControlRule(List.of("all"), List.of(MetadataOperation.ALL), ALLOW);
    CreatePolicy create = createAccessControlPolicyWithRules(policyName, List.of(rule));

    // No ending parenthesis
    rule.withCondition("!matchAnyTag('tag1'");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to parse");

    // No starting parenthesis
    rule.withCondition("!matchAnyTag'tag1')");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to parse");

    // Non-terminating quoted string 'unexpectedParam (missing end quote) or unexpectedParam' (missing beginning quote)
    rule.withCondition("!isOwner('unexpectedParam)");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to parse");
    rule.withCondition("!isOwner(unexpectedParam')");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to parse");

    // Incomplete expressions - right operand problem
    rule.withCondition("!isOwner() ||");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to parse");
    rule.withCondition("|| isOwner()");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to parse");

    // Incomplete expressions
    rule.withCondition("!");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to parse");

    // matchAnyTag() method does not input parameters
    rule.withCondition("!matchAnyTag()");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to evaluate");

    // isOwner() has Unexpected input parameter
    rule.withCondition("!isOwner('unexpectedParam')");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to evaluate");

    // Invalid function name
    rule.withCondition("invalidFunction()");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to evaluate");
    rule.withCondition("isOwner() || invalidFunction()");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to evaluate");

    // Function matchTags() has no input parameter
    rule.withCondition("matchTags()");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to evaluate");

    // Invalid text
    rule.withCondition("a");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to evaluate");
    rule.withCondition("abc");
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Failed to evaluate");
  }

  @Test
  void patch_PolicyAttributes_200_ok(TestInfo test) throws IOException {
    Policy policy = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS).withLocation(null);

    // Set enabled to false
    String origJson = JsonUtils.pojoToJson(policy);
    policy.setEnabled(false);
    ChangeDescription change = getChangeDescription(policy.getVersion());
    change.getFieldsUpdated().add(new FieldChange().withName("enabled").withOldValue(true).withNewValue(false));
    policy = patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    EntityReference locationReference = location.getEntityReference();

    // Add new field location
    origJson = JsonUtils.pojoToJson(policy);
    policy.setLocation(locationReference);
    change = getChangeDescription(policy.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("location").withNewValue(locationReference));
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
          actualResourceDescriptors.getData().stream().filter(rd -> rd.getName().equals(entity)).findFirst().get();
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
    return new CreatePolicy()
        .withName(name)
        .withDescription("description")
        .withPolicyType(PolicyType.AccessControl)
        .withRules(rules.stream().map(rule -> (Object) rule).collect(Collectors.toList()))
        .withOwner(USER_OWNER1);
  }

  private static Location createLocation() throws HttpResponseException {
    LocationResourceTest locationResourceTest = new LocationResourceTest();
    CreateLocation createLocation = locationResourceTest.createRequest(LOCATION_NAME, "", "", null);
    return TestUtils.post(getResource("locations"), createLocation, Location.class, ADMIN_AUTH_HEADERS);
  }

  public final ResourceDescriptorList getPolicyResources(Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(collectionName + "/resources");
    return TestUtils.get(target, ResourceDescriptorList.class, authHeaders);
  }

  private static Rule accessControlRule(List<String> resources, List<MetadataOperation> operations, Effect effect) {
    String name = "rule" + new Random().nextInt(21);
    return new Rule().withName(name).withResources(resources).withOperations(operations).withEffect(effect);
  }
}
