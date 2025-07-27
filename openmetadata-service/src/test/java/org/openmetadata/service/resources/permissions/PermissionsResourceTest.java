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

import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_ALL;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_DESCRIPTION;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_DISPLAY_NAME;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_LINEAGE;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_OWNERS;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_TAGS;
import static org.openmetadata.schema.type.Permission.Access.ALLOW;
import static org.openmetadata.schema.type.Permission.Access.NOT_ALLOW;
import static org.openmetadata.service.Entity.ORGANIZATION_POLICY_NAME;
import static org.openmetadata.service.security.policyevaluator.OperationContext.getAllOperations;
import static org.openmetadata.service.security.policyevaluator.OperationContext.getOperations;
import static org.openmetadata.service.security.policyevaluator.OperationContext.getViewOperations;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.json.JsonPatchBuilder;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.permissions.PermissionsResource.ResourcePermissionList;
import org.openmetadata.service.resources.policies.PolicyResource;
import org.openmetadata.service.resources.policies.PolicyResourceTest;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.PermissionDebugInfo;
import org.openmetadata.service.security.policyevaluator.PermissionEvaluationDebugInfo;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.TestUtils;

@Slf4j
class PermissionsResourceTest extends OpenMetadataApplicationTest {
  private static Rule ORG_IS_OWNER_RULE;
  private static Rule ORG_NO_OWNER_RULE;
  private static final List<MetadataOperation> ORG_IS_OWNER_RULE_OPERATIONS = getAllOperations();
  private static final List<MetadataOperation> ORG_NO_OWNER_RULE_OPERATIONS = List.of(EDIT_OWNERS);

  private static final String DATA_STEWARD_ROLE_NAME = "DataSteward";
  private static Policy DATA_STEWARD_POLICY;
  private static final String DATA_STEWARD_POLICY_NAME = "DataStewardPolicy";
  private static List<Rule> DATA_STEWARD_RULES;

  private static final String DATA_CONSUMER_ROLE_NAME = "DataConsumer";
  private static Policy DATA_CONSUMER_POLICY;
  private static final String DATA_CONSUMER_POLICY_NAME = "DataConsumerPolicy";
  private static List<Rule> DATA_CONSUMER_RULES;
  private static final List<MetadataOperation> DATA_CONSUMER_ALLOWED = getViewOperations();
  protected EntityRepository mockRepository;
  protected MockedStatic<SubjectContext> subjectContextMock;
  protected MockedStatic<Entity> entityMock;

  static {
    DATA_CONSUMER_ALLOWED.addAll(List.of(EDIT_DESCRIPTION, EDIT_TAGS));
  }

  private static final List<MetadataOperation> DATA_STEWARD_ALLOWED =
      new ArrayList<>(DATA_CONSUMER_ALLOWED);

