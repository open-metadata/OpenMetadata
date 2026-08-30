package org.openmetadata.service.security;

import java.util.Set;
import java.util.function.BiPredicate;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;
import lombok.Builder;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.UserUtil;

/**
 * Shared get-or-create for the email-first login flows.
 *
 * <p>The algorithm is identical for OIDC, SAML and LDAP; only the role/team side effects and the
 * configuration source differ, which is what {@link #forProvider} parameterises. Construct through
 * that factory rather than the raw constructor.
 */
@Slf4j
@Builder
public class EmailFirstUserProvisioner {

  private static final int MAX_CREATE_RETRIES = 3;

  /** Relationship fields the flows need loaded on an existing user before they mutate it. */
  private static final Set<String> LOOKUP_FIELDS = Set.of("id", "roles", "teams", "displayName");

  @FunctionalInterface
  public interface ExistingUserLookup {
    User getByEmail(String email) throws EntityNotFoundException;
  }

  @FunctionalInterface
  public interface ExistingUserMutator {
    boolean apply(User user);
  }

  private final String providerName;
  private final ExistingUserLookup existingUserLookup;
  private final Predicate<String> usernameExistsChecker;
  private final BiPredicate<String, String> adminEvaluator;
  private final ExistingUserMutator existingUserMutator;
  private final Consumer<User> newUserMutator;
  private final Function<User, User> userSaver;
  private final Function<String, RuntimeException> exceptionFactory;
  @Builder.Default private final Predicate<String> emailRegistrationAllowed = email -> true;

  /**
   * Wire a provisioner for one SSO provider. Lookup, username collision checking, admin
   * evaluation, persistence and self-signup domain enforcement are identical across providers and
   * are supplied here; the caller only describes what it does to the user's roles and teams.
   *
   * @param providerName provider label used in log messages
   * @param authorizerConfig authorizer configuration backing admin and self-signup decisions
   * @param userRepository repository the caller already holds; passed in rather than looked up so
   *     callers stay injectable and unit-testable
   * @param existingUserMutator applied to an existing user; returns true when it changed something
   * @param newUserMutator applied to a freshly built user before it is persisted
   */
  public static EmailFirstUserProvisioner forProvider(
      String providerName,
      AuthorizerConfiguration authorizerConfig,
      UserRepository userRepository,
      ExistingUserMutator existingUserMutator,
      Consumer<User> newUserMutator) {
    return EmailFirstUserProvisioner.builder()
        .providerName(providerName)
        .existingUserLookup(
            email -> userRepository.getActiveUserByEmailForAuth(email, new Fields(LOOKUP_FIELDS)))
        .usernameExistsChecker(userRepository::checkUserNameExists)
        .adminEvaluator(
            (email, username) -> UserUtil.isConfiguredAdmin(authorizerConfig, email, username))
        .existingUserMutator(existingUserMutator)
        .newUserMutator(newUserMutator)
        .userSaver(UserUtil::addOrUpdateUser)
        .exceptionFactory(AuthenticationException::new)
        .emailRegistrationAllowed(
            email ->
                SecurityUtil.isEmailRegistrationDomainAllowed(
                    email, authorizerConfig.getAllowedEmailRegistrationDomains()))
        .build();
  }

  /**
   * Return the account for this email, creating it when self-signup allows. Retries a losing race
   * with a concurrent create rather than failing the login.
   */
  public User getOrCreate(String email, String displayName, boolean selfSignupEnabled) {
    for (int attempt = 1; attempt <= MAX_CREATE_RETRIES; attempt++) {
      try {
        return syncExistingUser(existingUserLookup.getByEmail(email), email, displayName);
      } catch (EntityNotFoundException e) {
        LOG.debug("User not found by email {}, will create new user", email);
      }

      requireSignupAllowed(email, selfSignupEnabled);

      try {
        return userSaver.apply(buildNewUser(email, displayName));
      } catch (org.openmetadata.sdk.exception.UserCreationException ex) {
        rethrowUnlessRetryable(ex, attempt, email);
      }
    }

    throw exceptionFactory.apply(
        String.format("Unable to create %s user after concurrent retries.", providerName));
  }

  /** Bring an existing account in line with what the identity provider now asserts. */
  private User syncExistingUser(User user, String email, String displayName) {
    boolean needsUpdate = promoteToAdminIfConfigured(user, email);
    needsUpdate = syncDisplayName(user, displayName) || needsUpdate;
    needsUpdate = existingUserMutator.apply(user) || needsUpdate;
    return needsUpdate ? userSaver.apply(user) : user;
  }

  private boolean promoteToAdminIfConfigured(User user, String email) {
    if (!adminEvaluator.test(email, user.getName()) || Boolean.TRUE.equals(user.getIsAdmin())) {
      return false;
    }
    LOG.debug("Updating user {} to admin based on adminEmails/adminPrincipals", user.getName());
    user.setIsAdmin(true);
    return true;
  }

  /**
   * Only sync when the provider actually supplied a display name. Resolvers pass null otherwise, so
   * a name the user set in OpenMetadata is never reverted to a derived fallback.
   */
  private boolean syncDisplayName(User user, String displayName) {
    if (displayName == null || displayName.isBlank() || displayName.equals(user.getDisplayName())) {
      return false;
    }
    LOG.debug(
        "Updating displayName for user {} from '{}' to '{}'",
        user.getName(),
        user.getDisplayName(),
        displayName);
    user.setDisplayName(displayName);
    return true;
  }

  private void requireSignupAllowed(String email, boolean selfSignupEnabled) {
    if (!selfSignupEnabled) {
      throw exceptionFactory.apply(
          "User not registered. Contact administrator to create an account.");
    }
    if (!emailRegistrationAllowed.test(email)) {
      LOG.warn(
          "SECURITY: Blocked {} signup for disallowed registration domain (email: {})",
          providerName,
          email);
      throw exceptionFactory.apply(
          "Email domain not allowed for self-signup: " + email.substring(email.indexOf('@') + 1));
    }
  }

  private User buildNewUser(String email, String displayName) {
    // Guard once at the boundary: everything below derives the username and domain from '@'.
    String validatedEmail = SecurityUtil.requireEmailWithDomain(email);
    String emailDomain = validatedEmail.substring(validatedEmail.indexOf('@') + 1);
    String userName = UserUtil.generateUsernameFromEmail(validatedEmail, usernameExistsChecker);
    boolean isAdmin = adminEvaluator.test(validatedEmail, userName);
    LOG.debug(
        "Creating new {} user - Generated username: {}, Is admin: {}",
        providerName,
        userName,
        isAdmin);

    User newUser =
        UserUtil.user(userName, emailDomain, userName)
            .withEmail(validatedEmail)
            .withDisplayName(displayName != null ? displayName : userName)
            .withIsAdmin(isAdmin)
            .withIsEmailVerified(true);
    newUserMutator.accept(newUser);
    return newUser;
  }

  private void rethrowUnlessRetryable(
      org.openmetadata.sdk.exception.UserCreationException ex, int attempt, String email) {
    if (!UserUtil.isRetryableUserCreationConflict(ex) || attempt == MAX_CREATE_RETRIES) {
      throw ex;
    }
    LOG.warn(
        "Retrying {} user creation for '{}' after a concurrent create conflict",
        providerName,
        email);
  }
}
