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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.ws.rs.client.WebTarget;
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
import org.openmetadata.catalog.jdbi3.LocationRepository;
import org.openmetadata.catalog.jdbi3.PolicyRepository.PolicyEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.locations.LocationResourceTest;
import org.openmetadata.catalog.resources.policies.PolicyResource.PolicyList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.type.PolicyType;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.PolicyUtils;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
public class PolicyResourceTest extends EntityResourceTest<Policy, CreatePolicy> {

  private static final String LOCATION_NAME = "aws-s3";
  private static Location location;

  public PolicyResourceTest() {
    super(Entity.POLICY, Policy.class, PolicyList.class, "policies", PolicyResource.FIELDS, false, true, false, false);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    location = createLocation();
  }

  @Override
  public CreatePolicy createRequest(String name, String description, String displayName, EntityReference owner) {
    return new CreatePolicy()
        .withName(name)
        .withPolicyType(PolicyType.Lifecycle)
        .withDescription(description)
        .withDisplayName(displayName)
        .withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(Policy policy, CreatePolicy createRequest, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(policy),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    assertEquals(createRequest.getPolicyUrl(), policy.getPolicyUrl());
  }

  @Override
  public void validateUpdatedEntity(Policy updatedEntity, CreatePolicy request, Map<String, String> authHeaders) {
    validateCreatedEntity(updatedEntity, request, authHeaders);
  }

  @Override
  public void compareEntities(Policy expected, Policy updated, Map<String, String> authHeaders) {}

  @Override
  public EntityInterface<Policy> getEntityInterface(Policy entity) {
    return new PolicyEntityInterface(entity);
  }

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
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, "[policyType must not be null]");
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
        PolicyUtils.accessControlRule(null, null, "DataConsumer", MetadataOperation.UpdateDescription, true, 0, true));
    rules.add(PolicyUtils.accessControlRule(null, null, "DataConsumer", MetadataOperation.UpdateTags, true, 1, true));
    CreatePolicy create = createAccessControlPolicyWithRules(getEntityName(test), rules);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_AccessControlPolicyWithInvalidRules_400_error(TestInfo test) {
    List<Rule> rules = new ArrayList<>();
    rules.add(
        PolicyUtils.accessControlRule("rule21", null, null, null, MetadataOperation.UpdateDescription, true, 0, true));
    CreatePolicy create = createAccessControlPolicyWithRules(getEntityName(test), rules);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    assertResponseContains(
        exception,
        BAD_REQUEST,
        String.format(
            "Found invalid rule rule21 within policy %s. Please ensure that at least one among the user "
                + "(subject) and entity (object) attributes is specified",
            getEntityName(test)));
  }

  @Test
  void post_AccessControlPolicyWithDuplicateRules_400_error(TestInfo test) {
    List<Rule> rules = new ArrayList<>();
    rules.add(
        PolicyUtils.accessControlRule(
            "rule1", null, null, "DataConsumer", MetadataOperation.UpdateDescription, true, 0, true));
    rules.add(
        PolicyUtils.accessControlRule(
            "rule2", null, null, "DataConsumer", MetadataOperation.UpdateTags, true, 1, true));
    rules.add(
        PolicyUtils.accessControlRule(
            "rule3", null, null, "DataConsumer", MetadataOperation.UpdateTags, true, 1, true));
    CreatePolicy create = createAccessControlPolicyWithRules(getEntityName(test), rules);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    assertResponseContains(
        exception,
        BAD_REQUEST,
        String.format(
            "Found multiple rules with operation UpdateTags within policy %s. Please ensure that operation across all rules within the policy are distinct",
            getEntityName(test)));
  }

  @Test
  void get_PolicyListWithInvalidLimitOffset_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> listPolicies(null, -1, null, null, ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, () -> listPolicies(null, 0, null, null, ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception =
        assertThrows(HttpResponseException.class, () -> listPolicies(null, 1000001, null, null, ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  void get_PolicyListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> listPolicies(null, 1, "", "", ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  @Test
  void get_PolicyListWithValidLimitOffset_4xx(TestInfo test) throws HttpResponseException {
    // Create a large number of Policies
    int maxPolicies = 40;
    for (int i = 0; i < maxPolicies; i++) {
      createEntity(createRequest(test, i), ADMIN_AUTH_HEADERS);
    }

    // List all Policies
    PolicyList allPolicies = listPolicies(null, 1000000, null, null, ADMIN_AUTH_HEADERS);
    int totalRecords = allPolicies.getData().size();
    printPolicies(allPolicies);

    // List limit number Policies at a time at various offsets and ensure right results are returned
    for (int limit = 1; limit < maxPolicies; limit++) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllPolicies = 0;
      PolicyList forwardPage;
      PolicyList backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listPolicies(null, limit, null, after, ADMIN_AUTH_HEADERS);
        printPolicies(forwardPage);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allPolicies.getData(), forwardPage, limit, indexInAllPolicies);

        if (pageCount == 0) { // CASE 0 - First page is being returned. Therefore, before cursor is null
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listPolicies(null, limit, before, null, ADMIN_AUTH_HEADERS);
          assertEntityPagination(allPolicies.getData(), backwardPage, limit, (indexInAllPolicies - limit));
        }

        indexInAllPolicies += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllPolicies = totalRecords - limit - forwardPage.getData().size();
      do {
        LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listPolicies(null, limit, before, null, ADMIN_AUTH_HEADERS);
        printPolicies(forwardPage);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allPolicies.getData(), forwardPage, limit, indexInAllPolicies);
        pageCount++;
        indexInAllPolicies -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  private void printPolicies(PolicyList list) {
    list.getData().forEach(Policy -> LOG.info("DB {}", Policy.getFullyQualifiedName()));
    LOG.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  @Test
  void patch_PolicyAttributes_200_ok(TestInfo test) throws IOException {
    Policy policy = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS).withLocation(null);

    URI uri = null;
    try {
      uri = new URI("http://www.example.com/policy1");
    } catch (URISyntaxException e) {
      fail("could not construct URI for test");
    }

    // Add policyUrl which was previously null and set enabled to false
    String origJson = JsonUtils.pojoToJson(policy);
    policy.setPolicyUrl(uri);
    policy.setEnabled(false);
    ChangeDescription change = getChangeDescription(policy.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("policyUrl").withNewValue(uri));
    change.getFieldsUpdated().add(new FieldChange().withName("enabled").withOldValue(true).withNewValue(false));
    policy = patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove policyUrl
    origJson = JsonUtils.pojoToJson(policy);
    policy.setPolicyUrl(null);
    change = getChangeDescription(policy.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("policyUrl").withOldValue(uri));
    policy = patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    EntityReference locationReference = new LocationRepository.LocationEntityInterface(location).getEntityReference();

    // Add new field location
    origJson = JsonUtils.pojoToJson(policy);
    policy.setLocation(locationReference);
    change = getChangeDescription(policy.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("location").withNewValue(locationReference));
    patchEntityAndCheck(policy, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void delete_nonEmptyPolicy_4xx() {
    // TODO
  }

  /** Validate returned fields GET .../policies/{id}?fields="..." or GET .../policies/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Policy policy, boolean byName) throws HttpResponseException {
    // .../policies?fields=owner
    String fields = "owner";
    policy =
        byName
            ? getPolicyByName(policy.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getPolicy(policy.getId(), fields, ADMIN_AUTH_HEADERS);
    assertNotNull(policy.getOwner());

    // .../policies?fields=owner,displayName
    fields = "owner,displayName";
    policy =
        byName
            ? getPolicyByName(policy.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getPolicy(policy.getId(), fields, ADMIN_AUTH_HEADERS);
    assertNotNull(policy.getOwner());

    // .../policies?fields=owner,displayName,policyUrl
    fields = "owner,displayName,policyUrl";
    policy =
        byName
            ? getPolicyByName(policy.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getPolicy(policy.getId(), fields, ADMIN_AUTH_HEADERS);
    assertNotNull(policy.getOwner());
  }

  public static Policy getPolicy(UUID id, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("policies/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Policy.class, authHeaders);
  }

  public static Policy getPolicyByName(String fqn, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("policies/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Policy.class, authHeaders);
  }

  public static PolicyList listPolicies(
      String fields, Integer limitParam, String before, String after, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("policies");
    target = fields != null ? target.queryParam("fields", fields) : target;
    target = limitParam != null ? target.queryParam("limit", limitParam) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, PolicyList.class, authHeaders);
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
}
