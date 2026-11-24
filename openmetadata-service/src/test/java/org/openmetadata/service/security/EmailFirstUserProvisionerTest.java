package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.Response;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.exception.UserCreationException;
import org.openmetadata.service.exception.EntityNotFoundException;

@Execution(ExecutionMode.CONCURRENT)
class EmailFirstUserProvisionerTest {

  @Test
  void testReturnsExistingUserWhenNoUpdateIsNeeded() {
    User existingUser =
        new User()
            .withName("john")
            .withEmail("john@company.com")
            .withDisplayName("John")
            .withIsAdmin(false);
    AtomicInteger saveCount = new AtomicInteger();

    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("OIDC")
            .existingUserLookup(email -> existingUser)
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(
                user -> {
                  saveCount.incrementAndGet();
                  return user;
                })
            .exceptionFactory(IllegalStateException::new)
            .build();

    User resolvedUser = provisioner.getOrCreate("john@company.com", "John", null, true);

    assertSame(existingUser, resolvedUser);
    assertEquals(0, saveCount.get());
  }

  @Test
  void testUpdatesExistingUserWhenDisplayNameOrAdminChanges() {
    User existingUser =
        new User()
            .withName("john")
            .withEmail("john@company.com")
            .withDisplayName("Old")
            .withIsAdmin(false);
    AtomicInteger saveCount = new AtomicInteger();

    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("OIDC")
            .existingUserLookup(email -> existingUser)
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> true)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(
                user -> {
                  saveCount.incrementAndGet();
                  return user;
                })
            .exceptionFactory(IllegalStateException::new)
            .build();

    User resolvedUser = provisioner.getOrCreate("john@company.com", "John Updated", null, true);

