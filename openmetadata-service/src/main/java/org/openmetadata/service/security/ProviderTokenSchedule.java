package org.openmetadata.service.security;

import java.util.concurrent.TimeUnit;

/**
 * When a confidential OIDC session has to go back to the identity provider.
 *
 * <p>Renewal follows the provider's own token lifetime ({@code expires_in}), not OpenMetadata's
 * session expiry, and an access token OpenMetadata issues never outlives the point where the
 * provider's tokens need renewing, so an open browser always refreshes in time. A provider session
 * with a short idle timeout (Keycloak counts refresh-token use as activity) then stays alive exactly
 * as long as the user keeps OpenMetadata open, and a provider session that has ended is noticed
 * within one provider token lifetime.
 */
final class ProviderTokenSchedule {
  /**
   * Floor for a shortened access token. The browser renews a minute before expiry, so a shorter
   * token would send it straight back.
   */
  static final int MIN_ACCESS_TOKEN_VALIDITY_SECONDS = 120;

  /** How soon to ask again after the provider gave no verdict (outage, client misconfiguration). */
  static final int RETRY_AFTER_SECONDS = 300;

  private ProviderTokenSchedule() {}

  /**
   * Due when the provider's tokens would lapse before an access token issued now. A session that
   * never recorded a due time (created before it was tracked) is due.
   */
  static boolean isRenewalDue(Long renewalDueAt, long now, int tokenValiditySeconds) {
    return renewalDueAt == null
        || renewalDueAt < now + TimeUnit.SECONDS.toMillis(tokenValiditySeconds);
  }

  /**
   * When tokens the provider has just issued need renewing. Without {@code expires_in} the
   * provider's schedule is unknown, and every refresh renews them.
   */
  static long renewalDueAt(long now, long providerTokenLifetimeSeconds, int tokenValiditySeconds) {
    long lifetimeSeconds =
        providerTokenLifetimeSeconds > 0 ? providerTokenLifetimeSeconds : tokenValiditySeconds;
    return now + TimeUnit.SECONDS.toMillis(lifetimeSeconds);
  }

  static long retryAt(long now) {
    return now + TimeUnit.SECONDS.toMillis(RETRY_AFTER_SECONDS);
  }

  /**
   * The configured validity, cut short so the browser refreshes before the provider's tokens need
   * renewing. A session with no provider schedule gets the configured validity.
   */
  static int accessTokenValiditySeconds(Long renewalDueAt, long now, int tokenValiditySeconds) {
    if (renewalDueAt == null) {
      return tokenValiditySeconds;
    }
    long secondsUntilDue = TimeUnit.MILLISECONDS.toSeconds(renewalDueAt - now);
    long flooredSeconds = Math.max(secondsUntilDue, MIN_ACCESS_TOKEN_VALIDITY_SECONDS);
    return (int) Math.min(flooredSeconds, tokenValiditySeconds);
  }
}
