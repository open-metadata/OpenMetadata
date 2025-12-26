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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Role entity operations.
 *
 * <p>Extends BaseEntityIT to inherit all common entity tests. Adds role-specific tests for
 * policies, system role protection, and role assignment.
 *
 * <p>Migrated from: org.openmetadata.service.resources.teams.RoleResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class RoleResourceIT extends BaseEntityIT<Role, CreateRole> {

  public RoleResourceIT() {
    supportsFollowers = false;
    supportsTags = false;
    supportsDomains = false;
    supportsDataProducts = false;
    supportsSoftDelete = true;
    supportsPatch = true;
    supportsOwners = false;
    supportsSearchIndex = false; // Role does not have search index
  }

  @Override
  protected CreateRole createMinimalRequest(TestNamespace ns) {
    List<String> policyFqns =
        dataStewardRole().getPolicies().stream()
            .map(EntityReference::getFullyQualifiedName)
            .toList();

    return new CreateRole()
        .withName(ns.prefix("role"))
        .withPolicies(policyFqns)
        .withDescription("Test role created by integration test");
  }

  @Override
  protected CreateRole createRequest(String name, TestNamespace ns) {
    List<String> policyFqns =
        dataStewardRole().getPolicies().stream()
            .map(EntityReference::getFullyQualifiedName)
            .toList();

    return new CreateRole().withName(name).withPolicies(policyFqns).withDescription("Test role");
  }

  @Override
  protected Role createEntity(CreateRole createRequest) {
    return SdkClients.adminClient().roles().create(createRequest);
  }

  @Override
  protected Role getEntity(String id) {
    return SdkClients.adminClient().roles().get(id);
  }

  @Override
  protected Role getEntityByName(String fqn) {
    return SdkClients.adminClient().roles().getByName(fqn);
  }

  @Override
  protected Role patchEntity(String id, Role entity) {
    return SdkClients.adminClient().roles().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().roles().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().roles().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    SdkClients.adminClient()
        .roles()
        .delete(id, java.util.Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "role";
  }

  @Override
  protected void validateCreatedEntity(Role entity, CreateRole createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
    assertNotNull(entity.getPolicies());
    assertFalse(entity.getPolicies().isEmpty());
  }

  @Override
  protected Role getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().roles().get(id, fields);
  }

  @Override
  protected Role getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().roles().getByName(fqn, fields);
  }

  @Override
  protected Role getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().roles().get(id, null, "deleted");
  }

  @Override
  protected ListResponse<Role> listEntities(ListParams params) {
    return SdkClients.adminClient().roles().list(params);
  }

  // ===================================================================
  // ROLE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void test_createRoleWithDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    List<String> policyFqns =
        dataStewardRole().getPolicies().stream()
            .map(EntityReference::getFullyQualifiedName)
            .toList();

    CreateRole create =
        new CreateRole()
            .withName(ns.prefix("roleDisplayName"))
            .withPolicies(policyFqns)
            .withDisplayName("My Custom Role")
            .withDescription("Role with display name");

    Role role = createEntity(create);
    assertEquals("My Custom Role", role.getDisplayName());
    assertNotNull(role.getPolicies());
  }

  @Test
  void test_createRoleWithMultiplePolicies(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    List<String> policyFqns =
        List.of(shared().POLICY1.getFullyQualifiedName(), shared().POLICY2.getFullyQualifiedName());

    CreateRole create =
        new CreateRole()
            .withName(ns.prefix("roleMultiPolicy"))
            .withPolicies(policyFqns)
            .withDescription("Role with multiple policies");

    Role role = createEntity(create);
    assertNotNull(role.getPolicies());
    assertEquals(2, role.getPolicies().size());
  }

  @Test
  void test_deleteSystemRoleNotAllowed(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Role dataSteward = dataStewardRole();
    Role dataConsumer = dataConsumerRole();

    assertThrows(
        Exception.class,
        () -> deleteEntity(dataSteward.getId().toString()),
        "Deleting system role DataSteward should not be allowed");

    assertThrows(
        Exception.class,
        () -> deleteEntity(dataConsumer.getId().toString()),
        "Deleting system role DataConsumer should not be allowed");
  }

  @Test
  void test_updateRoleDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateRole create = createMinimalRequest(ns);
    Role role = createEntity(create);

    role.setDisplayName("Updated Role Display Name");
    Role updated = patchEntity(role.getId().toString(), role);

    assertEquals("Updated Role Display Name", updated.getDisplayName());
  }

  @Test
  void test_updateRoleDescription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateRole create = createMinimalRequest(ns);
    Role role = createEntity(create);

    role.setDescription("Updated description for role");
    Role updated = patchEntity(role.getId().toString(), role);

    assertEquals("Updated description for role", updated.getDescription());
  }

  @Test
  void test_getRoleWithPolicies(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateRole create = createMinimalRequest(ns);
    Role role = createEntity(create);

    Role fetched = client.roles().get(role.getId().toString(), "policies");
    assertNotNull(fetched.getPolicies());
    assertFalse(fetched.getPolicies().isEmpty());

    for (EntityReference policy : fetched.getPolicies()) {
      assertNotNull(policy.getId());
      assertNotNull(policy.getName());
      assertNotNull(policy.getType());
    }
  }

  @Test
  void test_getRoleWithUsersAndTeams(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateRole create = createMinimalRequest(ns);
    Role role = createEntity(create);

    Role fetched = client.roles().get(role.getId().toString(), "users,teams");
    assertNotNull(fetched);
  }

  @Test
  void test_softDeleteAndRestoreRole(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateRole create = createMinimalRequest(ns);
    Role role = createEntity(create);
    String roleId = role.getId().toString();

    deleteEntity(roleId);

    assertThrows(
        Exception.class, () -> getEntity(roleId), "Deleted role should not be retrievable");

    Role deleted = getEntityIncludeDeleted(roleId);
    assertTrue(deleted.getDeleted());

    restoreEntity(roleId);

    Role restored = getEntity(roleId);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_roleVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateRole create = createMinimalRequest(ns);
    Role role = createEntity(create);
    assertEquals(0.1, role.getVersion(), 0.001);

    role.setDescription("Updated description v1");
    Role v2 = patchEntity(role.getId().toString(), role);
    assertEquals(0.2, v2.getVersion(), 0.001);

    var history = client.roles().getVersionList(role.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void test_listRoles(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 3; i++) {
      List<String> policyFqns =
          dataStewardRole().getPolicies().stream()
              .map(EntityReference::getFullyQualifiedName)
              .toList();

      CreateRole create =
          new CreateRole()
              .withName(ns.prefix("listRole" + i))
              .withPolicies(policyFqns)
              .withDescription("Role for list test");
      createEntity(create);
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Role> response = listEntities(params);

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void test_listRolesWithPoliciesField(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    List<String> policyFqns =
        dataStewardRole().getPolicies().stream()
            .map(EntityReference::getFullyQualifiedName)
            .toList();

    for (int i = 0; i < 3; i++) {
      CreateRole create =
          new CreateRole()
              .withName(ns.prefix("bulkRole" + i))
              .withPolicies(policyFqns)
              .withDescription("Role for bulk fetch test");
      createEntity(create);
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    params.setFields("policies");
    ListResponse<Role> response = listEntities(params);

    assertNotNull(response);
    assertNotNull(response.getData());

    for (Role role : response.getData()) {
      if (role.getName().contains(ns.prefix(""))) {
        assertNotNull(
            role.getPolicies(), "Policies should be included for role: " + role.getName());
        assertFalse(role.getPolicies().isEmpty());
      }
    }
  }

  // ===================================================================
  // VERSION HISTORY SUPPORT
  // ===================================================================

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().roles().getVersionList(id);
  }

  @Override
  protected Role getVersion(UUID id, Double version) {
    return SdkClients.adminClient().roles().getVersion(id.toString(), version);
  }
}
