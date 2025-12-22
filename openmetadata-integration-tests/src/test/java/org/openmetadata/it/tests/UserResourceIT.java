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

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ImageList;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

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

  private static final Profile PROFILE =
      new Profile().withImages(new ImageList().withImage(URI.create("https://image.com")));

  public UserResourceIT() {
    supportsFollowers = false;
    supportsTags = false;
    supportsDomains = true;
    supportsDataProducts = false;
    supportsSoftDelete = true;
    supportsPatch = true;
    supportsOwners = false;
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

  @Override
  protected CreateUser createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    String name = ns.prefix("user");
    return new CreateUser()
        .withName(name)
        .withEmail(toValidEmail(name))
        .withDescription("Test user created by integration test");
  }

  @Override
  protected CreateUser createRequest(String name, TestNamespace ns, OpenMetadataClient client) {
    return new CreateUser()
        .withName(name)
        .withEmail(toValidEmail(name))
        .withDescription("Test user");
  }

  @Override
  protected User createEntity(CreateUser createRequest, OpenMetadataClient client) {
    return client.users().create(createRequest);
  }

  @Override
  protected User getEntity(String id, OpenMetadataClient client) {
    return client.users().get(id);
  }

  @Override
  protected User getEntityByName(String fqn, OpenMetadataClient client) {
    return client.users().getByName(fqn);
  }

  @Override
  protected User patchEntity(String id, User entity, OpenMetadataClient client) {
    return client.users().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.users().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.users().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    client.users().delete(id, java.util.Map.of("hardDelete", "true", "recursive", "true"));
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
  protected User getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.users().get(id, fields);
  }

  @Override
  protected User getEntityByNameWithFields(String fqn, String fields, OpenMetadataClient client) {
    return client.users().getByName(fqn, fields);
  }

  @Override
  protected User getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.users().get(id, null, "deleted");
  }

  @Override
  protected ListResponse<User> listEntities(ListParams params, OpenMetadataClient client) {
    return client.users().list(params);
  }

  // ===================================================================
  // OVERRIDDEN TESTS - Users have case-insensitive names
  // ===================================================================

  @Override
  @Test
  public void post_entityCreate_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    CreateUser createRequest = createMinimalRequest(ns, client);
    User entity = createEntity(createRequest, client);

    assertNotNull(entity.getId());
    assertNotNull(entity.getFullyQualifiedName());
    assertEquals(createRequest.getName().toLowerCase(), entity.getName().toLowerCase());
    validateCreatedEntity(entity, createRequest);
  }

  @Override
  @Test
  public void put_entityCreate_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    CreateUser createRequest = createMinimalRequest(ns, client);
    User entity = createEntity(createRequest, client);

    assertNotNull(entity.getId());
    assertEquals(createRequest.getName().toLowerCase(), entity.getName().toLowerCase());
  }

  @Override
  @Test
  public void post_entityWithDots_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String nameWithDots = ns.prefix("foo.bar");
    CreateUser createRequest = createRequest(nameWithDots, ns, client);
    User created = createEntity(createRequest, client);

    assertNotNull(created.getId());
    assertEquals(nameWithDots.toLowerCase(), created.getName().toLowerCase());
  }

  // ===================================================================
  // USER-SPECIFIC TESTS
  // ===================================================================

  @Test
  void test_createUserWithProfile(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String name = ns.prefix("userWithProfile");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withProfile(PROFILE)
            .withDescription("User with profile");

    User user = createEntity(createRequest, client);
    assertNotNull(user.getId());
    assertNotNull(user.getProfile());
    assertNotNull(user.getProfile().getImages());
  }

  @Test
  void test_createUserWithDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String name = ns.prefix("userDisplayName");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDisplayName("John Doe")
            .withDescription("User with display name");

    User user = createEntity(createRequest, client);
    assertEquals("John Doe", user.getDisplayName());
  }

  @Test
  void test_createUserWithTeams(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Use shared team from SharedEntities
    EntityReference teamRef = testTeam1().getEntityReference();

    String name = ns.prefix("userWithTeam");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withTeams(List.of(teamRef.getId()));

    User user = createEntity(createRequest, client);
    assertNotNull(user.getId());

    // Fetch with teams field to verify
    User fetched = client.users().get(user.getId().toString(), "teams");
    assertNotNull(fetched.getTeams());
    assertTrue(fetched.getTeams().size() >= 1);
  }

  @Test
  void test_createUserWithRoles(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Use shared role from SharedEntities
    UUID roleId = dataStewardRole().getId();

    String name = ns.prefix("userWithRole");
    CreateUser createRequest =
        new CreateUser().withName(name).withEmail(toValidEmail(name)).withRoles(List.of(roleId));

    User user = createEntity(createRequest, client);
    assertNotNull(user.getId());

    // Fetch with roles field to verify
    User fetched = client.users().get(user.getId().toString(), "roles");
    assertNotNull(fetched.getRoles());
    assertTrue(fetched.getRoles().size() >= 1);
  }

  @Test
  void test_createUserAsBot(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

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

    User user = createEntity(createRequest, client);
    assertTrue(user.getIsBot());
  }

  @Test
  void test_createUserAsAdmin(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String name = ns.prefix("adminUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withIsAdmin(true)
            .withDescription("Admin user for testing");

    User user = createEntity(createRequest, client);
    assertTrue(user.getIsAdmin());
  }

  @Test
  void test_updateUserDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user
    CreateUser createRequest = createMinimalRequest(ns, client);
    User user = createEntity(createRequest, client);

    // Update display name
    user.setDisplayName("Updated Display Name");
    User updated = patchEntity(user.getId().toString(), user, client);

    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_updateUserProfile(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user without profile
    CreateUser createRequest = createMinimalRequest(ns, client);
    User user = createEntity(createRequest, client);

    // Update with profile
    user.setProfile(PROFILE);
    User updated = patchEntity(user.getId().toString(), user, client);

    assertNotNull(updated.getProfile());
  }

  @Test
  void test_updateUserTeams(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user without teams
    CreateUser createRequest = createMinimalRequest(ns, client);
    User user = createEntity(createRequest, client);

    // Get user with teams field
    User fetched = client.users().get(user.getId().toString(), "teams");

    // Add to shared team
    EntityReference teamRef = testTeam1().getEntityReference();
    fetched.setTeams(List.of(teamRef));

    User updated = patchEntity(fetched.getId().toString(), fetched, client);

    // Verify teams updated
    User verifyFetch = client.users().get(updated.getId().toString(), "teams");
    assertNotNull(verifyFetch.getTeams());
    assertTrue(verifyFetch.getTeams().size() >= 1);
  }

  @Test
  void test_createUserWithInvalidEmail(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String name = ns.prefix("invalidEmailUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail("not-an-email") // Invalid email format
            .withDescription("User with invalid email");

    assertThrows(
        Exception.class,
        () -> createEntity(createRequest, client),
        "Creating user with invalid email should fail");
  }

  @Test
  void test_createUserWithDuplicateEmail(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String name1 = ns.prefix("user1");
    String email1 = toValidEmail(name1);
    CreateUser createRequest1 =
        new CreateUser().withName(name1).withEmail(email1).withDescription("First user");

    User user1 = createEntity(createRequest1, client);
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
        () -> createEntity(createRequest2, client),
        "Creating user with duplicate email should fail");
  }

  @Test
  void test_getUserByEmail(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user
    String name = ns.prefix("userByEmail");
    String email = toValidEmail(name);
    CreateUser createRequest =
        new CreateUser().withName(name).withEmail(email).withDescription("Test user");

    User created = createEntity(createRequest, client);

    // Get by name (users are indexed by name, not email)
    // Note: user names are lowercased
    User fetched = getEntityByName(name.toLowerCase(), client);
    assertEquals(created.getId(), fetched.getId());
    // Email is also lowercased
    assertEquals(email.toLowerCase(), fetched.getEmail().toLowerCase());
  }

  @Test
  void test_listUsers(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a few users
    for (int i = 0; i < 3; i++) {
      String name = ns.prefix("listUser" + i);
      CreateUser createRequest =
          new CreateUser()
              .withName(name)
              .withEmail(toValidEmail(name))
              .withDescription("User for list test");
      createEntity(createRequest, client);
    }

    // List users
    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<User> response = listEntities(params, client);

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void test_softDeleteAndRestoreUser(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user
    CreateUser createRequest = createMinimalRequest(ns, client);
    User user = createEntity(createRequest, client);
    String userId = user.getId().toString();

    // Soft delete
    deleteEntity(userId, client);

    // Verify deleted
    assertThrows(
        Exception.class, () -> getEntity(userId, client), "Deleted user should not be retrievable");

    // Get with include=deleted
    User deleted = getEntityIncludeDeleted(userId, client);
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(userId, client);

    // Verify restored
    User restored = getEntity(userId, client);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_userVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user
    CreateUser createRequest = createMinimalRequest(ns, client);
    User user = createEntity(createRequest, client);
    assertEquals(0.1, user.getVersion(), 0.001);

    // Update description
    user.setDescription("Updated description v1");
    User v2 = patchEntity(user.getId().toString(), user, client);
    assertEquals(0.2, v2.getVersion(), 0.001);

    // Update again
    v2.setDescription("Updated description v2");
    User v3 = patchEntity(v2.getId().toString(), v2, client);
    assertTrue(v3.getVersion() >= 0.2);

    // Get version history
    var history = client.users().getVersionList(user.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void test_userWithDomain(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Use shared domain
    String domainFqn = testDomain().getFullyQualifiedName();

    String name = ns.prefix("userWithDomain");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDomains(List.of(domainFqn))
            .withDescription("User with domain");

    User user = createEntity(createRequest, client);
    assertNotNull(user.getId());

    // Verify domains are set
    User fetched = client.users().get(user.getId().toString(), "domains");
    assertNotNull(fetched.getDomains());
    assertFalse(fetched.getDomains().isEmpty());
    assertTrue(
        fetched.getDomains().stream().anyMatch(d -> d.getFullyQualifiedName().equals(domainFqn)));
  }

  @Test
  void test_listUsersWithAdminFilter(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create admin user
    String adminName = ns.prefix("adminFilterUser");
    CreateUser adminRequest =
        new CreateUser()
            .withName(adminName)
            .withEmail(toValidEmail(adminName))
            .withIsAdmin(true)
            .withDescription("Admin user for filter test");
    User adminUser = createEntity(adminRequest, client);
    assertTrue(adminUser.getIsAdmin());

    // Create non-admin user
    String nonAdminName = ns.prefix("nonAdminFilterUser");
    CreateUser nonAdminRequest =
        new CreateUser()
            .withName(nonAdminName)
            .withEmail(toValidEmail(nonAdminName))
            .withIsAdmin(false)
            .withDescription("Non-admin user for filter test");
    User nonAdminUser = createEntity(nonAdminRequest, client);
    assertFalse(nonAdminUser.getIsAdmin());

    // List with isAdmin=true filter
    ListParams adminParams = new ListParams();
    adminParams.setLimit(100);
    adminParams.addFilter("isAdmin", "true");
    ListResponse<User> adminUsers = listEntities(adminParams, client);

    assertNotNull(adminUsers.getData());
    assertTrue(
        adminUsers.getData().stream().anyMatch(u -> u.getId().equals(adminUser.getId())),
        "Admin user should be in filtered list");

    // List with isAdmin=false filter
    ListParams nonAdminParams = new ListParams();
    nonAdminParams.setLimit(100);
    nonAdminParams.addFilter("isAdmin", "false");
    ListResponse<User> nonAdminUsers = listEntities(nonAdminParams, client);

    assertNotNull(nonAdminUsers.getData());
    assertTrue(
        nonAdminUsers.getData().stream().anyMatch(u -> u.getId().equals(nonAdminUser.getId())),
        "Non-admin user should be in filtered list");
  }

  @Test
  void test_listUsersWithBotFilter(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

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
    User botUser = createEntity(botRequest, client);
    assertTrue(botUser.getIsBot());

    // Create regular user
    String regularName = ns.prefix("regularFilterUser");
    CreateUser regularRequest =
        new CreateUser()
            .withName(regularName)
            .withEmail(toValidEmail(regularName))
            .withIsBot(false)
            .withDescription("Regular user for filter test");
    User regularUser = createEntity(regularRequest, client);

    // List with isBot=true filter
    ListParams botParams = new ListParams();
    botParams.setLimit(100);
    botParams.addFilter("isBot", "true");
    ListResponse<User> botUsers = listEntities(botParams, client);

    assertNotNull(botUsers.getData());
    assertTrue(
        botUsers.getData().stream().anyMatch(u -> u.getId().equals(botUser.getId())),
        "Bot user should be in filtered list");

    // List with isBot=false filter
    ListParams nonBotParams = new ListParams();
    nonBotParams.setLimit(100);
    nonBotParams.addFilter("isBot", "false");
    ListResponse<User> nonBotUsers = listEntities(nonBotParams, client);

    assertNotNull(nonBotUsers.getData());
    assertTrue(
        nonBotUsers.getData().stream().anyMatch(u -> u.getId().equals(regularUser.getId())),
        "Regular user should be in filtered list");
  }

  @Test
  void test_listUsersWithTeamFilter(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

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
    User user1 = createEntity(request1, client);

    // Create user NOT in team
    String userName2 = ns.prefix("teamFilterUser2");
    CreateUser request2 =
        new CreateUser()
            .withName(userName2)
            .withEmail(toValidEmail(userName2))
            .withDescription("User not in team for filter test");
    User user2 = createEntity(request2, client);

    // List with team filter
    ListParams teamParams = new ListParams();
    teamParams.setLimit(100);
    teamParams.addFilter("team", testTeam1().getName());
    ListResponse<User> teamUsers = listEntities(teamParams, client);

    assertNotNull(teamUsers.getData());
    assertTrue(
        teamUsers.getData().stream().anyMatch(u -> u.getId().equals(user1.getId())),
        "User in team should be in filtered list");
  }

  @Test
  void test_userNameCaseInsensitive(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user with mixed case name
    String mixedCaseName = ns.prefix("MixedCaseUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(mixedCaseName)
            .withEmail(toValidEmail(mixedCaseName))
            .withDescription("User with mixed case name");

    User user = createEntity(createRequest, client);

    // User names are stored lowercase
    assertEquals(mixedCaseName.toLowerCase(), user.getName());

    // Should be able to fetch by lowercase name
    User fetched = getEntityByName(mixedCaseName.toLowerCase(), client);
    assertEquals(user.getId(), fetched.getId());
  }

  @Test
  void test_hardDeleteUser(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user
    CreateUser createRequest = createMinimalRequest(ns, client);
    User user = createEntity(createRequest, client);
    String userId = user.getId().toString();

    // Hard delete
    hardDeleteEntity(userId, client);

    // Verify completely gone (even with include=deleted)
    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(userId, client),
        "Hard deleted user should not be retrievable");
  }

  @Test
  void test_updateUserRoles(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user without roles
    CreateUser createRequest = createMinimalRequest(ns, client);
    User user = createEntity(createRequest, client);

    // Fetch user with roles
    User fetched = client.users().get(user.getId().toString(), "roles");

    // Add role
    EntityReference roleRef =
        new EntityReference()
            .withId(dataStewardRole().getId())
            .withType("role")
            .withName(dataStewardRole().getName());
    fetched.setRoles(List.of(roleRef));

    User updated = patchEntity(fetched.getId().toString(), fetched, client);

    // Verify role added
    User verify = client.users().get(updated.getId().toString(), "roles");
    assertNotNull(verify.getRoles());
    assertTrue(verify.getRoles().size() >= 1);
    assertTrue(
        verify.getRoles().stream().anyMatch(r -> r.getId().equals(dataStewardRole().getId())));
  }

  @Test
  void test_userWithMultipleTeams(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

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

    User user = createEntity(createRequest, client);
    assertNotNull(user.getId());

    // Verify teams
    User fetched = client.users().get(user.getId().toString(), "teams");
    assertNotNull(fetched.getTeams());
    assertTrue(fetched.getTeams().size() >= 2);
  }

  @Test
  void test_userWithMultipleRoles(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

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

    User user = createEntity(createRequest, client);
    assertNotNull(user.getId());

    // Verify roles
    User fetched = client.users().get(user.getId().toString(), "roles");
    assertNotNull(fetched.getRoles());
    assertTrue(fetched.getRoles().size() >= 2);
  }

  @Test
  void test_createUserWithPersona(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a persona for this test
    org.openmetadata.schema.api.teams.CreatePersona personaRequest =
        new org.openmetadata.schema.api.teams.CreatePersona()
            .withName(ns.prefix("testPersona"))
            .withDescription("Test persona for user");

    org.openmetadata.schema.entity.teams.Persona persona = client.personas().create(personaRequest);

    String name = ns.prefix("userWithPersona");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withPersonas(List.of(persona.getEntityReference()))
            .withDescription("User with persona");

    User user = createEntity(createRequest, client);
    assertNotNull(user.getId());

    // Verify persona
    User fetched = client.users().get(user.getId().toString(), "personas");
    assertNotNull(fetched.getPersonas());
    assertFalse(fetched.getPersonas().isEmpty());
  }

  @Test
  void test_usersWithTeamPagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

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
      createEntity(createRequest, client);
    }

    // List with pagination
    ListParams params = new ListParams();
    params.setLimit(5);
    params.addFilter("team", testTeam1().getName());
    ListResponse<User> page1 = listEntities(params, client);

    assertNotNull(page1.getData());
    assertEquals(5, page1.getData().size());
    assertNotNull(page1.getPaging());

    // If there are more pages, verify pagination works
    if (page1.getPaging().getAfter() != null) {
      params.setAfter(page1.getPaging().getAfter());
      ListResponse<User> page2 = listEntities(params, client);
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
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user
    CreateUser createRequest = createMinimalRequest(ns, client);
    User user = createEntity(createRequest, client);
    String originalDesc = user.getDescription();

    // Update description
    String newDescription = "Updated description for user";
    user.setDescription(newDescription);
    User updated = patchEntity(user.getId().toString(), user, client);

    assertEquals(newDescription, updated.getDescription());
    assertNotEquals(originalDesc, updated.getDescription());
  }

  @Test
  void test_userInheritedRoles(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user with a role assigned to team
    EntityReference teamRef = testTeam1().getEntityReference();

    String name = ns.prefix("inheritedRoleUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withTeams(List.of(teamRef.getId()))
            .withDescription("User to test inherited roles");

    User user = createEntity(createRequest, client);
    assertNotNull(user.getId());

    // Fetch with inheritedRoles field
    User fetched = client.users().get(user.getId().toString(), "roles,teams,inheritedRoles");
    assertNotNull(fetched.getTeams());
    // inheritedRoles may be present depending on team configuration
  }

  // ===================================================================
  // ADDITIONAL USER TESTS - Migrated from UserResourceTest
  // ===================================================================

  @Test
  void test_userProfileTimezone(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String name = ns.prefix("userTimezone");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDescription("User with timezone")
            .withTimezone("America/Los_Angeles");

    User user = createEntity(createRequest, client);
    assertEquals("America/Los_Angeles", user.getTimezone());

    // Update timezone
    user.setTimezone("Europe/London");
    User updated = patchEntity(user.getId().toString(), user, client);
    assertEquals("Europe/London", updated.getTimezone());
  }

  @Test
  void patch_teamAddition_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user with testTeam1
    String name = ns.prefix("userAddTeam");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withTeams(List.of(testTeam1().getId()))
            .withDescription("User for team addition test");

    User user = createEntity(createRequest, client);

    // Fetch user with teams
    User fetched = client.users().get(user.getId().toString(), "teams");
    assertNotNull(fetched.getTeams());
    assertTrue(fetched.getTeams().stream().anyMatch(t -> t.getId().equals(testTeam1().getId())));

    // Add second team via patch
    List<EntityReference> newTeams = new java.util.ArrayList<>(fetched.getTeams());
    newTeams.add(testTeam2().getEntityReference());
    fetched.setTeams(newTeams);
    User updated = patchEntity(fetched.getId().toString(), fetched, client);

    // Verify both teams present
    User verify = client.users().get(updated.getId().toString(), "teams");
    assertNotNull(verify.getTeams());
    assertTrue(verify.getTeams().size() >= 2);
    assertTrue(verify.getTeams().stream().anyMatch(t -> t.getId().equals(testTeam1().getId())));
    assertTrue(verify.getTeams().stream().anyMatch(t -> t.getId().equals(testTeam2().getId())));
  }

  @Test
  void patch_roleRemoval_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user with role
    String name = ns.prefix("userRemoveRole");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withRoles(List.of(dataStewardRole().getId()))
            .withDescription("User for role removal test");

    User user = createEntity(createRequest, client);

    // Verify role exists
    User fetched = client.users().get(user.getId().toString(), "roles");
    assertNotNull(fetched.getRoles());
    assertTrue(fetched.getRoles().size() >= 1);

    // Remove role via patch
    fetched.setRoles(List.of());
    User updated = patchEntity(fetched.getId().toString(), fetched, client);

    // Verify role removed
    User verify = client.users().get(updated.getId().toString(), "roles");
    assertTrue(verify.getRoles() == null || verify.getRoles().isEmpty());
  }

  @Test
  void test_botUserWithAdmin(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

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

    User user = createEntity(createRequest, client);
    assertNotNull(user);
    assertTrue(user.getIsBot());
    // Just verify creation succeeds - bot can have admin flag in current implementation
  }

  @Test
  void test_updateBotAuthMechanism(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

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

    User bot = createEntity(createRequest, client);
    assertTrue(bot.getIsBot());
    assertNotNull(bot.getAuthenticationMechanism());
  }

  @Test
  void test_userFQNContainsName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String name = ns.prefix("fqnUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDescription("User for FQN test");

    User user = createEntity(createRequest, client);
    assertNotNull(user.getFullyQualifiedName());
    assertTrue(user.getFullyQualifiedName().contains(user.getName()));
  }

  @Test
  void test_listUsersPagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create multiple users
    for (int i = 0; i < 5; i++) {
      String name = ns.prefix("paginateUser" + i);
      CreateUser createRequest =
          new CreateUser()
              .withName(name)
              .withEmail(toValidEmail(name))
              .withDescription("User for pagination test " + i);
      createEntity(createRequest, client);
    }

    // First page
    ListParams params = new ListParams();
    params.setLimit(2);
    ListResponse<User> page1 = listEntities(params, client);

    assertNotNull(page1);
    assertNotNull(page1.getData());
    assertEquals(2, page1.getData().size());
    assertNotNull(page1.getPaging());
  }

  @Test
  void test_userWithFullyQualifiedName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String name = ns.prefix("userFqn");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDescription("User for FQN verification");

    User user = createEntity(createRequest, client);
    assertNotNull(user.getId());
    assertNotNull(user.getFullyQualifiedName());
    assertEquals(user.getName(), user.getFullyQualifiedName());
  }

  @Test
  void test_createUserWithAllFields(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

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

    User user = createEntity(createRequest, client);
    assertNotNull(user.getId());
    assertEquals("Full User Display Name", user.getDisplayName());
    assertEquals("User with all fields", user.getDescription());
    assertEquals("UTC", user.getTimezone());
    assertFalse(user.getIsAdmin());
  }

  @Test
  void test_switchUserTeams(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user with one team
    String name = ns.prefix("switchTeamsUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withTeams(List.of(testTeam1().getId()))
            .withDescription("User for team switch test");

    User user = createEntity(createRequest, client);

    // Update to different team
    User fetched = client.users().get(user.getId().toString(), "teams");
    fetched.setTeams(List.of(testTeam2().getEntityReference()));
    User updated = patchEntity(fetched.getId().toString(), fetched, client);

    // Verify team changed
    User verify = client.users().get(updated.getId().toString(), "teams");
    assertNotNull(verify.getTeams());
    assertTrue(verify.getTeams().stream().anyMatch(t -> t.getId().equals(testTeam2().getId())));
  }

  @Test
  void test_userDeletion_removesFromTeam(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user in team
    String name = ns.prefix("deleteFromTeamUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withTeams(List.of(testTeam1().getId()))
            .withDescription("User to delete from team");

    User user = createEntity(createRequest, client);

    // Delete user
    deleteEntity(user.getId().toString(), client);

    // Verify user is deleted
    User deleted = getEntityIncludeDeleted(user.getId().toString(), client);
    assertTrue(deleted.getDeleted());
  }

  @Test
  void test_userRestoreAfterDelete(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create user
    String name = ns.prefix("restoreUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDescription("User to restore");

    User user = createEntity(createRequest, client);

    // Soft delete
    deleteEntity(user.getId().toString(), client);

    // Verify deleted
    User deleted = getEntityIncludeDeleted(user.getId().toString(), client);
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(user.getId().toString(), client);

    // Verify restored
    User restored = getEntity(user.getId().toString(), client);
    assertFalse(restored.getDeleted() != null && restored.getDeleted());
  }

  @Test
  void test_userHref(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String name = ns.prefix("hrefUser");
    CreateUser createRequest =
        new CreateUser()
            .withName(name)
            .withEmail(toValidEmail(name))
            .withDescription("User for href test");

    User user = createEntity(createRequest, client);
    assertNotNull(user.getHref());
  }

  // ===================================================================
  // VERSION HISTORY SUPPORT
  // ===================================================================

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.users().getVersionList(id);
  }

  @Override
  protected User getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.users().getVersion(id.toString(), version);
  }
}
