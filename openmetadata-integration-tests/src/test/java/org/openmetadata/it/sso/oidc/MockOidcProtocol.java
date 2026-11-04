package org.openmetadata.it.sso.oidc;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/** The OpenID Connect names and wire shapes the mock provider speaks. */
final class MockOidcProtocol {
  static final String DISCOVERY_PATH = "/.well-known/openid-configuration";
  static final String AUTHORIZE_PATH = "/authorize";
  static final String TOKEN_PATH = "/token";
  static final String JWKS_PATH = "/jwks";
  static final String USERINFO_PATH = "/userinfo";

  static final String CLIENT_ID = "client_id";
  static final String CLIENT_SECRET = "client_secret";
  static final String REDIRECT_URI = "redirect_uri";
  static final String STATE = "state";
  static final String NONCE = "nonce";
  static final String SCOPE = "scope";
  static final String PROMPT = "prompt";
  static final String CODE = "code";
  static final String CODE_CHALLENGE = "code_challenge";
  static final String CODE_VERIFIER = "code_verifier";
  static final String GRANT_TYPE = "grant_type";
  static final String REFRESH_TOKEN = "refresh_token";
  static final String ERROR = "error";
  static final String ISSUER = "iss";

  static final String GRANT_AUTHORIZATION_CODE = "authorization_code";
  static final String GRANT_REFRESH_TOKEN = "refresh_token";
  static final String GRANT_CLIENT_CREDENTIALS = "client_credentials";
  static final String PROMPT_NONE = "none";
  static final String OFFLINE_ACCESS = "offline_access";

  static final String INVALID_CLIENT = "invalid_client";
  static final String INVALID_GRANT = "invalid_grant";
  static final String UNSUPPORTED_GRANT_TYPE = "unsupported_grant_type";
  static final String LOGIN_REQUIRED = "login_required";

  private MockOidcProtocol() {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  record Discovery(
      String issuer,
      @JsonProperty("authorization_endpoint") String authorizationEndpoint,
      @JsonProperty("token_endpoint") String tokenEndpoint,
      @JsonProperty("jwks_uri") String jwksUri,
      @JsonProperty("userinfo_endpoint") String userinfoEndpoint,
      @JsonProperty("scopes_supported") List<String> scopesSupported,
      @JsonProperty("response_types_supported") List<String> responseTypesSupported,
      @JsonProperty("subject_types_supported") List<String> subjectTypesSupported,
      @JsonProperty("id_token_signing_alg_values_supported") List<String> signingAlgorithms,
      @JsonProperty("token_endpoint_auth_methods_supported") List<String> tokenAuthMethods,
      @JsonProperty("code_challenge_methods_supported") List<String> codeChallengeMethods,
      @JsonProperty("grant_types_supported") List<String> grantTypes,
      @JsonProperty("authorization_response_iss_parameter_supported")
          Boolean issuerParameterSupported) {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  record TokenResponse(
      @JsonProperty("access_token") String accessToken,
      @JsonProperty("token_type") String tokenType,
      @JsonProperty("expires_in") long expiresIn,
      @JsonProperty("id_token") String idToken,
      @JsonProperty("refresh_token") String refreshToken) {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  record ErrorResponse(String error, @JsonProperty("error_description") String errorDescription) {}
}
