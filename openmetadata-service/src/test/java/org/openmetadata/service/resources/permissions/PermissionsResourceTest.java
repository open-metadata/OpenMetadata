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
import static org.openmetadata.schema.type.MetadataOperation.CREATE;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_ALL;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_DESCRIPTION;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_DISPLAY_NAME;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_LINEAGE;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_OWNER;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_TAGS;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_PII_SAMPLE_DATA;
import static org.openmetadata.schema.type.Permission.Access.ALLOW;
import static org.openmetadata.schema.type.Permission.Access.CONDITIONAL_ALLOW;
import static org.openmetadata.schema.type.Permission.Access.DENY;
import static org.openmetadata.schema.type.Permission.Access.NOT_ALLOW;
import static org.openmetadata.service.Entity.ORGANIZATION_POLICY_NAME;
import static org.openmetadata.service.security.policyevaluator.OperationContext.getAllOperations;
import static org.openmetadata.service.security.policyevaluator.OperationContext.getOperations;
import static org.openmetadata.service.security.policyevaluator.OperationContext.getViewOperations;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.json.Json;
import javax.json.JsonPatch;
import javax.json.JsonPatchBuilder;
import javax.ws.rs.client.WebTarget;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
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
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.TestUtils;

@Slf4j
class PermissionsResourceTest extends OpenMetadataApplicationTest {
  private static Rule ORG_IS_OWNER_RULE;
  private static Rule ORG_NO_OWNER_RULE;
  private static Rule ORG_PII_SENSITIVE_SAMPLE_DATA_RULE;
  private static final List<MetadataOperation> ORG_IS_OWNER_RULE_OPERATIONS = getAllOperations(CREATE);
  private static final List<MetadataOperation> ORG_NO_OWNER_RULE_OPERATIONS = List.of(EDIT_OWNER);

  private static final List<MetadataOperation> ORG_PII_SENSITIVE_SAMPLE_DATA_RULE_OPERATIONS =
      List.of(VIEW_PII_SAMPLE_DATA);

  private static final String DATA_STEWARD_ROLE_NAME = "DataSteward";
  private static Policy DATA_STEWARD_POLICY;
  private static final String DATA_STEWARD_POLICY_NAME = "DataStewardPolicy";
  private static List<Rule> DATA_STEWARD_RULES;

  private static final String DATA_CONSUMER_ROLE_NAME = "DataConsumer";
  private static Policy DATA_CONSUMER_POLICY;
  private static final String DATA_CONSUMER_POLICY_NAME = "DataConsumerPolicy";
  private static List<Rule> DATA_CONSUMER_RULES;
  private static final List<MetadataOperation> DATA_CONSUMER_ALLOWED = getViewOperations();

  static {
    DATA_CONSUMER_ALLOWED.addAll(List.of(EDIT_DESCRIPTION, EDIT_TAGS));
  }

  private static final List<MetadataOperation> DATA_STEWARD_ALLOWED = new ArrayList<>(DATA_CONSUMER_ALLOWED);

  static {
    // DATA_CONSUMER + additional operations
    DATA_STEWARD_ALLOWED.addAll(List.of(EDIT_OWNER, EDIT_DISPLAY_NAME, EDIT_LINEAGE));
  }

  private static final String DATA_STEWARD_USER_NAME = "user-data-steward";
  private static User DATA_STEWARD_USER;
  private static final String DATA_CONSUMER_USER_NAME = "user-data-consumer";
  private static User DATA_CONSUMER_USER;

