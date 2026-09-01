package org.openmetadata.service.security;

/**
 * Thread-local record of which bot an action is attributed to, so writes can be stamped with
 * {@code impersonatedBy} in change events and audit trails.
 *
 * <p>This is attribution, not authorization. It is set by {@link JwtFilter} for an {@code
 * X-Impersonate-User} request, but also by the MCP server on every tool call to name its own bot -
 * where no impersonation grant is involved and none was checked. A non-null value therefore does
 * not mean "this request is an authorized impersonation session", and must not be read as one.
 *
 * <p>To gate behaviour on a real impersonation session, use {@code
 * CatalogSecurityContext.impersonatedUser()}, which is request-scoped and set only after {@link
 * ImpersonationAuthorizer} has approved the swap - see {@link ImpersonationRestrictionFilter}.
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
