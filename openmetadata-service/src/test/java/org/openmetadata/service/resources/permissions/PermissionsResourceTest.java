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

package org.openmetadata.service.resources.permissions;

import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.MetadataOperation.ALL;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_DESCRIPTION;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_DISPLAY_NAME;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_LINEAGE;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_OWNER;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_TAGS;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_DATA_PROFILE;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_QUERIES;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_SAMPLE_DATA;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_TESTS;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_USAGE;
import static org.openmetadata.schema.type.Permission.Access.ALLOW;
import static org.openmetadata.schema.type.Permission.Access.CONDITIONAL_ALLOW;
import static org.openmetadata.schema.type.Permission.Access.NOT_ALLOW;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.schema.type.ResourceDescriptor;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.permissions.PermissionsResource.ResourcePermissionList;
import org.openmetadata.service.resources.policies.PolicyResource;
import org.openmetadata.service.resources.policies.PolicyResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PermissionsResourceTest extends OpenMetadataApplicationTest {
  private static final String ORG_POLICY_NAME = "OrganizationPolicy";
  private static List<Rule> ORG_RULES;

  private static final String DATA_STEWARD_ROLE_NAME = "DataSteward";
  private static final String DATA_STEWARD_POLICY_NAME = "DataStewardPolicy";
  private static List<Rule> DATA_STEWARD_RULES;

  private static final String DATA_CONSUMER_ROLE_NAME = "DataConsumer";
  private static final String DATA_CONSUMER_POLICY_NAME = "DataConsumerPolicy";
  private static List<Rule> DATA_CONSUMER_RULES;

  private static final String DATA_STEWARD_USER_NAME = "user-data-steward";
  private static User DATA_STEWARD_USER;
  private static final String DATA_CONSUMER_USER_NAME = "user-data-consumer";
  private static User DATA_CONSUMER_USER;

  @BeforeAll
  static void setup(TestInfo test) throws IOException, URISyntaxException {
    new TableResourceTest().setup(test);
    PolicyResourceTest policyResourceTest = new PolicyResourceTest();

    Policy ORG_POLICY =
        policyResourceTest.getEntityByName(ORG_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    ORG_RULES = ORG_POLICY.getRules();

    Policy DATA_STEWARD_POLICY =
        policyResourceTest.getEntityByName(DATA_STEWARD_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_STEWARD_RULES = DATA_STEWARD_POLICY.getRules();

    DATA_STEWARD_POLICY =
        policyResourceTest.getEntityByName(DATA_STEWARD_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_STEWARD_RULES = DATA_STEWARD_POLICY.getRules();

    DATA_STEWARD_USER = EntityResourceTest.USER_WITH_DATA_STEWARD_ROLE;

    Policy DATA_CONSUMER_POLICY =
        policyResourceTest.getEntityByName(DATA_CONSUMER_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_CONSUMER_RULES = DATA_CONSUMER_POLICY.getRules();

    DATA_CONSUMER_USER = EntityResourceTest.USER_WITH_DATA_CONSUMER_ROLE;
  }

  @Test
  void get_anotherUserPermission_disallowed() {
    // Only admin can get another user's permission
    // Getting as a data consumer, data steward's permissions should fail
    Map<String, String> authHeaders = SecurityUtil.authHeaders(DATA_CONSUMER_USER_NAME + "@open-metadata.org");
    assertResponse(
        () -> getPermissions(DATA_STEWARD_USER_NAME, authHeaders),
        FORBIDDEN,
        CatalogExceptionMessage.notAdmin(DATA_CONSUMER_USER_NAME));
  }

  @Test
  void get_admin_permissions() throws HttpResponseException {
    List<ResourcePermission> actualPermissions = getPermissions(ADMIN_AUTH_HEADERS);
    assertEquals(PolicyEvaluator.getResourcePermissions(ALLOW), actualPermissions);
  }

  @Test
  void get_dataConsumer_permissions() throws HttpResponseException {
    List<MetadataOperation> conditional = List.of(ALL); // All operations are conditionally allowed

    // Validate permissions for all resources as logged-in user
    Map<String, String> authHeaders = SecurityUtil.authHeaders(DATA_CONSUMER_USER_NAME + "@open-metadata.org");
    List<ResourcePermission> actualPermissions = getPermissions(authHeaders);
    assertDataConsumerPermissions(actualPermissions, conditional);

    // Validate permissions for DATA_CONSUMER_USER as admin and validate it
    actualPermissions = getPermissions(DATA_CONSUMER_USER_NAME, ADMIN_AUTH_HEADERS);
    assertDataConsumerPermissions(actualPermissions, conditional);

    // Validate permission as logged-in user for each resource one at a time
    for (ResourceDescriptor rd : ResourceRegistry.listResourceDescriptors()) {
      ResourcePermission actualPermission = getPermission(rd.getName(), null, authHeaders);
      assertDataConsumerPermission(actualPermission, conditional);
    }

    // Validate permission as admin user for each resource one at a time
    for (ResourceDescriptor rd : ResourceRegistry.listResourceDescriptors()) {
      ResourcePermission actualPermission = getPermission(rd.getName(), DATA_CONSUMER_USER_NAME, authHeaders);
      assertDataConsumerPermission(actualPermission, conditional);
    }

    //
    // Test getting permissions for an entity as an owner
    //
    // Create an entity with data consumer as owner
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable =
        tableResourceTest.createRequest("permissionTest").withOwner(DATA_CONSUMER_USER.getEntityReference());
    Table table1 = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Data consumer must have all operations allowed based on Organization policy as an owner
    ResourcePermission actualPermission = getPermission(Entity.TABLE, table1.getId(), null, authHeaders);
    assertAllOperationsAllowed(actualPermission);

    // get permissions by resource entity name
    actualPermission = getPermissionByName(Entity.TABLE, table1.getFullyQualifiedName(), null, authHeaders);
    assertAllOperationsAllowed(actualPermission);

    // Admin getting permissions for a specific resource on for Data consumer
    actualPermission = getPermission(Entity.TABLE, table1.getId(), DATA_CONSUMER_USER_NAME, ADMIN_AUTH_HEADERS);
    assertAllOperationsAllowed(actualPermission);

    // Create another table with a different owner and make sure data consumer does not have permission as non owner
    createTable = tableResourceTest.createRequest("permissionTest1").withOwner(DATA_STEWARD_USER.getEntityReference());
    Table table2 = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    //
    // Test getting permissions for an entity user does not own
    //
    // Data consumer has non-owner permissions
    actualPermission = getPermission(Entity.TABLE, table2.getId(), null, authHeaders);

    // Note that conditional list is empty. All the required context to resolve is met when requesting permission of
    // a specific resource (both subject and resource context). Only Deny, Allow, NotAllow permissions are expected.
    assertDataConsumerPermission(actualPermission, Collections.emptyList());
  }

  private void assertAllOperationsAllowed(ResourcePermission actualPermission) {
    assertEquals(Entity.TABLE, actualPermission.getResource());
    for (Permission permission : actualPermission.getPermissions()) {
      assertEquals(ALLOW, permission.getAccess());
      assertTrue(List.of(ORG_POLICY_NAME, DATA_CONSUMER_POLICY_NAME).contains(permission.getPolicy()));
    }
  }

  private void assertDataConsumerPermissions(
      List<ResourcePermission> actualPermissions, List<MetadataOperation> conditional) {
    // Only allowed operations in DataConsumerRole. All other operations are notAllow by default
    for (ResourcePermission actualPermission : actualPermissions) { // For all resources
      assertDataConsumerPermission(actualPermission, conditional);
    }
  }

  private void assertDataConsumerPermission(ResourcePermission actualPermission, List<MetadataOperation> conditional) {
    List<MetadataOperation> allowed =
        List.of(
            VIEW_ALL,
            VIEW_USAGE,
            VIEW_DATA_PROFILE,
            VIEW_SAMPLE_DATA,
            VIEW_TESTS,
            VIEW_QUERIES,
            EDIT_DESCRIPTION,
            EDIT_TAGS);

    // Only allowed operations in DataConsumerRole. All other operations are conditional allow or not allow
    for (Permission permission : actualPermission.getPermissions()) {
      if (allowed.contains(permission.getOperation())) {
        assertPermission(permission, ALLOW, DATA_CONSUMER_ROLE_NAME, DATA_CONSUMER_POLICY_NAME, DATA_CONSUMER_RULES);
      } else if (conditional.contains(permission.getOperation()) || conditional.contains(ALL)) {
        assertPermission(permission, CONDITIONAL_ALLOW, null, ORG_POLICY_NAME, ORG_RULES);
      } else {
        assertPermission(permission, NOT_ALLOW, null, null, null);
      }
    }
  }

  @Test
  void get_dataSteward_permissions() throws HttpResponseException {
    Map<String, String> authHeaders = SecurityUtil.authHeaders(DATA_STEWARD_USER_NAME + "@open-metadata.org");
    List<ResourcePermission> actualPermissions = getPermissions(authHeaders);

    for (ResourcePermission actualPermission : actualPermissions) { // For all resources
      assertDataStewardPermission(actualPermission);
    }
  }

  private void assertDataStewardPermission(ResourcePermission actualPermission) {
    // Only allowed operations in DataConsumerRole. All other operations are conditionalAllow by default
    List<MetadataOperation> allowed =
        List.of(
            VIEW_ALL,
            VIEW_USAGE,
            VIEW_DATA_PROFILE,
            VIEW_SAMPLE_DATA,
            VIEW_TESTS,
            VIEW_QUERIES,
            EDIT_OWNER,
            EDIT_DISPLAY_NAME,
            EDIT_LINEAGE,
            EDIT_DESCRIPTION,
            EDIT_TAGS);
    for (Permission permission : actualPermission.getPermissions()) {
      if (allowed.contains(permission.getOperation())) {
        assertPermission(permission, ALLOW, DATA_STEWARD_ROLE_NAME, DATA_STEWARD_POLICY_NAME, DATA_STEWARD_RULES);
      } else {
        assertPermission(permission, CONDITIONAL_ALLOW, null, ORG_POLICY_NAME, ORG_RULES);
      }
    }
  }

  private void assertPermission(
      Permission permission,
      Access expectedAccess,
      String expectedRole,
      String expectedPolicy,
      List<Rule> expectedRules) {
    assertEquals(expectedAccess, permission.getAccess(), permission.toString());
    assertEquals(expectedRole, permission.getRole(), permission.toString());
    assertEquals(expectedPolicy, permission.getPolicy(), permission.toString());
    assertTrue(expectedRules == null || expectedRules.contains(permission.getRule()));
  }

  public List<ResourcePermission> getPermissions(Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("permissions");
    return TestUtils.get(target, ResourcePermissionList.class, authHeaders).getData();
  }

  public List<ResourcePermission> getPermissions(String user, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("permissions");
    target = user != null ? target.queryParam("user", user) : target;
    return TestUtils.get(target, ResourcePermissionList.class, authHeaders).getData();
  }

  public ResourcePermission getPermission(String resource, String user, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("permissions/" + resource);
    target = user != null ? target.queryParam("user", user) : target;
    return TestUtils.get(target, ResourcePermission.class, authHeaders);
  }

  public ResourcePermission getPermission(String resource, UUID uuid, String user, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("permissions/" + resource + "/" + uuid);
    target = user != null ? target.queryParam("user", user) : target;
    return TestUtils.get(target, ResourcePermission.class, authHeaders);
  }

  public ResourcePermission getPermissionByName(
      String resource, String name, String user, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("permissions/" + resource + "/name/" + name);
    target = user != null ? target.queryParam("user", user) : target;
    return TestUtils.get(target, ResourcePermission.class, authHeaders);
  }
}
