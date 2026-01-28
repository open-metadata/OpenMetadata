package org.openmetadata.mcp.auth;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.net.URI;
import java.util.Arrays;
import java.util.List;

/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata. See
 * https://datatracker.ietf.org/doc/html/rfc8414#section-2
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OAuthMetadata {

  @JsonProperty("issuer")
  private URI issuer;

  @JsonProperty("authorization_endpoint")
  private URI authorizationEndpoint;

  @JsonProperty("token_endpoint")
  private URI tokenEndpoint;

  @JsonProperty("registration_endpoint")
  private URI registrationEndpoint;

  @JsonProperty("scopes_supported")
  private List<String> scopesSupported;

  @JsonProperty("response_types_supported")
  private List<String> responseTypesSupported;

  @JsonProperty("response_modes_supported")
  private List<String> responseModesSupported;

  @JsonProperty("grant_types_supported")
  private List<String> grantTypesSupported;

  @JsonProperty("token_endpoint_auth_methods_supported")
  private List<String> tokenEndpointAuthMethodsSupported;

  @JsonProperty("token_endpoint_auth_signing_alg_values_supported")
  private List<String> tokenEndpointAuthSigningAlgValuesSupported;

  @JsonProperty("service_documentation")
  private URI serviceDocumentation;

  @JsonProperty("ui_locales_supported")
  private List<String> uiLocalesSupported;

  @JsonProperty("op_policy_uri")
  private URI opPolicyUri;

  @JsonProperty("op_tos_uri")
  private URI opTosUri;

  @JsonProperty("revocation_endpoint")
  private URI revocationEndpoint;

  @JsonProperty("revocation_endpoint_auth_methods_supported")
  private List<String> revocationEndpointAuthMethodsSupported;

  @JsonProperty("revocation_endpoint_auth_signing_alg_values_supported")
  private List<String> revocationEndpointAuthSigningAlgValuesSupported;

  @JsonProperty("introspection_endpoint")
  private URI introspectionEndpoint;

  @JsonProperty("introspection_endpoint_auth_methods_supported")
  private List<String> introspectionEndpointAuthMethodsSupported;

  @JsonProperty("introspection_endpoint_auth_signing_alg_values_supported")
  private List<String> introspectionEndpointAuthSigningAlgValuesSupported;

  @JsonProperty("code_challenge_methods_supported")
  private List<String> codeChallengeMethodsSupported;

  public OAuthMetadata() {
    this.responseTypesSupported = Arrays.asList("code");
  }

  // Getters and setters
  public URI getIssuer() {
    return issuer;
  }

  public void setIssuer(URI issuer) {
    this.issuer = issuer;
  }

  public URI getAuthorizationEndpoint() {
    return authorizationEndpoint;
  }

  public void setAuthorizationEndpoint(URI authorizationEndpoint) {
    this.authorizationEndpoint = authorizationEndpoint;
  }

  public URI getTokenEndpoint() {
    return tokenEndpoint;
  }

  public void setTokenEndpoint(URI tokenEndpoint) {
    this.tokenEndpoint = tokenEndpoint;
  }

  public URI getRegistrationEndpoint() {
    return registrationEndpoint;
  }

  public void setRegistrationEndpoint(URI registrationEndpoint) {
    this.registrationEndpoint = registrationEndpoint;
  }

  public List<String> getScopesSupported() {
    return scopesSupported;
  }

  public void setScopesSupported(List<String> scopesSupported) {
    this.scopesSupported = scopesSupported;
  }

  public List<String> getResponseTypesSupported() {
    return responseTypesSupported;
  }

  public void setResponseTypesSupported(List<String> responseTypesSupported) {
    this.responseTypesSupported = responseTypesSupported;
  }

  public List<String> getResponseModesSupported() {
    return responseModesSupported;
  }

  public void setResponseModesSupported(List<String> responseModesSupported) {
    this.responseModesSupported = responseModesSupported;
  }

  public List<String> getGrantTypesSupported() {
    return grantTypesSupported;
  }

  public void setGrantTypesSupported(List<String> grantTypesSupported) {
    this.grantTypesSupported = grantTypesSupported;
  }

  public List<String> getTokenEndpointAuthMethodsSupported() {
    return tokenEndpointAuthMethodsSupported;
  }

  public void setTokenEndpointAuthMethodsSupported(List<String> tokenEndpointAuthMethodsSupported) {
    this.tokenEndpointAuthMethodsSupported = tokenEndpointAuthMethodsSupported;
  }

  public List<String> getTokenEndpointAuthSigningAlgValuesSupported() {
    return tokenEndpointAuthSigningAlgValuesSupported;
  }

  public void setTokenEndpointAuthSigningAlgValuesSupported(
      List<String> tokenEndpointAuthSigningAlgValuesSupported) {
    this.tokenEndpointAuthSigningAlgValuesSupported = tokenEndpointAuthSigningAlgValuesSupported;
  }

  public URI getServiceDocumentation() {
    return serviceDocumentation;
  }

  public void setServiceDocumentation(URI serviceDocumentation) {
    this.serviceDocumentation = serviceDocumentation;
  }

  public List<String> getUiLocalesSupported() {
    return uiLocalesSupported;
  }

  public void setUiLocalesSupported(List<String> uiLocalesSupported) {
    this.uiLocalesSupported = uiLocalesSupported;
  }

  public URI getOpPolicyUri() {
    return opPolicyUri;
  }

  public void setOpPolicyUri(URI opPolicyUri) {
    this.opPolicyUri = opPolicyUri;
  }

  public URI getOpTosUri() {
    return opTosUri;
  }

  public void setOpTosUri(URI opTosUri) {
    this.opTosUri = opTosUri;
  }

  public URI getRevocationEndpoint() {
    return revocationEndpoint;
  }

  public void setRevocationEndpoint(URI revocationEndpoint) {
    this.revocationEndpoint = revocationEndpoint;
  }

  public List<String> getRevocationEndpointAuthMethodsSupported() {
    return revocationEndpointAuthMethodsSupported;
  }

  public void setRevocationEndpointAuthMethodsSupported(
      List<String> revocationEndpointAuthMethodsSupported) {
    this.revocationEndpointAuthMethodsSupported = revocationEndpointAuthMethodsSupported;
  }

  public List<String> getRevocationEndpointAuthSigningAlgValuesSupported() {
    return revocationEndpointAuthSigningAlgValuesSupported;
  }

  public void setRevocationEndpointAuthSigningAlgValuesSupported(
      List<String> revocationEndpointAuthSigningAlgValuesSupported) {
    this.revocationEndpointAuthSigningAlgValuesSupported =
        revocationEndpointAuthSigningAlgValuesSupported;
  }

  public URI getIntrospectionEndpoint() {
    return introspectionEndpoint;
  }

  public void setIntrospectionEndpoint(URI introspectionEndpoint) {
    this.introspectionEndpoint = introspectionEndpoint;
  }

  public List<String> getIntrospectionEndpointAuthMethodsSupported() {
    return introspectionEndpointAuthMethodsSupported;
  }

  public void setIntrospectionEndpointAuthMethodsSupported(
      List<String> introspectionEndpointAuthMethodsSupported) {
    this.introspectionEndpointAuthMethodsSupported = introspectionEndpointAuthMethodsSupported;
  }

  public List<String> getIntrospectionEndpointAuthSigningAlgValuesSupported() {
    return introspectionEndpointAuthSigningAlgValuesSupported;
  }

  public void setIntrospectionEndpointAuthSigningAlgValuesSupported(
      List<String> introspectionEndpointAuthSigningAlgValuesSupported) {
    this.introspectionEndpointAuthSigningAlgValuesSupported =
        introspectionEndpointAuthSigningAlgValuesSupported;
  }

  public List<String> getCodeChallengeMethodsSupported() {
    return codeChallengeMethodsSupported;
  }

  public void setCodeChallengeMethodsSupported(List<String> codeChallengeMethodsSupported) {
    this.codeChallengeMethodsSupported = codeChallengeMethodsSupported;
  }
}
