package org.openmetadata.it.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Pins the shape of BASE_URL. This resolution has been wrong twice against the ephemeral k8s
 * cluster and neither failure named itself: seeding nothing from OM_URL surfaced as
 * {@code ConnectException} against localhost, and seeding it without {@code /api} surfaced as
 * {@code Unexpected character ('<')} because {@code /v1/...} is served by the UI, not the API.
 *
 * <p>The invariant is that callers append {@code /v1/...} to whatever this returns, and the
 * server's {@code rootPath} is {@code /api/*} in every config, so the suffix belongs here.
 */
class SdkClientsBaseUrlTest {

  private static final String OM_URL = "http://collate.java-it-123:8585";

  @Test
  void omUrlGainsTheApiSuffix() {
    assertThat(SdkClients.resolveBaseUrl(null, OM_URL)).isEqualTo(OM_URL + "/api");
  }

  @Test
  void omUrlWithTrailingSlashDoesNotDoubleTheSeparator() {
    assertThat(SdkClients.resolveBaseUrl(null, OM_URL + "/")).isEqualTo(OM_URL + "/api");
  }

  // TestSuiteBootstrap already sets IT_BASE_URL to ".../api", so this one is taken verbatim —
  // appending again would produce /api/api/v1.
  @Test
  void explicitBaseUrlIsUsedAsGiven() {
    assertThat(SdkClients.resolveBaseUrl("http://localhost:1234/api", OM_URL))
        .isEqualTo("http://localhost:1234/api");
  }

  @Test
  void explicitBaseUrlWinsOverOmUrl() {
    assertThat(SdkClients.resolveBaseUrl("http://localhost:1234/api", OM_URL))
        .doesNotContain("collate");
  }

  @Test
  void neitherSetFallsBackToLocalhost() {
    assertThat(SdkClients.resolveBaseUrl(null, null)).isEqualTo("http://localhost:8585");
  }
}
