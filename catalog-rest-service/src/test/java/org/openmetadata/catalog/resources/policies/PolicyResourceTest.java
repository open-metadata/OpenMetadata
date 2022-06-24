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
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import org.openmetadata.catalog.entity.data.Location;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.locations.LocationResourceTest;
import org.openmetadata.catalog.resources.policies.PolicyResource.PolicyList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.type.PolicyType;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.PolicyUtils;
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
    rules.add(PolicyUtils.accessControlRule(null, null, MetadataOperation.EDIT_DESCRIPTION, true, 0));
    rules.add(PolicyUtils.accessControlRule(null, null, "DataConsumer", MetadataOperation.EDIT_TAGS, true, 1));
    CreatePolicy create = createAccessControlPolicyWithRules(getEntityName(test), rules);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_AccessControlPolicyWithInvalidRules_400_error(TestInfo test) {
    // Adding a rule without operation should be disallowed
    String policyName = getEntityName(test);
    String ruleName = "rule21";
    List<Rule> rules = new ArrayList<>();
    rules.add(PolicyUtils.accessControlRule(ruleName, null, null, null, true, 0));
    CreatePolicy create = createAccessControlPolicyWithRules(policyName, rules);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.invalidPolicyOperationNull(ruleName, policyName));
  }

  @Test
  void post_AccessControlPolicyWithDuplicateRules_400_error(TestInfo test) {
    List<Rule> rules = new ArrayList<>();
    rules.add(PolicyUtils.accessControlRule("rule1", null, null, MetadataOperation.EDIT_DESCRIPTION, true, 0));
    rules.add(PolicyUtils.accessControlRule("rule2", null, null, MetadataOperation.EDIT_TAGS, true, 1));
    rules.add(PolicyUtils.accessControlRule("rule3", null, null, MetadataOperation.EDIT_TAGS, true, 1));
    String policyName = getEntityName(test);
    CreatePolicy create = createAccessControlPolicyWithRules(policyName, rules);
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        String.format(
            "Found multiple rules with operation EditTags within policy %s. "
                + "Please ensure that operation across all rules within the policy are distinct",
            policyName));
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
  public void get_policyResources() throws HttpResponseException {
    // Get list of policy resources and make sure it has all the entities and other resources
    List<String> resources = getPolicyResources(ADMIN_AUTH_HEADERS);
    List<String> entities = Entity.listEntities();
    assertTrue(resources.containsAll(entities));
    assertTrue(resources.contains("lineage"));
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

  public final List<String> getPolicyResources(Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(collectionName + "/resources");
    return (List<String>) TestUtils.get(target, List.class, authHeaders);
  }
}
