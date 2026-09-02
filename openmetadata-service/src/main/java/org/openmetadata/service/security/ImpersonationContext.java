package org.openmetadata.service.security;

/**
 * Thread-local context to store impersonated user information.
 * Set by JwtFilter and retrieved by EntityRepository.
 */
public class ImpersonationContext {
  private static final ThreadLocal<String> impersonatedBy = new ThreadLocal<>();

  /**
   * {@code "<bot>-><target>"} of an impersonation already checked by {@link DefaultAuthorizer}.
   * Subject resolution re-checks impersonation on every call and a single request resolves the
   * subject many times, so this keeps the bot lookup and policy evaluation to once per request.
   */
  private static final ThreadLocal<String> validatedImpersonation = new ThreadLocal<>();

  public static void setImpersonatedBy(String username) {
    impersonatedBy.set(username);
  }

  public static String getImpersonatedBy() {
    return impersonatedBy.get();
  }

  public static boolean isValidated(String botName, String targetUser) {
    return validationKey(botName, targetUser).equals(validatedImpersonation.get());
  }

  public static void markValidated(String botName, String targetUser) {
    validatedImpersonation.set(validationKey(botName, targetUser));
  }

  private static String validationKey(String botName, String targetUser) {
    return botName + "->" + targetUser;
  }

  public static void clear() {
    impersonatedBy.remove();
    validatedImpersonation.remove();
  }
}
