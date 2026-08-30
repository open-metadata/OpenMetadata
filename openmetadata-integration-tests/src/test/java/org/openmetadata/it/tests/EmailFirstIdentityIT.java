package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS;

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

  @Test
  void testChangedEmailBecomesTheLoginIdentity(TestNamespace ns) {
    String localPart = ("moved" + ns.uniqueShortId()).toLowerCase(Locale.ROOT);
    String oldEmail = localPart + "@old.test.om.org";
    String newEmail = localPart + "@new.test.om.org";

    User user = provision(oldEmail, "Moved User");
    Entity.getUserRepository().changeEmail(oldEmail, newEmail, false);

    User afterChange = provision(newEmail, "Moved User");
    assertEquals(user.getId(), afterChange.getId(), "New address must resolve to the same account");
    assertEquals(newEmail, afterChange.getEmail());
    assertEquals(user.getName(), afterChange.getName(), "Username must not change with the email");

    User reusedOldAddress = provision(oldEmail, "Someone Else");
    assertNotEquals(
        user.getId(),
        reusedOldAddress.getId(),
        "Released address must not resolve to the old account");
  }

  @Test
  void testChangeEmailRejectsAddressAlreadyInUse(TestNamespace ns) {
    String suffix = ns.uniqueShortId().toLowerCase(Locale.ROOT);
    String firstEmail = "keep" + suffix + "@x.test.om.org";
    String secondEmail = "taken" + suffix + "@x.test.om.org";

    provision(firstEmail, "First");
    provision(secondEmail, "Second");

    assertThrows(
        IllegalArgumentException.class,
        () -> Entity.getUserRepository().changeEmail(firstEmail, secondEmail, false));
    assertEquals(
        firstEmail, provision(firstEmail, "First").getEmail(), "Failed change must not mutate");
  }

  @Test
  void testReassignedAddressIsRefusedUntilTheBindingIsCleared(TestNamespace ns) {
    String localPart = ("reassign" + ns.uniqueShortId()).toLowerCase(Locale.ROOT);
    String email = localPart + "@x.test.om.org";
    String parkedEmail = localPart + "@parked.test.om.org";
    String originalSubject = "idp-subject-" + localPart + "-original";
    String newHireSubject = "idp-subject-" + localPart + "-newhire";

    User original = provision(email, "Original Owner", originalSubject);
    assertEquals(originalSubject, original.getIdentityProviderSubject());

    // A different person now holds the same address at the IdP; the bound subject must stop them.
    assertThrows(
        org.openmetadata.service.security.AuthenticationException.class,
        () -> provision(email, "New Hire", newHireSubject));

    // The administrator parks the old account's address, releasing it for the new person.
    Entity.getUserRepository().changeEmail(email, parkedEmail, true);
    User newHire = provision(email, "New Hire", newHireSubject);

    assertNotEquals(original.getId(), newHire.getId(), "New hire must get a distinct account");
    assertEquals(newHireSubject, newHire.getIdentityProviderSubject());
    assertNull(
        Entity.getUserRepository()
            .getByEmail(null, parkedEmail, EMPTY_FIELDS)
            .getIdentityProviderSubject(),
        "Parked account's binding must have been cleared");
  }

  /**
   * Provisions through the same factory the OIDC, SAML and LDAP login paths use, so this exercises
   * the production wiring rather than a copy of it. An empty authorizer configuration means no
   * configured admins and no self-signup domain restriction.
   */
  private User provision(String email, String displayName) {
    return provision(email, displayName, null);
  }

  private User provision(String email, String displayName, String identityProviderSubject) {
    List<String> noTeams = List.of();
    return EmailFirstUserProvisioner.forProvider(
            "TEST",
            new AuthorizerConfiguration(),
            Entity.getUserRepository(),
            user -> UserUtil.assignTeamsFromClaim(user, noTeams),
            user -> UserUtil.assignTeamsFromClaim(user, noTeams))
        .getOrCreate(email, displayName, identityProviderSubject, true);
  }
}
