package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.EmailFirstUserProvisioner;
import org.openmetadata.service.util.UserUtil;

/**
 * Exercises email-first provisioning against a real database. It drives {@link
 * EmailFirstUserProvisioner} with the same wiring the SSO handlers use rather than reflecting into
 * a handler, so the coverage survives handler refactors and still asserts on stored user state.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class EmailFirstIdentityIT {

  @Test
  void testEmailFirstUsersWithSameLocalPartStayUnique(TestNamespace ns) {
    String localPart = ("user" + ns.uniqueShortId()).toLowerCase(Locale.ROOT);
    String firstEmail = localPart + "@x.test.om.org";
    String secondEmail = localPart + "@y.test.om.org";

    User firstUser = provision(firstEmail, "First User");
    User secondUser = provision(secondEmail, "Second User");

    assertNotNull(firstUser.getId());
    assertNotNull(secondUser.getId());
    assertEquals(firstEmail, firstUser.getEmail());
    assertEquals(secondEmail, secondUser.getEmail());
    assertEquals(localPart, firstUser.getName());
    assertNotEquals(firstUser.getName(), secondUser.getName());
    assertTrue(secondUser.getName().startsWith(localPart + "_"));
  }

  @Test
  void testEmailFirstUsersAreResolvedByExactEmail(TestNamespace ns) {
    String localPart = ("user" + ns.uniqueShortId()).toLowerCase(Locale.ROOT);
    String firstEmail = localPart + "@x.test.om.org";
    String secondEmail = localPart + "@y.test.om.org";

    User firstUser = provision(firstEmail, "First User");
    User secondUser = provision(secondEmail, "Second User");
    User secondUserAgain = provision(secondEmail, "Second User Updated");

    assertEquals(firstEmail, firstUser.getEmail());
    assertEquals(secondEmail, secondUser.getEmail());
    assertEquals(secondUser.getId(), secondUserAgain.getId());
    assertEquals(secondUser.getName(), secondUserAgain.getName());
    assertEquals(secondEmail, secondUserAgain.getEmail());
  }

  @Test
  void testDeactivatedUserCannotAuthenticateByEmail(TestNamespace ns) {
    String localPart = ("gone" + ns.uniqueShortId()).toLowerCase(Locale.ROOT);
    String email = localPart + "@x.test.om.org";

    User user = provision(email, "Gone User");
    Entity.getUserRepository().delete("admin", user.getId(), false, false);

    org.openmetadata.service.security.AuthenticationException exception =
        assertThrows(
            org.openmetadata.service.security.AuthenticationException.class,
            () -> provision(email, "Gone User"));

    assertTrue(
        exception.getMessage() != null && exception.getMessage().contains("deactivated"),
        "Expected deactivated-account rejection but got: " + exception.getMessage());
  }

  @Test
  void testNewUserWithDeletedUsersLocalPartGetsSuffixedName(TestNamespace ns) {
    String localPart = ("del" + ns.uniqueShortId()).toLowerCase(Locale.ROOT);
    String firstEmail = localPart + "@x.test.om.org";
    String secondEmail = localPart + "@y.test.om.org";

    User firstUser = provision(firstEmail, "First");
    Entity.getUserRepository().delete("admin", firstUser.getId(), false, false);

    User secondUser = provision(secondEmail, "Second");

    assertNotNull(secondUser.getId());
    assertEquals(secondEmail, secondUser.getEmail());
    assertTrue(
        secondUser.getName().startsWith(localPart + "_"),
        "Expected suffixed username since the soft-deleted user still owns the base name, got: "
            + secondUser.getName());
  }

  /**
   * Provisions through the same factory the OIDC, SAML and LDAP login paths use, so this exercises
   * the production wiring rather than a copy of it. An empty authorizer configuration means no
   * configured admins and no self-signup domain restriction.
   */
  private User provision(String email, String displayName) {
    List<String> noTeams = List.of();
    return EmailFirstUserProvisioner.forProvider(
            "TEST",
            new AuthorizerConfiguration(),
            Entity.getUserRepository(),
            user -> UserUtil.assignTeamsFromClaim(user, noTeams),
            user -> UserUtil.assignTeamsFromClaim(user, noTeams))
        .getOrCreate(email, displayName, true);
  }
}
