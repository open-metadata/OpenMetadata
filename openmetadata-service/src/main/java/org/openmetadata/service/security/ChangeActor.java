package org.openmetadata.service.security;

import jakarta.ws.rs.core.SecurityContext;

/**
 * Who a write is attributed to: the acting user and, when a bot acts on their behalf, the bot.
 *
 * <p>Build it on the request thread. {@link ImpersonationContext} is a ThreadLocal and is not
 * carried into background tasks, so a write that runs later must take the actor captured here.
 */
public record ChangeActor(String userName, String impersonatedBy) {

  public static ChangeActor fromRequest(SecurityContext securityContext) {
    return new ChangeActor(
        securityContext.getUserPrincipal().getName(), ImpersonationContext.getImpersonatedBy());
  }
}
