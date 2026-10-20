package org.openmetadata.service.security;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import jakarta.ws.rs.core.SecurityContext;

/**
 * Who a write is attributed to: the acting user and, when a bot acts on their behalf, the bot. A
 * system write is one the platform makes on its own, such as a migration or a governance workflow
 * applying an admin's rules, so the user it records did not choose it and is not authorized for it.
 *
 * <p>Build it on the request thread. {@link ImpersonationContext} is a ThreadLocal and is not
 * carried into background tasks, so a write that runs later must take the actor captured here.
 */
public record ChangeActor(String userName, String impersonatedBy, boolean system) {

  public static ChangeActor fromRequest(SecurityContext securityContext) {
    return user(
        securityContext.getUserPrincipal().getName(), ImpersonationContext.getImpersonatedBy());
  }

  public static ChangeActor user(String userName, String impersonatedBy) {
    return new ChangeActor(userName, impersonatedBy, false);
  }

  public static ChangeActor system(String userName, String impersonatedBy) {
    return new ChangeActor(userName, impersonatedBy, true);
  }

  /**
   * The actor of a write that records only the names. {@code admin} is the author the platform
   * records its own writes under, as the entity updater also treats it.
   */
  public static ChangeActor recorded(String userName, String impersonatedBy) {
    return new ChangeActor(userName, impersonatedBy, ADMIN_USER_NAME.equalsIgnoreCase(userName));
  }
}
