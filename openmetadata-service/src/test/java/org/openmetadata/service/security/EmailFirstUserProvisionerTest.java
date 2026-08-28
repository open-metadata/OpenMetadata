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
        new EmailFirstUserProvisioner(
            "OIDC",
            email -> existingUser,
            username -> false,
            (email, username) -> false,
            user -> false,
            user -> {},
            user -> {
              saveCount.incrementAndGet();
              return user;
            },
            IllegalStateException::new);

    User resolvedUser = provisioner.getOrCreate("john@company.com", "John", true);

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
        new EmailFirstUserProvisioner(
            "OIDC",
            email -> existingUser,
            username -> false,
            (email, username) -> true,
            user -> false,
            user -> {},
            user -> {
              saveCount.incrementAndGet();
              return user;
            },
            IllegalStateException::new);

    User resolvedUser = provisioner.getOrCreate("john@company.com", "John Updated", true);

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
        new EmailFirstUserProvisioner(
            "SAML",
            email -> existingUser,
            username -> false,
            (email, username) -> false,
            user -> true,
            user -> {},
            user -> {
              saveCount.incrementAndGet();
              return user;
            },
            IllegalStateException::new);

    provisioner.getOrCreate("john@company.com", "John", true);

    assertEquals(1, saveCount.get());
  }

  @Test
  void testRejectsUnregisteredUserWhenSelfSignupDisabled() {
    EmailFirstUserProvisioner provisioner =
        new EmailFirstUserProvisioner(
            "LDAP",
            email -> {
              throw EntityNotFoundException.byName(email);
            },
            username -> false,
            (email, username) -> false,
            user -> false,
            user -> {},
            user -> user,
            IllegalStateException::new);

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () -> provisioner.getOrCreate("newuser@company.com", "New User", false));

    assertTrue(exception.getMessage().contains("User not registered"));
  }

  @Test
  void testRejectsSignupWhenRegistrationDomainNotAllowed() {
    EmailFirstUserProvisioner provisioner =
        new EmailFirstUserProvisioner(
            "OIDC",
            email -> {
              throw EntityNotFoundException.byName(email);
            },
            username -> false,
            (email, username) -> false,
            user -> false,
            user -> {},
            user -> user,
            IllegalStateException::new,
            email -> email.endsWith("@company.com"));

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () -> provisioner.getOrCreate("intruder@other.org", "Intruder", true));

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
        new EmailFirstUserProvisioner(
            "SAML",
            email -> existingUser,
            username -> false,
            (email, username) -> false,
            user -> false,
            user -> {},
            user -> {
              saveCount.incrementAndGet();
              return user;
            },
            IllegalStateException::new);

    User resolvedUser = provisioner.getOrCreate("john@company.com", null, true);

    assertSame(existingUser, resolvedUser);
    assertEquals("Custom Name", resolvedUser.getDisplayName());
    assertEquals(0, saveCount.get());
  }

  @Test
  void testCreatesNewUserWithUniqueUsernameWhenSelfSignupEnabled() {
    EmailFirstUserProvisioner provisioner =
        new EmailFirstUserProvisioner(
            "OIDC",
            email -> {
              throw EntityNotFoundException.byName(email);
            },
            username -> "john".equals(username),
            (email, username) -> false,
            user -> false,
            user -> user.setDisplayName(user.getDisplayName() + " via team sync"),
            user -> user,
            IllegalStateException::new);

    User createdUser = provisioner.getOrCreate("john@company.com", "John", true);

    assertTrue(createdUser.getName().startsWith("john_"));
    assertEquals("john@company.com", createdUser.getEmail());
    assertEquals("John via team sync", createdUser.getDisplayName());
    assertTrue(Boolean.TRUE.equals(createdUser.getIsEmailVerified()));
    assertFalse(Boolean.TRUE.equals(createdUser.getIsAdmin()));
  }

  @Test
  void testCreatesNewAdminUserWithGeneratedDisplayNameWhenMissing() {
    EmailFirstUserProvisioner provisioner =
        new EmailFirstUserProvisioner(
            "OIDC",
            email -> {
              throw EntityNotFoundException.byName(email);
            },
            username -> false,
            (email, username) -> "admin@company.com".equals(email),
            user -> false,
            user -> {},
            user -> user,
            IllegalStateException::new);

    User createdUser = provisioner.getOrCreate("admin@company.com", null, true);

    assertEquals("admin", createdUser.getName());
    assertEquals("admin", createdUser.getDisplayName());
    assertTrue(Boolean.TRUE.equals(createdUser.getIsAdmin()));
  }

  @Test
  void testRetriesOnRetryableCreateConflict() {
    AtomicInteger saveAttempts = new AtomicInteger();
    EmailFirstUserProvisioner provisioner =
        new EmailFirstUserProvisioner(
            "OIDC",
            email -> {
              throw EntityNotFoundException.byName(email);
            },
            username -> false,
            (email, username) -> false,
            user -> false,
            user -> {},
            user -> {
              if (saveAttempts.getAndIncrement() == 0) {
                throw UserCreationException.byMessage(
                    user.getName(), "entity already exists", Response.Status.CONFLICT);
              }
              return user;
            },
            IllegalStateException::new);

    User createdUser = provisioner.getOrCreate("retry@company.com", "Retry User", true);

    assertEquals("retry", createdUser.getName());
    assertEquals(2, saveAttempts.get());
  }

  @Test
  void testThrowsImmediatelyOnNonRetryableCreateConflict() {
    AtomicInteger saveAttempts = new AtomicInteger();
    EmailFirstUserProvisioner provisioner =
        new EmailFirstUserProvisioner(
            "OIDC",
            email -> {
              throw EntityNotFoundException.byName(email);
            },
            username -> false,
            (email, username) -> false,
            user -> false,
            user -> {},
            user -> {
              saveAttempts.incrementAndGet();
              throw UserCreationException.byMessage(
                  user.getName(), "validation failed", Response.Status.BAD_REQUEST);
            },
            IllegalStateException::new);

    UserCreationException exception =
        assertThrows(
            UserCreationException.class,
            () -> provisioner.getOrCreate("retry@company.com", "Retry User", true));

    assertTrue(exception.getMessage().toLowerCase().contains("validation"));
    assertEquals(1, saveAttempts.get());
  }

  @Test
  void testThrowsAfterExhaustingRetryableCreateConflicts() {
    AtomicInteger saveAttempts = new AtomicInteger();
    EmailFirstUserProvisioner provisioner =
        new EmailFirstUserProvisioner(
            "OIDC",
            email -> {
              throw EntityNotFoundException.byName(email);
            },
            username -> false,
            (email, username) -> false,
            user -> false,
            user -> {},
            user -> {
              saveAttempts.incrementAndGet();
              throw UserCreationException.byMessage(
                  user.getName(), "duplicate username", Response.Status.CONFLICT);
            },
            IllegalStateException::new);

    UserCreationException exception =
        assertThrows(
            UserCreationException.class,
            () -> provisioner.getOrCreate("retry@company.com", "Retry User", true));

    assertTrue(exception.getMessage().toLowerCase().contains("duplicate"));
    assertEquals(3, saveAttempts.get());
  }
}
