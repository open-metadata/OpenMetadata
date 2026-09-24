package org.openmetadata.service.security.session;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Sessions are shared as JSON between pods that may run different builds during a rolling upgrade,
 * and {@code JsonUtils} reads with a mapper that rejects unknown properties. Unknown fields are
 * therefore ignored, and fields added later are written only when set, so an older pod can still read
 * a session written by a newer one.
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
@JsonIgnoreProperties(ignoreUnknown = true)
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

  @JsonInclude(JsonInclude.Include.NON_NULL)
  private String idpRedirectUri;

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
