package org.openmetadata.it.server.sso;

import java.util.Map;

/**
 * Okta SSO profile — {@code AUTHENTICATION_PROVIDER=okta} routed through a mock IdP
 * {@code /okta} issuer. The OM signed-token validation, callback, and OIDC code exchange
 * all run against the same mock OAuth2 server as the Google profile; only the provider
 * key, issuer path, and the SSO button label on the sign-in page differ.
 */
public record OktaProfile(ClientType clientType) implements SsoProfile {

  private static final String ISSUER_ID = "okta";
  private static final String CLIENT_ID = "om-test-client";
  private static final String CLIENT_SECRET = "om-test-secret";

  @Override
  public String displayName() {
    return "Okta";
  }

  @Override
  public String providerSlug() {
    return "okta";
  }

  @Override
  public String issuerId() {
    return ISSUER_ID;
  }

  @Override
  public Map<String, String> serverEnv(final MockOidcServer idp, final int omHostPort) {
    return OidcEnvBuilder.build(
        "okta", ISSUER_ID, clientType, CLIENT_ID, CLIENT_SECRET, idp, omHostPort, null);
  }
}
