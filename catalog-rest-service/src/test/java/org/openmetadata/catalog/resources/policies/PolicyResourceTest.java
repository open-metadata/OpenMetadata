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
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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
public class PolicyResourceTest extends EntityResourceTest<Policy> {

  private static String LOCATION_NAME = "aws-s3";
  private static Location location;

  public PolicyResourceTest() {
    super(Entity.POLICY, Policy.class, PolicyList.class, "policies", PolicyResource.FIELDS, false, true, false);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    location = createLocation();
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name).withDescription(description).withDisplayName(displayName).withOwner(owner);
  }

  @Override
  public EntityReference getContainer(Object createRequest) throws URISyntaxException {
    return null; // No container entity for Policy
  }

  @Override
  public void validateCreatedEntity(Policy policy, Object request, Map<String, String> authHeaders) {
    CreatePolicy createRequest = (CreatePolicy) request;
    validateCommonEntityFields(
        getEntityInterface(policy),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    assertEquals(createRequest.getPolicyUrl(), policy.getPolicyUrl());
  }

  @Override
  public void validateUpdatedEntity(Policy updatedEntity, Object request, Map<String, String> authHeaders) {
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
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  @Test
  public void post_PolicyWithoutPolicyType_400_badRequest(TestInfo test) {
    CreatePolicy create = create(test).withPolicyType(null);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createPolicy(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[policyType must not be null]");
  }

  @Test
  public void post_validPolicies_as_admin_200_OK(TestInfo test) throws IOException {
    // Create valid policy
    CreatePolicy create = create(test);
    createAndCheckEntity(create, adminAuthHeaders());
    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  public void post_PolicyWithUserOwner_200_ok(TestInfo test) throws IOException {
    CreatePolicy create = create(test).withOwner(USER_OWNER1);
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  public void post_PolicyWithTeamOwner_200_ok(TestInfo test) throws IOException {
    CreatePolicy create = create(test).withOwner(TEAM_OWNER1);
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  public void post_AccessControlPolicyWithValidRules_200_ok(TestInfo test) throws IOException {
    CreatePolicy create = createAccessControlPolicyWithValidRules(test);
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  public void post_AccessControlPolicyWithInvalidRules_400_error(TestInfo test) throws IOException {
    CreatePolicy create = createAccessControlPolicyWithInvalidRules(test);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    assertResponseContains(
        exception,
        BAD_REQUEST,
        "Check if operation is non-null and at least one among the user (subject) "
            + "and entity (object) attributes is specified");
  }

  @Test
  public void post_Policy_as_non_admin_401(TestInfo test) {
    CreatePolicy create = create(test);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createPolicy(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void get_PolicyListWithInvalidLimitOffset_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> listPolicies(null, -1, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, () -> listPolicies(null, 0, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception =
        assertThrows(HttpResponseException.class, () -> listPolicies(null, 1000001, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_PolicyListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> listPolicies(null, 1, "", "", adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  @Test
  public void get_PolicyListWithValidLimitOffset_4xx(TestInfo test) throws HttpResponseException {
    // Create a large number of Policies
    int maxPolicies = 40;
    for (int i = 0; i < maxPolicies; i++) {
      createPolicy(create(test, i), adminAuthHeaders());
    }

    // List all Policies
    PolicyList allPolicies = listPolicies(null, 1000000, null, null, adminAuthHeaders());
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
        log.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listPolicies(null, limit, null, after, adminAuthHeaders());
        printPolicies(forwardPage);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allPolicies.getData(), forwardPage, limit, indexInAllPolicies);

        if (pageCount == 0) { // CASE 0 - First page is being returned. Therefore, before cursor is null
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listPolicies(null, limit, before, null, adminAuthHeaders());
          assertEntityPagination(allPolicies.getData(), backwardPage, limit, (indexInAllPolicies - limit));
        }

        indexInAllPolicies += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllPolicies = totalRecords - limit - forwardPage.getData().size();
      do {
        log.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listPolicies(null, limit, before, null, adminAuthHeaders());
        printPolicies(forwardPage);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allPolicies.getData(), forwardPage, limit, indexInAllPolicies);
        pageCount++;
        indexInAllPolicies -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  private void printPolicies(PolicyList list) {
    list.getData().forEach(Policy -> log.info("DB {}", Policy.getFullyQualifiedName()));
    log.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  @Test
  public void patch_PolicyAttributes_200_ok(TestInfo test) throws IOException {
    Policy policy = createAndCheckEntity(create(test), adminAuthHeaders());

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
    policy = patchEntityAndCheck(policy, origJson, adminAuthHeaders(), MINOR_UPDATE, change);

    // Remove policyUrl
    origJson = JsonUtils.pojoToJson(policy);
    policy.setPolicyUrl(null);
    change = getChangeDescription(policy.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("policyUrl").withOldValue(uri));
    policy = patchEntityAndCheck(policy, origJson, adminAuthHeaders(), MINOR_UPDATE, change);

    EntityReference locationReference = new LocationRepository.LocationEntityInterface(location).getEntityReference();
    Map<String, String> locationObj = new LinkedHashMap<>();
    locationObj.put("type", locationReference.getType());
    locationObj.put("name", locationReference.getName());
    locationObj.put("id", locationReference.getId().toString());

    // Add new field location
    origJson = JsonUtils.pojoToJson(policy);
    policy.setLocation(locationReference);
    change = getChangeDescription(policy.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("location").withNewValue(locationObj));
    patchEntityAndCheck(policy, origJson, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void delete_emptyPolicy_200_ok(TestInfo test) throws HttpResponseException {
    Policy policy = createPolicy(create(test), adminAuthHeaders());
    deleteEntity(policy.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonEmptyPolicy_4xx() {
    // TODO
  }

  public static Policy createPolicy(CreatePolicy create, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("policies"), create, Policy.class, authHeaders);
  }

  /** Validate returned fields GET .../policies/{id}?fields="..." or GET .../policies/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Policy policy, boolean byName) throws HttpResponseException {
    // .../policies?fields=owner
    String fields = "owner";
    policy =
        byName
            ? getPolicyByName(policy.getFullyQualifiedName(), fields, adminAuthHeaders())
            : getPolicy(policy.getId(), fields, adminAuthHeaders());
    assertNotNull(policy.getOwner());

    // .../policies?fields=owner,displayName
    fields = "owner,displayName";
    policy =
        byName
            ? getPolicyByName(policy.getFullyQualifiedName(), fields, adminAuthHeaders())
            : getPolicy(policy.getId(), fields, adminAuthHeaders());
    assertNotNull(policy.getOwner());

    // .../policies?fields=owner,displayName,policyUrl
    fields = "owner,displayName,policyUrl";
    policy =
        byName
            ? getPolicyByName(policy.getFullyQualifiedName(), fields, adminAuthHeaders())
            : getPolicy(policy.getId(), fields, adminAuthHeaders());
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

  private CreatePolicy create(TestInfo test) {
    return create(getEntityName(test));
  }

  private CreatePolicy create(TestInfo test, int index) {
    return create(getEntityName(test, index));
  }

  private CreatePolicy create(String name) {
    return new CreatePolicy()
        .withName(name)
        .withDescription("description")
        .withPolicyType(PolicyType.Lifecycle)
        .withOwner(USER_OWNER1);
  }

  private CreatePolicy createAccessControlPolicyWithRules(String name, List<Rule> rules) {
    return new CreatePolicy()
        .withName(name)
        .withDescription("description")
        .withPolicyType(PolicyType.AccessControl)
        .withRules(rules.stream().map(rule -> (Object) rule).collect(Collectors.toList()))
        .withOwner(USER_OWNER1);
  }

  private CreatePolicy createAccessControlPolicyWithInvalidRules(TestInfo test) {
    List<Rule> rules = new ArrayList<>();
    rules.add(PolicyUtils.accessControlRule(null, null, null, MetadataOperation.UpdateDescription, true, 0, true));
    return createAccessControlPolicyWithRules(getEntityName(test), rules);
  }

  private CreatePolicy createAccessControlPolicyWithValidRules(TestInfo test) {
    List<Rule> rules = new ArrayList<>();
    rules.add(
        PolicyUtils.accessControlRule(null, null, "DataConsumer", MetadataOperation.UpdateDescription, true, 0, true));
    rules.add(PolicyUtils.accessControlRule(null, null, "DataConsumer", MetadataOperation.UpdateTags, true, 1, true));
    return createAccessControlPolicyWithRules(getEntityName(test), rules);
  }

  private static Location createLocation() throws HttpResponseException {
    CreateLocation createLocation = LocationResourceTest.create(LOCATION_NAME, AWS_STORAGE_SERVICE_REFERENCE);
    return TestUtils.post(getResource("locations"), createLocation, Location.class, adminAuthHeaders());
  }
}
