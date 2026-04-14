package org.openmetadata.mcp.server.auth.handlers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.net.URI;
import java.util.List;
import java.util.concurrent.CompletionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.auth.OAuthClientMetadata;
import org.openmetadata.mcp.auth.exception.RegistrationException;
import org.openmetadata.mcp.server.auth.repository.OAuthClientRepository;

@ExtendWith(MockitoExtension.class)
class RegistrationHandlerTest {

  @Mock private OAuthClientRepository clientRepository;

  private RegistrationHandler handler;

  @BeforeEach
  void setUp() {
    handler = new RegistrationHandler(clientRepository);
  }

  private OAuthClientMetadata validMetadata() {
    OAuthClientMetadata metadata = new OAuthClientMetadata();
    metadata.setClientName("TestClient");
    metadata.setRedirectUris(List.of(URI.create("https://example.com/callback")));
    return metadata;
  }

  @Test
  void testValidRegistration_generatesCredentials() {
    OAuthClientInformation result = handler.handle(validMetadata()).join();

    assertThat(result.getClientId()).isNotNull().isNotEmpty();
    assertThat(result.getClientSecret()).isNotNull().isNotEmpty();
    assertThat(result.getClientIdIssuedAt()).isGreaterThan(0);
    assertThat(result.getClientSecretExpiresAt()).isEqualTo(0L);
    verify(clientRepository).register(any(OAuthClientInformation.class));
  }

  @Test
  void testValidRegistration_copiesMetadata() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setClientName("MyApp");
    metadata.setScope("read write");

    OAuthClientInformation result = handler.handle(metadata).join();

    assertThat(result.getClientName()).isEqualTo("MyApp");
    assertThat(result.getScope()).isEqualTo("read write");
    assertThat(result.getRedirectUris())
        .containsExactly(URI.create("https://example.com/callback"));
  }

  @Test
  void testValidRegistration_defaultsGrantTypes() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setGrantTypes(null);

    OAuthClientInformation result = handler.handle(metadata).join();

    assertThat(result.getGrantTypes()).containsExactly("authorization_code", "refresh_token");
  }

  @Test
  void testValidRegistration_defaultsResponseTypes() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setResponseTypes(null);

    OAuthClientInformation result = handler.handle(metadata).join();

    assertThat(result.getResponseTypes()).containsExactly("code");
  }

  @Test
  void testValidRegistration_defaultsAuthMethod() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setTokenEndpointAuthMethod(null);

    OAuthClientInformation result = handler.handle(metadata).join();

    assertThat(result.getTokenEndpointAuthMethod()).isEqualTo("client_secret_post");
  }

  @Test
  void testMissingRedirectUris_throwsRegistrationException() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setRedirectUris(null);

    assertThatThrownBy(() -> handler.handle(metadata).join())
        .isInstanceOf(CompletionException.class)
        .hasCauseInstanceOf(RuntimeException.class)
        .hasRootCauseInstanceOf(RegistrationException.class);

    verify(clientRepository, never()).register(any());
  }

  @Test
  void testEmptyRedirectUris_throwsRegistrationException() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setRedirectUris(List.of());

    assertThatThrownBy(() -> handler.handle(metadata).join())
        .isInstanceOf(CompletionException.class)
        .hasRootCauseInstanceOf(RegistrationException.class);

    verify(clientRepository, never()).register(any());
  }

  @Test
  void testBlockedScheme_javascript_throwsRegistrationException() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setRedirectUris(List.of(URI.create("javascript:alert(1)")));

    assertThatThrownBy(() -> handler.handle(metadata).join())
        .isInstanceOf(CompletionException.class)
        .hasRootCauseInstanceOf(RegistrationException.class);

    verify(clientRepository, never()).register(any());
  }

  @Test
  void testBlockedScheme_data_throwsRegistrationException() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setRedirectUris(List.of(URI.create("data:text/html,hello")));

    assertThatThrownBy(() -> handler.handle(metadata).join())
        .isInstanceOf(CompletionException.class)
        .hasRootCauseInstanceOf(RegistrationException.class);

    verify(clientRepository, never()).register(any());
  }

  @Test
  void testFragmentInUri_throwsRegistrationException() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setRedirectUris(List.of(URI.create("https://example.com/cb#fragment")));

    assertThatThrownBy(() -> handler.handle(metadata).join())
        .isInstanceOf(CompletionException.class)
        .hasRootCauseInstanceOf(RegistrationException.class);

    verify(clientRepository, never()).register(any());
  }

  @Test
  void testNonLoopbackHttp_throwsRegistrationException() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setRedirectUris(List.of(URI.create("http://example.com/callback")));

    assertThatThrownBy(() -> handler.handle(metadata).join())
        .isInstanceOf(CompletionException.class)
        .hasRootCauseInstanceOf(RegistrationException.class);

    verify(clientRepository, never()).register(any());
  }

  @Test
  void testLoopbackHttp_accepted() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setRedirectUris(List.of(URI.create("http://localhost:8080/callback")));

    OAuthClientInformation result = handler.handle(metadata).join();

    assertThat(result.getClientId()).isNotNull();
    verify(clientRepository).register(any());
  }

  @Test
  void testLoopback127001Http_accepted() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setRedirectUris(List.of(URI.create("http://127.0.0.1:8080/callback")));

    OAuthClientInformation result = handler.handle(metadata).join();

    assertThat(result.getClientId()).isNotNull();
    verify(clientRepository).register(any());
  }

  @Test
  void testPrivateUseScheme_accepted() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setRedirectUris(List.of(URI.create("cursor://callback")));

    OAuthClientInformation result = handler.handle(metadata).join();

    assertThat(result.getClientId()).isNotNull();
    verify(clientRepository).register(any());
  }

  @Test
  void testUnsupportedGrantType_throwsRegistrationException() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setGrantTypes(List.of("implicit"));

    assertThatThrownBy(() -> handler.handle(metadata).join())
        .isInstanceOf(CompletionException.class)
        .hasRootCauseInstanceOf(RegistrationException.class);

    verify(clientRepository, never()).register(any());
  }

  @Test
  void testUnsupportedResponseType_throwsRegistrationException() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setResponseTypes(List.of("token"));

    assertThatThrownBy(() -> handler.handle(metadata).join())
        .isInstanceOf(CompletionException.class)
        .hasRootCauseInstanceOf(RegistrationException.class);

    verify(clientRepository, never()).register(any());
  }

  @Test
  void testFieldLengthExceeded_throwsRegistrationException() {
    OAuthClientMetadata metadata = validMetadata();
    metadata.setClientName("x".repeat(256));

    assertThatThrownBy(() -> handler.handle(metadata).join())
        .isInstanceOf(CompletionException.class)
        .hasRootCauseInstanceOf(RegistrationException.class);

    verify(clientRepository, never()).register(any());
  }
}
