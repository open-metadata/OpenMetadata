package org.openmetadata.service.security.session;

public enum SessionStatus {
  PENDING,
  ACTIVE,
  REFRESHING,
  REVOKED,
  EXPIRED
}
