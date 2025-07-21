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

package org.openmetadata.service.resources.teams;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.validation.constraints.Positive;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.teams.RoleResource.RoleList;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class RoleResourceTest extends EntityResourceTest<Role, CreateRole> {
  public RoleResourceTest() {
    super(
        Entity.ROLE,
        Role.class,
        RoleList.class,
        "roles",
        RoleResource.FIELDS,
        DATA_CONSUMER_ROLE_NAME);
  }

  public void setupRoles(TestInfo test) throws HttpResponseException {
    DATA_CONSUMER_ROLE =
        getEntityByName(DATA_CONSUMER_ROLE_NAME, null, RoleResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_CONSUMER_ROLE_REF = DATA_CONSUMER_ROLE.getEntityReference();

    DATA_STEWARD_ROLE =
        getEntityByName(DATA_STEWARD_ROLE_NAME, null, RoleResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_STEWARD_ROLE_REF = DATA_STEWARD_ROLE.getEntityReference();

    ROLE1 = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    ROLE1_REF = ROLE1.getEntityReference();

    CREATE_ACCESS_ROLE =
        createEntity(
            new CreateRole()
                .withName("CreateAccessRole")
                .withPolicies(List.of(CREATE_ACCESS_PERMISSION_POLICY.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);
  }

  /** Creates the given number of roles */
  public void createRoles(TestInfo test, @Positive int numberOfRoles, @Positive int offset)
      throws IOException {
    // Create a set of roles.
    for (int i = 0; i < numberOfRoles; i++) {
      CreateRole create = createRequest(test, offset + i);
      createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    }
  }

  @Test
  void post_validRoles_as_admin_200_OK(TestInfo test) throws IOException {
    // Create role with different optional fields and verify each creation

    // Test 1: Create basic role
    CreateRole create = createRequest(test, 1);
    Role role1 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertNotNull(role1);
    assertNotNull(role1.getId());
    assertEquals(create.getName(), role1.getName());
    assertListNotNull(role1.getPolicies());
    assertEquals(create.getPolicies().size(), role1.getPolicies().size());

    // Test 2: Create role with display name
    create = createRequest(test, 2).withDisplayName("displayName");
    Role role2 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertNotNull(role2);
    assertEquals("displayName", role2.getDisplayName());
    assertEquals(create.getName(), role2.getName());
    assertListNotNull(role2.getPolicies());

    // Test 3: Create role with description
    create = createRequest(test, 3).withDescription("description");
    Role role3 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertNotNull(role3);
    assertEquals("description", role3.getDescription());
    assertEquals(create.getName(), role3.getName());
    assertListNotNull(role3.getPolicies());

    // Test 4: Create role with both display name and description
    create = createRequest(test, 4).withDisplayName("displayName").withDescription("description");
    Role role4 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertNotNull(role4);
    assertEquals("displayName", role4.getDisplayName());
    assertEquals("description", role4.getDescription());
    assertEquals(create.getName(), role4.getName());
    assertListNotNull(role4.getPolicies());

    // Verify all roles have the expected policies
    for (Role role : List.of(role1, role2, role3, role4)) {
      assertEquals(DATA_CONSUMER_ROLE.getPolicies().size(), role.getPolicies().size());
      // Verify policy names match
      for (int i = 0; i < role.getPolicies().size(); i++) {
        assertEquals(
            DATA_CONSUMER_ROLE.getPolicies().get(i).getName(),
            role.getPolicies().get(i).getName(),
            "Policy name should match");
      }
    }
  }

  @Test
  void patch_roleAttributes_as_non_admin_403(TestInfo test) throws HttpResponseException {
    Role role = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // Patching as a non-admin should is disallowed
    String originalJson = JsonUtils.pojoToJson(role);
    role.setDisplayName("newDisplayName");
    assertResponse(
        () -> patchEntity(role.getId(), originalJson, role, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.EDIT_DISPLAY_NAME)));
  }

  @Test
  void patch_rolePolicies(TestInfo test) throws IOException {
    Role role = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    // Add new DATA_STEWARD_POLICY to role in addition to DATA_CONSUMER_POLICY
    String originalJson = JsonUtils.pojoToJson(role);
    role.getPolicies().addAll(DATA_STEWARD_ROLE.getPolicies());
    ChangeDescription change = getChangeDescription(role, MINOR_UPDATE);
    fieldAdded(change, "policies", DATA_STEWARD_ROLE.getPolicies());
    role = patchEntityAndCheck(role, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove new DATA_CONSUMER_POLICY
    // Changes from this PATCH is consolidated with the previous changes
    originalJson = JsonUtils.pojoToJson(role);
    role.setPolicies(DATA_STEWARD_ROLE.getPolicies());
    change = getChangeDescription(role, MINOR_UPDATE);
    fieldDeleted(change, "policies", DATA_CONSUMER_ROLE.getPolicies());
    role = patchEntityAndCheck(role, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove all the policies. It should be disallowed
    final String originalJson1 = JsonUtils.pojoToJson(role);
    final UUID id = role.getId();
    final Role role1 = role;
    role1.setPolicies(null);
    assertResponse(
        () -> patchEntity(id, originalJson1, role1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.EMPTY_POLICIES_IN_ROLE);
  }

  @Test
  void delete_Disallowed() {
    for (Role role : List.of(DATA_CONSUMER_ROLE, DATA_STEWARD_ROLE)) {
      assertResponse(
          () -> deleteEntity(role.getId(), ADMIN_AUTH_HEADERS),
          BAD_REQUEST,
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(role.getName(), Entity.ROLE));
    }
  }

  @Test
  void test_bulkFetchWithPolicies_pagination(TestInfo test) throws IOException {
    // This test verifies that bulk fetching roles with policies field works correctly
    // Create multiple roles with different policies to trigger bulk fetching
    List<Role> createdRoles = new ArrayList<>();

    // Create 5 roles to ensure bulk fetching is triggered
    for (int i = 0; i < 5; i++) {
      CreateRole create =
          createRequest(test.getDisplayName() + "_role" + i)
              .withPolicies(
                  List.of(DATA_CONSUMER_ROLE.getPolicies().getFirst().getFullyQualifiedName()));

      Role role = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
      createdRoles.add(role);
    }

    // Test 1: Get all roles with policies field via list API
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fields", "policies");
    queryParams.put("limit", "100"); // Ensure we get all roles in one page
    queryParams.put("default", "false"); // Exclude default roles to focus on created ones

    ResultList<Role> roleList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertNotNull(roleList);
    assertTrue(roleList.getData().size() >= 5, "Should have at least 5 roles");

    // Verify that policies are populated for all roles
    for (Role role : roleList.getData()) {
      if (createdRoles.stream().anyMatch(r -> r.getId().equals(role.getId()))) {
        assertListNotNull(role.getPolicies());
        assertEquals(
            1,
            role.getPolicies().size(),
            "Role " + role.getName() + " should have exactly one policy");

        // Verify the policy reference is valid
        assertNotNull(role.getPolicies().getFirst().getId());
        assertNotNull(role.getPolicies().getFirst().getName());
        assertNotNull(role.getPolicies().getFirst().getType());
      }
    }

    // Test 2: Get each role individually to compare with bulk response
    for (Role createdRole : createdRoles) {
      Role individualRole =
          getEntityByName(
              createdRole.getFullyQualifiedName(), null, "policies", ADMIN_AUTH_HEADERS);

      assertListNotNull(individualRole.getPolicies());
      assertEquals(1, individualRole.getPolicies().size());

      // Find the same role in bulk response
      Role bulkRole =
          roleList.getData().stream()
              .filter(r -> r.getId().equals(createdRole.getId()))
              .findFirst()
              .orElse(null);

      if (bulkRole != null) {
        assertEquals(
            individualRole.getPolicies().getFirst().getId(),
            bulkRole.getPolicies().getFirst().getId(),
            "Policy from bulk fetch should match individual fetch");
      } else {
        LOG.info(
            "Role {} not found in bulk response - might be on a different page",
            createdRole.getName());
      }
    }
  }

  private static void validateRole(
      Role role, String expectedDescription, String expectedDisplayName, String expectedUpdatedBy) {
    assertListNotNull(role.getId(), role.getHref());
    assertEquals(expectedDescription, role.getDescription());
    assertEquals(expectedUpdatedBy, role.getUpdatedBy());
    assertEquals(expectedDisplayName, role.getDisplayName());
  }

  @Override
  public Role validateGetWithDifferentFields(Role role, boolean byName)
      throws HttpResponseException {
    // Assign two arbitrary users this role for testing.
    if (nullOrEmpty(role.getUsers())) {
      UserResourceTest userResourceTest = new UserResourceTest();
      userResourceTest.createEntity(
          userResourceTest
              .createRequest("roleUser1", "", "", null)
              .withRoles(List.of(role.getId())),
          ADMIN_AUTH_HEADERS);
      userResourceTest.createEntity(
          userResourceTest
              .createRequest("roleUser2", "", "", null)
              .withRoles(List.of(role.getId())),
          ADMIN_AUTH_HEADERS);
    }

    // Assign two arbitrary teams this role for testing.
    if (role.getTeams() == null) {
      TeamResourceTest teamResourceTest = new TeamResourceTest();
      teamResourceTest.createEntity(
          teamResourceTest
              .createRequest("roleTeam1", "", "", null)
              .withDefaultRoles(List.of(role.getId())),
          ADMIN_AUTH_HEADERS);
      teamResourceTest.createEntity(
          teamResourceTest
              .createRequest("roleTeam2", "", "", null)
              .withDefaultRoles(List.of(role.getId())),
          ADMIN_AUTH_HEADERS);
    }

    String updatedBy = getPrincipalName(ADMIN_AUTH_HEADERS);
    role =
        byName
            ? getEntityByName(role.getFullyQualifiedName(), null, null, ADMIN_AUTH_HEADERS)
            : getEntity(role.getId(), null, ADMIN_AUTH_HEADERS);
    validateRole(role, role.getDescription(), role.getDisplayName(), updatedBy);
    assertListNull(role.getPolicies(), role.getUsers());

    String fields = "policies,teams,users";
    role =
        byName
            ? getEntityByName(role.getFullyQualifiedName(), null, fields, ADMIN_AUTH_HEADERS)
            : getEntity(role.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(role.getPolicies(), role.getUsers());
    validateRole(role, role.getDescription(), role.getDisplayName(), updatedBy);
    TestUtils.validateEntityReferences(role.getPolicies());
    TestUtils.validateEntityReferences(role.getTeams(), true);
    TestUtils.validateEntityReferences(role.getUsers(), true);
    return role;
  }

  @Override
  public CreateRole createRequest(String name) {
    return new CreateRole()
        .withName(name)
        .withPolicies(EntityUtil.getFqns(DATA_CONSUMER_ROLE.getPolicies()));
  }

  @Override
  public void validateCreatedEntity(
      Role role, CreateRole createRequest, Map<String, String> authHeaders) {
    TestUtils.assertEntityReferenceNames(createRequest.getPolicies(), role.getPolicies());
  }

  @Override
  public void compareEntities(Role expected, Role updated, Map<String, String> authHeaders) {
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("policies")) {
      assertEntityReferencesFieldChange(expected, actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
