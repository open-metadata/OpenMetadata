package org.openmetadata.it.server.sso;

import java.util.Map;

/**
 * Configuration for a single SSO scenario — picks the OM auth provider, the OAuth2 client
 * shape (public vs confidential), and the issuer path under the {@link MockOidcServer}.
 *
 * <p>Implementations expose the env vars OM needs to boot in this mode via
 * {@link #serverEnv(MockOidcServer, int)}. The OM container's callback host port is
 * passed in because the callback URL must be one the browser can reach, and the host
 * port is fixed per launch.
 *
 * <p>Sealed so the set of supported providers stays narrow and explicit; add a new record
 * here when wiring a new provider rather than leaking provider knowledge into call sites.
 */
public sealed interface SsoProfile permits GoogleProfile, OktaProfile, CustomOidcProfile {

  /** Human-readable provider name. Drives the SSO button text on the OM sign-in page. */
  String displayName();

  /**
   * Short, kebab-case provider identifier ({@code "google"}, {@code "okta"},
   * {@code "custom-oidc"}). Used to compose backend names for {@code jpw.auth}.
   */
  String providerSlug();

  String issuerId();

  ClientType clientType();

  Map<String, String> serverEnv(MockOidcServer idp, int omHostPort);
}
