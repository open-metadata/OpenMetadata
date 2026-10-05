package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class ProviderTokenScheduleTest {

  private static final int TOKEN_VALIDITY_SECONDS = 3600;
  // The browser's proactive timer renews a token a minute before it expires.
  private static final int BROWSER_REFRESH_LEAD_SECONDS = 60;
  private static final long NOW = 1_700_000_000_000L;

  @Test
  void isRenewalDue_withoutARecordedDueTime_isDue() {
    assertTrue(ProviderTokenSchedule.isRenewalDue(null, NOW, TOKEN_VALIDITY_SECONDS));
  }

  @Test
  void isRenewalDue_whenTheProviderTokensLapseBeforeTheNextAccessToken_isDue() {
    assertTrue(
        ProviderTokenSchedule.isRenewalDue(secondsFromNow(300), NOW, TOKEN_VALIDITY_SECONDS));
    assertTrue(
        ProviderTokenSchedule.isRenewalDue(secondsFromNow(-30), NOW, TOKEN_VALIDITY_SECONDS));
  }

  @Test
  void isRenewalDue_whenTheProviderTokensOutliveTheNextAccessToken_isNotDue() {
    assertFalse(
        ProviderTokenSchedule.isRenewalDue(secondsFromNow(7200), NOW, TOKEN_VALIDITY_SECONDS));
  }

  @Test
  void renewalDueAt_followsTheProvidersExpiresIn() {
    assertEquals(
        secondsFromNow(300), ProviderTokenSchedule.renewalDueAt(NOW, 300, TOKEN_VALIDITY_SECONDS));
  }

  @Test
  void renewalDueAt_withoutExpiresIn_renewsAtTheNextRefresh() {
    long dueAt = ProviderTokenSchedule.renewalDueAt(NOW, 0, TOKEN_VALIDITY_SECONDS);

    assertEquals(secondsFromNow(TOKEN_VALIDITY_SECONDS), dueAt);
    long nextRefresh = NOW + TimeUnit.SECONDS.toMillis(TOKEN_VALIDITY_SECONDS - 60);
    assertTrue(ProviderTokenSchedule.isRenewalDue(dueAt, nextRefresh, TOKEN_VALIDITY_SECONDS));
  }

  @Test
  void retryAt_asksAgainAfterTheRetryInterval() {
    assertEquals(
        secondsFromNow(ProviderTokenSchedule.RETRY_AFTER_SECONDS),
        ProviderTokenSchedule.retryAt(NOW));
  }

  @Test
  void accessTokenValidity_withoutAProviderSchedule_isTheConfiguredValidity() {
    assertEquals(
        TOKEN_VALIDITY_SECONDS,
        ProviderTokenSchedule.accessTokenValiditySeconds(null, NOW, TOKEN_VALIDITY_SECONDS));
  }

  @Test
  void accessTokenValidity_endsWhenTheProviderTokensNeedRenewing() {
    assertEquals(
        300,
        ProviderTokenSchedule.accessTokenValiditySeconds(
            secondsFromNow(300), NOW, TOKEN_VALIDITY_SECONDS));
  }

  @Test
  void accessTokenValidity_neverExceedsTheConfiguredValidity() {
    assertEquals(
        TOKEN_VALIDITY_SECONDS,
        ProviderTokenSchedule.accessTokenValiditySeconds(
            secondsFromNow(86_400), NOW, TOKEN_VALIDITY_SECONDS));
  }

  @Test
  void accessTokenValidity_isFlooredSoTheBrowserDoesNotRefreshInALoop() {
    int floor = ProviderTokenSchedule.MIN_ACCESS_TOKEN_VALIDITY_SECONDS;

    assertEquals(
        floor,
        ProviderTokenSchedule.accessTokenValiditySeconds(
            secondsFromNow(30), NOW, TOKEN_VALIDITY_SECONDS));
    assertEquals(
        floor,
        ProviderTokenSchedule.accessTokenValiditySeconds(
            secondsFromNow(-600), NOW, TOKEN_VALIDITY_SECONDS));
    assertTrue(floor > BROWSER_REFRESH_LEAD_SECONDS);
  }

  @Test
  void accessTokenValidity_floorNeverRaisesAShorterConfiguredValidity() {
    assertEquals(60, ProviderTokenSchedule.accessTokenValiditySeconds(secondsFromNow(30), NOW, 60));
  }

  @Test
  void anOpenBrowserRenewsShortLivedProviderTokensBeforeTheyLapse() {
    // Keycloak defaults: 5-minute access tokens, and the SSO session idles out after 30 minutes
    // without a refresh-token grant. Before, the provider was first asked 3.5 days in.
    long providerLifetimeSeconds = 300;
    long now = NOW;
    long dueAt =
        ProviderTokenSchedule.renewalDueAt(now, providerLifetimeSeconds, TOKEN_VALIDITY_SECONDS);
    long lastGrant = now;

    for (int refresh = 0; refresh < 100; refresh++) {
      now = nextBrowserRefresh(dueAt, now);
      assertTrue(ProviderTokenSchedule.isRenewalDue(dueAt, now, TOKEN_VALIDITY_SECONDS));
      assertTrue(now - lastGrant <= TimeUnit.SECONDS.toMillis(providerLifetimeSeconds));
      dueAt =
          ProviderTokenSchedule.renewalDueAt(now, providerLifetimeSeconds, TOKEN_VALIDITY_SECONDS);
      lastGrant = now;
    }
  }

  @Test
  void longLivedProviderTokensAreRenewedOnlyWhenTheyAreAboutToLapse() {
    // Auth0-style day-long access tokens: hourly OpenMetadata refreshes leave the provider alone
    // until the last hour before its tokens lapse.
    long providerLifetimeSeconds = 86_400;
    long now = NOW;
    long dueAt =
        ProviderTokenSchedule.renewalDueAt(now, providerLifetimeSeconds, TOKEN_VALIDITY_SECONDS);
    int grants = 0;

    while (now < NOW + TimeUnit.DAYS.toMillis(2)) {
      now = nextBrowserRefresh(dueAt, now);
      if (ProviderTokenSchedule.isRenewalDue(dueAt, now, TOKEN_VALIDITY_SECONDS)) {
        assertTrue(dueAt > now, "renewed only after the provider's tokens had lapsed");
        dueAt =
            ProviderTokenSchedule.renewalDueAt(
                now, providerLifetimeSeconds, TOKEN_VALIDITY_SECONDS);
        grants++;
      }
    }

    assertEquals(2, grants);
  }

  private static long nextBrowserRefresh(long dueAt, long now) {
    int validitySeconds =
        ProviderTokenSchedule.accessTokenValiditySeconds(dueAt, now, TOKEN_VALIDITY_SECONDS);
    return now + TimeUnit.SECONDS.toMillis(validitySeconds - BROWSER_REFRESH_LEAD_SECONDS);
  }

  private static long secondsFromNow(long seconds) {
    return NOW + TimeUnit.SECONDS.toMillis(seconds);
  }
}
