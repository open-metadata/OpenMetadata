package org.openmetadata.service.security;

/**
 * Thread-local context to store impersonated user information.
 * Set by JwtFilter and retrieved by EntityRepository.
 */
public class ImpersonationContext {
  private static final ThreadLocal<String> impersonatedBy = new ThreadLocal<>();

  public static void setImpersonatedBy(String username) {
    impersonatedBy.set(username);
  }

  public static String getImpersonatedBy() {
    return impersonatedBy.get();
  }

  public static void clear() {
    impersonatedBy.remove();
  }
}
