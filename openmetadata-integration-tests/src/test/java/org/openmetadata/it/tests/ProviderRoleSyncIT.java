package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.Entity.ADMIN_ROLE;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.UserUtil;

/**
 * Exercises the useRolesFromProvider sync against a real database. Each test applies what an
 * identity provider's token granted, the way the OIDC callback and /users/loggedInUser do, and
 * asserts on the user the API then returns.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class ProviderRoleSyncIT {

  private static final AuthorizerConfiguration NO_CONFIGURED_ADMINS = new AuthorizerConfiguration();

  @Test
  void providerGrantingNoRolesRevokesRolesAndAdmin(TestNamespace ns) {
    // Entra ID once a user's Admin and DataSteward app roles are both removed: no roles claim.
    User user = createUser(ns, true, "DataSteward");

    syncFromProvider(user, Set.of(), NO_CONFIGURED_ADMINS);

    User stored = storedUser(user);
    assertFalse(stored.getIsAdmin());
    assertEquals(List.of(), roleNames(stored));
  }

  @Test
  void providerDroppingOnlyTheAdminRoleDemotesAndKeepsTheRest(TestNamespace ns) {
    User user = createUser(ns, true, "DataSteward");

    syncFromProvider(user, Set.of("DataSteward"), NO_CONFIGURED_ADMINS);

    User stored = storedUser(user);
    assertFalse(stored.getIsAdmin());
    assertEquals(List.of("DataSteward"), roleNames(stored));
  }

  @Test
  void configuredAdminKeepsAdminWhenTheProviderGrantsNoRoles(TestNamespace ns) {
    User user = createUser(ns, true, "DataSteward");
    AuthorizerConfiguration adminByEmail =
        new AuthorizerConfiguration().withAdminEmails(Set.of(user.getEmail()));

    syncFromProvider(user, Set.of(), adminByEmail);

    User stored = storedUser(user);
    assertTrue(stored.getIsAdmin());
    assertEquals(List.of(), roleNames(stored));
  }

  @Test
  void providerGrantingAdminAndARolePromotesAndAssigns(TestNamespace ns) {
    User user = createUser(ns, false);

    syncFromProvider(user, Set.of(ADMIN_ROLE, "DataConsumer"), NO_CONFIGURED_ADMINS);

    User stored = storedUser(user);
    assertTrue(stored.getIsAdmin());
    assertEquals(List.of("DataConsumer"), roleNames(stored));
  }

  private static User createUser(TestNamespace ns, boolean isAdmin, String... roleNames) {
    String name = ("rolesync" + ns.uniqueShortId()).toLowerCase(Locale.ROOT);
    List<UUID> roleIds =
        Arrays.stream(roleNames)
            .map(roleName -> SdkClients.adminClient().roles().getByName(roleName).getId())
            .toList();
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(name)
                .withEmail(name + "@rolesync.test.om.org")
                .withIsAdmin(isAdmin)
                .withRoles(roleIds));
  }

  private static void syncFromProvider(
      User user, Set<String> providerRoles, AuthorizerConfiguration authorizerConfiguration) {
    User loggedIn =
        Entity.getUserRepository()
            .getByName(null, user.getName(), new EntityUtil.Fields(Set.of("roles")));
    UserUtil.reSyncUserRolesFromToken(null, loggedIn, providerRoles, authorizerConfiguration);
  }

  private static User storedUser(User user) {
    return SdkClients.adminClient().users().get(user.getId().toString(), "roles");
  }

  private static List<String> roleNames(User user) {
    return user.getRoles() == null
        ? List.of()
        : user.getRoles().stream().map(EntityReference::getName).sorted().toList();
  }
}
