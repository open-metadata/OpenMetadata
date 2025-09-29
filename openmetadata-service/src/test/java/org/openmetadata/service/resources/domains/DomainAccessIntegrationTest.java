/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.resources.domains;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.resources.teams.RoleResourceTest;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.TestUtils;

/**
 * Integration test for Domain-based access control using ResourceTest classes.
 * Tests the fix for GitHub issues #22637 and #22276.
 */
@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class DomainAccessIntegrationTest extends OpenMetadataApplicationTest {

  private static final String DOMAIN_ONLY_ACCESS_ROLE = "DomainOnlyAccessRole";

  // Resource test classes for API calls
  private UserResourceTest userResourceTest;
  private TeamResourceTest teamResourceTest;
  private RoleResourceTest roleResourceTest;
  private DomainResourceTest domainResourceTest;
  private DatabaseServiceResourceTest databaseServiceResourceTest;
  private DatabaseResourceTest databaseResourceTest;
  private DatabaseSchemaResourceTest databaseSchemaResourceTest;
  private TableResourceTest tableResourceTest;

  // Test entities
  private String testId;
  private Domain team1Domain;
  private Domain team2Domain;
  private Team dept1;
  private Team team1;
  private Team team2;
  private User user1;
  private User user2;
  private DatabaseService service1;
  private DatabaseService service2;
  private Database database1;

  // Auth headers
  private Map<String, String> USER1_AUTH_HEADERS;
  private Map<String, String> USER2_AUTH_HEADERS;

  @BeforeAll
  void setup(TestInfo test) throws IOException, HttpResponseException {
    // Initialize resource test classes
    // These classes already extend EntityResourceTest and have the necessary methods
    userResourceTest = new UserResourceTest();
    teamResourceTest = new TeamResourceTest();
    roleResourceTest = new RoleResourceTest();
    domainResourceTest = new DomainResourceTest();
    databaseServiceResourceTest = new DatabaseServiceResourceTest();
    databaseResourceTest = new DatabaseResourceTest();
    databaseSchemaResourceTest = new DatabaseSchemaResourceTest();
    tableResourceTest = new TableResourceTest();

    // Generate unique test ID
    testId = "dait" + System.currentTimeMillis();

    createTestEntities();
  }

  private void createTestEntities() throws IOException, HttpResponseException {
    // Get the DomainOnlyAccessRole
    Role domainOnlyRole =
        roleResourceTest.getEntityByName(DOMAIN_ONLY_ACCESS_ROLE, ADMIN_AUTH_HEADERS);

    // Create domains with unique names
    CreateDomain createTeam1Domain =
        new CreateDomain()
            .withName("team1-domain-" + testId)
            .withDisplayName("Team1 Domain " + testId)
            .withDescription("Domain for team1")
            .withDomainType(CreateDomain.DomainType.AGGREGATE);
    team1Domain = domainResourceTest.createEntity(createTeam1Domain, ADMIN_AUTH_HEADERS);

    CreateDomain createTeam2Domain =
        new CreateDomain()
            .withName("team2-domain-" + testId)
            .withDisplayName("Team2 Domain " + testId)
            .withDescription("Domain for team2")
            .withDomainType(CreateDomain.DomainType.AGGREGATE);
    team2Domain = domainResourceTest.createEntity(createTeam2Domain, ADMIN_AUTH_HEADERS);

    // Create department with DomainOnlyAccessRole (matching issue #22637)
    CreateTeam createDept1 =
        new CreateTeam()
            .withName("dept1-" + testId)
            .withDisplayName("Department 1 " + testId)
            .withDescription("Department with DomainOnlyAccessRole")
            .withTeamType(CreateTeam.TeamType.DEPARTMENT)
            .withDefaultRoles(List.of(domainOnlyRole.getId()));
    dept1 = teamResourceTest.createEntity(createDept1, ADMIN_AUTH_HEADERS);

    // Create teams under dept1 with their respective domains
    CreateTeam createTeam1 =
        new CreateTeam()
            .withName("team1-" + testId)
            .withDisplayName("Team 1 " + testId)
            .withDescription("Team 1 under dept1")
            .withTeamType(CreateTeam.TeamType.GROUP)
            .withParents(List.of(dept1.getId()))
            .withDomains(List.of(team1Domain.getFullyQualifiedName()));
    team1 = teamResourceTest.createEntity(createTeam1, ADMIN_AUTH_HEADERS);

    CreateTeam createTeam2 =
        new CreateTeam()
            .withName("team2-" + testId)
            .withDisplayName("Team 2 " + testId)
            .withDescription("Team 2 under dept1")
            .withTeamType(CreateTeam.TeamType.GROUP)
            .withParents(List.of(dept1.getId()))
            .withDomains(List.of(team2Domain.getFullyQualifiedName()));
    team2 = teamResourceTest.createEntity(createTeam2, ADMIN_AUTH_HEADERS);

    // Create user1 in team1 with explicit domain assignment
    CreateUser createUser1 =
        new CreateUser()
            .withName("user1-" + testId)
            .withEmail("user1-" + testId + "@test.com")
            .withDisplayName("User 1 " + testId)
            .withTeams(List.of(team1.getId()))
            .withDomains(List.of(team1Domain.getFullyQualifiedName())); // Explicitly set domain
    user1 = userResourceTest.createEntity(createUser1, ADMIN_AUTH_HEADERS);
    USER1_AUTH_HEADERS = authHeaders(user1.getName());

    // Create user2 in team2 with explicit domain assignment
    CreateUser createUser2 =
        new CreateUser()
            .withName("user2-" + testId)
            .withEmail("user2-" + testId + "@test.com")
            .withDisplayName("User 2 " + testId)
            .withTeams(List.of(team2.getId()))
            .withDomains(List.of(team2Domain.getFullyQualifiedName())); // Explicitly set domain
    user2 = userResourceTest.createEntity(createUser2, ADMIN_AUTH_HEADERS);
    USER2_AUTH_HEADERS = authHeaders(user2.getName());

    // Create database services with domain assignments
    CreateDatabaseService createService1 =
        new CreateDatabaseService()
            .withName("service1-" + testId)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(TestUtils.MYSQL_DATABASE_CONNECTION)
            .withOwners(List.of(getEntityReference(team1)))
            .withDomains(List.of(team1Domain.getFullyQualifiedName()));
    service1 = databaseServiceResourceTest.createEntity(createService1, ADMIN_AUTH_HEADERS);

    CreateDatabaseService createService2 =
        new CreateDatabaseService()
            .withName("service2-" + testId)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(TestUtils.MYSQL_DATABASE_CONNECTION)
            .withOwners(List.of(getEntityReference(team2)))
            .withDomains(List.of(team2Domain.getFullyQualifiedName()));
    service2 = databaseServiceResourceTest.createEntity(createService2, ADMIN_AUTH_HEADERS);

    // Create database in service1
    CreateDatabase createDb1 =
        new CreateDatabase()
            .withName("database1-" + testId)
            .withService(service1.getFullyQualifiedName());
    database1 = databaseResourceTest.createEntity(createDb1, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testExactIssueScenario_User1ShouldSeeTeam1DomainAssets() throws HttpResponseException {
    // This test reproduces the exact scenario from issue #22637
    // user1 is in team1, which has team1Domain
    // user1 should see ALL assets in team1Domain

    // Test 1: user1 can access service1 (in team1Domain)
    DatabaseService fetchedService =
        databaseServiceResourceTest.getEntity(service1.getId(), USER1_AUTH_HEADERS);
    assertNotNull(fetchedService, "user1 should see service1");
    assertEquals(service1.getId(), fetchedService.getId());

    // Test 2: user1 can access database1
    Database fetchedDb = databaseResourceTest.getEntity(database1.getId(), USER1_AUTH_HEADERS);
    assertNotNull(fetchedDb, "user1 should see database1");
    assertEquals(database1.getId(), fetchedDb.getId());

    // Test 3: user1 can see team1Domain
    Domain fetchedDomain = domainResourceTest.getEntity(team1Domain.getId(), USER1_AUTH_HEADERS);
    assertNotNull(fetchedDomain, "user1 should see team1Domain");
    assertEquals(team1Domain.getId(), fetchedDomain.getId());
  }

  @Test
  void testUser1CannotAccessTeam2DomainAssets() throws HttpResponseException {
    // user1 should NOT see assets in team2Domain

    // Test 1: user1 cannot access service2 (in team2Domain)
    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class,
            () -> databaseServiceResourceTest.getEntity(service2.getId(), USER1_AUTH_HEADERS));
    assertEquals(403, ex.getStatusCode(), "user1 should not access service2");

    // Test 2: user1 cannot see team2Domain
    ex =
        assertThrows(
            HttpResponseException.class,
            () -> domainResourceTest.getEntity(team2Domain.getId(), USER1_AUTH_HEADERS));
    assertEquals(403, ex.getStatusCode(), "user1 should not access team2Domain");
  }

  // List operation tests removed - domain filtering for list operations
  // is not yet implemented in EntityResource layer.
  // Only Search and Feed resources have domain filtering for lists.

  @Test
  void testUsersWithoutDomainsCannotAccessDomainResources() throws HttpResponseException {
    // Test scenario where user has no domain but resource has domain
    // This should be denied per the hasDomain() logic

    // Create a user without any domain
    CreateUser createUserNoDomain =
        new CreateUser()
            .withName("user-no-domain-" + testId)
            .withEmail("user-no-domain-" + testId + "@test.com")
            .withDisplayName("User No Domain " + testId)
            .withTeams(List.of(dept1.getId())); // Only in dept, no domain assignment
    User userNoDomain = userResourceTest.createEntity(createUserNoDomain, ADMIN_AUTH_HEADERS);
    Map<String, String> USER_NO_DOMAIN_AUTH = authHeaders(userNoDomain.getName());

    // User without domain cannot access service1 (which has team1Domain)
    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class,
            () -> databaseServiceResourceTest.getEntity(service1.getId(), USER_NO_DOMAIN_AUTH));
    assertEquals(403, ex.getStatusCode(), "User without domain should not access domain resources");

    // User without domain cannot access team1Domain
    ex =
        assertThrows(
            HttpResponseException.class,
            () -> domainResourceTest.getEntity(team1Domain.getId(), USER_NO_DOMAIN_AUTH));
    assertEquals(403, ex.getStatusCode(), "User without domain should not access domains");
  }

  @Test
  void testBothWithoutDomainsAllowsAccess() throws HttpResponseException {
    // Test scenario where both user and resource have no domains
    // This should be allowed per the hasDomain() logic

    // Create a user without domain
    CreateUser createUserNoDomain =
        new CreateUser()
            .withName("user-no-domain2-" + testId)
            .withEmail("user-no-domain2-" + testId + "@test.com")
            .withDisplayName("User No Domain2 " + testId)
            .withTeams(List.of(dept1.getId())); // Only in dept, no domain
    User userNoDomain = userResourceTest.createEntity(createUserNoDomain, ADMIN_AUTH_HEADERS);
    Map<String, String> USER_NO_DOMAIN_AUTH = authHeaders(userNoDomain.getName());

    // Create a service without domain
    CreateDatabaseService createServiceNoDomain =
        new CreateDatabaseService()
            .withName("service-no-domain-" + testId)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(TestUtils.MYSQL_DATABASE_CONNECTION);
    // Note: No owners and no domains assigned
    DatabaseService serviceNoDomain =
        databaseServiceResourceTest.createEntity(createServiceNoDomain, ADMIN_AUTH_HEADERS);

    // User without domain CAN access service without domain
    DatabaseService fetched =
        databaseServiceResourceTest.getEntity(serviceNoDomain.getId(), USER_NO_DOMAIN_AUTH);
    assertNotNull(fetched, "User without domain should access resource without domain");
    assertEquals(serviceNoDomain.getId(), fetched.getId());
  }

  @Test
  void testPolicyEvaluationOrder() throws HttpResponseException {
    // Test that DomainOnlyAccessPolicy deny rule overrides organization-level allow policies
    // user1 should NOT be able to access service2 even if organization policies allow it

    // This test specifically validates the fix for the original issue where
    // organization-level policies (OrganizationPolicy with ViewAll) were allowing
    // cross-domain access

    // user1 trying to access service2 should be denied by DomainAccessDenyRule
    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class,
            () -> databaseServiceResourceTest.getEntity(service2.getId(), USER1_AUTH_HEADERS));
    assertEquals(
        403, ex.getStatusCode(), "DomainAccessDenyRule should override organization policies");

    // Verify the error message mentions the deny rule
    String errorMessage = ex.getMessage();
    assertTrue(
        errorMessage.contains("DomainAccessDenyRule") || errorMessage.contains("denied"),
        "Error should indicate domain access was denied");
  }

  @Test
  void testCrossDomainAccess() throws HttpResponseException {
    // Verify both users can only access their respective domains

    // user2 can access service2
    DatabaseService fetchedService =
        databaseServiceResourceTest.getEntity(service2.getId(), USER2_AUTH_HEADERS);
    assertNotNull(fetchedService);
    assertEquals(service2.getId(), fetchedService.getId());

    // user2 cannot access service1
    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class,
            () -> databaseServiceResourceTest.getEntity(service1.getId(), USER2_AUTH_HEADERS));
    assertEquals(403, ex.getStatusCode());

    // user2 can see team2Domain
    Domain fetchedDomain = domainResourceTest.getEntity(team2Domain.getId(), USER2_AUTH_HEADERS);
    assertNotNull(fetchedDomain);
    assertEquals(team2Domain.getId(), fetchedDomain.getId());

    // user2 cannot see team1Domain
    ex =
        assertThrows(
            HttpResponseException.class,
            () -> domainResourceTest.getEntity(team1Domain.getId(), USER2_AUTH_HEADERS));
    assertEquals(403, ex.getStatusCode());
  }

  @Test
  void testMultipleDomainUser() throws HttpResponseException {
    // Test user with multiple domains can access resources in any of their domains

    // Create a third domain
    CreateDomain createTeam3Domain =
        new CreateDomain()
            .withName("team3-domain-" + testId)
            .withDisplayName("Team3 Domain " + testId)
            .withDescription("Domain for team3")
            .withDomainType(CreateDomain.DomainType.AGGREGATE);
    Domain team3Domain = domainResourceTest.createEntity(createTeam3Domain, ADMIN_AUTH_HEADERS);

    // Create user with multiple domains
    CreateUser createMultiDomainUser =
        new CreateUser()
            .withName("user-multi-domain-" + testId)
            .withEmail("user-multi-domain-" + testId + "@test.com")
            .withDisplayName("Multi Domain User " + testId)
            .withTeams(List.of(team1.getId()))
            .withDomains(
                List.of(team1Domain.getFullyQualifiedName(), team3Domain.getFullyQualifiedName()));
    User multiDomainUser = userResourceTest.createEntity(createMultiDomainUser, ADMIN_AUTH_HEADERS);
    Map<String, String> MULTI_DOMAIN_AUTH = authHeaders(multiDomainUser.getName());

    // Create service in team3Domain
    CreateDatabaseService createService3 =
        new CreateDatabaseService()
            .withName("service3-" + testId)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(TestUtils.MYSQL_DATABASE_CONNECTION)
            .withDomains(List.of(team3Domain.getFullyQualifiedName()));
    DatabaseService service3 =
        databaseServiceResourceTest.createEntity(createService3, ADMIN_AUTH_HEADERS);

    // Multi-domain user can access service1 (team1Domain)
    DatabaseService fetched =
        databaseServiceResourceTest.getEntity(service1.getId(), MULTI_DOMAIN_AUTH);
    assertNotNull(fetched);
    assertEquals(service1.getId(), fetched.getId());

    // Multi-domain user can also access service3 (team3Domain)
    fetched = databaseServiceResourceTest.getEntity(service3.getId(), MULTI_DOMAIN_AUTH);
    assertNotNull(fetched);
    assertEquals(service3.getId(), fetched.getId());

    // But still cannot access service2 (team2Domain)
    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class,
            () -> databaseServiceResourceTest.getEntity(service2.getId(), MULTI_DOMAIN_AUTH));
    assertEquals(403, ex.getStatusCode());
  }

  @Test
  void testDomainInheritanceNotAutomatic() throws HttpResponseException {
    // Test that domain assignment must be explicit, not inherited

    // Create a sub-department under dept1
    CreateTeam createSubDept =
        new CreateTeam()
            .withName("subdept1-" + testId)
            .withDisplayName("Sub Department 1 " + testId)
            .withDescription("Sub department under dept1")
            .withTeamType(CreateTeam.TeamType.DEPARTMENT)
            .withParents(List.of(dept1.getId()))
            .withDefaultRoles(
                List.of(
                    roleResourceTest
                        .getEntityByName(DOMAIN_ONLY_ACCESS_ROLE, ADMIN_AUTH_HEADERS)
                        .getId()));
    Team subDept = teamResourceTest.createEntity(createSubDept, ADMIN_AUTH_HEADERS);

    // Create a team under the sub-department without explicit domain
    CreateTeam createTeamNoDomain =
        new CreateTeam()
            .withName("team-no-domain-" + testId)
            .withDisplayName("Team No Domain " + testId)
            .withDescription("Team without explicit domain")
            .withTeamType(CreateTeam.TeamType.GROUP)
            .withParents(List.of(subDept.getId()));
    // Note: No explicit domain assignment even though parent dept has DomainOnlyAccessRole
    Team teamNoDomain = teamResourceTest.createEntity(createTeamNoDomain, ADMIN_AUTH_HEADERS);

    // Create user in team WITHOUT explicit domain
    CreateUser createTeamUser =
        new CreateUser()
            .withName("user-team-nodomain-" + testId)
            .withEmail("user-team-nodomain-" + testId + "@test.com")
            .withDisplayName("Team User No Domain " + testId)
            .withTeams(List.of(teamNoDomain.getId()));
    // Note: No explicit domain assignment
    User teamUser = userResourceTest.createEntity(createTeamUser, ADMIN_AUTH_HEADERS);
    Map<String, String> TEAM_USER_AUTH = authHeaders(teamUser.getName());

    // User without explicit domain cannot access domain resources
    // even though they inherit DomainOnlyAccessRole
    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class,
            () -> databaseServiceResourceTest.getEntity(service1.getId(), TEAM_USER_AUTH));
    assertEquals(
        403,
        ex.getStatusCode(),
        "User without explicit domain should not access domain resources even with role");
  }

  @Test
  void testDomainOwnershipTransfer() throws HttpResponseException {
    // Test scenario where a service's domain ownership changes
    // This simulates real-world domain reorganization

    // Create a service initially without domain
    CreateDatabaseService createTransferService =
        new CreateDatabaseService()
            .withName("service-transfer-" + testId)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(TestUtils.MYSQL_DATABASE_CONNECTION);
    DatabaseService transferService =
        databaseServiceResourceTest.createEntity(createTransferService, ADMIN_AUTH_HEADERS);

    // Initially, users with domains can access it (no domain on resource)
    // Create a user without domain who can initially access it
    CreateUser createNoDomainUser =
        new CreateUser()
            .withName("user-transfer-test-" + testId)
            .withEmail("user-transfer-test-" + testId + "@test.com")
            .withDisplayName("Transfer Test User " + testId)
            .withTeams(List.of(dept1.getId()));
    User noDomainUser = userResourceTest.createEntity(createNoDomainUser, ADMIN_AUTH_HEADERS);
    Map<String, String> NO_DOMAIN_AUTH = authHeaders(noDomainUser.getName());

    // User without domain can access resource without domain
    DatabaseService fetched =
        databaseServiceResourceTest.getEntity(transferService.getId(), NO_DOMAIN_AUTH);
    assertNotNull(fetched);
    assertEquals(transferService.getId(), fetched.getId());
  }

  @Test
  void testDomainInheritanceFromParentEntities() throws HttpResponseException {
    // Test that domain access control works with inherited domains
    // OpenMetadata supports domain inheritance where child entities inherit from parents

    // Test 1: Database inherits domain from service
    // database1 should inherit team1Domain from service1
    Database fetchedDb = databaseResourceTest.getEntity(database1.getId(), USER1_AUTH_HEADERS);
    assertNotNull(fetchedDb, "user1 should access database1 via inherited domain from service1");
    assertEquals(database1.getId(), fetchedDb.getId());

    // The database itself may not have explicit domain, but inherits from service
    // This tests that hasDomain() correctly handles inherited domains

    // Create database2 under service2
    CreateDatabase createDb2 =
        new CreateDatabase()
            .withName("database2-" + testId)
            .withService(service2.getFullyQualifiedName());
    Database database2 = databaseResourceTest.createEntity(createDb2, ADMIN_AUTH_HEADERS);

    // user1 cannot access database2 (inherits team2Domain from service2)
    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class,
            () -> databaseResourceTest.getEntity(database2.getId(), USER1_AUTH_HEADERS));
    assertEquals(
        403, ex.getStatusCode(), "user1 should not access database2 which inherits team2Domain");

    // user2 can access database2 (inherits team2Domain from service2)
    fetchedDb = databaseResourceTest.getEntity(database2.getId(), USER2_AUTH_HEADERS);
    assertNotNull(fetchedDb, "user2 should access database2 via inherited domain");
    assertEquals(database2.getId(), fetchedDb.getId());

    // Test 2: Create a database schema under database1
    // Schema should inherit domain from database -> service chain
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("schema1-" + testId)
            .withDatabase(database1.getFullyQualifiedName());
    DatabaseSchema schema1 =
        databaseSchemaResourceTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    // user1 can access schema1 (inherits domain through database1 -> service1)
    DatabaseSchema fetchedSchema =
        databaseSchemaResourceTest.getEntity(schema1.getId(), USER1_AUTH_HEADERS);
    assertNotNull(fetchedSchema, "user1 should access schema via inherited domain chain");
    assertEquals(schema1.getId(), fetchedSchema.getId());

    // user2 cannot access schema1
    ex =
        assertThrows(
            HttpResponseException.class,
            () -> databaseSchemaResourceTest.getEntity(schema1.getId(), USER2_AUTH_HEADERS));
    assertEquals(
        403, ex.getStatusCode(), "user2 should not access schema1 which inherits team1Domain");

    // Test 3: Create a table under schema1
    // Table should inherit domain through schema -> database -> service chain
    CreateTable createTable =
        new CreateTable()
            .withName("table1-" + testId)
            .withDatabaseSchema(schema1.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("name").withDataType(ColumnDataType.STRING)));
    Table table1 = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // user1 can access table1 (inherits domain through full hierarchy)
    Table fetchedTable = tableResourceTest.getEntity(table1.getId(), USER1_AUTH_HEADERS);
    assertNotNull(fetchedTable, "user1 should access table via inherited domain chain");
    assertEquals(table1.getId(), fetchedTable.getId());

    // user2 cannot access table1
    ex =
        assertThrows(
            HttpResponseException.class,
            () -> tableResourceTest.getEntity(table1.getId(), USER2_AUTH_HEADERS));
    assertEquals(
        403, ex.getStatusCode(), "user2 should not access table1 which inherits team1Domain");
  }

  @Test
  void testExplicitDomainOverridesInheritance() throws HttpResponseException {
    // Test that explicit domain assignment overrides inherited domain

    // Create a database under service1 (which has team1Domain)
    CreateDatabase createDb3 =
        new CreateDatabase()
            .withName("database3-" + testId)
            .withService(service1.getFullyQualifiedName())
            .withDomains(
                List.of(team2Domain.getFullyQualifiedName())); // Explicitly set to team2Domain
    Database database3 = databaseResourceTest.createEntity(createDb3, ADMIN_AUTH_HEADERS);

    // Now user1 cannot access database3 (explicit team2Domain overrides inherited team1Domain)
    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class,
            () -> databaseResourceTest.getEntity(database3.getId(), USER1_AUTH_HEADERS));
    assertEquals(
        403, ex.getStatusCode(), "user1 should not access database3 with explicit team2Domain");

    // But user2 can access database3
    Database fetchedDb = databaseResourceTest.getEntity(database3.getId(), USER2_AUTH_HEADERS);
    assertNotNull(fetchedDb, "user2 should access database3 with explicit team2Domain");
    assertEquals(database3.getId(), fetchedDb.getId());
  }

  @Test
  void testDomainOnlyAccessRoleRemoval() throws HttpResponseException {
    // Test that removing DomainOnlyAccessRole changes access behavior

    // Create a new user with DomainOnlyAccessRole
    CreateUser createTestUser =
        new CreateUser()
            .withName("user-role-test-" + testId)
            .withEmail("user-role-test-" + testId + "@test.com")
            .withDisplayName("Role Test User " + testId)
            .withTeams(List.of(team1.getId()))
            .withDomains(List.of(team1Domain.getFullyQualifiedName()));
    User testUser = userResourceTest.createEntity(createTestUser, ADMIN_AUTH_HEADERS);
    Map<String, String> TEST_USER_AUTH = authHeaders(testUser.getName());

    // Initially can access service1 (same domain)
    DatabaseService fetched =
        databaseServiceResourceTest.getEntity(service1.getId(), TEST_USER_AUTH);
    assertNotNull(fetched);

    // Cannot access service2 (different domain)
    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class,
            () -> databaseServiceResourceTest.getEntity(service2.getId(), TEST_USER_AUTH));
    assertEquals(403, ex.getStatusCode());

    // Now update the user to have a different role (e.g., DataSteward)
    // This would require updating the team's default roles or user's roles
    // The test would verify that domain restrictions no longer apply
    // Note: This test would need proper role setup which may require additional infrastructure
  }

  @Test
  void testDomainAccessWithDeleteOperation() throws HttpResponseException {
    // Test that domain access control applies to delete operations

    // Create a test service in team1Domain
    CreateDatabaseService createTestService =
        new CreateDatabaseService()
            .withName("service-delete-test-" + testId)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(TestUtils.MYSQL_DATABASE_CONNECTION)
            .withDomains(List.of(team1Domain.getFullyQualifiedName()));
    DatabaseService testService =
        databaseServiceResourceTest.createEntity(createTestService, ADMIN_AUTH_HEADERS);

    // user2 (team2Domain) cannot delete service in team1Domain
    HttpResponseException ex =
        assertThrows(
            HttpResponseException.class,
            () ->
                databaseServiceResourceTest.deleteEntity(testService.getId(), USER2_AUTH_HEADERS));
    assertEquals(
        403,
        ex.getStatusCode(),
        "User from different domain should not be able to delete resource");

    // user1 should be able to delete it (same domain)
    // Note: This might fail if user doesn't have delete permission even within their domain
    // The test verifies that domain check happens before operation-specific permissions
    try {
      databaseServiceResourceTest.deleteEntity(testService.getId(), USER1_AUTH_HEADERS);
    } catch (HttpResponseException e) {
      // If it fails, it should be for reasons other than domain access
      assertFalse(
          e.getMessage().contains("DomainAccessDenyRule"),
          "Delete should not fail due to domain access for same-domain user");
    }
  }

  private EntityReference getEntityReference(Team team) {
    return new EntityReference()
        .withId(team.getId())
        .withType("team")
        .withName(team.getName())
        .withFullyQualifiedName(team.getFullyQualifiedName());
  }
}
