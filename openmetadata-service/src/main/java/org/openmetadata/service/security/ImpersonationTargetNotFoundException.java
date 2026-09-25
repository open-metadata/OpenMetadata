package org.openmetadata.service.security;

/**
 * The {@code X-Impersonate-User} target does not exist. Still an authentication failure for the
 * generic error envelope, but distinguishable from an invalid or missing token.
 */
public class ImpersonationTargetNotFoundException extends AuthenticationException {
  public ImpersonationTargetNotFoundException(String msg) {
    super(msg);
  }
}
