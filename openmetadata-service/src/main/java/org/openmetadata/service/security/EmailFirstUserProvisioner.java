package org.openmetadata.service.security;

import java.util.function.BiPredicate;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.UserUtil;

@Slf4j
public class EmailFirstUserProvisioner {

  private static final int MAX_CREATE_RETRIES = 3;

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
  private final Predicate<String> emailRegistrationAllowed;

  public EmailFirstUserProvisioner(
      String providerName,
      ExistingUserLookup existingUserLookup,
      Predicate<String> usernameExistsChecker,
      BiPredicate<String, String> adminEvaluator,
      ExistingUserMutator existingUserMutator,
      Consumer<User> newUserMutator,
      Function<User, User> userSaver,
      Function<String, RuntimeException> exceptionFactory) {
    this(
        providerName,
        existingUserLookup,
        usernameExistsChecker,
        adminEvaluator,
        existingUserMutator,
        newUserMutator,
        userSaver,
        exceptionFactory,
        email -> true);
  }

  public EmailFirstUserProvisioner(
      String providerName,
      ExistingUserLookup existingUserLookup,
      Predicate<String> usernameExistsChecker,
      BiPredicate<String, String> adminEvaluator,
      ExistingUserMutator existingUserMutator,
      Consumer<User> newUserMutator,
      Function<User, User> userSaver,
      Function<String, RuntimeException> exceptionFactory,
      Predicate<String> emailRegistrationAllowed) {
    this.providerName = providerName;
    this.existingUserLookup = existingUserLookup;
    this.usernameExistsChecker = usernameExistsChecker;
    this.adminEvaluator = adminEvaluator;
    this.existingUserMutator = existingUserMutator;
    this.newUserMutator = newUserMutator;
    this.userSaver = userSaver;
    this.exceptionFactory = exceptionFactory;
    this.emailRegistrationAllowed = emailRegistrationAllowed;
  }

  public User getOrCreate(String email, String displayName, boolean selfSignupEnabled) {
    for (int attempt = 1; attempt <= MAX_CREATE_RETRIES; attempt++) {
      try {
        User user = existingUserLookup.getByEmail(email);
        boolean needsUpdate = false;

        boolean shouldBeAdmin = adminEvaluator.test(email, user.getName());
        LOG.info(
            "{} login - Email: {}, Username: {}, Should be admin: {}, Current admin status: {}",
            providerName,
            email,
            user.getName(),
            shouldBeAdmin,
            user.getIsAdmin());

        if (shouldBeAdmin && !Boolean.TRUE.equals(user.getIsAdmin())) {
          LOG.info(
              "Updating user {} to admin based on adminEmails/adminPrincipals", user.getName());
          user.setIsAdmin(true);
          needsUpdate = true;
        }

        // Only sync when the IdP actually supplied a display name; resolvers pass null
        // otherwise, so a user-customized display name is never reverted to a fallback.
        if (displayName != null
            && !displayName.isBlank()
            && !displayName.equals(user.getDisplayName())) {
          LOG.info(
              "Updating displayName for user {} from '{}' to '{}'",
              user.getName(),
              user.getDisplayName(),
              displayName);
          user.setDisplayName(displayName);
          needsUpdate = true;
        }

        needsUpdate = existingUserMutator.apply(user) || needsUpdate;
        if (needsUpdate) {
          return userSaver.apply(user);
        }
        return user;
      } catch (EntityNotFoundException e) {
        LOG.debug("User not found by email {}, will create new user", email);
      }

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
            "Email domain not allowed for self-signup: " + email.split("@")[1]);
      }

      String userName = UserUtil.generateUsernameFromEmail(email, usernameExistsChecker);
      boolean isAdmin = adminEvaluator.test(email, userName);
      LOG.info(
          "Creating new {} user - Email: {}, Generated username: {}, Is admin: {}",
          providerName,
          email,
          userName,
          isAdmin);

      User newUser =
          UserUtil.user(userName, email.split("@")[1], userName)
              .withEmail(email)
              .withDisplayName(displayName != null ? displayName : userName)
              .withIsAdmin(isAdmin)
              .withIsEmailVerified(true);

      newUserMutator.accept(newUser);

      try {
        return userSaver.apply(newUser);
      } catch (org.openmetadata.sdk.exception.UserCreationException ex) {
        if (!UserUtil.isRetryableUserCreationConflict(ex) || attempt == MAX_CREATE_RETRIES) {
          throw ex;
        }
        LOG.warn(
            "Retrying {} user creation for '{}' after a concurrent create conflict",
            providerName,
            email);
      }
    }

    throw exceptionFactory.apply(
        String.format("Unable to create %s user after concurrent retries.", providerName));
  }
}