  @BeforeAll
  static void setup(TestInfo test) throws IOException, URISyntaxException {
    new TableResourceTest().setup(test);
    PolicyResourceTest policyResourceTest = new PolicyResourceTest();

    Policy orgPolicy =
        policyResourceTest.getEntityByName(ORGANIZATION_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    List<Rule> orgRules = orgPolicy.getRules();
    // Rules are alphabetically ordered
    ORG_NO_OWNER_RULE = orgRules.get(0);
    ORG_IS_OWNER_RULE = orgRules.get(1);
    ORG_PII_SENSITIVE_SAMPLE_DATA_RULE = orgRules.get(2);

    DATA_STEWARD_POLICY =
        policyResourceTest.getEntityByName(DATA_STEWARD_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_STEWARD_RULES = DATA_STEWARD_POLICY.getRules();

    DATA_STEWARD_USER = EntityResourceTest.USER_WITH_DATA_STEWARD_ROLE;

    DATA_CONSUMER_POLICY =
        policyResourceTest.getEntityByName(DATA_CONSUMER_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_CONSUMER_RULES = DATA_CONSUMER_POLICY.getRules();

    DATA_CONSUMER_USER = EntityResourceTest.USER_WITH_DATA_CONSUMER_ROLE;
  }

  @Test
  void get_anotherUserPermission_disallowed() {
    // Only admin can get another user's permission (this is tested in other tests)
    // Getting as a data consumer, data steward's permissions should fail
    Map<String, String> authHeaders = SecurityUtil.authHeaders(DATA_CONSUMER_USER_NAME + "@open-metadata.org");
    assertResponse(
        () -> getPermissions(DATA_STEWARD_USER_NAME, authHeaders),
        FORBIDDEN,
        CatalogExceptionMessage.notAdmin(DATA_CONSUMER_USER_NAME));
  }

  @Test
  void get_admin_permissions_for_role() throws HttpResponseException {
    // Ensure an admin has all the permissions
    List<ResourcePermission> actualPermissions = getPermissions(ADMIN_AUTH_HEADERS);
    assertEquals(PolicyEvaluator.getResourcePermissions(ALLOW), actualPermissions);
  }

  @Test
  void get_dataConsumer_permissions_for_role() throws HttpResponseException {
    //
    // Validate permissions for all resources as logged-in user
    //
    Map<String, String> authHeaders = SecurityUtil.authHeaders(DATA_CONSUMER_USER_NAME + "@open-metadata.org");
    List<ResourcePermission> actualPermissions = getPermissions(authHeaders);
    ResourcePermissionsBuilder permissionsBuilder = new ResourcePermissionsBuilder();
    permissionsBuilder.setPermission(
        DATA_CONSUMER_ALLOWED, ALLOW, DATA_CONSUMER_ROLE_NAME, DATA_CONSUMER_POLICY_NAME, DATA_CONSUMER_RULES.get(0));
    // Set permissions based on alphabetical order of roles
    permissionsBuilder.setPermission(
        ORG_NO_OWNER_RULE_OPERATIONS, CONDITIONAL_ALLOW, null, ORGANIZATION_POLICY_NAME, ORG_NO_OWNER_RULE);
    permissionsBuilder.setPermission(
        ORG_IS_OWNER_RULE_OPERATIONS, CONDITIONAL_ALLOW, null, ORGANIZATION_POLICY_NAME, ORG_IS_OWNER_RULE);
    assertResourcePermissions(permissionsBuilder.getResourcePermissions(), actualPermissions);

    // Validate permissions for all resources for data consumer as admin
    actualPermissions = getPermissions(DATA_CONSUMER_USER_NAME, ADMIN_AUTH_HEADERS);
    assertResourcePermissions(permissionsBuilder.getResourcePermissions(), actualPermissions);

    // Validate permission as logged-in user for each resource one at a time
    ResourcePermission actualPermission;
    for (ResourceDescriptor rd : ResourceRegistry.listResourceDescriptors()) {
      actualPermission = getPermission(rd.getName(), null, authHeaders);
      assertResourcePermission(permissionsBuilder.getPermission(rd.getName()), actualPermission);
    }

    // Validate permission of data consumer as admin user for each resource one at a time
    for (ResourceDescriptor rd : ResourceRegistry.listResourceDescriptors()) {
      actualPermission = getPermission(rd.getName(), DATA_CONSUMER_USER_NAME, authHeaders);
      assertResourcePermission(permissionsBuilder.getPermission(rd.getName()), actualPermission);
    }
  }

  @Test
  void get_dataSteward_permissions_for_role() throws HttpResponseException {
    Map<String, String> authHeaders = SecurityUtil.authHeaders(DATA_STEWARD_USER_NAME + "@open-metadata.org");
    List<ResourcePermission> actualPermissions = getPermissions(authHeaders);

    ResourcePermissionsBuilder permissionsBuilder = new ResourcePermissionsBuilder();
    permissionsBuilder.setPermission(
        DATA_STEWARD_ALLOWED, ALLOW, DATA_STEWARD_ROLE_NAME, DATA_STEWARD_POLICY_NAME, DATA_STEWARD_RULES.get(0));
    // Set permissions based on alphabetical order of roles
    permissionsBuilder.setPermission(
        ORG_NO_OWNER_RULE_OPERATIONS, CONDITIONAL_ALLOW, null, ORGANIZATION_POLICY_NAME, ORG_NO_OWNER_RULE);
    permissionsBuilder.setPermission(
        ORG_IS_OWNER_RULE_OPERATIONS, CONDITIONAL_ALLOW, null, ORGANIZATION_POLICY_NAME, ORG_IS_OWNER_RULE);

    assertResourcePermissions(permissionsBuilder.getResourcePermissions(), actualPermissions);
  }

  @Test
  void get_permissionsForPolicies() throws HttpResponseException {
    // Get permissions for DATA_CONSUMER policy and assert it is correct
    List<UUID> policies = new ArrayList<>(List.of(DATA_CONSUMER_POLICY.getId()));
    List<ResourcePermission> actual = getPermissionsForPolicies(policies, ADMIN_AUTH_HEADERS);
    ResourcePermissionsBuilder permissionsBuilder = new ResourcePermissionsBuilder();
    permissionsBuilder.setPermission(
        DATA_CONSUMER_ALLOWED, ALLOW, null, DATA_CONSUMER_POLICY_NAME, DATA_CONSUMER_RULES.get(0));

    assertResourcePermissions(permissionsBuilder.getResourcePermissions(), actual);

    // Get permissions for DATA_CONSUMER and DATA_STEWARD policies together and assert it is correct
    policies.add(DATA_STEWARD_POLICY.getId());
    actual = getPermissionsForPolicies(policies, ADMIN_AUTH_HEADERS);
    permissionsBuilder.setPermission(
        DATA_STEWARD_ALLOWED, ALLOW, null, DATA_STEWARD_POLICY_NAME, DATA_STEWARD_RULES.get(0));
    assertResourcePermissions(permissionsBuilder.getResourcePermissions(), actual);
  }

  @Test
  void get_non_owner_permissions() throws HttpResponseException {
    //
    // Test getting permissions for an entity user does not own
    //
    TableResourceTest tableResourceTest = new TableResourceTest();
    Map<String, String> authHeaders = SecurityUtil.authHeaders(DATA_CONSUMER_USER_NAME + "@open-metadata.org");

    ResourcePermissionsBuilder permissionsBuilder = new ResourcePermissionsBuilder();
    // Organization policy of no owner or isOwner does not apply. Hence, not added to expected permissions.
    permissionsBuilder.setPermission(
        DATA_CONSUMER_ALLOWED, ALLOW, DATA_CONSUMER_ROLE_NAME, DATA_CONSUMER_POLICY_NAME, DATA_CONSUMER_RULES.get(0));
    // Added to the expected permissions Organization rule of deny PII.Sensitive tag in sample data if not owner
    permissionsBuilder.setPermission(
        ORG_PII_SENSITIVE_SAMPLE_DATA_RULE_OPERATIONS,
        DENY,
        null,
        ORGANIZATION_POLICY_NAME,
        ORG_PII_SENSITIVE_SAMPLE_DATA_RULE);

    // Create a table with owner other than data consumer & make sure data consumer doesn't have permission as non owner
    CreateTable createTable =
        tableResourceTest.createRequest("permissionTest1").withOwner(DATA_STEWARD_USER.getEntityReference());
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Data consumer has non-owner permissions
    ResourcePermission actualPermission = getPermission(Entity.TABLE, table.getId(), null, authHeaders);

    // Note that conditional list is empty. All the required context to resolve is met when requesting permission of
    // a specific resource (both subject and resource context). Only Deny, Allow, NotAllow permissions are expected.
    assertResourcePermission(permissionsBuilder.getPermission(Entity.TABLE), actualPermission);
  }

  @Test
  void get_owner_permissions() throws HttpResponseException, JsonProcessingException {
    //
    // Test getting permissions for an entity as an owner - where ORG_POLICY isOwner becomes effective
    //
    TableResourceTest tableResourceTest = new TableResourceTest();
    Map<String, String> authHeaders = SecurityUtil.authHeaders(DATA_CONSUMER_USER_NAME + "@open-metadata.org");

    // Create an entity with data consumer as owner
    CreateTable createTable =
        tableResourceTest
            .createRequest("permissionTest")
            .withDescription("description")
            .withDisplayName("display")
            .withOwner(DATA_CONSUMER_USER.getEntityReference());
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Data consumer must have all operations except create allowed based on Organization policy as an owner
    ResourcePermissionsBuilder permissionsBuilder = new ResourcePermissionsBuilder();
    permissionsBuilder.setPermission(
        DATA_CONSUMER_ALLOWED, ALLOW, DATA_CONSUMER_ROLE_NAME, DATA_CONSUMER_POLICY_NAME, DATA_CONSUMER_RULES.get(0));
    permissionsBuilder.setPermission(
        ORG_IS_OWNER_RULE_OPERATIONS, ALLOW, null, ORGANIZATION_POLICY_NAME, ORG_IS_OWNER_RULE);
    ResourcePermission actualPermission = getPermission(Entity.TABLE, table.getId(), null, authHeaders);
    assertResourcePermission(permissionsBuilder.getPermission(Entity.TABLE), actualPermission);

    // get permissions by resource entity name
    actualPermission = getPermissionByName(Entity.TABLE, table.getFullyQualifiedName(), null, authHeaders);
    assertResourcePermission(permissionsBuilder.getPermission(Entity.TABLE), actualPermission);

    // Admin getting permissions for a specific resource on for Data consumer
    actualPermission = getPermission(Entity.TABLE, table.getId(), DATA_CONSUMER_USER_NAME, ADMIN_AUTH_HEADERS);
    assertResourcePermission(permissionsBuilder.getPermission(Entity.TABLE), actualPermission);

    PolicyResourceTest policyResourceTest = new PolicyResourceTest();
    Policy orgPolicy = policyResourceTest.getEntityByName(ORGANIZATION_POLICY_NAME, "", ADMIN_AUTH_HEADERS);
    List<MetadataOperation> editOperations = getOperations(Entity.TABLE, "Edit", EDIT_ALL, EDIT_DESCRIPTION, EDIT_TAGS);

    // Change organization owner rule to take away one permission at a time and ensure permissions reflect it
    for (MetadataOperation editOperation : editOperations) {
      List<MetadataOperation> allowedOperations =
          editOperations.stream().filter(operation -> operation != editOperation).collect(Collectors.toList());
      LOG.info("Removing permission for {}", editOperation);

      // Update the organization policy with the list of allowed operations
      String origJson = JsonUtils.pojoToJson(orgPolicy);
      orgPolicy.getRules().get(1).withOperations(allowedOperations); // Exclude the editOperation
      orgPolicy = policyResourceTest.patchEntity(orgPolicy.getId(), origJson, orgPolicy, ADMIN_AUTH_HEADERS);

      // Ensure removed operation is not allowed
      permissionsBuilder = new ResourcePermissionsBuilder();
      permissionsBuilder.setPermission(
          DATA_CONSUMER_ALLOWED, ALLOW, DATA_CONSUMER_ROLE_NAME, DATA_CONSUMER_POLICY_NAME, DATA_CONSUMER_RULES.get(0));
      permissionsBuilder.setPermission(
          allowedOperations, ALLOW, null, ORGANIZATION_POLICY_NAME, orgPolicy.getRules().get(1));
      actualPermission = getPermissionByName(Entity.TABLE, table.getFullyQualifiedName(), null, authHeaders);
      assertResourcePermission(permissionsBuilder.getPermission(Entity.TABLE), actualPermission);

      // Finally, try to patch the field that can't be edited and expect permission denied
      String field = ResourceRegistry.getField(editOperation);
      if (field != null) {
        JsonPatchBuilder jsonPatchBuilder =
            Json.createPatchBuilder().remove("/" + ResourceRegistry.getField(editOperation));
        JsonPatch patch = jsonPatchBuilder.build();
        assertResponse(
            () -> tableResourceTest.patchEntity(table.getId(), patch, authHeaders),
            FORBIDDEN,
            CatalogExceptionMessage.permissionNotAllowed(DATA_CONSUMER_USER_NAME, List.of(editOperation)));
      } else {
        LOG.warn("Field for operation {} is null", editOperation);
      }
    }
  }

  private void assertResourcePermissions(List<ResourcePermission> expected, List<ResourcePermission> actual) {
    assertEquals(expected.size(), actual.size());
    Comparator<ResourcePermission> resourcePermissionComparator = Comparator.comparing(ResourcePermission::getResource);
    expected.sort(resourcePermissionComparator);
    actual.sort(resourcePermissionComparator);
    for (int i = 0; i < expected.size(); i++) {
      assertResourcePermission(expected.get(i), actual.get(i));
    }
  }

  private void assertResourcePermission(ResourcePermission expected, ResourcePermission actual) {
    assertEquals(expected.getPermissions().size(), actual.getPermissions().size());
    Comparator<Permission> operationComparator = Comparator.comparing(Permission::getOperation);
    expected.getPermissions().sort(operationComparator);
    actual.getPermissions().sort(operationComparator);
    for (int i = 0; i < expected.getPermissions().size(); i++) {
      // Using for loop to compare instead of equals to help with debugging the difference between the lists
      assertEquals(expected.getPermissions().get(i), actual.getPermissions().get(i));
    }
  }

  public List<ResourcePermission> getPermissions(Map<String, String> authHeaders) throws HttpResponseException {
    // Get permissions as a logged-in user for all the resources
    WebTarget target = getResource("permissions");
    return TestUtils.get(target, ResourcePermissionList.class, authHeaders).getData();
  }

  public List<ResourcePermission> getPermissions(String user, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Get permissions for another user for all the resources
    WebTarget target = getResource("permissions");
    target = user != null ? target.queryParam("user", user) : target;
    return TestUtils.get(target, ResourcePermissionList.class, authHeaders).getData();
  }

  public ResourcePermission getPermission(String resource, String user, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Get permissions for another user for a given resource type
    WebTarget target = getResource("permissions/" + resource);
    target = user != null ? target.queryParam("user", user) : target;
    return TestUtils.get(target, ResourcePermission.class, authHeaders);
  }

  public ResourcePermission getPermission(String resource, UUID uuid, String user, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Get permissions for another user for a given resource type and specific resource by id
    WebTarget target = getResource("permissions/" + resource + "/" + uuid);
    target = user != null ? target.queryParam("user", user) : target;
    return TestUtils.get(target, ResourcePermission.class, authHeaders);
  }

  public ResourcePermission getPermissionByName(
      String resource, String name, String user, Map<String, String> authHeaders) throws HttpResponseException {
    // Get permissions for another user for a given resource type and specific resource by name
    WebTarget target = getResource("permissions/").path(resource).path("/name/").path(name);
    target = user != null ? target.queryParam("user", user) : target;
    return TestUtils.get(target, ResourcePermission.class, authHeaders);
  }

  public List<ResourcePermission> getPermissionsForPolicies(List<UUID> policyIds, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("permissions/policies");
    for (UUID policyId : policyIds) {
      target = target.queryParam("ids", policyId);
    }
    return TestUtils.get(target, ResourcePermissionList.class, authHeaders).getData();
  }

  /** Build permissions based on role, policies, etc. for testing purposes */
  public static class ResourcePermissionsBuilder {
    @Getter
    private final List<ResourcePermission> resourcePermissions = PolicyEvaluator.getResourcePermissions(NOT_ALLOW);

    public void setPermission(
        List<MetadataOperation> operations, Access access, String role, String policy, Rule rule) {
      resourcePermissions.forEach(rp -> setPermission(rp, operations, access, role, policy, rule));
    }

    public ResourcePermission getPermission(String resource) {
      return resourcePermissions.stream()
          .filter(resourcePermission -> resourcePermission.getResource().equals(resource))
          .findAny()
          .orElse(null);
    }

    private void setPermission(
        ResourcePermission resourcePermission,
        List<MetadataOperation> operations,
        Access access,
        String role,
        String policy,
        Rule rule) {
      for (Permission permission : resourcePermission.getPermissions()) {
        if (operations.contains(permission.getOperation())
            && CompiledRule.overrideAccess(access, permission.getAccess())) {
          permission.withAccess(access).withRole(role).withPolicy(policy).withRule(rule);
        }
      }
    }
  }
}
