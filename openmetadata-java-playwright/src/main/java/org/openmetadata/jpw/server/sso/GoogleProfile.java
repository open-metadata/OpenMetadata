package org.openmetadata.jpw.server.sso;

import java.util.HashMap;
import java.util.Map;

/**
 * Google SSO profile — drives OM to boot with {@code AUTHENTICATION_PROVIDER=google} and
 * routes all IdP traffic to a {@link MockOidcServer} {@code /google} issuer.
 *
 * <p>{@link ClientType#PUBLIC} uses {@code response_type=id_token} (browser receives the
 * token directly); {@link ClientType#CONFIDENTIAL} uses {@code response_type=code} and
 * adds {@code OIDC_*} vars for OM's server-side code exchange.
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
  public String issuerId() {
    return ISSUER_ID;
  }

  @Override
  public Map<String, String> serverEnv(final MockOidcServer idp, final int omHostPort) {
    final String issuer = idp.issuerUrl(ISSUER_ID).toString();
    final String jwks = idp.jwksUrl(ISSUER_ID).toString();
    final String discovery = idp.discoveryUrl(ISSUER_ID).toString();
    final String callback = "http://localhost:" + omHostPort + "/callback";
    final String serverUrl = "http://localhost:" + omHostPort;

    final Map<String, String> env = new HashMap<>();
    env.put("AUTHENTICATION_PROVIDER", "google");
    env.put("AUTHENTICATION_AUTHORITY", issuer);
    env.put("AUTHENTICATION_CLIENT_ID", CLIENT_ID);
    env.put("AUTHENTICATION_CALLBACK_URL", callback);
    env.put("AUTHENTICATION_PUBLIC_KEYS", "[" + jwks + "]");
    env.put("AUTHENTICATION_CLIENT_TYPE", clientTypeEnv());
    env.put("AUTHENTICATION_RESPONSE_TYPE", responseTypeEnv());

    if (clientType == ClientType.CONFIDENTIAL) {
      env.put("OIDC_TYPE", "google");
      env.put("OIDC_CLIENT_ID", CLIENT_ID);
      env.put("OIDC_CLIENT_SECRET", CLIENT_SECRET);
      env.put("OIDC_DISCOVERY_URI", discovery);
      env.put("OIDC_CALLBACK", callback);
      env.put("OIDC_SERVER_URL", serverUrl);
      env.put("OIDC_RESPONSE_TYPE", "code");
    }
    return env;
  }

  private String clientTypeEnv() {
    return clientType == ClientType.CONFIDENTIAL ? "confidential" : "public";
  }

  private String responseTypeEnv() {
    return clientType == ClientType.CONFIDENTIAL ? "code" : "id_token";
  }
}
