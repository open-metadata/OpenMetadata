package org.openmetadata.service.security;

import jakarta.ws.rs.core.SecurityContext;

/**
 * Who asks for a write made on their behalf, and who decides whether they may: each entity the write
 * touches is authorized for {@code securityContext} by {@code authorizer}, and saved as {@code actor}.
 *
 * <p>Build it on the request thread, as {@link ChangeActor} is.
 */
public record PatchRequester(
    SecurityContext securityContext, Authorizer authorizer, ChangeActor actor) {

  public static PatchRequester fromRequest(SecurityContext securityContext, Authorizer authorizer) {
    return new PatchRequester(
        securityContext, authorizer, ChangeActor.fromRequest(securityContext));
  }
}
