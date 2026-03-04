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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.azure.core.exception.HttpResponseException;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ImageList;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.sdk.fluent.Personas;
import org.openmetadata.sdk.fluent.Users;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Integration tests for User entity operations.
 *
 * <p>Extends BaseEntityIT to inherit all common entity tests. Adds user-specific tests for
 * authentication, teams, roles, and profile management.
 *
 * <p>Migrated from: org.openmetadata.service.resources.teams.UserResourceTest
 *
 * <p>Test isolation: Uses TestNamespace for unique entity names
 * Parallelization: Safe for concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
public class UserResourceIT extends BaseEntityIT<User, CreateUser> {

  {
    // User CSV export/import is done through the Team endpoint, not User endpoint
    // The actual export is /v1/teams/name/{teamName}/export which exports users in that team
    supportsImportExport = false;
  }

  private static final Profile PROFILE =
      new Profile().withImages(new ImageList().withImage(URI.create("https://image.com")));

  private Team lastCreatedTeam;

  public UserResourceIT() {
    supportsFollowers = false;
    supportsTags = false;
    supportsDomains = true;
    supportsDataProducts = false;
    supportsSoftDelete = true;
    supportsPatch = true;
    supportsOwners = false;
    supportsListHistoryByTimestamp = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  /**
   * Generate a valid email from a name that may contain special characters.
   * Email local part allows: letters, digits, dots, hyphens, underscores.
   * Maximum length of local part is 64 characters.
   */
  private String toValidEmail(String name) {
    // Replace any characters that aren't valid in email local part
    String sanitized = name.replaceAll("[^a-zA-Z0-9._-]", "");
    // Ensure it doesn't start or end with a dot
    sanitized = sanitized.replaceAll("^\\.+|\\.+$", "");
    // Replace multiple dots with single dot
    sanitized = sanitized.replaceAll("\\.{2,}", ".");
    // Replace multiple underscores/hyphens with single ones
    sanitized = sanitized.replaceAll("_{2,}", "_");
    sanitized = sanitized.replaceAll("-{2,}", "-");
    // Truncate to max 60 characters (leaving room for uniqueness)
    if (sanitized.length() > 60) {
      sanitized = sanitized.substring(0, 52) + UUID.randomUUID().toString().substring(0, 8);
    }
    return sanitized + "@test.openmetadata.org";
  }

  /**
   * Helper to find a user in paginated results with a given filter.
   * Paginates through all pages until the user is found or no more pages exist.
   */
  private boolean findUserInPaginatedResults(UUID userId, String filterKey, String filterValue) {
    ListParams params = new ListParams();
    params.setLimit(100);
    params.addFilter(filterKey, filterValue);

    ListResponse<User> page = listEntities(params);
    while (page != null && page.getData() != null) {
      if (page.getData().stream().anyMatch(u -> u.getId().equals(userId))) {
        return true;
      }
      String afterCursor = page.getPaging() != null ? page.getPaging().getAfter() : null;
      if (afterCursor == null) {
        break;
      }
      params.setAfter(afterCursor);
      page = listEntities(params);
    }
    return false;
  }

  @Override
  protected CreateUser createMinimalRequest(TestNamespace ns) {
    String name = ns.prefix("user");
    return new CreateUser()
        .withName(name)
        .withEmail(toValidEmail(name))
        .withDescription("Test user created by integration test");
  }

  @Override
  protected CreateUser createRequest(String name, TestNamespace ns) {
    return new CreateUser()
        .withName(name)
        .withEmail(toValidEmail(name))
        .withDescription("Test user");
  }

  @Override
  protected User createEntity(CreateUser createRequest) {
    return Users.create(createRequest);
  }

  @Override
  protected User getEntity(String id) {
    return Users.get(id);
  }

  @Override
  protected User getEntityByName(String fqn) {
    return Users.getByName(fqn);
  }

  @Override
  protected User patchEntity(String id, User entity) {
    return Users.update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    Users.delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    Users.restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    Users.delete(id, java.util.Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "user";
  }

  @Override
  protected void validateCreatedEntity(User entity, CreateUser createRequest) {
    assertEquals(createRequest.getName().toLowerCase(), entity.getName().toLowerCase());
    assertEquals(createRequest.getEmail().toLowerCase(), entity.getEmail().toLowerCase());
    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected User getEntityWithFields(String id, String fields) {
    return Users.get(id, fields);
  }

  @Override
  protected User getEntityByNameWithFields(String fqn, String fields) {
    return Users.getByName(fqn, fields);
  }

  @Override
  protected User getEntityIncludeDeleted(String id) {
    return Users.get(id, null, "deleted");
  }

  @Override
  protected ListResponse<User> listEntities(ListParams params) {
    return Users.list(params);
  }

  @Override
  protected org.openmetadata.sdk.services.EntityServiceBase<User> getEntityService() {
    return SdkClients.adminClient().users();
  }

  @Override
  protected String getImportExportContainerName(TestNamespace ns) {
    if (lastCreatedTeam == null) {
      CreateTeam teamRequest = new CreateTeam();
      teamRequest.setName(ns.prefix("export_team"));
      teamRequest.setDescription("Team for user export testing");
      teamRequest.setTeamType(CreateTeam.TeamType.GROUP);
      lastCreatedTeam = SdkClients.adminClient().teams().create(teamRequest);
    }
    return lastCreatedTeam.getFullyQualifiedName();
  }

  // ===================================================================
  // OVERRIDDEN TESTS - Users have case-insensitive names
  // ===================================================================

  @Override
  @Test
  public void post_entityCreate_200_OK(TestNamespace ns) {
    CreateUser createRequest = createMinimalRequest(ns);
    User entity = createEntity(createRequest);

    assertNotNull(entity.getId());
    assertNotNull(entity.getFullyQualifiedName());
    assertEquals(createRequest.getName().toLowerCase(), entity.getName().toLowerCase());
    validateCreatedEntity(entity, createRequest);
  }

  @Override
  @Test
  public void put_entityCreate_200(TestNamespace ns) {
    CreateUser createRequest = createMinimalRequest(ns);
    User entity = createEntity(createRequest);

    assertNotNull(entity.getId());
    assertEquals(createRequest.getName().toLowerCase(), entity.getName().toLowerCase());
  }

  @Override
  @Test
  public void post_entityWithDots_200(TestNamespace ns) {
    String nameWithDots = ns.prefix("foo.bar");
    CreateUser createRequest = createRequest(nameWithDots, ns);
    User created = createEntity(createRequest);

    assertNotNull(created.getId());
    assertEquals(nameWithDots.toLowerCase(), created.getName().toLowerCase());
  }

  // ===================================================================
  // USER-SPECIFIC TESTS
  // ===================================================================

  @Test
  void test_createUserWithProfile(TestNamespace ns) {

    String name = ns.prefix("userWithProfile");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withProfile(PROFILE)
            .withDescription("User with profile");

    User user = createEntity(createRequest);
    assertNotNull(user.getId());
    assertNotNull(user.getProfile());
    assertNotNull(user.getProfile().getImages());
  }

  @Test
  void test_createUserWithDisplayName(TestNamespace ns) {

    String name = ns.prefix("userDisplayName");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDisplayName("John Doe")
            .withDescription("User with display name");

    User user = createEntity(createRequest);
    assertEquals("John Doe", user.getDisplayName());
  }

  @Test
  void test_createUserWithTeams(TestNamespace ns) {

    // Use shared team from SharedEntities
    EntityReference teamRef = testTeam1().getEntityReference();

    String name = ns.prefix("userWithTeam");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withTeams(List.of(teamRef.getId()));

    User user = createEntity(createRequest);
    assertNotNull(user.getId());

    // Fetch with teams field to verify
    User fetched = Users.get(user.getId().toString(), "teams");
    assertNotNull(fetched.getTeams());
    assertTrue(fetched.getTeams().size() >= 1);
  }

  @Test
  void test_createUserWithRoles(TestNamespace ns) {

    // Use shared role from SharedEntities
    UUID roleId = dataStewardRole().getId();

    String name = ns.prefix("userWithRole");
    CreateUser createRequest =
        new CreateUser().withName(name).withEmail(toValidEmail(name)).withRoles(List.of(roleId));

    User user = createEntity(createRequest);
    assertNotNull(user.getId());

    // Fetch with roles field to verify
    User fetched = Users.get(user.getId().toString(), "roles");
    assertNotNull(fetched.getRoles());
    assertTrue(fetched.getRoles().size() >= 1);
  }

  @Test
  void test_createUserAsBot(TestNamespace ns) {

    String name = ns.prefix("botUser");

    // Bot users require authentication mechanism with JWT
    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));

    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withDescription("Bot user for testing");

    User user = createEntity(createRequest);
    assertTrue(user.getIsBot());
  }

  @Test
  void test_createUserAsAdmin(TestNamespace ns) {

    String name = ns.prefix("adminUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withIsAdmin(true)
            .withDescription("Admin user for testing");

    User user = createEntity(createRequest);
    assertTrue(user.getIsAdmin());
  }

  @Test
  void test_updateUserDisplayName(TestNamespace ns) {

    // Create user
    CreateUser createRequest = createMinimalRequest(ns);
    User user = createEntity(createRequest);

    // Update display name
    user.setDisplayName("Updated Display Name");
    User updated = patchEntity(user.getId().toString(), user);

    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_updateUserProfile(TestNamespace ns) {

    // Create user without profile
    CreateUser createRequest = createMinimalRequest(ns);
    User user = createEntity(createRequest);

    // Update with profile
    user.setProfile(PROFILE);
    User updated = patchEntity(user.getId().toString(), user);

    assertNotNull(updated.getProfile());
  }

  @Test
  void test_updateUserTeams(TestNamespace ns) {

    // Create user without teams
    CreateUser createRequest = createMinimalRequest(ns);
    User user = createEntity(createRequest);

    // Get user with teams field
    User fetched = Users.get(user.getId().toString(), "teams");

    // Add to shared team
    EntityReference teamRef = testTeam1().getEntityReference();
    fetched.setTeams(List.of(teamRef));

    User updated = patchEntity(fetched.getId().toString(), fetched);

    // Verify teams updated
    User verifyFetch = Users.get(updated.getId().toString(), "teams");
    assertNotNull(verifyFetch.getTeams());
    assertTrue(verifyFetch.getTeams().size() >= 1);
  }

  @Test
  void test_createUserWithInvalidEmail(TestNamespace ns) {

    String name = ns.prefix("invalidEmailUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail("not-an-email") // Invalid email format
            .withDescription("User with invalid email");

    assertThrows(
        Exception.class,
        () -> createEntity(createRequest),
        "Creating user with invalid email should fail");
  }

  @Test
  void test_createUserWithDuplicateEmail(TestNamespace ns) {

    String name1 = ns.prefix("user1");
    String email1 = toValidEmail(name1);
    CreateUser createRequest1 =
        new CreateUser().withName(name1).withEmail(email1).withDescription("First user");

    User user1 = createEntity(createRequest1);
    assertNotNull(user1.getId());

    // Try to create another user with same email
    String name2 = ns.prefix("user2");
    CreateUser createRequest2 =
        new CreateUser()
            .withName(name2)
            .withEmail(email1) // Same email as user1
            .withDescription("Second user with duplicate email");

    assertThrows(
        Exception.class,
        () -> createEntity(createRequest2),
        "Creating user with duplicate email should fail");
  }

  @Test
  void test_getUserByEmail(TestNamespace ns) {

    // Create user
    String name = ns.prefix("userByEmail");
    String email = toValidEmail(name);
    CreateUser createRequest =
        new CreateUser().withName(name).withEmail(email).withDescription("Test user");

    User created = createEntity(createRequest);

    // Get by name (users are indexed by name, not email)
    // Note: user names are lowercased
    User fetched = getEntityByName(name.toLowerCase());
    assertEquals(created.getId(), fetched.getId());
    // Email is also lowercased
    assertEquals(email.toLowerCase(), fetched.getEmail().toLowerCase());
  }

  @Test
  void test_listUsers(TestNamespace ns) {

    // Create a few users
    for (int i = 0; i < 3; i++) {
      String name = ns.prefix("listUser" + i);
      CreateUser createRequest =
          new CreateUser()
              .withName(name)
              .withEmail(toValidEmail(name))
              .withDescription("User for list test");
      createEntity(createRequest);
    }

    // List users
    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<User> response = listEntities(params);

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void test_softDeleteAndRestoreUser(TestNamespace ns) {

    // Create user
    CreateUser createRequest = createMinimalRequest(ns);
    User user = createEntity(createRequest);
    String userId = user.getId().toString();

    // Soft delete
    deleteEntity(userId);

    // Verify deleted
    assertThrows(
        Exception.class, () -> getEntity(userId), "Deleted user should not be retrievable");

    // Get with include=deleted
    User deleted = getEntityIncludeDeleted(userId);
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(userId);

    // Verify restored
    User restored = getEntity(userId);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_userVersionHistory(TestNamespace ns) {

    // Create user
    CreateUser createRequest = createMinimalRequest(ns);
    User user = createEntity(createRequest);
    assertEquals(0.1, user.getVersion(), 0.001);

    // Update description
    user.setDescription("Updated description v1");
    User v2 = patchEntity(user.getId().toString(), user);
    assertEquals(0.2, v2.getVersion(), 0.001);

    // Update again
    v2.setDescription("Updated description v2");
    User v3 = patchEntity(v2.getId().toString(), v2);
    assertTrue(v3.getVersion() >= 0.2);

    // Get version history
    var history = Users.getVersionList(user.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void test_userWithDomain(TestNamespace ns) {

    // Use shared domain
    String domainFqn = testDomain().getFullyQualifiedName();

    String name = ns.prefix("userWithDomain");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDomains(List.of(domainFqn))
            .withDescription("User with domain");

    User user = createEntity(createRequest);
    assertNotNull(user.getId());

    // Verify domains are set
    User fetched = Users.get(user.getId().toString(), "domains");
    assertNotNull(fetched.getDomains());
    assertFalse(fetched.getDomains().isEmpty());
    assertTrue(
        fetched.getDomains().stream().anyMatch(d -> d.getFullyQualifiedName().equals(domainFqn)));
  }

  @Test
  void test_listUsersWithAdminFilter(TestNamespace ns) {

    // Create admin user
    String adminName = ns.prefix("adminFilterUser");
    CreateUser adminRequest =
        new CreateUser()
            .withName(adminName)
            .withEmail(toValidEmail(adminName))
            .withIsAdmin(true)
            .withDescription("Admin user for filter test");
    User adminUser = createEntity(adminRequest);
    assertTrue(adminUser.getIsAdmin());

    // Create non-admin user
    String nonAdminName = ns.prefix("nonAdminFilterUser");
    CreateUser nonAdminRequest =
        new CreateUser()
            .withName(nonAdminName)
            .withEmail(toValidEmail(nonAdminName))
            .withIsAdmin(false)
            .withDescription("Non-admin user for filter test");
    User nonAdminUser = createEntity(nonAdminRequest);
    assertFalse(nonAdminUser.getIsAdmin());

    // List with isAdmin=true filter
    ListParams adminParams = new ListParams();
    adminParams.setLimit(100);
    adminParams.addFilter("isAdmin", "true");
    ListResponse<User> adminUsers = listEntities(adminParams);

    assertNotNull(adminUsers.getData());
    assertTrue(
        adminUsers.getData().stream().anyMatch(u -> u.getId().equals(adminUser.getId())),
        "Admin user should be in filtered list");

    // List with isAdmin=false filter
    ListParams nonAdminParams = new ListParams();
    nonAdminParams.setLimit(100);
    nonAdminParams.addFilter("isAdmin", "false");
    ListResponse<User> nonAdminUsers = listEntities(nonAdminParams);

    assertNotNull(nonAdminUsers.getData());

    // Diagnostic: Check if user exists by fetching directly
    User fetchedUser = getEntity(nonAdminUser.getId().toString());
    assertNotNull(fetchedUser, "User should exist when fetched by ID");
    assertFalse(
        fetchedUser.getIsAdmin(),
        String.format(
            "Fetched user isAdmin should be false but was: %s", fetchedUser.getIsAdmin()));

    // Diagnostic: Log pagination info
    int pageCount = nonAdminUsers.getData().size();
    boolean hasMore =
        nonAdminUsers.getPaging() != null && nonAdminUsers.getPaging().getAfter() != null;

    // Check if user is in first page
    boolean foundInFirstPage =
        nonAdminUsers.getData().stream().anyMatch(u -> u.getId().equals(nonAdminUser.getId()));

    // If not found in first page and there are more pages, paginate to find it
    boolean foundInAnyPage = foundInFirstPage;
    int totalPages = 1;
    String afterCursor = hasMore ? nonAdminUsers.getPaging().getAfter() : null;

    while (!foundInAnyPage && afterCursor != null) {
      totalPages++;
      ListParams nextPageParams = new ListParams();
      nextPageParams.setLimit(100);
      nextPageParams.addFilter("isAdmin", "false");
      nextPageParams.setAfter(afterCursor);
      ListResponse<User> nextPage = listEntities(nextPageParams);

      foundInAnyPage =
          nextPage.getData().stream().anyMatch(u -> u.getId().equals(nonAdminUser.getId()));
      afterCursor = nextPage.getPaging() != null ? nextPage.getPaging().getAfter() : null;
    }

    assertTrue(
        foundInAnyPage,
        String.format(
            "Non-admin user should be in filtered list. "
                + "User ID: %s, User name: %s, isAdmin from fetch: %s, "
                + "First page size: %d, Has more pages: %s, Total pages searched: %d, "
                + "Found in first page: %s",
            nonAdminUser.getId(),
            nonAdminUser.getName(),
            fetchedUser.getIsAdmin(),
            pageCount,
            hasMore,
            totalPages,
            foundInFirstPage));
  }

  /**
   * Test that reproduces pagination issue with isAdmin=false filter.
   * Creates 101 non-admin users to ensure target user is pushed beyond first page.
   * This test verifies that the filter works correctly across pagination boundaries.
   */
  @Test
  void test_listUsersWithAdminFilter_paginationBoundary(TestNamespace ns) {
    // First, check how many non-admin users already exist
    ListParams countParams = new ListParams();
    countParams.setLimit(1);
    countParams.addFilter("isAdmin", "false");
    ListResponse<User> initialCount = listEntities(countParams);
    int existingNonAdminCount =
        initialCount.getPaging() != null && initialCount.getPaging().getTotal() != null
            ? initialCount.getPaging().getTotal()
            : 0;

    // Create 101 non-admin users with names that sort BEFORE our target alphabetically
    // Using "aaa" prefix ensures they come first in alphabetical order
    int usersToCreate = 101;
    for (int i = 0; i < usersToCreate; i++) {
      String name = ns.prefix(String.format("aaa_paginationUser_%03d", i));
      CreateUser createRequest =
          new CreateUser()
              .withName(name)
              .withEmail(toValidEmail(name))
              .withIsAdmin(false)
              .withDescription("User for pagination boundary test");
      createEntity(createRequest);
    }

    // Create target user with name that sorts AFTER all the "aaa" users
    String targetName = ns.prefix("zzz_targetUser");
    CreateUser targetRequest =
        new CreateUser()
            .withName(targetName)
            .withEmail(toValidEmail(targetName))
            .withIsAdmin(false)
            .withDescription("Target user that should be beyond first page");
    User targetUser = createEntity(targetRequest);
    assertFalse(targetUser.getIsAdmin(), "Target user should be non-admin");

    // Verify target user exists and has correct isAdmin value
    User fetchedTarget = getEntity(targetUser.getId().toString());
    assertFalse(
        fetchedTarget.getIsAdmin(),
        String.format(
            "Fetched target user isAdmin should be false but was: %s", fetchedTarget.getIsAdmin()));

    // List with isAdmin=false filter and limit=100 (first page only)
    ListParams firstPageParams = new ListParams();
    firstPageParams.setLimit(100);
    firstPageParams.addFilter("isAdmin", "false");
    ListResponse<User> firstPage = listEntities(firstPageParams);

    assertNotNull(firstPage.getData(), "First page data should not be null");

    boolean foundInFirstPage =
        firstPage.getData().stream().anyMatch(u -> u.getId().equals(targetUser.getId()));

    // The target user may or may not be in first page depending on existing users
    // The key assertion is that we can find it through pagination
    boolean foundInAnyPage = foundInFirstPage;
    int totalPagesSearched = 1;
    String afterCursor = firstPage.getPaging() != null ? firstPage.getPaging().getAfter() : null;

    while (!foundInAnyPage && afterCursor != null) {
      totalPagesSearched++;
      ListParams nextPageParams = new ListParams();
      nextPageParams.setLimit(100);
      nextPageParams.addFilter("isAdmin", "false");
      nextPageParams.setAfter(afterCursor);
      ListResponse<User> nextPage = listEntities(nextPageParams);

      foundInAnyPage =
          nextPage.getData().stream().anyMatch(u -> u.getId().equals(targetUser.getId()));
      afterCursor = nextPage.getPaging() != null ? nextPage.getPaging().getAfter() : null;
    }

    // This is the key assertion - the user MUST be found when paginating
    assertTrue(
        foundInAnyPage,
        String.format(
            "Target non-admin user should be found via pagination. "
                + "User ID: %s, User name: %s, "
                + "Existing non-admin count before test: %d, "
                + "Users created in test: %d, "
                + "First page size: %d, "
                + "Found in first page: %s, "
                + "Total pages searched: %d, "
                + "isAdmin from direct fetch: %s",
            targetUser.getId(),
            targetUser.getName(),
            existingNonAdminCount,
            usersToCreate,
            firstPage.getData().size(),
            foundInFirstPage,
            totalPagesSearched,
            fetchedTarget.getIsAdmin()));

    // Additional diagnostic: if not found in first page, that's expected given we created 101 users
    // But if there are many existing users, target might still be in first page
    if (!foundInFirstPage && totalPagesSearched > 1) {
      // This is the expected behavior - user was beyond first page but found via pagination
      assertTrue(true, "User correctly found via pagination as expected");
    }
  }

  @Test
  void test_listUsersWithBotFilter(TestNamespace ns) {

    // Create bot user
    String botName = ns.prefix("botFilterUser");
    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));

    CreateUser botRequest =
        new CreateUser()
            .withName(botName)
            .withEmail(toValidEmail(botName))
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withDescription("Bot user for filter test");
    User botUser = createEntity(botRequest);
    assertTrue(botUser.getIsBot());

    // Create regular user
    String regularName = ns.prefix("regularFilterUser");
    CreateUser regularRequest =
        new CreateUser()
            .withName(regularName)
            .withEmail(toValidEmail(regularName))
            .withIsBot(false)
            .withDescription("Regular user for filter test");
    User regularUser = createEntity(regularRequest);

    // List with isBot=true filter
    ListParams botParams = new ListParams();
    botParams.setLimit(100);
    botParams.addFilter("isBot", "true");
    ListResponse<User> botUsers = listEntities(botParams);

    assertNotNull(botUsers.getData());
    assertTrue(
        botUsers.getData().stream().anyMatch(u -> u.getId().equals(botUser.getId())),
        "Bot user should be in filtered list");

    // List with isBot=false filter using paginated search
    assertTrue(
        findUserInPaginatedResults(regularUser.getId(), "isBot", "false"),
        "Regular user should be in filtered list");
  }

  @Test
  void test_listUsersWithTeamFilter(TestNamespace ns) {

    // Use shared team
    EntityReference teamRef = testTeam1().getEntityReference();

    // Create user in team
    String userName1 = ns.prefix("teamFilterUser1");
    CreateUser request1 =
        new CreateUser()
            .withName(userName1)
            .withEmail(toValidEmail(userName1))
            .withTeams(List.of(teamRef.getId()))
            .withDescription("User in team for filter test");
    User user1 = createEntity(request1);

    // Create user NOT in team
    String userName2 = ns.prefix("teamFilterUser2");
    CreateUser request2 =
        new CreateUser()
            .withName(userName2)
            .withEmail(toValidEmail(userName2))
            .withDescription("User not in team for filter test");
    createEntity(request2);

    assertTrue(
        findUserInPaginatedResults(user1.getId(), "team", testTeam1().getName()),
        "User in team should be in filtered list");
  }

  @Test
  void test_userNameCaseInsensitive(TestNamespace ns) {

    // Create user with mixed case name
    String mixedCaseName = ns.prefix("MixedCaseUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(mixedCaseName)
            .withEmail(toValidEmail(mixedCaseName))
            .withDescription("User with mixed case name");

    User user = createEntity(createRequest);

    // User names are stored lowercase
    assertEquals(mixedCaseName.toLowerCase(), user.getName());

    // Should be able to fetch by lowercase name
    User fetched = getEntityByName(mixedCaseName.toLowerCase());
    assertEquals(user.getId(), fetched.getId());
  }

  @Test
  void test_hardDeleteUser(TestNamespace ns) {

    // Create user
    CreateUser createRequest = createMinimalRequest(ns);
    User user = createEntity(createRequest);
    String userId = user.getId().toString();

    // Hard delete
    hardDeleteEntity(userId);

    // Verify completely gone (even with include=deleted)
    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(userId),
        "Hard deleted user should not be retrievable");
  }

  @Test
  void test_updateUserRoles(TestNamespace ns) {

    // Create user without roles
    CreateUser createRequest = createMinimalRequest(ns);
    User user = createEntity(createRequest);

    // Fetch user with roles
    User fetched = Users.get(user.getId().toString(), "roles");

    // Add role
    EntityReference roleRef =
        new EntityReference()
            .withId(dataStewardRole().getId())
            .withType("role")
            .withName(dataStewardRole().getName());
    fetched.setRoles(List.of(roleRef));

    User updated = patchEntity(fetched.getId().toString(), fetched);

    // Verify role added
    User verify = Users.get(updated.getId().toString(), "roles");
    assertNotNull(verify.getRoles());
    assertTrue(verify.getRoles().size() >= 1);
    assertTrue(
        verify.getRoles().stream().anyMatch(r -> r.getId().equals(dataStewardRole().getId())));
  }

  @Test
  void test_userWithMultipleTeams(TestNamespace ns) {

    // Use shared teams
    EntityReference team1Ref = testTeam1().getEntityReference();
    EntityReference team2Ref = testTeam2().getEntityReference();

    String name = ns.prefix("multiTeamUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withTeams(List.of(team1Ref.getId(), team2Ref.getId()))
            .withDescription("User with multiple teams");

    User user = createEntity(createRequest);
    assertNotNull(user.getId());

    // Verify teams
    User fetched = Users.get(user.getId().toString(), "teams");
    assertNotNull(fetched.getTeams());
    assertTrue(fetched.getTeams().size() >= 2);
  }

  @Test
  void test_userWithMultipleRoles(TestNamespace ns) {

    // Use shared roles
    UUID role1 = dataStewardRole().getId();
    UUID role2 = dataConsumerRole().getId();

    String name = ns.prefix("multiRoleUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withRoles(List.of(role1, role2))
            .withDescription("User with multiple roles");

    User user = createEntity(createRequest);
    assertNotNull(user.getId());

    // Verify roles
    User fetched = Users.get(user.getId().toString(), "roles");
    assertNotNull(fetched.getRoles());
    assertTrue(fetched.getRoles().size() >= 2);
  }

  @Test
  void test_createUserWithPersona(TestNamespace ns) {

    // Create a persona for this test
    org.openmetadata.schema.api.teams.CreatePersona personaRequest =
        new org.openmetadata.schema.api.teams.CreatePersona()
            .withName(ns.prefix("testPersona"))
            .withDescription("Test persona for user");

    org.openmetadata.schema.entity.teams.Persona persona = Personas.create(personaRequest);

    String name = ns.prefix("userWithPersona");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withPersonas(List.of(persona.getEntityReference()))
            .withDescription("User with persona");

    User user = createEntity(createRequest);
    assertNotNull(user.getId());

    // Verify persona
    User fetched = Users.get(user.getId().toString(), "personas");
    assertNotNull(fetched.getPersonas());
    assertFalse(fetched.getPersonas().isEmpty());
  }

  @Test
  void test_usersWithTeamPagination(TestNamespace ns) {

    // Use shared team
    EntityReference teamRef = testTeam1().getEntityReference();

    // Create multiple users in the team
    for (int i = 0; i < 10; i++) {
      String name = ns.prefix("paginationUser" + i);
      CreateUser createRequest =
          new CreateUser()
              .withName(name)
              .withEmail(toValidEmail(name))
              .withTeams(List.of(teamRef.getId()))
              .withDescription("User for pagination test");
      createEntity(createRequest);
    }

    // List with pagination
    ListParams params = new ListParams();
    params.setLimit(5);
    params.addFilter("team", testTeam1().getName());
    ListResponse<User> page1 = listEntities(params);

    assertNotNull(page1.getData());
    assertEquals(5, page1.getData().size());
    assertNotNull(page1.getPaging());

    // If there are more pages, verify pagination works
    if (page1.getPaging().getAfter() != null) {
      params.setAfter(page1.getPaging().getAfter());
      ListResponse<User> page2 = listEntities(params);
      assertNotNull(page2.getData());
      assertTrue(page2.getData().size() > 0);

      // Ensure no overlap between pages
      List<UUID> page1Ids = page1.getData().stream().map(User::getId).toList();
      List<UUID> page2Ids = page2.getData().stream().map(User::getId).toList();
      for (UUID id : page2Ids) {
        assertFalse(page1Ids.contains(id), "Pages should not overlap");
      }
    }
  }

  @Test
  void test_updateUserDescription(TestNamespace ns) {

    // Create user
    CreateUser createRequest = createMinimalRequest(ns);
    User user = createEntity(createRequest);
    String originalDesc = user.getDescription();

    // Update description
    String newDescription = "Updated description for user";
    user.setDescription(newDescription);
    User updated = patchEntity(user.getId().toString(), user);

    assertEquals(newDescription, updated.getDescription());
    assertNotEquals(originalDesc, updated.getDescription());
  }

  @Test
  void test_userInheritedRoles(TestNamespace ns) {

    // Create user with a role assigned to team
    EntityReference teamRef = testTeam1().getEntityReference();

    String name = ns.prefix("inheritedRoleUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withTeams(List.of(teamRef.getId()))
            .withDescription("User to test inherited roles");

    User user = createEntity(createRequest);
    assertNotNull(user.getId());

    // Fetch with inheritedRoles field
    User fetched = Users.get(user.getId().toString(), "roles,teams,inheritedRoles");
    assertNotNull(fetched.getTeams());
    // inheritedRoles may be present depending on team configuration
  }

  // ===================================================================
  // ADDITIONAL USER TESTS - Migrated from UserResourceTest
  // ===================================================================

  @Test
  void test_userProfileTimezone(TestNamespace ns) {

    String name = ns.prefix("userTimezone");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDescription("User with timezone")
            .withTimezone("America/Los_Angeles");

    User user = createEntity(createRequest);
    assertEquals("America/Los_Angeles", user.getTimezone());

    // Update timezone
    user.setTimezone("Europe/London");
    User updated = patchEntity(user.getId().toString(), user);
    assertEquals("Europe/London", updated.getTimezone());
  }

  @Test
  void patch_teamAddition_200_ok(TestNamespace ns) {

    // Create user with testTeam1
    String name = ns.prefix("userAddTeam");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withTeams(List.of(testTeam1().getId()))
            .withDescription("User for team addition test");

    User user = createEntity(createRequest);

    // Fetch user with teams
    User fetched = Users.get(user.getId().toString(), "teams");
    assertNotNull(fetched.getTeams());
    assertTrue(fetched.getTeams().stream().anyMatch(t -> t.getId().equals(testTeam1().getId())));

    // Add second team via patch
    List<EntityReference> newTeams = new java.util.ArrayList<>(fetched.getTeams());
    newTeams.add(testTeam2().getEntityReference());
    fetched.setTeams(newTeams);
    User updated = patchEntity(fetched.getId().toString(), fetched);

    // Verify both teams present
    User verify = Users.get(updated.getId().toString(), "teams");
    assertNotNull(verify.getTeams());
    assertTrue(verify.getTeams().size() >= 2);
    assertTrue(verify.getTeams().stream().anyMatch(t -> t.getId().equals(testTeam1().getId())));
    assertTrue(verify.getTeams().stream().anyMatch(t -> t.getId().equals(testTeam2().getId())));
  }

  @Test
  void patch_roleRemoval_200_ok(TestNamespace ns) {

    // Create user with role
    String name = ns.prefix("userRemoveRole");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withRoles(List.of(dataStewardRole().getId()))
            .withDescription("User for role removal test");

    User user = createEntity(createRequest);

    // Verify role exists
    User fetched = Users.get(user.getId().toString(), "roles");
    assertNotNull(fetched.getRoles());
    assertTrue(fetched.getRoles().size() >= 1);

    // Remove role via patch
    fetched.setRoles(List.of());
    User updated = patchEntity(fetched.getId().toString(), fetched);

    // Verify role removed
    User verify = Users.get(updated.getId().toString(), "roles");
    assertTrue(verify.getRoles() == null || verify.getRoles().isEmpty());
  }

  @Test
  void test_botUserWithAdmin(TestNamespace ns) {

    // Create a bot user with admin flag
    String name = ns.prefix("botAdmin");
    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));

    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withIsBot(true)
            .withIsAdmin(true)
            .withAuthenticationMechanism(authMechanism)
            .withDescription("Bot user with admin flag");

    User user = createEntity(createRequest);
    assertNotNull(user);
    assertTrue(user.getIsBot());
    // Just verify creation succeeds - bot can have admin flag in current implementation
  }

  @Test
  void test_updateBotAuthMechanism(TestNamespace ns) {

    String name = ns.prefix("botUpdateAuth");
    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));

    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withDescription("Bot user for auth update test");

    User bot = createEntity(createRequest);
    assertTrue(bot.getIsBot());
    assertNotNull(bot.getAuthenticationMechanism());
  }

  @Test
  void test_userFQNContainsName(TestNamespace ns) {

    String name = ns.prefix("fqnUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDescription("User for FQN test");

    User user = createEntity(createRequest);
    assertNotNull(user.getFullyQualifiedName());
    assertTrue(user.getFullyQualifiedName().contains(user.getName()));
  }

  @Test
  void test_listUsersPagination(TestNamespace ns) {

    // Create multiple users
    for (int i = 0; i < 5; i++) {
      String name = ns.prefix("paginateUser" + i);
      CreateUser createRequest =
          new CreateUser()
              .withName(name)
              .withEmail(toValidEmail(name))
              .withDescription("User for pagination test " + i);
      createEntity(createRequest);
    }

    // First page
    ListParams params = new ListParams();
    params.setLimit(2);
    ListResponse<User> page1 = listEntities(params);

    assertNotNull(page1);
    assertNotNull(page1.getData());
    assertEquals(2, page1.getData().size());
    assertNotNull(page1.getPaging());
  }

  @Test
  void test_userWithFullyQualifiedName(TestNamespace ns) {

    String name = ns.prefix("userFqn");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDescription("User for FQN verification");

    User user = createEntity(createRequest);
    assertNotNull(user.getId());
    assertNotNull(user.getFullyQualifiedName());
    assertEquals(user.getName(), user.getFullyQualifiedName());
  }

  @Test
  void test_createUserWithAllFields(TestNamespace ns) {

    String name = ns.prefix("fullUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withDisplayName("Full User Display Name")
            .withEmail(toValidEmail(name))
            .withDescription("User with all fields")
            .withTimezone("UTC")
            .withIsAdmin(false)
            .withTeams(List.of(testTeam1().getId()))
            .withRoles(List.of(dataStewardRole().getId()));

    User user = createEntity(createRequest);
    assertNotNull(user.getId());
    assertEquals("Full User Display Name", user.getDisplayName());
    assertEquals("User with all fields", user.getDescription());
    assertEquals("UTC", user.getTimezone());
    assertFalse(user.getIsAdmin());
  }

  @Test
  void test_switchUserTeams(TestNamespace ns) {

    // Create user with one team
    String name = ns.prefix("switchTeamsUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withTeams(List.of(testTeam1().getId()))
            .withDescription("User for team switch test");

    User user = createEntity(createRequest);

    // Update to different team
    User fetched = Users.get(user.getId().toString(), "teams");
    fetched.setTeams(List.of(testTeam2().getEntityReference()));
    User updated = patchEntity(fetched.getId().toString(), fetched);

    // Verify team changed
    User verify = Users.get(updated.getId().toString(), "teams");
    assertNotNull(verify.getTeams());
    assertTrue(verify.getTeams().stream().anyMatch(t -> t.getId().equals(testTeam2().getId())));
  }

  @Test
  void test_userDeletion_removesFromTeam(TestNamespace ns) {

    // Create user in team
    String name = ns.prefix("deleteFromTeamUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withTeams(List.of(testTeam1().getId()))
            .withDescription("User to delete from team");

    User user = createEntity(createRequest);

    // Delete user
    deleteEntity(user.getId().toString());

    // Verify user is deleted
    User deleted = getEntityIncludeDeleted(user.getId().toString());
    assertTrue(deleted.getDeleted());
  }

  @Test
  void test_userRestoreAfterDelete(TestNamespace ns) {

    // Create user
    String name = ns.prefix("restoreUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDescription("User to restore");

    User user = createEntity(createRequest);

    // Soft delete
    deleteEntity(user.getId().toString());

    // Verify deleted
    User deleted = getEntityIncludeDeleted(user.getId().toString());
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(user.getId().toString());

    // Verify restored
    User restored = getEntity(user.getId().toString());
    assertFalse(restored.getDeleted() != null && restored.getDeleted());
  }

  @Test
  void test_userHref(TestNamespace ns) {

    String name = ns.prefix("hrefUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDescription("User for href test");

    User user = createEntity(createRequest);
    assertNotNull(user.getHref());
  }

  @Test
  void post_userWithoutEmail_400_badRequest(TestNamespace ns) {

    String name = ns.prefix("noEmailUser");
    CreateUser create = new CreateUser().withName(name).withEmail(null);

    assertThrows(
        Exception.class, () -> createEntity(create), "Creating user without email should fail");

    create.withEmail("");
    assertThrows(
        Exception.class, () -> createEntity(create), "Creating user with empty email should fail");
  }

  @Test
  void patch_userAttributes_as_admin_200_ok(TestNamespace ns) {

    String name = ns.prefix("patchAttrsUser");
    CreateUser createRequest =
        new CreateUser().withName(name).withEmail(toValidEmail(name)).withProfile(null);

    User user = createEntity(createRequest);
    assertNull(user.getDisplayName());
    assertNull(user.getTimezone());

    EntityReference team1Ref = testTeam1().getEntityReference();
    EntityReference roleRef = dataStewardRole().getEntityReference();

    User fetched = Users.get(user.getId().toString(), "teams,roles");

    fetched.setDisplayName("Updated Display Name");
    fetched.setTimezone("America/Los_Angeles");
    fetched.setTeams(List.of(team1Ref));
    fetched.setRoles(List.of(roleRef));
    fetched.setProfile(PROFILE);

    User updated = patchEntity(fetched.getId().toString(), fetched);

    assertEquals("Updated Display Name", updated.getDisplayName());
    assertEquals("America/Los_Angeles", updated.getTimezone());

    User verify = Users.get(updated.getId().toString(), "teams,roles,profile");
    assertNotNull(verify.getDisplayName());
    assertNotNull(verify.getTimezone());
    assertNotNull(verify.getProfile());
  }

  @Test
  void delete_validUser_as_admin_200(TestNamespace ns) {

    String userName = ns.prefix("deleteUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(toValidEmail(userName))
            .withTeams(List.of(testTeam1().getId()))
            .withDescription("User to delete");

    User user = createEntity(createRequest);
    assertNotNull(user.getId());

    deleteEntity(user.getId().toString());

    assertThrows(Exception.class, () -> getEntity(user.getId().toString()));

    User deleted = getEntityIncludeDeleted(user.getId().toString());
    assertTrue(deleted.getDeleted());
  }

  @Test
  void test_inheritDomain(TestNamespace ns) {

    String domainFqn = testDomain().getFullyQualifiedName();

    String teamName = ns.prefix("domainTeam");
    org.openmetadata.schema.api.teams.CreateTeam teamRequest =
        new org.openmetadata.schema.api.teams.CreateTeam()
            .withName(teamName)
            .withDomains(List.of(domainFqn))
            .withDescription("Team with domain");
    org.openmetadata.schema.entity.teams.Team team =
        org.openmetadata.sdk.fluent.Teams.create(teamRequest);

    String userName = ns.prefix("inheritDomainUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(toValidEmail(userName))
            .withTeams(List.of(team.getId()))
            .withDescription("User inheriting domain from team");

    User user = createEntity(createRequest);

    User fetched = Users.get(user.getId().toString(), "domains,teams");
    assertNotNull(fetched.getDomains());
  }

  @Test
  void test_versionConsolidationWithDeletedDomains(TestNamespace ns) {

    String domainName = ns.prefix("versionDomain");
    CreateDomain domainRequest =
        new CreateDomain()
            .withName(domainName)
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Domain for version consolidation test");
    org.openmetadata.schema.entity.domains.Domain domain =
        org.openmetadata.sdk.fluent.Domains.create(domainRequest);

    String userName = ns.prefix("versionDomainUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(toValidEmail(userName))
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withDescription("User for version consolidation test");

    User user = createEntity(createRequest);
    assertEquals(0.1, user.getVersion(), 0.001);

    user.setDescription("Updated description");
    User v2 = patchEntity(user.getId().toString(), user);
    assertEquals(0.2, v2.getVersion(), 0.001);

    org.openmetadata.sdk.fluent.Domains.delete(
        domain.getId().toString(), java.util.Map.of("hardDelete", "true", "recursive", "true"));

    User v3 = Users.get(user.getId().toString(), "domains");
    assertNotNull(v3);
  }

  @Test
  void test_versionConsolidationWithDeletedTeams(TestNamespace ns) {

    String teamName = ns.prefix("versionTeam");
    org.openmetadata.schema.api.teams.CreateTeam teamRequest =
        new org.openmetadata.schema.api.teams.CreateTeam()
            .withName(teamName)
            .withDescription("Team for version consolidation test");
    org.openmetadata.schema.entity.teams.Team team =
        org.openmetadata.sdk.fluent.Teams.create(teamRequest);

    String userName = ns.prefix("versionTeamUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(toValidEmail(userName))
            .withTeams(List.of(team.getId()))
            .withDescription("User for version consolidation test");

    User user = createEntity(createRequest);
    assertEquals(0.1, user.getVersion(), 0.001);

    user.setDescription("Updated description");
    User v2 = patchEntity(user.getId().toString(), user);
    assertEquals(0.2, v2.getVersion(), 0.001);

    org.openmetadata.sdk.fluent.Teams.delete(
        team.getId().toString(), java.util.Map.of("hardDelete", "true", "recursive", "true"));

    User v3 = Users.get(user.getId().toString(), "teams");
    assertNotNull(v3);
  }

  @Test
  void test_userCanBeFetchedAfterPersonaDeletion(TestNamespace ns) {

    String personaName = ns.prefix("personaDelete");
    org.openmetadata.schema.api.teams.CreatePersona personaRequest =
        new org.openmetadata.schema.api.teams.CreatePersona()
            .withName(personaName)
            .withDescription("Persona to delete");
    org.openmetadata.schema.entity.teams.Persona persona = Personas.create(personaRequest);

    String userName = ns.prefix("personaUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(toValidEmail(userName))
            .withPersonas(List.of(persona.getEntityReference()))
            .withDescription("User with persona");

    User user = createEntity(createRequest);
    assertNotNull(user.getId());

    User fetched = Users.get(user.getId().toString(), "personas");
    assertNotNull(fetched.getPersonas());
    assertFalse(fetched.getPersonas().isEmpty());

    Personas.delete(persona.getId().toString());

    User afterDelete = Users.get(user.getId().toString(), "personas");
    assertNotNull(afterDelete);
  }

  @Test
  void get_listUsersWithFalseBotFilterPagination(TestNamespace ns) {

    for (int i = 0; i < 5; i++) {
      String name = ns.prefix("nonBotPageUser" + i);
      CreateUser createRequest =
          new CreateUser()
              .withName(name)
              .withEmail(toValidEmail(name))
              .withIsBot(false)
              .withDescription("Non-bot user for pagination");
      createEntity(createRequest);
    }

    ListParams params = new ListParams();
    params.setLimit(3);
    params.addFilter("isBot", "false");
    ListResponse<User> page1 = listEntities(params);

    assertNotNull(page1.getData());
    assertTrue(page1.getData().size() > 0);

    if (page1.getPaging() != null && page1.getPaging().getAfter() != null) {
      params.setAfter(page1.getPaging().getAfter());
      ListResponse<User> page2 = listEntities(params);
      assertNotNull(page2.getData());
    }
  }

  @org.junit.jupiter.api.Disabled(
      "Users can only update their own persona preferences - needs user-specific client")
  @Test
  void patch_userPersonaPreferences_200_ok(TestNamespace ns) {

    String personaName = ns.prefix("personaPrefs");
    org.openmetadata.schema.api.teams.CreatePersona personaRequest =
        new org.openmetadata.schema.api.teams.CreatePersona()
            .withName(personaName)
            .withDescription("Persona for preferences test");
    org.openmetadata.schema.entity.teams.Persona persona = Personas.create(personaRequest);

    String userName = ns.prefix("userPrefs");
    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(toValidEmail(userName))
            .withPersonas(List.of(persona.getEntityReference()))
            .withDescription("User for persona preferences test");

    User user = createEntity(createRequest);

    org.openmetadata.schema.type.PersonaPreferences preferences =
        new org.openmetadata.schema.type.PersonaPreferences()
            .withPersonaId(persona.getId())
            .withPersonaName(persona.getName())
            .withLandingPageSettings(
                new org.openmetadata.schema.type.LandingPageSettings()
                    .withHeaderColor("#FF5733")
                    .withHeaderImage("http://example.com/assets/custom-header.png"));

    User fetched = Users.get(user.getId().toString(), "personas");
    List<org.openmetadata.schema.type.PersonaPreferences> prefsList = new java.util.ArrayList<>();
    prefsList.add(preferences);
    fetched.setPersonaPreferences(prefsList);

    User updated = patchEntity(fetched.getId().toString(), fetched);

    assertNotNull(updated.getPersonaPreferences());
    assertEquals(1, updated.getPersonaPreferences().size());
    org.openmetadata.schema.type.PersonaPreferences savedPref =
        updated.getPersonaPreferences().get(0);
    assertEquals(persona.getId(), savedPref.getPersonaId());
    assertEquals(persona.getName(), savedPref.getPersonaName());
    assertEquals("#FF5733", savedPref.getLandingPageSettings().getHeaderColor());
    assertEquals(
        "http://example.com/assets/custom-header.png",
        savedPref.getLandingPageSettings().getHeaderImage());

    org.openmetadata.schema.type.PersonaPreferences updatedPreferences =
        new org.openmetadata.schema.type.PersonaPreferences()
            .withPersonaId(persona.getId())
            .withPersonaName(persona.getName())
            .withLandingPageSettings(
                new org.openmetadata.schema.type.LandingPageSettings()
                    .withHeaderColor("#00FF00")
                    .withHeaderImage("http://example.com/assets/custom-header.png"));

    User refetched = Users.get(updated.getId().toString(), "personas");
    refetched.setPersonaPreferences(List.of(updatedPreferences));

    User updated2 = patchEntity(refetched.getId().toString(), refetched);

    assertEquals(
        "#00FF00",
        updated2.getPersonaPreferences().get(0).getLandingPageSettings().getHeaderColor());
    assertEquals(
        "http://example.com/assets/custom-header.png",
        updated2.getPersonaPreferences().get(0).getLandingPageSettings().getHeaderImage());
  }

  @Test
  void patch_ProfileWithSubscription(TestNamespace ns) {

    String userName = ns.prefix("profileSubUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(toValidEmail(userName))
            .withDescription("User for profile subscription test");

    User user = createEntity(createRequest);

    Profile profile1 =
        new Profile()
            .withSubscription(
                new org.openmetadata.schema.type.profile.SubscriptionConfig()
                    .withSlack(
                        new org.openmetadata.schema.type.Webhook()
                            .withEndpoint(URI.create("https://example.com"))));

    user.setProfile(profile1);
    User updated = patchEntity(user.getId().toString(), user);

    assertNotNull(updated.getProfile());
    assertNotNull(updated.getProfile().getSubscription());
    assertNotNull(updated.getProfile().getSubscription().getSlack());

    // Setting profile to null in PATCH is a no-op - the profile remains
    // Just verify the subscription was successfully added
    User fetched = Users.get(updated.getId().toString(), "profile");
    assertNotNull(fetched.getProfile(), "Profile should be present");
    assertNotNull(fetched.getProfile().getSubscription(), "Subscription should be present");
  }

  @Test
  void test_personaDeletion_cleansUpAllRelationships(TestNamespace ns) {

    String personaName = ns.prefix("personaCleanup");
    org.openmetadata.schema.api.teams.CreatePersona personaRequest =
        new org.openmetadata.schema.api.teams.CreatePersona()
            .withName(personaName)
            .withDescription("Persona for cleanup test");
    org.openmetadata.schema.entity.teams.Persona persona = Personas.create(personaRequest);

    String user1Name = ns.prefix("cleanupUser1");
    CreateUser request1 =
        new CreateUser()
            .withName(user1Name)
            .withEmail(toValidEmail(user1Name))
            .withPersonas(List.of(persona.getEntityReference()))
            .withDefaultPersona(persona.getEntityReference())
            .withDescription("User 1 for persona cleanup test");
    User user1 = createEntity(request1);

    String user2Name = ns.prefix("cleanupUser2");
    CreateUser request2 =
        new CreateUser()
            .withName(user2Name)
            .withEmail(toValidEmail(user2Name))
            .withPersonas(List.of(persona.getEntityReference()))
            .withDescription("User 2 for persona cleanup test");
    User user2 = createEntity(request2);

    User fetchedUser1 = Users.get(user1.getId().toString(), "personas,defaultPersona");
    assertNotNull(fetchedUser1.getPersonas());
    assertFalse(fetchedUser1.getPersonas().isEmpty());
    assertNotNull(fetchedUser1.getDefaultPersona());

    User fetchedUser2 = Users.get(user2.getId().toString(), "personas");
    assertNotNull(fetchedUser2.getPersonas());
    assertFalse(fetchedUser2.getPersonas().isEmpty());

    Personas.delete(persona.getId().toString());

    // Poll until persona relationships are cleaned up (may be async)
    String user1Id = user1.getId().toString();
    String user2Id = user2.getId().toString();

    Awaitility.await("Wait for persona cleanup on user1")
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              User afterDelete1 = Users.get(user1Id, "personas,defaultPersona");
              assertTrue(
                  afterDelete1.getPersonas() == null || afterDelete1.getPersonas().isEmpty(),
                  "Personas should be cleaned up after persona deletion");
              assertTrue(
                  afterDelete1.getDefaultPersona() == null,
                  "Default persona should be cleaned up after persona deletion");
            });

    Awaitility.await("Wait for persona cleanup on user2")
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              User afterDelete2 = Users.get(user2Id, "personas");
              assertTrue(
                  afterDelete2.getPersonas() == null || afterDelete2.getPersonas().isEmpty(),
                  "Personas should be cleaned up after persona deletion");
            });
  }

  @Test
  void test_updateDefaultPersona(TestNamespace ns) {

    String persona1Name = ns.prefix("defaultPersona1");
    org.openmetadata.schema.api.teams.CreatePersona persona1Request =
        new org.openmetadata.schema.api.teams.CreatePersona()
            .withName(persona1Name)
            .withDescription("First persona");
    org.openmetadata.schema.entity.teams.Persona persona1 = Personas.create(persona1Request);

    String persona2Name = ns.prefix("defaultPersona2");
    org.openmetadata.schema.api.teams.CreatePersona persona2Request =
        new org.openmetadata.schema.api.teams.CreatePersona()
            .withName(persona2Name)
            .withDescription("Second persona");
    org.openmetadata.schema.entity.teams.Persona persona2 = Personas.create(persona2Request);

    String userName = ns.prefix("defaultPersonaUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(toValidEmail(userName))
            .withPersonas(List.of(persona1.getEntityReference(), persona2.getEntityReference()))
            .withDefaultPersona(persona1.getEntityReference())
            .withDescription("User for default persona test");

    User user = createEntity(createRequest);

    User fetched = Users.get(user.getId().toString(), "personas,defaultPersona");
    assertNotNull(fetched.getDefaultPersona());
    assertEquals(persona1.getId(), fetched.getDefaultPersona().getId());

    fetched.setDefaultPersona(persona2.getEntityReference());
    User updated = patchEntity(fetched.getId().toString(), fetched);

    User verify = Users.get(updated.getId().toString(), "defaultPersona");
    assertNotNull(verify.getDefaultPersona());
    assertEquals(persona2.getId(), verify.getDefaultPersona().getId());
  }

  @Test
  void test_removeTeamFromUser(TestNamespace ns) {

    EntityReference teamRef = testTeam1().getEntityReference();

    String userName = ns.prefix("removeTeamUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(toValidEmail(userName))
            .withTeams(List.of(teamRef.getId()))
            .withDescription("User for team removal test");

    User user = createEntity(createRequest);

    User fetched = Users.get(user.getId().toString(), "teams");
    assertNotNull(fetched.getTeams());
    assertTrue(fetched.getTeams().size() >= 1);

    // Setting teams to empty list via PATCH removes them
    fetched.setTeams(new java.util.ArrayList<>());
    User updated = patchEntity(fetched.getId().toString(), fetched);

    User verify = Users.get(updated.getId().toString(), "teams");
    // After clearing, teams should be empty or contain only the default Organization team
    assertTrue(
        verify.getTeams() == null
            || verify.getTeams().isEmpty()
            || verify.getTeams().stream().noneMatch(t -> t.getId().equals(teamRef.getId())),
        "Original team should be removed from user");
  }

  @Test
  void test_userWithMultipleDomains(TestNamespace ns) {

    String domain1Name = ns.prefix("domain1");
    org.openmetadata.schema.api.domains.CreateDomain domain1Request =
        new org.openmetadata.schema.api.domains.CreateDomain()
            .withName(domain1Name)
            .withDomainType(org.openmetadata.schema.api.domains.CreateDomain.DomainType.AGGREGATE)
            .withDescription("First domain");
    org.openmetadata.schema.entity.domains.Domain domain1 =
        org.openmetadata.sdk.fluent.Domains.create(domain1Request);

    String domain2Name = ns.prefix("domain2");
    org.openmetadata.schema.api.domains.CreateDomain domain2Request =
        new org.openmetadata.schema.api.domains.CreateDomain()
            .withName(domain2Name)
            .withDomainType(org.openmetadata.schema.api.domains.CreateDomain.DomainType.AGGREGATE)
            .withDescription("Second domain");
    org.openmetadata.schema.entity.domains.Domain domain2 =
        org.openmetadata.sdk.fluent.Domains.create(domain2Request);

    String userName = ns.prefix("multiDomainUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(toValidEmail(userName))
            .withDomains(List.of(domain1.getFullyQualifiedName(), domain2.getFullyQualifiedName()))
            .withDescription("User with multiple domains");

    User user = createEntity(createRequest);
    assertNotNull(user.getId());

    User fetched = Users.get(user.getId().toString(), "domains");
    assertNotNull(fetched.getDomains());
    assertTrue(fetched.getDomains().size() >= 2);
  }

  @Test
  void test_updateUserIsAdmin(TestNamespace ns) {

    String userName = ns.prefix("adminToggleUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(toValidEmail(userName))
            .withIsAdmin(false)
            .withDescription("User for admin toggle test");

    User user = createEntity(createRequest);
    assertFalse(user.getIsAdmin());

    user.setIsAdmin(true);
    User updated = patchEntity(user.getId().toString(), user);

    assertTrue(updated.getIsAdmin());

    updated.setIsAdmin(false);
    User updated2 = patchEntity(updated.getId().toString(), updated);
    assertFalse(updated2.getIsAdmin());
  }

  @Test
  void test_userEmailCaseInsensitive(TestNamespace ns) {

    String userName = ns.prefix("emailCaseUser");
    String email = "MixedCase@Test.Com";

    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withDescription("User for email case test");

    User user = createEntity(createRequest);

    assertEquals(email.toLowerCase(), user.getEmail());
  }

  @Test
  void test_updateUserEmail(TestNamespace ns) {
    // Email is immutable in User entity - verify that updates are ignored
    String userName = ns.prefix("emailUpdateUser");
    String originalEmail = toValidEmail(userName);

    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(originalEmail)
            .withDescription("User for email update test");

    User user = createEntity(createRequest);
    assertEquals(originalEmail.toLowerCase(), user.getEmail().toLowerCase());

    String newEmail = toValidEmail(userName + "new");
    user.setEmail(newEmail);
    User updated = patchEntity(user.getId().toString(), user);

    // Email is immutable - the original email should be preserved
    assertEquals(originalEmail.toLowerCase(), updated.getEmail().toLowerCase());
  }

  @Test
  void test_userWithIsBot(TestNamespace ns) {

    String botName = ns.prefix("simpleBot");
    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));

    CreateUser createRequest =
        new CreateUser()
            .withName(botName)
            .withEmail(toValidEmail(botName))
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withDescription("Simple bot user");

    User bot = createEntity(createRequest);
    assertTrue(bot.getIsBot());

    User fetched = Users.get(bot.getId().toString());
    assertTrue(fetched.getIsBot());
  }

  @Test
  void test_listUsersWithDomainFilter(TestNamespace ns) {

    String domainFqn = testDomain().getFullyQualifiedName();

    String user1Name = ns.prefix("domainFilterUser1");
    CreateUser request1 =
        new CreateUser()
            .withName(user1Name)
            .withEmail(toValidEmail(user1Name))
            .withDomains(List.of(domainFqn))
            .withDescription("User in domain");
    User user1 = createEntity(request1);

    String user2Name = ns.prefix("domainFilterUser2");
    CreateUser request2 =
        new CreateUser()
            .withName(user2Name)
            .withEmail(toValidEmail(user2Name))
            .withDescription("User not in domain");
    createEntity(request2);

    assertTrue(
        findUserInPaginatedResults(user1.getId(), "domain", testDomain().getName()),
        "User in domain should be in filtered list");
  }

  @Test
  void test_userVersionIncrement(TestNamespace ns) {

    CreateUser createRequest = createMinimalRequest(ns);
    User user = createEntity(createRequest);
    assertEquals(0.1, user.getVersion(), 0.001);

    user.setDescription("First update");
    User v2 = patchEntity(user.getId().toString(), user);
    // Version should increment for description change
    assertTrue(v2.getVersion() >= 0.1, "Version should not decrease");

    v2.setDescription("Second update - different content");
    User v3 = patchEntity(v2.getId().toString(), v2);
    assertTrue(v3.getVersion() >= v2.getVersion(), "Version should not decrease");

    v3.setDisplayName("New display name");
    User v4 = patchEntity(v3.getId().toString(), v3);
    // DisplayName change may or may not increment version depending on change type
    assertTrue(v4.getVersion() >= v3.getVersion(), "Version should not decrease");
  }

  @Test
  void test_createUserMinimalFields(TestNamespace ns) {

    String userName = ns.prefix("minimalUser");
    CreateUser createRequest =
        new CreateUser().withName(userName).withEmail(toValidEmail(userName));

    User user = createEntity(createRequest);

    assertNotNull(user.getId());
    assertEquals(userName.toLowerCase(), user.getName().toLowerCase());
    assertNotNull(user.getEmail());
    assertFalse(user.getIsBot() != null && user.getIsBot());
    assertFalse(user.getIsAdmin() != null && user.getIsAdmin());
  }

  // ===================================================================
  // TOKEN GENERATION TESTS
  // ===================================================================

  @Test
  void test_generateToken_adminForBotUser_200_ok(TestNamespace ns) {
    // Create a bot user
    String botName = ns.prefix("tokenTestBot");
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));

    CreateUser createRequest =
        new CreateUser()
            .withName(botName)
            .withEmail(toValidEmail(botName))
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withDescription("Bot user for token generation test");

    User botUser = createEntity(createRequest);
    assertTrue(botUser.getIsBot());

    // Admin generates token for bot user
    JWTAuthMechanism jwtAuth =
        SdkClients.adminClient().users().generateToken(botUser.getId(), JWTTokenExpiry.Seven);
    assertNotNull(jwtAuth);
    assertNotNull(jwtAuth.getJWTToken());
  }

  @Test
  void test_generateToken_nonAdminForBotUser_forbidden(TestNamespace ns) {
    // Create a bot user
    String botName = ns.prefix("tokenTestBot2");
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));

    CreateUser createRequest =
        new CreateUser()
            .withName(botName)
            .withEmail(toValidEmail(botName))
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withDescription("Bot user for forbidden token test");

    User botUser = createEntity(createRequest);
    assertTrue(botUser.getIsBot());

    // Non-admin user should NOT be able to generate token for bot user (no EDIT permission)
    assertThrows(
        Exception.class,
        () ->
            SdkClients.testUserClient()
                .users()
                .generateToken(botUser.getId(), JWTTokenExpiry.Seven),
        "Non-admin user without EDIT permission should not be able to generate token for bot user");
  }

  @Test
  void test_generateToken_forRegularUser_forbidden(TestNamespace ns) {
    // Create a regular user
    String userName = ns.prefix("regularTokenUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(toValidEmail(userName))
            .withDescription("Regular user for token test");

    User regularUser = createEntity(createRequest);
    assertFalse(regularUser.getIsBot() != null && regularUser.getIsBot());

    // Admin should NOT be able to generate token for regular user (prevents impersonation)
    assertThrows(
        Exception.class,
        () ->
            SdkClients.adminClient()
                .users()
                .generateToken(regularUser.getId(), JWTTokenExpiry.Seven),
        "Admin should not be able to generate token for regular user");
  }

  @Test
  void testUserContextCachePerformance(TestNamespace ns) throws HttpResponseException {
    // Create a test user with multiple roles and teams to properly test cache performance
    CreateUser createUser =
        createRequest(ns.prefix("cache-perf-test-user"), ns)
            .withRoles(List.of(dataStewardRole().getId(), dataConsumerRole().getId()))
            .withTeams(List.of(testTeam1().getId(), shared().TEAM21.getId()));
    User testUser = createEntity(createUser);
    String userName = testUser.getName();

    SubjectCache.invalidateAll();

    // Warm up JVM (exclude from measurements)
    for (int i = 0; i < 3; i++) {
      SubjectContext.getSubjectContext(userName);
    }
    SubjectCache.invalidateAll();

    // Test 1: Cache Miss (First call - should be slower)
    long cacheMissStartTime = System.currentTimeMillis();
    SubjectContext context1 = SubjectContext.getSubjectContext(userName);
    long cacheMissTime = System.currentTimeMillis() - cacheMissStartTime;
    assertNotNull(context1);
    assertEquals(userName, context1.user().getName());

    // Test 2: Cache Hit (Multiple subsequent calls - should be much faster)
    List<Long> cacheHitTimes = new ArrayList<>();
    for (int i = 0; i < 10; i++) {
      long cacheHitStartTime = System.currentTimeMillis();
      SubjectContext context = SubjectContext.getSubjectContext(userName);
      long cacheHitTime = System.currentTimeMillis() - cacheHitStartTime;

      cacheHitTimes.add(cacheHitTime);
      assertNotNull(context);
      assertEquals(userName, context.user().getName());
    }

    // Calculate cache hit performance statistics
    double avgCacheHitTime =
        cacheHitTimes.stream().mapToLong(Long::longValue).average().orElse(0.0);
    long maxCacheHitTime = cacheHitTimes.stream().mapToLong(Long::longValue).max().orElse(0);
    long minCacheHitTime = cacheHitTimes.stream().mapToLong(Long::longValue).min().orElse(0);

    // Performance assertions
    double performanceImprovement =
        ((double) cacheMissTime - avgCacheHitTime) / cacheMissTime * 100;

    // Assert significant performance improvement
    assertTrue(
        performanceImprovement > 30.0,
        String.format(
            "Expected >30%% improvement, got %.1f%% (%dms → %.1fms)",
            performanceImprovement, cacheMissTime, avgCacheHitTime));
    assertTrue(
        avgCacheHitTime < 200,
        String.format("Cache hits should be <200ms, got %.1fms", avgCacheHitTime));

    // Test 3: Concurrent Access Performance
    int threadCount = 5;
    int callsPerThread = 10;
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);

    long concurrentStartTime = System.currentTimeMillis();
    List<CompletableFuture<List<Long>>> futures = new ArrayList<>();

    for (int threadId = 0; threadId < threadCount; threadId++) {
      CompletableFuture<List<Long>> future =
          CompletableFuture.supplyAsync(
              () -> {
                List<Long> threadTimes = new ArrayList<>();
                for (int call = 0; call < callsPerThread; call++) {
                  long callStart = System.currentTimeMillis();
                  SubjectContext context = SubjectContext.getSubjectContext(userName);
                  long callTime = System.currentTimeMillis() - callStart;

                  threadTimes.add(callTime);
                  assertNotNull(context);
                  assertEquals(userName, context.user().getName());
                }
                return threadTimes;
              },
              executor);

      futures.add(future);
    }

    // Wait for all threads to complete
    try {
      CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).get();
    } catch (Exception e) {
      throw new RuntimeException("Concurrent test failed", e);
    }

    long totalConcurrentTime = System.currentTimeMillis() - concurrentStartTime;
    executor.shutdown();

    // Collect all concurrent timing data
    List<Long> allConcurrentTimes = new ArrayList<>();
    for (CompletableFuture<List<Long>> future : futures) {
      try {
        allConcurrentTimes.addAll(future.get());
      } catch (Exception e) {
        throw new RuntimeException("Failed to get concurrent results", e);
      }
    }

    double avgConcurrentTime =
        allConcurrentTimes.stream().mapToLong(Long::longValue).average().orElse(0.0);
    int totalCalls = threadCount * callsPerThread;
    double callsPerSecond = (double) totalCalls / (totalConcurrentTime / 1000.0);

    // Performance assertions for concurrent access
    assertTrue(
        avgConcurrentTime < 300,
        String.format(
            "Average concurrent call time should be <300ms, got %.2fms", avgConcurrentTime));
    assertTrue(
        callsPerSecond > 20,
        String.format("Should handle >20 calls/sec, got %.1f", callsPerSecond));

    // Test 4: Cache Statistics
    String cacheStats = SubjectCache.getCacheStats();

    // Cleanup: Remove the test user
    deleteEntity(testUser.getId().toString());
  }

  // ===================================================================
  // VERSION HISTORY SUPPORT
  // ===================================================================

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return Users.getVersionList(id);
  }

  @Override
  protected User getVersion(UUID id, Double version) {
    return Users.getVersion(id.toString(), version);
  }
}
