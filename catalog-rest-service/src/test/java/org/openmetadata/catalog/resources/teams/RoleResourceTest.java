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

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Map;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.teams.CreateRole;
import org.openmetadata.catalog.api.teams.CreateTeam;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
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
public class RoleResourceTest extends EntityResourceTest<Role> {

  public RoleResourceTest() {
    super(Entity.ROLE, Role.class, RoleList.class, "roles", null, false, false, false, false);
  }

  @Test
  void post_validRoles_as_admin_200_OK(TestInfo test) throws IOException {
    // Create role with different optional fields
    CreateRole create = create(test, 1);
    createAndCheckRole(create, adminAuthHeaders());

    create = create(test, 2).withDisplayName("displayName");
    createAndCheckRole(create, adminAuthHeaders());

    create = create(test, 3).withDescription("description");
    createAndCheckRole(create, adminAuthHeaders());

    create = create(test, 4).withDisplayName("displayName").withDescription("description");
    createAndCheckRole(create, adminAuthHeaders());
  }

  private Role createAndCheckRole(CreateRole create, Map<String, String> authHeaders) throws IOException {
    Role role = createAndCheckEntity(create, authHeaders);
    Policy policy = PolicyResourceTest.getPolicy(role.getPolicy().getId(), PolicyResource.FIELDS, adminAuthHeaders());
    assertEquals(String.format("%sRoleAccessControlPolicy", role.getName()), policy.getName());
    assertEquals(String.format("%s Role Access Control Policy", role.getDisplayName()), policy.getDisplayName());
    assertEquals(
        String.format("Policy for %s Role to perform operations on metadata entities", role.getDisplayName()),
        policy.getDescription());
    return role;
  }

  @Test
  void post_validRoles_as_non_admin_401(TestInfo test) {
    // Create role with different optional fields
    Map<String, String> authHeaders = authHeaders("test@open-metadata.org");
    CreateRole create = create(test, 1);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createAndCheckRole(create, authHeaders));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  /**
   * @see EntityResourceTest#put_addDeleteFollower_200 for tests related getting role with entities owned by the role
   */
  @Test
  void delete_validRole_200_OK(TestInfo test) throws IOException {
    CreateRole create = create(test);
    Role role = createAndCheckRole(create, adminAuthHeaders());
    deleteEntity(role.getId(), adminAuthHeaders());
  }

  @Test
  void delete_validRole_as_non_admin_401(TestInfo test) throws IOException {
    CreateRole create = create(test);
    Role role = createAndCheckRole(create, adminAuthHeaders());
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class, () -> deleteEntity(role.getId(), authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  void patch_roleDeletedDisallowed_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure role deleted attribute can't be changed using patch
    Role role = createRole(create(test), adminAuthHeaders());
    String roleJson = JsonUtils.pojoToJson(role);
    role.setDeleted(true);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> patchRole(roleJson, role, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.readOnlyAttribute("Role", "deleted"));
  }

  @Test
  void patch_roleAttributes_as_non_admin_403(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create table without any attributes
    Role role = createRole(create(test), adminAuthHeaders());
    // Patching as a non-admin should is disallowed
    String originalJson = JsonUtils.pojoToJson(role);
    role.setDisplayName("newDisplayName");
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> patchRole(role.getId(), originalJson, role, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  public static Role createRole(CreateRole create, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(CatalogApplicationTest.getResource("roles"), create, Role.class, authHeaders);
  }

  public static Role getRole(UUID id, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("roles/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Role.class, authHeaders);
  }

  public static Role getRoleByName(String name, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("roles/name/" + name);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Role.class, authHeaders);
  }

  private static void validateRole(
      Role role, String expectedDescription, String expectedDisplayName, String expectedUpdatedBy) {
    assertListNotNull(role.getId(), role.getHref());
    assertEquals(expectedDescription, role.getDescription());
    assertEquals(expectedUpdatedBy, role.getUpdatedBy());
    assertEquals(expectedDisplayName, role.getDisplayName());
  }

  /** Validate returned fields GET .../roles/{id}?fields="..." or GET .../roles/name/{name}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Role expectedRole, boolean byName) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(adminAuthHeaders());
    // Role does not have any supported additional fields yet.
    // .../roles
    Role getRole =
        byName
            ? getRoleByName(expectedRole.getName(), null, adminAuthHeaders())
            : getRole(expectedRole.getId(), null, adminAuthHeaders());
    validateRole(getRole, expectedRole.getDescription(), expectedRole.getDisplayName(), updatedBy);
  }

  private Role patchRole(UUID roleId, String originalJson, Role updated, Map<String, String> authHeaders)
      throws JsonProcessingException, HttpResponseException {
    String updatedJson = JsonUtils.pojoToJson(updated);
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
    return TestUtils.patch(CatalogApplicationTest.getResource("roles/" + roleId), patch, Role.class, authHeaders);
  }

  private Role patchRole(String originalJson, Role updated, Map<String, String> authHeaders)
      throws JsonProcessingException, HttpResponseException {
    return patchRole(updated.getId(), originalJson, updated, authHeaders);
  }

  public static Role createRole(CreateTeam create, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(CatalogApplicationTest.getResource("roles"), create, Role.class, authHeaders);
  }

  CreateRole create(TestInfo test, int index) {
    return new CreateRole().withName(getEntityName(test) + index);
  }

  public CreateRole create(TestInfo test) {
    return create(getEntityName(test));
  }

  public CreateRole create(String entityName) {
    return new CreateRole().withName(entityName);
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name).withDescription(description).withDisplayName(displayName);
  }

  @Override
  public EntityReference getContainer(Object createRequest) throws URISyntaxException {
    return null;
  }

  @Override
  public void validateCreatedEntity(Role role, Object request, Map<String, String> authHeaders) {
    CreateRole createRequest = (CreateRole) request;
    validateCommonEntityFields(
        getEntityInterface(role), createRequest.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    assertEquals(createRequest.getDisplayName(), role.getDisplayName());
  }

  @Override
  public void validateUpdatedEntity(Role updatedEntity, Object request, Map<String, String> authHeaders) {
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
