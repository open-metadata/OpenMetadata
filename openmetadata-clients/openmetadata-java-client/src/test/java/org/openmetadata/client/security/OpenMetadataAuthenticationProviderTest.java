package org.openmetadata.client.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import feign.RequestTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;

public class OpenMetadataAuthenticationProviderTest {

  private OpenMetadataAuthenticationProvider provider;

  @BeforeEach
  public void setUp() {
    OpenMetadataConnection connection =
        new OpenMetadataConnection()
            .withAuthProvider(AuthProvider.OPENMETADATA)
            .withHostPort("http://localhost:8585/api")
            .withSecurityConfig(new OpenMetadataJWTClientConfig().withJwtToken("test-token"));

    provider = new OpenMetadataAuthenticationProvider(connection);
  }

  @Test
  public void testAuthenticationAddedForEntityNamesContainingVersion() {
    RequestTemplate template = new RequestTemplate();
    template.uri("/v1/teams/name/data-conversion-service");
    provider.apply(template);

    assertTrue(
        template.headers().containsKey("Authorization"),
        "Authorization header should be added for entities with 'conversion' in name");
  }

  @Test
  public void testAuthenticationAddedForEntityNamesWithVersionSubstring() {
    RequestTemplate template = new RequestTemplate();
    template.uri("/v1/topics/name/dataset-version-update-events");
    provider.apply(template);

    assertTrue(
        template.headers().containsKey("Authorization"),
        "Authorization header should be added for entities with 'version' in name");
  }

  @Test
  public void testAuthenticationSkippedForVersionEndpoint() {
    RequestTemplate template = new RequestTemplate();
    template.uri("/v1/system/version");
    provider.apply(template);

    assertFalse(
        template.headers().containsKey("Authorization"),
        "Authorization header should NOT be added for /system/version endpoint");
  }

  @Test
  public void testAuthenticationSkippedForVersionEndpointWithQueryParams() {
    RequestTemplate template = new RequestTemplate();
    template.uri("/v1/system/version?param=value");
    provider.apply(template);

    assertFalse(
        template.headers().containsKey("Authorization"),
        "Authorization header should NOT be added for /system/version endpoint with query params");
  }

  @Test
  public void testAuthenticationAddedForRegularEndpoints() {
    RequestTemplate template = new RequestTemplate();
    template.uri("/v1/teams/name/my-team");
    provider.apply(template);

    assertTrue(
        template.headers().containsKey("Authorization"),
        "Authorization header should be added for regular endpoints");
  }
}
