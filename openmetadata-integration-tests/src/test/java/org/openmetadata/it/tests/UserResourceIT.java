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
