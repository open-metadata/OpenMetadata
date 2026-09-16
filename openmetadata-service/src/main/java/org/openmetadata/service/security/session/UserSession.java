package org.openmetadata.service.security.session;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class UserSession {
  private String id;
  private SessionType type;
  private String provider;
  private SessionStatus status;
  private String userId;
  private String username;
  private String email;
  private String omRefreshToken;
  private String providerRefreshToken;
  private String redirectUri;
  private String state;
  private String nonce;
  private String pkceVerifier;
  private Long version;
  private Long refreshLeaseUntil;
  private Long createdAt;
  private Long updatedAt;
  private Long lastAccessedAt;
  private Long expiresAt;
  private Long idleExpiresAt;

  @JsonIgnore
  public boolean isExpired(long now) {
    return status == SessionStatus.EXPIRED
        || status == SessionStatus.REVOKED
        || (expiresAt != null && expiresAt <= now)
        || (idleExpiresAt != null && idleExpiresAt <= now);
  }

  @JsonIgnore
  public boolean hasStaleRefreshLease(long now) {
    return status == SessionStatus.REFRESHING
        && refreshLeaseUntil != null
        && refreshLeaseUntil <= now;
  }
}
