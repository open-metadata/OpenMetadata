package org.openmetadata.mcp.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;

class OAuthClientMetadataTest {

  @Test
  void testValidateScope_nullReturnsNull() throws InvalidScopeException {
    OAuthClientMetadata metadata = new OAuthClientMetadata();
    metadata.setScope("read write");

    assertThat(metadata.validateScope(null)).isNull();
  }

  @Test
  void testValidateScope_noRegisteredScopesAllowsAny() throws InvalidScopeException {
    OAuthClientMetadata metadata = new OAuthClientMetadata();
    metadata.setScope(null);

    List<String> result = metadata.validateScope("custom admin");

    assertThat(result).containsExactly("custom", "admin");
  }

  @Test
  void testValidateScope_emptyRegisteredScopesAllowsAny() throws InvalidScopeException {
    OAuthClientMetadata metadata = new OAuthClientMetadata();
    metadata.setScope("  ");

    List<String> result = metadata.validateScope("anything");

    assertThat(result).containsExactly("anything");
  }

  @Test
  void testValidateScope_validSubsetAccepted() throws InvalidScopeException {
    OAuthClientMetadata metadata = new OAuthClientMetadata();
    metadata.setScope("read write admin");

    List<String> result = metadata.validateScope("read write");

    assertThat(result).containsExactly("read", "write");
  }

  @Test
  void testValidateScope_invalidScopeThrows() {
    OAuthClientMetadata metadata = new OAuthClientMetadata();
    metadata.setScope("read write");

    assertThatThrownBy(() -> metadata.validateScope("admin"))
        .isInstanceOf(InvalidScopeException.class)
        .hasMessageContaining("admin");
  }

  @Test
  void testValidateRedirectUri_exactMatchSucceeds() throws InvalidRedirectUriException {
    OAuthClientMetadata metadata = new OAuthClientMetadata();
    URI uri = URI.create("https://example.com/callback");
    metadata.setRedirectUris(List.of(uri, URI.create("https://other.com/cb")));

    URI result = metadata.validateRedirectUri(uri);

    assertThat(result).isEqualTo(uri);
  }

  @Test
  void testValidateRedirectUri_noMatchThrows() {
    OAuthClientMetadata metadata = new OAuthClientMetadata();
    metadata.setRedirectUris(List.of(URI.create("https://example.com/callback")));

    assertThatThrownBy(() -> metadata.validateRedirectUri(URI.create("https://evil.com/callback")))
        .isInstanceOf(InvalidRedirectUriException.class)
        .hasMessageContaining("not registered");
  }

  @Test
  void testValidateRedirectUri_nullWithSingleRegisteredReturnsSingle()
      throws InvalidRedirectUriException {
    OAuthClientMetadata metadata = new OAuthClientMetadata();
    URI uri = URI.create("https://example.com/callback");
    metadata.setRedirectUris(List.of(uri));

    URI result = metadata.validateRedirectUri(null);

    assertThat(result).isEqualTo(uri);
  }

  @Test
  void testValidateRedirectUri_nullWithMultipleRegisteredThrows() {
    OAuthClientMetadata metadata = new OAuthClientMetadata();
    metadata.setRedirectUris(
        List.of(URI.create("https://a.com/cb"), URI.create("https://b.com/cb")));

    assertThatThrownBy(() -> metadata.validateRedirectUri(null))
        .isInstanceOf(InvalidRedirectUriException.class)
        .hasMessageContaining("must be specified");
  }

  @Test
  void testValidateRedirectUri_noRegisteredUrisThrows() {
    OAuthClientMetadata metadata = new OAuthClientMetadata();
    metadata.setRedirectUris(null);

    assertThatThrownBy(() -> metadata.validateRedirectUri(URI.create("https://example.com/cb")))
        .isInstanceOf(InvalidRedirectUriException.class)
        .hasMessageContaining("No redirect URIs registered");
  }

  @Test
  void testDefaultConstructorSetsDefaults() {
    OAuthClientMetadata metadata = new OAuthClientMetadata();

    assertThat(metadata.getTokenEndpointAuthMethod()).isEqualTo("client_secret_post");
    assertThat(metadata.getGrantTypes()).containsExactly("authorization_code", "refresh_token");
    assertThat(metadata.getResponseTypes()).containsExactly("code");
  }
}
