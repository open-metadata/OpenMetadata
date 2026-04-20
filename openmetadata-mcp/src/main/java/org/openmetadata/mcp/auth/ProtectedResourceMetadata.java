package org.openmetadata.mcp.auth;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.net.URI;
import java.util.List;

/**
 * RFC 9728 OAuth 2.0 Protected Resource Metadata.
 * See https://datatracker.ietf.org/doc/html/rfc9728
 *
 * This metadata describes the OAuth 2.0 protected resource (MCP server)
 * and points to the authorization servers that issue tokens for it.
 */
public class ProtectedResourceMetadata {

  @JsonProperty("resource")
  private URI resource;

  @JsonProperty("authorization_servers")
  private List<URI> authorizationServers;

  @JsonProperty("bearer_methods_supported")
  private List<String> bearerMethodsSupported;

  @JsonProperty("resource_signing_alg_values_supported")
  private List<String> resourceSigningAlgValuesSupported;

  @JsonProperty("resource_documentation")
  private URI resourceDocumentation;

  @JsonProperty("scopes_supported")
  private List<String> scopesSupported;

  public ProtectedResourceMetadata() {
    this.bearerMethodsSupported = List.of("header");
  }

  public URI getResource() {
    return resource;
  }

  public void setResource(URI resource) {
    this.resource = resource;
  }

  public List<URI> getAuthorizationServers() {
    return authorizationServers;
  }

  public void setAuthorizationServers(List<URI> authorizationServers) {
    this.authorizationServers = authorizationServers;
  }

  public List<String> getBearerMethodsSupported() {
    return bearerMethodsSupported;
  }

  public void setBearerMethodsSupported(List<String> bearerMethodsSupported) {
    this.bearerMethodsSupported = bearerMethodsSupported;
  }

  public List<String> getResourceSigningAlgValuesSupported() {
    return resourceSigningAlgValuesSupported;
  }

  public void setResourceSigningAlgValuesSupported(List<String> resourceSigningAlgValuesSupported) {
    this.resourceSigningAlgValuesSupported = resourceSigningAlgValuesSupported;
  }

  public URI getResourceDocumentation() {
    return resourceDocumentation;
  }

  public void setResourceDocumentation(URI resourceDocumentation) {
    this.resourceDocumentation = resourceDocumentation;
  }

  public List<String> getScopesSupported() {
    return scopesSupported;
  }

  public void setScopesSupported(List<String> scopesSupported) {
    this.scopesSupported = scopesSupported;
  }
}
