package org.openmetadata.service.security;

/**
 * An {@code X-Impersonate-User} swap was refused. Kept distinct from other authorization failures
 * so endpoints with a stable error contract can report impersonation separately from permissions.
 */
public class ImpersonationDeniedException extends AuthorizationException {
  public ImpersonationDeniedException(String msg) {
    super(msg);
  }
}
