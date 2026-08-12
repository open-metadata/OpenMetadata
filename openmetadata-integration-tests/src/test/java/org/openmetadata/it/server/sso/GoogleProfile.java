package org.openmetadata.it.server.sso;

import java.util.Map;

/**
 * Google SSO profile — {@code AUTHENTICATION_PROVIDER=google} routed through a mock IdP
 * {@code /google} issuer. Public client uses the implicit-style {@code id_token} flow;
 * confidential adds the {@code OIDC_*} server-side code-exchange config.
 */
public record GoogleProfile(ClientType clientType) implements SsoProfile {

  private static final String ISSUER_ID = "google";
  private static final String CLIENT_ID = "om-test-client";
  private static final String CLIENT_SECRET = "om-test-secret";

  @Override
  public String displayName() {
    return "Google";
  }

  @Override
  public String providerSlug() {
    return "google";
  }

  @Override
  public String issuerId() {
    return ISSUER_ID;
  }

  @Override
  public Map<String, String> serverEnv(final MockOidcServer idp, final int omHostPort) {
    return OidcEnvBuilder.build(
        "google", ISSUER_ID, clientType, CLIENT_ID, CLIENT_SECRET, idp, omHostPort, null);
  }
}
