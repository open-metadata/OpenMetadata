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

import com.fasterxml.jackson.core.JsonProcessingException;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.policies.CreatePolicy;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.policies.PolicyResource.PolicyList;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.PolicyType;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;
import org.openmetadata.common.utils.JsonSchemaUtil;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.ENTITY_NAME_LENGTH_ERROR;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

@Slf4j
public class PolicyResourceTest extends CatalogApplicationTest {
    public static User USER1;
    public static EntityReference USER_OWNER1;
    public static Team TEAM1;
    public static EntityReference TEAM_OWNER1;


    @BeforeAll
    public static void setup(TestInfo test) throws HttpResponseException {
        USER1 = UserResourceTest.createUser(new UserResourceTest().create(test),
                authHeaders("test@open-metadata.org"));
        USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");
        TeamResourceTest teamResourceTest = new TeamResourceTest();
        TEAM1 = TeamResourceTest.createTeam(teamResourceTest.create(test), adminAuthHeaders());
        TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");
    }

    @Test
    public void post_policyWithLongName_400_badRequest(TestInfo test) {
        CreatePolicy create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
        HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createPolicy(create,
                adminAuthHeaders()));
        assertResponse(exception, BAD_REQUEST, ENTITY_NAME_LENGTH_ERROR);
    }

    @Test
    public void post_PolicyWithoutName_400_badRequest(TestInfo test) {
        CreatePolicy create = create(test).withName("");
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                createPolicy(create, adminAuthHeaders()));
        assertResponse(exception, BAD_REQUEST, ENTITY_NAME_LENGTH_ERROR);
    }

    @Test
    public void post_PolicyWithoutOwner_400_badRequest(TestInfo test) {
        CreatePolicy create = create(test).withOwner(null);
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                createPolicy(create, adminAuthHeaders()));
        assertResponse(exception, BAD_REQUEST, "[owner must not be null]");
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
    public void post_validPolicies_as_admin_200_OK(TestInfo test) throws HttpResponseException {
        // Create valid policy
        CreatePolicy create = create(test);
        createAndCheckPolicy(create, adminAuthHeaders());
        create.withName(getPolicyName(test, 1)).withDescription("description");
        createAndCheckPolicy(create, adminAuthHeaders());
    }

    @Test
    public void post_PolicyWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
        CreatePolicy create = create(test).withOwner(USER_OWNER1);
        createAndCheckPolicy(create, adminAuthHeaders());
    }

    @Test
    public void post_PolicyWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
        CreatePolicy create = create(test).withOwner(TEAM_OWNER1);
        createAndCheckPolicy(create, adminAuthHeaders());
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
    public void put_PolicyUpdateWithNoChange_200(TestInfo test) throws HttpResponseException {
        // Create a Policy with POST
        CreatePolicy request = create(test)
                .withDescription("des")
                .withPolicyType(PolicyType.Lifecycle);
        Policy policy = createAndCheckPolicy(request, adminAuthHeaders());

        // Update Policy two times successfully with PUT requests
        policy = updateAndCheckPolicy(policy, request, OK, adminAuthHeaders(), NO_CHANGE);
        updateAndCheckPolicy(policy, request, OK, adminAuthHeaders(), NO_CHANGE);
    }

    @Test
    public void put_PolicyCreate_200(TestInfo test) throws HttpResponseException {
        // Create a new Policy with PUT
        CreatePolicy request = create(test).withOwner(USER_OWNER1);
        updateAndCheckPolicy(null, request.withName(test.getDisplayName()).withDescription("description"),
                CREATED, adminAuthHeaders(), NO_CHANGE);
    }

    @Test
    public void put_PolicyEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
        // Create table with empty description
        CreatePolicy request = create(test).withDescription("");
        Policy policy = createAndCheckPolicy(request, adminAuthHeaders());

        // Update empty description with a new description
        updateAndCheckPolicy(policy, request.withDescription("newDescription"), OK, adminAuthHeaders(), MINOR_UPDATE);
    }

    @Test
    public void put_PolicyNonEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
        CreatePolicy request = create(test).withDescription("description");
        createAndCheckPolicy(request, adminAuthHeaders());

        // Updating description is ignored when backend already has description
        Policy db = updatePolicy(request.withDescription("newDescription"), OK, adminAuthHeaders());
        assertEquals("description", db.getDescription());
    }

    @Test
    public void put_PolicyUpdateOwner_200(TestInfo test) throws HttpResponseException {
        CreatePolicy request = create(test).withDescription("");
        Policy policy = createAndCheckPolicy(request, adminAuthHeaders());

        // Change ownership from USER_OWNER1 to TEAM_OWNER1
        policy = updateAndCheckPolicy(policy, request.withOwner(TEAM_OWNER1), OK, adminAuthHeaders(), MINOR_UPDATE);
        assertNotNull(policy.getOwner());
    }

    @Test
    public void get_nonExistentPolicy_404_notFound() {
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                getPolicy(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
        assertResponse(exception, NOT_FOUND, entityNotFound(Entity.POLICY, TestUtils.NON_EXISTENT_ENTITY));
    }

    @Test
    public void get_PolicyWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
        CreatePolicy create = create(test);
        Policy policy = createAndCheckPolicy(create, adminAuthHeaders());
        validateGetWithDifferentFields(policy, false);
    }

    @Test
    public void get_PolicyByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
        CreatePolicy create = create(test);
        Policy policy = createAndCheckPolicy(create, adminAuthHeaders());
        validateGetWithDifferentFields(policy, true);
    }

    @Test
    public void patch_PolicyAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
        Policy policy = createPolicy(create(test), adminAuthHeaders());
        assertNull(policy.getPolicyUrl());
        assertTrue(policy.getEnabled());

        URI uri = null;
        try {
            uri = new URI("http://www.example.com/policy1");
        } catch (URISyntaxException e) {
            fail("could not construct URI for test");
        }

        policy = getPolicy(policy.getId(), "displayName,description,owner,policyUrl,enabled", adminAuthHeaders());

        // Add policyUrl which was previously null and set enabled to false
        patchPolicyAttributesAndCheck(policy, uri, false, adminAuthHeaders(), MINOR_UPDATE);
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

    public static Policy createAndCheckPolicy(CreatePolicy create, Map<String, String> authHeaders) throws
            HttpResponseException {
        String updatedBy = TestUtils.getPrincipal(authHeaders);
        Policy policy = createPolicy(create, authHeaders);
        validatePolicy(policy, create.getDisplayName(), create.getDescription(), create.getOwner(), updatedBy);
        return getAndValidate(policy.getId(), create, authHeaders, updatedBy);
    }

    public static Policy updateAndCheckPolicy(Policy before, CreatePolicy create, Status status,
                                              Map<String, String> authHeaders, UpdateType updateType)
            throws HttpResponseException {
        String updatedBy = TestUtils.getPrincipal(authHeaders);
        Policy updatedPolicy = updatePolicy(create, status, authHeaders);
        validatePolicy(updatedPolicy, create.getDescription(), create.getOwner(), updatedBy);
        if (before == null) {
            assertEquals(0.1, updatedPolicy.getVersion()); // First version created
        } else {
            TestUtils.validateUpdate(before.getVersion(), updatedPolicy.getVersion(), updateType);
        }

        return getAndValidate(updatedPolicy.getId(), create, authHeaders, updatedBy);
    }

    // Make sure in GET operations the returned Policy has all the required information passed during creation
    public static Policy getAndValidate(UUID policyID, CreatePolicy create, Map<String, String> authHeaders,
                                        String expectedUpdatedBy) throws HttpResponseException {
        // GET the newly created Policy by ID and validate
        Policy policy = getPolicy(policyID, "displayName,description,owner,policyUrl,enabled", authHeaders);
        validatePolicy(policy, create.getDescription(), create.getOwner(), expectedUpdatedBy);

        // GET the newly created Policy by name and validate
        String fqn = policy.getFullyQualifiedName();
        policy = getPolicyByName(fqn, "displayName,description,owner,policyUrl,enabled", authHeaders);
        return validatePolicy(policy, create.getDescription(), create.getOwner(), expectedUpdatedBy);
    }

    public static Policy updatePolicy(CreatePolicy create, Status status, Map<String, String> authHeaders)
            throws HttpResponseException {
        return TestUtils.put(getResource("policies"), create, Policy.class, status, authHeaders);
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

    private static Policy validatePolicy(Policy policy, String expectedDisplayName, String expectedDescription,
                                         EntityReference expectedOwner, String expectedUpdatedBy) {
        Policy newPolicy = validatePolicy(policy, expectedDescription, expectedOwner, expectedUpdatedBy);
        assertEquals(expectedDisplayName, newPolicy.getDisplayName());
        return newPolicy;
    }

    private static Policy validatePolicy(Policy policy, URI expectedPolicyUrl, Boolean expectedEnabled,
                                         String expectedUpdatedBy) {
        assertNotNull(policy.getId());
        assertNotNull(policy.getHref());
        assertEquals(expectedPolicyUrl, policy.getPolicyUrl());
        assertEquals(expectedEnabled, policy.getEnabled());
        assertEquals(expectedUpdatedBy, policy.getUpdatedBy());
        return policy;
    }

    private static Policy validatePolicy(Policy policy, String expectedDescription, EntityReference expectedOwner,
                                         String expectedUpdatedBy) {
        assertNotNull(policy.getId());
        assertNotNull(policy.getHref());
        assertEquals(expectedDescription, policy.getDescription());
        assertEquals(expectedUpdatedBy, policy.getUpdatedBy());

        // Validate owner
        if (expectedOwner != null) {
            TestUtils.validateEntityReference(policy.getOwner());
            assertEquals(expectedOwner.getId(), policy.getOwner().getId());
            assertEquals(expectedOwner.getType(), policy.getOwner().getType());
            assertNotNull(policy.getOwner().getHref());
        }

        return policy;
    }

    private Policy patchPolicyAttributesAndCheck(Policy before, URI policyUrl, Boolean enabled,
                                                 Map<String, String> authHeaders, UpdateType updateType)
            throws JsonProcessingException, HttpResponseException {
        String updatedBy = TestUtils.getPrincipal(authHeaders);
        String policyJson = JsonUtils.pojoToJson(before);

        // Update the attributes
        before.setPolicyUrl(policyUrl);
        before.setEnabled(enabled);

        // Validate information returned in patch response has the updates
        Policy updatedPolicy = patchPolicy(policyJson, before, authHeaders);
        validatePolicy(updatedPolicy, policyUrl, enabled, updatedBy);
        TestUtils.validateUpdate(before.getVersion(), updatedPolicy.getVersion(), updateType);

        // GET the table and Validate information returned
        Policy getPolicy = getPolicy(before.getId(), "policyUrl,enabled", authHeaders);
        validatePolicy(getPolicy, policyUrl, enabled, updatedBy);
        return updatedPolicy;
    }

    private Policy patchPolicy(UUID policyId, String originalJson, Policy updatedPolicy,
                               Map<String, String> authHeaders)
            throws JsonProcessingException, HttpResponseException {
        String updatedPolicyJson = JsonUtils.pojoToJson(updatedPolicy);
        JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updatedPolicyJson);
        return TestUtils.patch(getResource("policies/" + policyId), patch, Policy.class, authHeaders);
    }

    private Policy patchPolicy(String originalJson, Policy updatedPolicy, Map<String, String> authHeaders)
            throws JsonProcessingException, HttpResponseException {
        return patchPolicy(updatedPolicy.getId(), originalJson, updatedPolicy, authHeaders);
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

    public static String getPolicyName(TestInfo test) {
        return String.format("policy_%s", test.getDisplayName());
    }

    public static String getPolicyName(TestInfo test, int index) {
        return String.format("policy%d_%s", index, test.getDisplayName());
    }

    public static CreatePolicy create(TestInfo test) {
        return new CreatePolicy()
                .withName(getPolicyName(test))
                .withDescription("description")
                .withPolicyType(PolicyType.AccessControl)
                .withOwner(USER_OWNER1);
    }

    public static CreatePolicy create(TestInfo test, int index) {
        return create(test).withName(getPolicyName(test, index));
    }

}
