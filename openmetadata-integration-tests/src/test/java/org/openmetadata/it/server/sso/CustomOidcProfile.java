package org.openmetadata.it.server.sso;

import java.util.Map;

/**
 * Custom OIDC profile — {@code AUTHENTICATION_PROVIDER=custom-oidc} routed through a mock
 * IdP {@code /custom-oidc} issuer. Sets the human-readable
 * {@code CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME} the OM UI uses for the SSO button
 * label, since "Custom OIDC" alone isn't a recognizable brand.
 */
public record CustomOidcProfile(ClientType clientType) implements SsoProfile {

  private static final String ISSUER_ID = "custom-oidc";
  private static final String CLIENT_ID = "om-test-client";
  private static final String CLIENT_SECRET = "om-test-secret";
  private static final String DISPLAY_NAME = "Test SSO";

  @Override
  public String displayName() {
    return DISPLAY_NAME;
  }

  @Override
  public String providerSlug() {
    return "custom-oidc";
  }

  @Override
  public String issuerId() {
    return ISSUER_ID;
  }

  @Override
  public Map<String, String> serverEnv(final MockOidcServer idp, final int omHostPort) {
    return OidcEnvBuilder.build(
        "custom-oidc",
        ISSUER_ID,
        clientType,
        CLIENT_ID,
        CLIENT_SECRET,
        idp,
        omHostPort,
        DISPLAY_NAME);
  }
}
