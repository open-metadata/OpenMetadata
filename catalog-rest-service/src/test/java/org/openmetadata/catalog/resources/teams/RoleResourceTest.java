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

package org.openmetadata.catalog.resources.teams;

import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.teams.CreateRole;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.jdbi3.RoleRepository.RoleEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.policies.PolicyResource;
import org.openmetadata.catalog.resources.policies.PolicyResourceTest;
import org.openmetadata.catalog.resources.teams.RoleResource.RoleList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
public class RoleResourceTest extends EntityResourceTest<Role, CreateRole> {

  public RoleResourceTest() {
    super(Entity.ROLE, Role.class, RoleList.class, "roles", null, false, false, false, false);
  }

  @Test
  void post_validRoles_as_admin_200_OK(TestInfo test) throws IOException {
    // Create role with different optional fields
    CreateRole create = createRequest(test, 1);
    createAndCheckRole(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 2).withDisplayName("displayName");
    createAndCheckRole(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 3).withDescription("description");
    createAndCheckRole(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 4).withDisplayName("displayName").withDescription("description");
    createAndCheckRole(create, ADMIN_AUTH_HEADERS);
  }

  private Role createAndCheckRole(CreateRole create, Map<String, String> authHeaders) throws IOException {
    Role role = createAndCheckEntity(create, authHeaders);
    Policy policy = PolicyResourceTest.getPolicy(role.getPolicy().getId(), PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    assertEquals(String.format("%sRoleAccessControlPolicy", role.getName()), policy.getName());
    assertEquals(String.format("%s Role Access Control Policy", role.getDisplayName()), policy.getDisplayName());
    assertEquals(
        String.format("Policy for %s Role to perform operations on metadata entities", role.getDisplayName()),
        policy.getDescription());
    return role;
  }

  @Test
  void patch_roleAttributes_as_non_admin_403(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create table without any attributes
    Role role = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // Patching as a non-admin should is disallowed
    String originalJson = JsonUtils.pojoToJson(role);
    role.setDisplayName("newDisplayName");
    assertResponse(
        () -> patchEntity(role.getId(), originalJson, role, TEST_AUTH_HEADERS),
        FORBIDDEN,
        "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  private static void validateRole(
      Role role, String expectedDescription, String expectedDisplayName, String expectedUpdatedBy) {
    assertListNotNull(role.getId(), role.getHref());
    assertEquals(expectedDescription, role.getDescription());
    assertEquals(expectedUpdatedBy, role.getUpdatedBy());
    assertEquals(expectedDisplayName, role.getDisplayName());
  }

  @Override
  protected void prepareGetWithDifferentFields(Role role) throws HttpResponseException {
    // Assign two arbitrary users this role for testing.
    UserResourceTest userResourceTest = new UserResourceTest();
    userResourceTest.createEntity(
        userResourceTest.createRequest(role.getName() + "user1", "", "", null).withRoles(List.of(role.getId())),
        ADMIN_AUTH_HEADERS);
    userResourceTest.createEntity(
        userResourceTest.createRequest(role.getName() + "user2", "", "", null).withRoles(List.of(role.getId())),
        ADMIN_AUTH_HEADERS);
  }

  /** Validate returned fields GET .../roles/{id}?fields="..." or GET .../roles/name/{name}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Role expectedRole, boolean byName) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(ADMIN_AUTH_HEADERS);

    // .../roles
    Role role =
        byName
            ? getEntityByName(expectedRole.getName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(expectedRole.getId(), null, ADMIN_AUTH_HEADERS);
    validateRole(role, expectedRole.getDescription(), expectedRole.getDisplayName(), updatedBy);

    // .../roles?fields=policy,users
    String fields = "policy,users";
    role =
        byName
            ? getEntityByName(expectedRole.getName(), null, fields, ADMIN_AUTH_HEADERS)
            : getEntity(expectedRole.getId(), fields, ADMIN_AUTH_HEADERS);
    validateRole(role, expectedRole.getDescription(), expectedRole.getDisplayName(), updatedBy);
    TestUtils.validateEntityReference(role.getPolicy());
    TestUtils.validateEntityReference(role.getUsers());
  }

  @Override
  public CreateRole createRequest(String name, String description, String displayName, EntityReference owner) {
    return new CreateRole().withName(name).withDescription(description).withDisplayName(displayName);
  }

  @Override
  public void validateCreatedEntity(Role role, CreateRole createRequest, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(role), createRequest.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    assertEquals(createRequest.getDisplayName(), role.getDisplayName());
  }

  @Override
  public void validateUpdatedEntity(Role updatedEntity, CreateRole request, Map<String, String> authHeaders) {
    validateCreatedEntity(updatedEntity, request, authHeaders);
  }

  @Override
  public void compareEntities(Role expected, Role updated, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(updated), expected.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    assertEquals(expected.getDisplayName(), updated.getDisplayName());
  }

  @Override
  public EntityInterface<Role> getEntityInterface(Role entity) {
    return new RoleEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
