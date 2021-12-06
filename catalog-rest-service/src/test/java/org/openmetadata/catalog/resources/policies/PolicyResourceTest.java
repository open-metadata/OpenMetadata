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

import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.policies.CreatePolicy;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.PolicyRepository.PolicyEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.policies.PolicyResource.PolicyList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.PolicyType;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;

import javax.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

@Slf4j
public class PolicyResourceTest extends EntityResourceTest<Policy> {

  public PolicyResourceTest() {
    super(Entity.POLICY, Policy.class, PolicyList.class, "policies", PolicyResource.FIELDS,
            false, true, false);
  }

  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    EntityResourceTest.setup(test);
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner)
          throws URISyntaxException {
    return create(name).withDescription(description).withDisplayName(displayName).withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(Policy policy, Object request, Map<String, String> authHeaders)
          throws HttpResponseException {
    CreatePolicy createRequest = (CreatePolicy) request;
    validateCommonEntityFields(getEntityInterface(policy), createRequest.getDescription(),
            TestUtils.getPrincipal(authHeaders), createRequest.getOwner());
    assertEquals(createRequest.getPolicyUrl(), policy.getPolicyUrl());
  }

  @Override
  public void validateUpdatedEntity(Policy updatedEntity, Object request, Map<String, String> authHeaders)
          throws HttpResponseException {
    validateCreatedEntity(updatedEntity, request, authHeaders);
  }

  @Override
  public void compareEntities(Policy expected, Policy updated, Map<String, String> authHeaders)
          throws HttpResponseException {

  }

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
      System.out.println("expected " + expected);
      System.out.println("actual " + actual);
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
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPolicy(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[policyType must not be null]");
  }

  @Test
  public void post_PolicyAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreatePolicy create = create(test);
    createPolicy(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPolicy(create, adminAuthHeaders()));
    assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
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
  public void post_Policy_as_non_admin_401(TestInfo test) {
    CreatePolicy create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPolicy(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_PolicyWithInvalidOwnerType_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */

    CreatePolicy create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPolicy(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_PolicyWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TestUtils.NON_EXISTENT_ENTITY).withType("user");
    CreatePolicy create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPolicy(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_PolicyListWithInvalidLimitOffset_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listPolicies(null, -1, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listPolicies(null, 0, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listPolicies(null, 1000001, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_PolicyListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listPolicies(null, 1, "", "", adminAuthHeaders()));
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
    PolicyList allPolicies = listPolicies(null, 1000000, null,
            null, adminAuthHeaders());
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

        if (pageCount == 0) {  // CASE 0 - First page is being returned. There is no before cursor
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
  public void get_nonExistentPolicy_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getPolicy(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.POLICY, TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_PolicyWithDifferentFields_200_OK(TestInfo test) throws IOException {
    CreatePolicy create = create(test);
    Policy policy = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(policy, false);
  }

  @Test
  public void get_PolicyByNameWithDifferentFields_200_OK(TestInfo test) throws IOException {
    CreatePolicy create = create(test);
    Policy policy = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(policy, true);
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
    patchEntityAndCheck(policy, origJson, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void delete_emptyPolicy_200_ok(TestInfo test) throws HttpResponseException {
    Policy policy = createPolicy(create(test), adminAuthHeaders());
    deletePolicy(policy.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonEmptyPolicy_4xx() {
    // TODO
  }

  @Test
  public void delete_nonExistentPolicy_404() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deletePolicy(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.POLICY, TestUtils.NON_EXISTENT_ENTITY));
  }

  public static Policy createPolicy(CreatePolicy create, Map<String, String> authHeaders) throws
          HttpResponseException {
    return TestUtils.post(getResource("policies"), create, Policy.class, authHeaders);
  }

  /**
   * Validate returned fields GET .../policies/{id}?fields="..." or GET .../policies/name/{fqn}?fields="..."
   */
  private void validateGetWithDifferentFields(Policy policy, boolean byName) throws HttpResponseException {
    // .../policies?fields=owner
    String fields = "owner";
    policy = byName ? getPolicyByName(policy.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getPolicy(policy.getId(), fields, adminAuthHeaders());
    assertNotNull(policy.getOwner());

    // .../policies?fields=owner,displayName
    fields = "owner,displayName";
    policy = byName ? getPolicyByName(policy.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getPolicy(policy.getId(), fields, adminAuthHeaders());
    assertNotNull(policy.getOwner());

    // .../policies?fields=owner,displayName,policyUrl
    fields = "owner,displayName,policyUrl";
    policy = byName ? getPolicyByName(policy.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getPolicy(policy.getId(), fields, adminAuthHeaders());
    assertNotNull(policy.getOwner());
  }

  public static void getPolicy(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    getPolicy(id, null, authHeaders);
  }

  public static Policy getPolicy(UUID id, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
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

  public static PolicyList listPolicies(String fields, Integer limitParam,
                                        String before, String after, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("policies");
    target = fields != null ? target.queryParam("fields", fields) : target;
    target = limitParam != null ? target.queryParam("limit", limitParam) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, PolicyList.class, authHeaders);
  }

  private void deletePolicy(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(getResource("policies/" + id), authHeaders);

    // Ensure deleted Policy does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getPolicy(id, authHeaders));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.POLICY, id));
  }

  private CreatePolicy create(TestInfo test) {
    return create(getEntityName(test));
  }

  private CreatePolicy create(TestInfo test, int index) {
    return create(getEntityName(test, index));
  }

  private CreatePolicy create(String name) {
    return new CreatePolicy().withName(name).withDescription("description")
            .withPolicyType(PolicyType.AccessControl).withOwner(USER_OWNER1);
  }
}
