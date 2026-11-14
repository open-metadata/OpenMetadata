package org.openmetadata.it.sso.oidc;

import java.util.LinkedHashMap;
import java.util.Map;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;

/**
 * How one real identity provider shapes its issuer and ID-token claims, so a test can sign in "as"
 * that provider through the mock. Only the shapes the server reads are modelled.
 */
public enum OidcProviderProfile {
  CUSTOM(AuthProvider.CUSTOM_OIDC, null),
  /** A path-style realm issuer; the login name in {@code preferred_username}. */
  KEYCLOAK(AuthProvider.CUSTOM_OIDC, null),
  /** A custom authorization server issuer. */
  OKTA(AuthProvider.OKTA, null),
  /** Google's documented schemeless issuer form, a hosted domain, and the Google client type. */
  GOOGLE(AuthProvider.GOOGLE, "google"),
  /** An issuer with a trailing slash. */
  AUTH0(AuthProvider.AUTH_0, null),
  /** A user-pool issuer and {@code cognito:username}. */
  COGNITO(AuthProvider.AWS_COGNITO, null),
  /**
   * Entra ID v2 for a single-tenant app: a tenant issuer, {@code tid}, the UPN as {@code
   * preferred_username} and no {@code email} claim unless the tenant adds it as an optional claim.
   * The multi-tenant issuer template ({@code .../{tenantid}/v2.0}) only parses with the Azure
   * client type, whose discovery host pac4j fixes to login.microsoftonline.com.
   */
  ENTRA(AuthProvider.AZURE, null);

  public static final String ENTRA_TENANT_ID = "8f6bd38f-4e6a-4f8e-9c5b-0d2a5e1c7b11";
  private static final String GOOGLE_ISSUER = "https://accounts.google.com";
  private static final String GOOGLE_SCHEMELESS_ISSUER = "accounts.google.com";
  private static final String ENTRA_ISSUER =
      "https://login.microsoftonline.com/" + ENTRA_TENANT_ID + "/v2.0";
  private static final String COGNITO_ISSUER =
      "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_SsoIt";
  private static final String EMAIL = "email";
  private static final String PREFERRED_USERNAME = "preferred_username";

  private final AuthProvider provider;
  private final String clientType;

  OidcProviderProfile(AuthProvider provider, String clientType) {
    this.provider = provider;
    this.clientType = clientType;
  }

  public AuthProvider provider() {
    return provider;
  }

  /** The OIDC client {@code type} the server builds its pac4j client from; null for generic. */
  public String clientType() {
    return clientType;
  }

  String discoveryIssuer(String baseUrl) {
    return switch (this) {
      case CUSTOM -> baseUrl;
      case KEYCLOAK -> baseUrl + "/realms/openmetadata";
      case OKTA -> baseUrl + "/oauth2/default";
      case GOOGLE -> GOOGLE_ISSUER;
      case AUTH0 -> baseUrl + "/";
      case COGNITO -> COGNITO_ISSUER;
      case ENTRA -> ENTRA_ISSUER;
    };
  }

  String tokenIssuer(String baseUrl) {
    return this == GOOGLE ? GOOGLE_SCHEMELESS_ISSUER : discoveryIssuer(baseUrl);
  }

  /** The identity's claims as this provider would put them in an ID token. */
  Map<String, Object> shapeClaims(MockOidcIdentity identity) {
    Map<String, Object> claims = new LinkedHashMap<>(identity.identityClaims());
    switch (this) {
      case CUSTOM, AUTH0 -> {}
      case KEYCLOAK -> claims.put(PREFERRED_USERNAME, localPart(identity));
      case OKTA -> claims.put(PREFERRED_USERNAME, identity.email());
      case GOOGLE -> googleClaims(claims, identity);
      case COGNITO -> claims.put("cognito:username", localPart(identity));
      case ENTRA -> entraClaims(claims, identity);
    }
    return claims;
  }

  private static void googleClaims(Map<String, Object> claims, MockOidcIdentity identity) {
    claims.put("email_verified", true);
    claims.put("hd", identity.email().substring(identity.email().indexOf('@') + 1));
  }

  private static void entraClaims(Map<String, Object> claims, MockOidcIdentity identity) {
    claims.remove(EMAIL);
    claims.put(PREFERRED_USERNAME, identity.email());
    claims.put("upn", identity.email());
    claims.put("tid", ENTRA_TENANT_ID);
    claims.put("oid", identity.subject());
  }

  private static String localPart(MockOidcIdentity identity) {
    return identity.email().substring(0, identity.email().indexOf('@'));
  }
}