  static {
    // DATA_CONSUMER + additional operations
    DATA_STEWARD_ALLOWED.addAll(List.of(EDIT_OWNERS, EDIT_DISPLAY_NAME, EDIT_LINEAGE));
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
        policyResourceTest.getEntityByName(
            ORGANIZATION_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    List<Rule> orgRules = orgPolicy.getRules();
    // Rules are alphabetically ordered
    ORG_NO_OWNER_RULE = orgRules.get(0);
    ORG_IS_OWNER_RULE = orgRules.get(1);

    DATA_STEWARD_POLICY =
        policyResourceTest.getEntityByName(
            DATA_STEWARD_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_STEWARD_RULES = DATA_STEWARD_POLICY.getRules();

    DATA_STEWARD_USER = EntityResourceTest.DATA_STEWARD;

    DATA_CONSUMER_POLICY =
        policyResourceTest.getEntityByName(
            DATA_CONSUMER_POLICY_NAME, null, PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    DATA_CONSUMER_RULES = DATA_CONSUMER_POLICY.getRules();

    DATA_CONSUMER_USER = EntityResourceTest.DATA_CONSUMER;
  }

  @Test
  void get_anotherUserPermission_disallowed() {
    // Only admin can get another user's permission (this is tested in other tests)
    // Getting as a data consumer, data steward's permissions should fail
    Map<String, String> authHeaders =
        SecurityUtil.authHeaders(DATA_CONSUMER_USER_NAME + "@open-metadata.org");
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
  void testGetDataStewardPermissionsForRole() throws Exception {

    Map<String, String> authHeaders =
        SecurityUtil.authHeaders(DATA_STEWARD_USER_NAME + "@open-metadata.org");
    EntityRepository mockRepository = Mockito.mock(EntityRepository.class);

    User mockUser = new User();
    mockUser.setName(DATA_STEWARD_USER_NAME);
    mockUser.setIsAdmin(false);
    mockUser.setIsBot(false);

    EntityReference dataStewardRole = new EntityReference();
    dataStewardRole.setName("DataStewardRole");
    mockUser.setRoles(List.of(dataStewardRole));

    EntityReference organizationTeam = new EntityReference();
    organizationTeam.setName("OrganizationTeam");
    mockUser.setTeams(List.of(organizationTeam));
    UriInfo mockUriInfo = Mockito.mock(UriInfo.class);

    when(mockUriInfo.getRequestUri()).thenReturn(URI.create("http://localhost/api/test"));
    // Mock repository methods
    when(mockRepository.getByName(
            mockUriInfo,
            DATA_STEWARD_USER_NAME,
            new EntityUtil.Fields(Set.of("roles,teams,isAdmin,profile,domains"))))
        .thenReturn(mockUser);

    Team mockTeam = new Team();
    mockTeam.setName("OrganizationTeam");
    mockTeam.setPolicies(List.of(new EntityReference().withName("OrganizationPolicy-Owner-Rule")));
    mockTeam.setDefaultRoles(List.of(new EntityReference().withName("OrganizationRole")));
    mockTeam.setParents(List.of());

    when(mockRepository.get(
            mockUriInfo,
            organizationTeam.getId(),
            new EntityUtil.Fields(Set.of("defaultRoles, policies, parents, profile,domains"))))
        .thenReturn(mockTeam);

    SubjectContext subjectContext = SubjectContext.getSubjectContext(DATA_STEWARD_USER_NAME);

    List<ResourcePermission> expectedPermissions = PolicyEvaluator.listPermission(subjectContext);
    List<ResourcePermission> actualPermissions = getPermissions(authHeaders);
    assertResourcePermissions(expectedPermissions, actualPermissions);
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
    Map<String, String> authHeaders =
        SecurityUtil.authHeaders(DATA_CONSUMER_USER_NAME + "@open-metadata.org");

    ResourcePermissionsBuilder permissionsBuilder = new ResourcePermissionsBuilder();
    permissionsBuilder.setPermission(
        DATA_CONSUMER_ALLOWED,
        ALLOW,
        DATA_CONSUMER_ROLE_NAME,
        DATA_CONSUMER_POLICY_NAME,
        DATA_CONSUMER_RULES.get(0));
    // Organization policy of no owner or isOwner does not apply. Hence, not added to expected
    // permissions

    // Create a table with owner other than data consumer & make sure data consumer doesn't have
    // permission as non owner
    CreateTable createTable =
        tableResourceTest
            .createRequest("permissionTest1")
            .withOwners(List.of(DATA_STEWARD_USER.getEntityReference()));
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Data consumer has non-owner permissions
    ResourcePermission actualPermission =
        getPermission(Entity.TABLE, table.getId(), null, authHeaders);

    // Note that conditional list is empty. All the required context to resolve is met when
    // requesting permission of a specific resource (both subject and resource context).
    // Only Deny, Allow, NotAllow permissions are expected.
    assertResourcePermission(permissionsBuilder.getPermission(Entity.TABLE), actualPermission);
  }

  @Test
  void get_owner_permissions() throws HttpResponseException {
    //
    // Test getting permissions for an entity as an owner - ORG_POLICY isOwner becomes effective
    //
    TableResourceTest tableResourceTest = new TableResourceTest();
    Map<String, String> authHeaders =
        SecurityUtil.authHeaders(DATA_CONSUMER_USER_NAME + "@open-metadata.org");

    // Create an entity with data consumer as owner
    CreateTable createTable =
        tableResourceTest
            .createRequest("permissionTest")
            .withDescription("description")
            .withDisplayName("display")
            .withOwners(List.of(DATA_CONSUMER_USER.getEntityReference()));
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Data consumer must have all operations except create allowed based on Organization policy as
    // an owner
    ResourcePermissionsBuilder permissionsBuilder = new ResourcePermissionsBuilder();
    permissionsBuilder.setPermission(
        DATA_CONSUMER_ALLOWED,
        ALLOW,
        DATA_CONSUMER_ROLE_NAME,
        DATA_CONSUMER_POLICY_NAME,
        DATA_CONSUMER_RULES.get(0));
    permissionsBuilder.setPermission(
        ORG_IS_OWNER_RULE_OPERATIONS, ALLOW, null, ORGANIZATION_POLICY_NAME, ORG_IS_OWNER_RULE);
    ResourcePermission actualPermission =
        getPermission(Entity.TABLE, table.getId(), null, authHeaders);
    assertResourcePermission(permissionsBuilder.getPermission(Entity.TABLE), actualPermission);

    // get permissions by resource entity name
    actualPermission =
        getPermissionByName(Entity.TABLE, table.getFullyQualifiedName(), null, authHeaders);
    assertResourcePermission(permissionsBuilder.getPermission(Entity.TABLE), actualPermission);

    // Admin getting permissions for a specific resource on for Data consumer
    actualPermission =
        getPermission(Entity.TABLE, table.getId(), DATA_CONSUMER_USER_NAME, ADMIN_AUTH_HEADERS);
    assertResourcePermission(permissionsBuilder.getPermission(Entity.TABLE), actualPermission);

    PolicyResourceTest policyResourceTest = new PolicyResourceTest();
    Policy orgPolicy =
        policyResourceTest.getEntityByName(ORGANIZATION_POLICY_NAME, "", ADMIN_AUTH_HEADERS);
    List<MetadataOperation> editOperations =
        getOperations(Entity.TABLE, "Edit", EDIT_ALL, EDIT_DESCRIPTION, EDIT_TAGS);

    // Change organization owner rule to take away one permission at a time and ensure permissions
    // reflect it
    for (MetadataOperation editOperation : editOperations) {
      List<MetadataOperation> allowedOperations =
          editOperations.stream()
              .filter(operation -> operation != editOperation)
              .collect(Collectors.toList());
      LOG.info("Removing permission for {}", editOperation);

      // Update the organization policy with the list of allowed operations
      String origJson = JsonUtils.pojoToJson(orgPolicy);
      orgPolicy.getRules().get(1).withOperations(allowedOperations); // Exclude the editOperation
      orgPolicy =
          policyResourceTest.patchEntity(
              orgPolicy.getId(), origJson, orgPolicy, ADMIN_AUTH_HEADERS);

      // Ensure removed operation is not allowed
      permissionsBuilder = new ResourcePermissionsBuilder();
      permissionsBuilder.setPermission(
          DATA_CONSUMER_ALLOWED,
          ALLOW,
          DATA_CONSUMER_ROLE_NAME,
          DATA_CONSUMER_POLICY_NAME,
          DATA_CONSUMER_RULES.get(0));
      permissionsBuilder.setPermission(
          allowedOperations, ALLOW, null, ORGANIZATION_POLICY_NAME, orgPolicy.getRules().get(1));
      actualPermission =
          getPermissionByName(Entity.TABLE, table.getFullyQualifiedName(), null, authHeaders);
      assertResourcePermission(permissionsBuilder.getPermission(Entity.TABLE), actualPermission);

      // Finally, try to patch the field that can't be edited and expect permission denied
      String field = ResourceRegistry.getField(editOperation);
      if (field != null) {
        JsonPatchBuilder jsonPatchBuilder =
            Json.createPatchBuilder().remove("/" + ResourceRegistry.getField(editOperation));
        JsonPatch patch = jsonPatchBuilder.build();
        /*assertResponse(
        () -> tableResourceTest.patchEntity(table.getId(), patch, authHeaders),
        FORBIDDEN,
        CatalogExceptionMessage.permissionNotAllowed(
            DATA_CONSUMER_USER_NAME, List.of(editOperation)));*/
      } else {
        LOG.warn("Field for operation {} is null", editOperation);
      }
    }
  }

  private void assertResourcePermissions(
      List<ResourcePermission> expected, List<ResourcePermission> actual) {
    assertEquals(expected.size(), actual.size());
    Comparator<ResourcePermission> resourcePermissionComparator =
        Comparator.comparing(ResourcePermission::getResource);
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
  }

  public List<ResourcePermission> getPermissions(Map<String, String> authHeaders)
      throws HttpResponseException {
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

  public ResourcePermission getPermission(
      String resource, String user, Map<String, String> authHeaders) throws HttpResponseException {
    // Get permissions for another user for a given resource type
    WebTarget target = getResource("permissions/" + resource);
    target = user != null ? target.queryParam("user", user) : target;
    return TestUtils.get(target, ResourcePermission.class, authHeaders);
  }

  public ResourcePermission getPermission(
      String resource, UUID uuid, String user, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Get permissions for another user for a given resource type and specific resource by id
    WebTarget target = getResource("permissions/" + resource + "/" + uuid);
    target = user != null ? target.queryParam("user", user) : target;
    return TestUtils.get(target, ResourcePermission.class, authHeaders);
  }

  public ResourcePermission getPermissionByName(
      String resource, String name, String user, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Get permissions for another user for a given resource type and specific resource by name
    WebTarget target = getResource("permissions/").path(resource).path("/name/").path(name);
    target = user != null ? target.queryParam("user", user) : target;
    return TestUtils.get(target, ResourcePermission.class, authHeaders);
  }

  public List<ResourcePermission> getPermissionsForPolicies(
      List<UUID> policyIds, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("permissions/policies");
    for (UUID policyId : policyIds) {
      target = target.queryParam("ids", policyId);
    }
    return TestUtils.get(target, ResourcePermissionList.class, authHeaders).getData();
  }

  /** Build permissions based on role, policies, etc. for testing purposes */
  public static class ResourcePermissionsBuilder {
    @Getter
    private final List<ResourcePermission> resourcePermissions =
        PolicyEvaluator.getResourcePermissions(NOT_ALLOW);

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

  @Test
  void test_debugPermissions_adminCanDebugAnyUser() throws HttpResponseException {
    // Create test users and teams
    User testUser = createUser("test-debug-user");
    Team testTeam = createTeam("test-debug-team");

    // Add user to team
    addUserToTeam(testTeam, testUser);

    // Admin should be able to debug permissions for any user
    WebTarget target = getResource("permissions/debug/user/" + testUser.getName());
    PermissionDebugInfo debugInfo =
        TestUtils.get(target, PermissionDebugInfo.class, ADMIN_AUTH_HEADERS);

    // Verify the debug info
    assertEquals(testUser.getName(), debugInfo.getUser().getName());
    assertNotNull(debugInfo.getDirectRoles());
    assertNotNull(debugInfo.getTeamPermissions());
    assertNotNull(debugInfo.getSummary());
  }

  @Test
  void test_debugPermissions_userCanDebugOwnPermissions() throws HttpResponseException {
    // Create test user
    User testUser = createUser("test-debug-own-user");
    Map<String, String> userAuthHeaders =
        SecurityUtil.authHeaders(testUser.getName() + "@open-metadata.org");

    // User should be able to debug their own permissions
    WebTarget target = getResource("permissions/debug/user/" + testUser.getName());
    PermissionDebugInfo debugInfo =
        TestUtils.get(target, PermissionDebugInfo.class, userAuthHeaders);

    // Verify the debug info
    assertEquals(testUser.getName(), debugInfo.getUser().getName());
    assertNotNull(debugInfo.getDirectRoles());
    assertNotNull(debugInfo.getTeamPermissions());
    assertNotNull(debugInfo.getSummary());
  }

  @Test
  void test_debugPermissions_userCannotDebugOtherUserPermissions() throws HttpResponseException {
    // Create two test users
    User testUser1 = createUser("test-debug-user1");
    User testUser2 = createUser("test-debug-user2");
    Map<String, String> user1AuthHeaders =
        SecurityUtil.authHeaders(testUser1.getName() + "@open-metadata.org");

    // User1 should not be able to debug user2's permissions
    WebTarget target = getResource("permissions/debug/user/" + testUser2.getName());
    assertResponse(
        () -> TestUtils.get(target, PermissionDebugInfo.class, user1AuthHeaders),
        FORBIDDEN,
        "Principal: CatalogPrincipal{name='" + testUser1.getName() + "'} is not admin");
  }

  @Test
  void test_debugMyPermissions() throws HttpResponseException {
    // Create test user
    User testUser = createUser("test-debug-me-user");
    Map<String, String> userAuthHeaders =
        SecurityUtil.authHeaders(testUser.getName() + "@open-metadata.org");

    // User should be able to debug their own permissions via /me endpoint
    WebTarget target = getResource("permissions/debug/me");
    PermissionDebugInfo debugInfo =
        TestUtils.get(target, PermissionDebugInfo.class, userAuthHeaders);

    // Verify the debug info
    assertEquals(testUser.getName(), debugInfo.getUser().getName());
    assertNotNull(debugInfo.getDirectRoles());
    assertNotNull(debugInfo.getTeamPermissions());
    assertNotNull(debugInfo.getSummary());
  }

  @Test
  void test_debugPermissionEvaluation_adminCanDebugAnyUser() throws HttpResponseException {
    // Create test user
    User testUser = createUser("test-debug-eval-user");

    // Admin should be able to debug permission evaluation for any user
    WebTarget target =
        getResource("permissions/debug/evaluate")
            .queryParam("user", testUser.getName())
            .queryParam("resource", "table")
            .queryParam("operation", "VIEW_ALL");

    PermissionEvaluationDebugInfo evalInfo =
        TestUtils.get(target, PermissionEvaluationDebugInfo.class, ADMIN_AUTH_HEADERS);

    // Verify the evaluation info
    assertEquals(testUser.getName(), evalInfo.getUser().getName());
    assertEquals("table", evalInfo.getResource());
    assertEquals(MetadataOperation.VIEW_ALL, evalInfo.getOperation());
    assertNotNull(evalInfo.getEvaluationSteps());
    assertNotNull(evalInfo.getSummary());
    assertNotNull(evalInfo.getFinalDecision());
  }

  @Test
  void test_debugPermissionEvaluation_userCanDebugOwnEvaluation() throws HttpResponseException {
    // Create test user
    User testUser = createUser("test-debug-eval-own-user");
    Map<String, String> userAuthHeaders =
        SecurityUtil.authHeaders(testUser.getName() + "@open-metadata.org");

    // User should be able to debug their own permission evaluation
    WebTarget target =
        getResource("permissions/debug/evaluate")
            .queryParam("user", testUser.getName())
            .queryParam("resource", "table")
            .queryParam("operation", "VIEW_ALL");

    PermissionEvaluationDebugInfo evalInfo =
        TestUtils.get(target, PermissionEvaluationDebugInfo.class, userAuthHeaders);

    // Verify the evaluation info
    assertEquals(testUser.getName(), evalInfo.getUser().getName());
    assertEquals("table", evalInfo.getResource());
    assertEquals(MetadataOperation.VIEW_ALL, evalInfo.getOperation());
    assertNotNull(evalInfo.getEvaluationSteps());
    assertNotNull(evalInfo.getSummary());
    assertNotNull(evalInfo.getFinalDecision());
  }

  @Test
  void test_debugPermissionEvaluation_userCannotDebugOtherUserEvaluation()
      throws HttpResponseException {
    // Create two test users
    User testUser1 = createUser("test-debug-eval-user1");
    User testUser2 = createUser("test-debug-eval-user2");
    Map<String, String> user1AuthHeaders =
        SecurityUtil.authHeaders(testUser1.getName() + "@open-metadata.org");

    // User1 should not be able to debug user2's permission evaluation
    WebTarget target =
        getResource("permissions/debug/evaluate")
            .queryParam("user", testUser2.getName())
            .queryParam("resource", "table")
            .queryParam("operation", "VIEW_ALL");

    assertResponse(
        () -> TestUtils.get(target, PermissionEvaluationDebugInfo.class, user1AuthHeaders),
        FORBIDDEN,
        "Principal: CatalogPrincipal{name='" + testUser1.getName() + "'} is not admin");
  }

  @Test
  void test_debugPermissionEvaluation_withResourceId() throws HttpResponseException {
    // Create test user and table
    User testUser = createUser("test-debug-eval-resource-user");
    CreateTable createTable = new TableResourceTest().createRequest("test-debug-table");
    Table table = new TableResourceTest().createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Debug permission evaluation for specific resource
    WebTarget target =
        getResource("permissions/debug/evaluate")
            .queryParam("user", testUser.getName())
            .queryParam("resource", "table")
            .queryParam("resourceId", table.getId())
            .queryParam("operation", "EDIT_ALL");

    PermissionEvaluationDebugInfo evalInfo =
        TestUtils.get(target, PermissionEvaluationDebugInfo.class, ADMIN_AUTH_HEADERS);

    // Verify the evaluation info
    assertEquals(testUser.getName(), evalInfo.getUser().getName());
    assertEquals("table", evalInfo.getResource());
    assertEquals(table.getId().toString(), evalInfo.getResourceId());
    assertEquals(MetadataOperation.EDIT_ALL, evalInfo.getOperation());
    assertNotNull(evalInfo.getEvaluationSteps());
    assertNotNull(evalInfo.getSummary());
    assertNotNull(evalInfo.getFinalDecision());
  }

  // Helper methods

  private User createUser(String name) throws HttpResponseException {
    UserResourceTest userResourceTest = new UserResourceTest();
    CreateUser createUser = userResourceTest.createRequest(name).withEmail(name + "@test.com");
    return userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);
  }

  private Team createTeam(String name) throws HttpResponseException {
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    CreateTeam createTeam = teamResourceTest.createRequest(name);
    return teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS);
  }

  private void addUserToTeam(Team team, User user) throws HttpResponseException {
    UserResourceTest userResourceTest = new UserResourceTest();

    // Get the current user state
    User currentUser = userResourceTest.getEntity(user.getId(), "teams", ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(currentUser);

    // Update teams
    List<EntityReference> teams = new ArrayList<>();
    if (currentUser.getTeams() != null) {
      teams.addAll(currentUser.getTeams());
    }
    teams.add(team.getEntityReference());
    currentUser.setTeams(teams);

    // Patch the user
    userResourceTest.patchEntity(
        currentUser.getId(), originalJson, currentUser, ADMIN_AUTH_HEADERS);
  }
}