    assertSame(existingUser, resolvedUser);
    assertEquals("John Updated", resolvedUser.getDisplayName());
    assertTrue(Boolean.TRUE.equals(resolvedUser.getIsAdmin()));
    assertEquals(1, saveCount.get());
  }

  @Test
  void testUpdatesExistingUserWhenExistingMutatorRequestsSave() {
    User existingUser =
        new User()
            .withName("john")
            .withEmail("john@company.com")
            .withDisplayName("John")
            .withIsAdmin(false);
    AtomicInteger saveCount = new AtomicInteger();

    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("SAML")
            .existingUserLookup(email -> existingUser)
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> true)
            .newUserMutator(user -> {})
            .userSaver(
                user -> {
                  saveCount.incrementAndGet();
                  return user;
                })
            .exceptionFactory(IllegalStateException::new)
            .build();

    provisioner.getOrCreate("john@company.com", "John", null, true);

    assertEquals(1, saveCount.get());
  }

  @Test
  void testRejectsUnregisteredUserWhenSelfSignupDisabled() {
    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("LDAP")
            .existingUserLookup(
                email -> {
                  throw EntityNotFoundException.byName(email);
                })
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(user -> user)
            .exceptionFactory(IllegalStateException::new)
            .build();

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () -> provisioner.getOrCreate("newuser@company.com", "New User", null, false));

    assertTrue(exception.getMessage().contains("User not registered"));
  }

  @Test
  void testRejectsSignupWhenRegistrationDomainNotAllowed() {
    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("OIDC")
            .existingUserLookup(
                email -> {
                  throw EntityNotFoundException.byName(email);
                })
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(user -> user)
            .exceptionFactory(IllegalStateException::new)
            .emailRegistrationAllowed(email -> email.endsWith("@company.com"))
            .build();

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () -> provisioner.getOrCreate("intruder@other.org", "Intruder", null, true));

    assertTrue(exception.getMessage().contains("not allowed for self-signup"));
  }

  @Test
  void testDoesNotOverwriteDisplayNameWhenIdpProvidesNone() {
    User existingUser =
        new User()
            .withName("john")
            .withEmail("john@company.com")
            .withDisplayName("Custom Name")
            .withIsAdmin(false);
    AtomicInteger saveCount = new AtomicInteger();

    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("SAML")
            .existingUserLookup(email -> existingUser)
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(
                user -> {
                  saveCount.incrementAndGet();
                  return user;
                })
            .exceptionFactory(IllegalStateException::new)
            .build();

    User resolvedUser = provisioner.getOrCreate("john@company.com", null, null, true);

    assertSame(existingUser, resolvedUser);
    assertEquals("Custom Name", resolvedUser.getDisplayName());
    assertEquals(0, saveCount.get());
  }

  @Test
  void testCreatesNewUserWithUniqueUsernameWhenSelfSignupEnabled() {
    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("OIDC")
            .existingUserLookup(
                email -> {
                  throw EntityNotFoundException.byName(email);
                })
            .usernameExistsChecker(username -> "john".equals(username))
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> user.setDisplayName(user.getDisplayName() + " via team sync"))
            .userSaver(user -> user)
            .exceptionFactory(IllegalStateException::new)
            .build();

    User createdUser = provisioner.getOrCreate("john@company.com", "John", null, true);

    assertTrue(createdUser.getName().startsWith("john_"));
    assertEquals("john@company.com", createdUser.getEmail());
    assertEquals("John via team sync", createdUser.getDisplayName());
    assertTrue(Boolean.TRUE.equals(createdUser.getIsEmailVerified()));
    assertFalse(Boolean.TRUE.equals(createdUser.getIsAdmin()));
  }

  @Test
  void testCreatesNewAdminUserWithGeneratedDisplayNameWhenMissing() {
    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("OIDC")
            .existingUserLookup(
                email -> {
                  throw EntityNotFoundException.byName(email);
                })
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> "admin@company.com".equals(email))
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(user -> user)
            .exceptionFactory(IllegalStateException::new)
            .build();

    User createdUser = provisioner.getOrCreate("admin@company.com", null, null, true);

    assertEquals("admin", createdUser.getName());
    assertEquals("admin", createdUser.getDisplayName());
    assertTrue(Boolean.TRUE.equals(createdUser.getIsAdmin()));
  }

  @Test
  void testRetriesOnRetryableCreateConflict() {
    AtomicInteger saveAttempts = new AtomicInteger();
    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("OIDC")
            .existingUserLookup(
                email -> {
                  throw EntityNotFoundException.byName(email);
                })
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(
                user -> {
                  if (saveAttempts.getAndIncrement() == 0) {
                    throw UserCreationException.byMessage(
                        user.getName(), "entity already exists", Response.Status.CONFLICT);
                  }
                  return user;
                })
            .exceptionFactory(IllegalStateException::new)
            .build();

    User createdUser = provisioner.getOrCreate("retry@company.com", "Retry User", null, true);

    assertEquals("retry", createdUser.getName());
    assertEquals(2, saveAttempts.get());
  }

  @Test
  void testThrowsImmediatelyOnNonRetryableCreateConflict() {
    AtomicInteger saveAttempts = new AtomicInteger();
    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("OIDC")
            .existingUserLookup(
                email -> {
                  throw EntityNotFoundException.byName(email);
                })
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(
                user -> {
                  saveAttempts.incrementAndGet();
                  throw UserCreationException.byMessage(
                      user.getName(), "validation failed", Response.Status.BAD_REQUEST);
                })
            .exceptionFactory(IllegalStateException::new)
            .build();

    UserCreationException exception =
        assertThrows(
            UserCreationException.class,
            () -> provisioner.getOrCreate("retry@company.com", "Retry User", null, true));

    assertTrue(exception.getMessage().toLowerCase().contains("validation"));
    assertEquals(1, saveAttempts.get());
  }

  @Test
  void testThrowsAfterExhaustingRetryableCreateConflicts() {
    AtomicInteger saveAttempts = new AtomicInteger();
    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("OIDC")
            .existingUserLookup(
                email -> {
                  throw EntityNotFoundException.byName(email);
                })
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(
                user -> {
                  saveAttempts.incrementAndGet();
                  throw UserCreationException.byMessage(
                      user.getName(), "duplicate username", Response.Status.CONFLICT);
                })
            .exceptionFactory(IllegalStateException::new)
            .build();

    UserCreationException exception =
        assertThrows(
            UserCreationException.class,
            () -> provisioner.getOrCreate("retry@company.com", "Retry User", null, true));

    assertTrue(exception.getMessage().toLowerCase().contains("duplicate"));
    assertEquals(3, saveAttempts.get());
  }

  @Test
  void testBindsIdentityProviderSubjectOnFirstLogin() {
    User existingUser =
        new User().withName("john").withEmail("john@company.com").withDisplayName("John");
    AtomicInteger saveCount = new AtomicInteger();

    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("OIDC")
            .existingUserLookup(email -> existingUser)
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(
                user -> {
                  saveCount.incrementAndGet();
                  return user;
                })
            .exceptionFactory(IllegalStateException::new)
            .build();

    User resolved = provisioner.getOrCreate("john@company.com", "John", "idp-subject-1", true);

    assertEquals("idp-subject-1", resolved.getIdentityProviderSubject());
    assertEquals(1, saveCount.get(), "binding the subject should persist the user");
  }

  @Test
  void testRejectsLoginWhenSubjectDiffersFromBoundSubject() {
    // The email was reassigned to a different person at the identity provider; without this the
    // new holder would inherit the previous owner's account.
    User existingUser =
        new User()
            .withName("john")
            .withEmail("john@company.com")
            .withIdentityProviderSubject("original-subject");

    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("OIDC")
            .existingUserLookup(email -> existingUser)
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(user -> user)
            .exceptionFactory(IllegalStateException::new)
            .build();

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () ->
                provisioner.getOrCreate("john@company.com", "New Hire", "different-subject", true));

    assertTrue(exception.getMessage().contains("bound to a different identity-provider subject"));
  }

  @Test
  void testAcceptsLoginWhenSubjectMatchesAndDoesNotRewriteIt() {
    User existingUser =
        new User()
            .withName("john")
            .withEmail("john@company.com")
            .withDisplayName("John")
            .withIdentityProviderSubject("stable-subject");
    AtomicInteger saveCount = new AtomicInteger();

    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("OIDC")
            .existingUserLookup(email -> existingUser)
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(
                user -> {
                  saveCount.incrementAndGet();
                  return user;
                })
            .exceptionFactory(IllegalStateException::new)
            .build();

    User resolved = provisioner.getOrCreate("john@company.com", "John", "stable-subject", true);

    assertEquals("stable-subject", resolved.getIdentityProviderSubject());
    assertEquals(0, saveCount.get(), "a matching subject is not a change and must not write");
  }

  @Test
  void testStoresSubjectOnNewlyCreatedUser() {
    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("OIDC")
            .existingUserLookup(
                email -> {
                  throw EntityNotFoundException.byName(email);
                })
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(user -> user)
            .exceptionFactory(IllegalStateException::new)
            .build();

    User created = provisioner.getOrCreate("new@company.com", "New", "fresh-subject", true);

    assertEquals("fresh-subject", created.getIdentityProviderSubject());
  }

  @Test
  void testProvidersWithoutASubjectAreUnaffected() {
    // SAML and LDAP pass null; binding must stay inert rather than blocking those logins.
    User existingUser =
        new User().withName("john").withEmail("john@company.com").withDisplayName("John");
    AtomicInteger saveCount = new AtomicInteger();

    EmailFirstUserProvisioner provisioner =
        EmailFirstUserProvisioner.builder()
            .providerName("LDAP")
            .existingUserLookup(email -> existingUser)
            .usernameExistsChecker(username -> false)
            .adminEvaluator((email, username) -> false)
            .existingUserMutator(user -> false)
            .newUserMutator(user -> {})
            .userSaver(
                user -> {
                  saveCount.incrementAndGet();
                  return user;
                })
            .exceptionFactory(IllegalStateException::new)
            .build();

    User resolved = provisioner.getOrCreate("john@company.com", "John", null, true);

    assertSame(existingUser, resolved);
    assertEquals(0, saveCount.get());
  }
}
