package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.util.ValidationHttpUtil;

class SystemRepositoryNormalizeTest {

  private static final String DISCOVERY_URI =
      "https://login.microsoftonline.com/tenant-abc/v2.0/.well-known/openid-configuration";
  private static final String ISSUER = "https://login.microsoftonline.com/tenant-abc/v2.0";
  private static final String JWKS_URI =
      "https://login.microsoftonline.com/tenant-abc/discovery/v2.0/keys";
  private static final String DISCOVERY_RESPONSE =
      "{\"issuer\": \"" + ISSUER + "\", \"jwks_uri\": \"" + JWKS_URI + "\"}";

  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private SystemRepository repository;

  @BeforeEach
  void setUp() {
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);

    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SystemDAO systemDAO = mock(SystemDAO.class);
    when(collectionDAO.systemDAO()).thenReturn(systemDAO);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

    MigrationValidationClient client = mock(MigrationValidationClient.class);
    migrationMock.when(MigrationValidationClient::getInstance).thenReturn(client);

    repository = new SystemRepository();
  }

  @AfterEach
  void tearDown() {
    entityMock.close();
    migrationMock.close();
  }

  @Test
  void normalizeForPersistence_canonicalDiscoveryUri_derivesAuthorityAndPublicKeyUrls() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.CUSTOM_OIDC);
    authConfig.setDiscoveryUri(DISCOVERY_URI);
    authConfig.setCallbackUrl("http://localhost:8585/callback");
    OidcClientConfig oidc = new OidcClientConfig();
    oidc.setId("client-id-123");
    oidc.setSecret("client-secret-xyz");
    authConfig.setOidcConfiguration(oidc);

    try (MockedStatic<ValidationHttpUtil> httpMock = mockStatic(ValidationHttpUtil.class)) {
      httpMock
          .when(() -> ValidationHttpUtil.safeGet(anyString()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));

      repository.normalizeForPersistence(authConfig);
    }

    assertEquals(ISSUER, authConfig.getAuthority());
    assertNotNull(authConfig.getPublicKeyUrls());
    assertEquals(1, authConfig.getPublicKeyUrls().size());
    assertEquals(JWKS_URI, authConfig.getPublicKeyUrls().get(0));
    assertEquals(DISCOVERY_URI, authConfig.getOidcConfiguration().getDiscoveryUri());
    assertEquals("client-id-123", authConfig.getClientId());
  }

  @Test
  void normalizeForPersistence_mirrorsOidcIdToRootClientId() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.CUSTOM_OIDC);
    authConfig.setCallbackUrl("http://localhost:8585/callback");
    OidcClientConfig oidc = new OidcClientConfig();
    oidc.setId("only-in-nested");
    authConfig.setOidcConfiguration(oidc);

    try (MockedStatic<ValidationHttpUtil> httpMock = mockStatic(ValidationHttpUtil.class)) {
      httpMock
          .when(() -> ValidationHttpUtil.safeGet(anyString()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));

      repository.normalizeForPersistence(authConfig);
    }

    assertEquals("only-in-nested", authConfig.getClientId());
  }

  @Test
  void normalizeForPersistence_mirrorsRootClientIdToNested() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.CUSTOM_OIDC);
    authConfig.setClientId("only-at-root");
    authConfig.setCallbackUrl("http://localhost:8585/callback");
    authConfig.setOidcConfiguration(new OidcClientConfig());

    repository.normalizeForPersistence(authConfig);

    assertEquals("only-at-root", authConfig.getOidcConfiguration().getId());
  }

  @Test
  void normalizeForPersistence_legacyConfigWithoutDiscoveryUri_preservesExistingValues() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.CUSTOM_OIDC);
    authConfig.setAuthority("https://existing-authority.example.com");
    authConfig.setPublicKeyUrls(java.util.List.of("https://existing/keys"));
    authConfig.setClientId("legacy-client");
    authConfig.setCallbackUrl("http://legacy/callback");

    repository.normalizeForPersistence(authConfig);

    assertEquals("https://existing-authority.example.com", authConfig.getAuthority());
    assertEquals(1, authConfig.getPublicKeyUrls().size());
    assertEquals("https://existing/keys", authConfig.getPublicKeyUrls().get(0));
  }

  @Test
  void normalizeForPersistence_azureProvider_derivesTenantFromDiscoveryUri() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.AZURE);
    authConfig.setDiscoveryUri(DISCOVERY_URI);
    authConfig.setCallbackUrl("http://localhost:8585/callback");
    authConfig.setOidcConfiguration(new OidcClientConfig());

    try (MockedStatic<ValidationHttpUtil> httpMock = mockStatic(ValidationHttpUtil.class)) {
      httpMock
          .when(() -> ValidationHttpUtil.safeGet(anyString()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));

      repository.normalizeForPersistence(authConfig);
    }

    assertEquals("tenant-abc", authConfig.getOidcConfiguration().getTenant());
  }

  @Test
  void normalizeForPersistence_azureGovCloud_derivesTenant() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.AZURE);
    authConfig.setDiscoveryUri(
        "https://login.microsoftonline.us/gov-tenant-xyz/v2.0/.well-known/openid-configuration");
    authConfig.setCallbackUrl("http://localhost:8585/callback");
    authConfig.setOidcConfiguration(new OidcClientConfig());

    try (MockedStatic<ValidationHttpUtil> httpMock = mockStatic(ValidationHttpUtil.class)) {
      httpMock
          .when(() -> ValidationHttpUtil.safeGet(anyString()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));

      repository.normalizeForPersistence(authConfig);
    }

    assertEquals("gov-tenant-xyz", authConfig.getOidcConfiguration().getTenant());
  }

  @Test
  void normalizeForPersistence_nonAzureProvider_doesNotSetTenant() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.OKTA);
    authConfig.setDiscoveryUri(DISCOVERY_URI);
    authConfig.setCallbackUrl("http://localhost:8585/callback");
    authConfig.setOidcConfiguration(new OidcClientConfig());

    try (MockedStatic<ValidationHttpUtil> httpMock = mockStatic(ValidationHttpUtil.class)) {
      httpMock
          .when(() -> ValidationHttpUtil.safeGet(anyString()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));

      repository.normalizeForPersistence(authConfig);
    }

    assertNull(authConfig.getOidcConfiguration().getTenant());
  }

  @Test
  void normalizeForPersistence_nullAuthConfig_doesNotThrow() {
    repository.normalizeForPersistence(null);
  }

  @Test
  void normalizeForPersistence_discoveryUriFromNested_syncsToRoot() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.CUSTOM_OIDC);
    authConfig.setCallbackUrl("http://localhost:8585/callback");
    OidcClientConfig oidc = new OidcClientConfig();
    oidc.setDiscoveryUri(DISCOVERY_URI);
    oidc.setId("c");
    oidc.setSecret("s");
    authConfig.setOidcConfiguration(oidc);

    try (MockedStatic<ValidationHttpUtil> httpMock = mockStatic(ValidationHttpUtil.class)) {
      httpMock
          .when(() -> ValidationHttpUtil.safeGet(anyString()))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(200, DISCOVERY_RESPONSE));

      repository.normalizeForPersistence(authConfig);
    }

    assertEquals(DISCOVERY_URI, authConfig.getDiscoveryUri());
  }

  @Test
  void hydrateForResponse_legacyNestedDiscoveryUri_copiedToRoot() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.CUSTOM_OIDC);
    OidcClientConfig oidc = new OidcClientConfig();
    oidc.setDiscoveryUri(DISCOVERY_URI);
    authConfig.setOidcConfiguration(oidc);

    repository.hydrateForResponse(authConfig);

    assertEquals(DISCOVERY_URI, authConfig.getDiscoveryUri());
  }

  @Test
  void hydrateForResponse_newConfigBothPopulated_noChange() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.CUSTOM_OIDC);
    authConfig.setDiscoveryUri(DISCOVERY_URI);
    authConfig.setClientId("root-client");
    OidcClientConfig oidc = new OidcClientConfig();
    oidc.setDiscoveryUri(DISCOVERY_URI);
    oidc.setId("root-client");
    authConfig.setOidcConfiguration(oidc);

    repository.hydrateForResponse(authConfig);

    assertEquals(DISCOVERY_URI, authConfig.getDiscoveryUri());
    assertEquals("root-client", authConfig.getClientId());
    assertEquals("root-client", authConfig.getOidcConfiguration().getId());
  }

  @Test
  void hydrateForResponse_legacyRootClientId_copiedToNested() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.CUSTOM_OIDC);
    authConfig.setClientId("legacy-root-id");
    authConfig.setOidcConfiguration(new OidcClientConfig());

    repository.hydrateForResponse(authConfig);

    assertEquals("legacy-root-id", authConfig.getOidcConfiguration().getId());
  }

  @Test
  void hydrateForResponse_noNetworkCall() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.CUSTOM_OIDC);
    OidcClientConfig oidc = new OidcClientConfig();
    oidc.setDiscoveryUri(DISCOVERY_URI);
    authConfig.setOidcConfiguration(oidc);

    try (MockedStatic<ValidationHttpUtil> httpMock = mockStatic(ValidationHttpUtil.class)) {
      repository.hydrateForResponse(authConfig);

      httpMock.verifyNoInteractions();
    }
  }

  @Test
  void hydrateForResponse_nullAuthConfig_doesNotThrow() {
    repository.hydrateForResponse(null);
  }

  @Test
  void normalizeForPersistence_derivedClientType_whenNullAndSecretPresent_setsConfidential() {
    AuthenticationConfiguration authConfig = new AuthenticationConfiguration();
    authConfig.setProvider(AuthProvider.CUSTOM_OIDC);
    authConfig.setCallbackUrl("http://localhost:8585/callback");
    authConfig.setClientType(null);
    OidcClientConfig oidc = new OidcClientConfig();
    oidc.setId("c");
    oidc.setSecret("s");
    authConfig.setOidcConfiguration(oidc);

    repository.normalizeForPersistence(authConfig);

    assertEquals(ClientType.CONFIDENTIAL, authConfig.getClientType());
  }
}
