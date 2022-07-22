package org.openmetadata.catalog.validators;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.dropwizard.db.DataSourceFactory;
import java.util.ArrayList;
import java.util.List;
import javax.validation.ConstraintViolation;
import javax.validation.Validation;
import javax.validation.Validator;
import javax.validation.ValidatorFactory;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.airflow.AuthConfiguration;
import org.openmetadata.catalog.migration.MigrationConfiguration;
import org.openmetadata.catalog.security.client.Auth0SSOClientConfig;
import org.openmetadata.catalog.security.client.AzureSSOClientConfig;
import org.openmetadata.catalog.security.client.CustomOIDCSSOClientConfig;
import org.openmetadata.catalog.security.client.GoogleSSOClientConfig;
import org.openmetadata.catalog.security.client.OktaSSOClientConfig;
import org.openmetadata.catalog.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;

public class AirflowConfigValidationTest {

  private static Validator validator;

  @BeforeAll
  static void setUp() {
    ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
    validator = factory.getValidator();
  }

  @Test
  void testOpenMetadataGoogleClientConfigValidation() {
    CatalogApplicationConfig catalogApplicationConfig =
        buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.GOOGLE);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(buildGoogleAuthConfig());
    List<ConstraintViolation<CatalogApplicationConfig>> violations =
        new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(0, violations.size());
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getGoogle().setSecretKey("");
    violations = new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals("\ngoogle SSO client config requires secretKey", violations.get(0).getMessage());
  }

  @Test
  void testOpenMetadataOktaClientConfigValidation() {
    CatalogApplicationConfig catalogApplicationConfig =
        buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.OKTA);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(buildOktaAuthConfig());
    List<ConstraintViolation<CatalogApplicationConfig>> violations =
        new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(0, violations.size());
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getOkta().setClientId("");
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getOkta().setPrivateKey("");
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getOkta().setEmail("");
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getOkta().setOrgURL("");
    violations = new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals(
        "\nokta SSO client config requires clientId\n"
            + "okta SSO client config requires privateKey\n"
            + "okta SSO client config requires email\n"
            + "okta SSO client config requires orgUrl",
        violations.get(0).getMessage());
  }

  @Test
  void testOpenMetadataAuth0ClientConfigValidation() {
    CatalogApplicationConfig catalogApplicationConfig =
        buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.AUTH_0);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(buildAuth0Config());
    List<ConstraintViolation<CatalogApplicationConfig>> violations =
        new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(0, violations.size());
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getAuth0().setClientId("");
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getAuth0().setSecretKey("");
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getAuth0().setDomain("");
    violations = new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals(
        "\nauth0 SSO client config requires clientId\n"
            + "auth0 SSO client config requires secretKey\n"
            + "auth0 SSO client config requires domain",
        violations.get(0).getMessage());
  }

  @Test
  void testOpenMetadataAzureClientConfigValidation() {
    CatalogApplicationConfig catalogApplicationConfig =
        buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.AZURE);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(buildAzureAuthConfig());
    List<ConstraintViolation<CatalogApplicationConfig>> violations =
        new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(0, violations.size());
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getAzure().setClientId("");
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getAzure().setClientSecret("");
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getAzure().setAuthority("");
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getAzure().setScopes(List.of());
    violations = new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals(
        "\nazure SSO client config requires clientId\n"
            + "azure SSO client config requires clientSecret\n"
            + "azure SSO client config requires authority\n"
            + "azure SSO client config requires scopes",
        violations.get(0).getMessage());
  }

  @Test
  void testOpenMetadataCustomOIDCClientConfigValidation() {
    CatalogApplicationConfig catalogApplicationConfig =
        buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.CUSTOM_OIDC);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(buildCustomOIDCConfig());
    List<ConstraintViolation<CatalogApplicationConfig>> violations =
        new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(0, violations.size());
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getCustomOidc().setClientId("");
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getCustomOidc().setSecretKey("");
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getCustomOidc().setTokenEndpoint("");
    violations = new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals(
        "\ncustom-oidc SSO client config requires clientId\n"
            + "custom-oidc SSO client config requires secretKey\n"
            + "custom-oidc SSO client config requires tokenEndpoint",
        violations.get(0).getMessage());
  }

  @Test
  void testOpenMetadataNoAuthClientConfigValidation() {
    CatalogApplicationConfig catalogApplicationConfig =
        buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.CUSTOM_OIDC);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(buildCustomOIDCConfig());
    List<ConstraintViolation<CatalogApplicationConfig>> violations =
        new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(0, violations.size());
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getCustomOidc().setClientId("");
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getCustomOidc().setSecretKey("");
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getCustomOidc().setTokenEndpoint("");
    violations = new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals(
        "\ncustom-oidc SSO client config requires clientId\n"
            + "custom-oidc SSO client config requires secretKey\n"
            + "custom-oidc SSO client config requires tokenEndpoint",
        violations.get(0).getMessage());
  }

  @Test
  void testOpenMetadataOpenmetadataClientConfigValidation() {
    CatalogApplicationConfig catalogApplicationConfig =
        buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.OPENMETADATA);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(buildOpenmetadataAuthConfig());
    List<ConstraintViolation<CatalogApplicationConfig>> violations =
        new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(0, violations.size());
    catalogApplicationConfig.getAirflowConfiguration().getAuthConfig().getOpenmetadata().setJwtToken("");
    violations = new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals("\nopenmetadata SSO client config requires jwtToken", violations.get(0).getMessage());
  }

  @Test
  void testNoAuthClientConfigValidation() {
    CatalogApplicationConfig catalogApplicationConfig =
        buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.NO_AUTH);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(new AuthConfiguration());
    List<ConstraintViolation<CatalogApplicationConfig>> violations =
        new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(0, violations.size());
  }

  @Test
  void testAuthClientConfiguredWithoutConfigValidation() {
    CatalogApplicationConfig catalogApplicationConfig =
        buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.GOOGLE);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(null);
    List<ConstraintViolation<CatalogApplicationConfig>> violations =
        new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals("\ngoogle SSO client config requires authConfig section", violations.get(0).getMessage());
  }

  private AuthConfiguration buildGoogleAuthConfig() {
    AuthConfiguration authConfig = new AuthConfiguration();
    authConfig.setGoogle(new GoogleSSOClientConfig().withSecretKey("1234").withAudience("test"));
    return authConfig;
  }

  private AuthConfiguration buildOktaAuthConfig() {
    AuthConfiguration authConfig = new AuthConfiguration();
    List<String> scopes = List.of("local", "prod", "test");
    OktaSSOClientConfig oktaSSOClientConfig =
        new OktaSSOClientConfig()
            .withClientId("1234")
            .withEmail("test@test.com")
            .withOrgURL("https://okta.domain.com")
            .withPrivateKey("34123")
            .withScopes(scopes);
    authConfig.setOkta(oktaSSOClientConfig);
    return authConfig;
  }

  private CatalogApplicationConfig buildCatalogApplicationConfig(
      OpenMetadataServerConnection.AuthProvider authProvider) {
    CatalogApplicationConfig catalogApplicationConfig = new CatalogApplicationConfig();
    DataSourceFactory dataSourceFactory = new DataSourceFactory();
    dataSourceFactory.setDriverClass("driverClass");
    dataSourceFactory.setUrl("http://localhost");
    MigrationConfiguration migrationConfiguration = new MigrationConfiguration();
    migrationConfiguration.setPath("/fake/path");
    catalogApplicationConfig.setDataSourceFactory(dataSourceFactory);
    catalogApplicationConfig.setMigrationConfiguration(migrationConfiguration);
    catalogApplicationConfig.setAirflowConfiguration(buildAirflowConfig(authProvider));
    return catalogApplicationConfig;
  }

  private AirflowConfiguration buildAirflowConfig(OpenMetadataServerConnection.AuthProvider authProvider) {
    AirflowConfiguration airflowConfiguration = new AirflowConfiguration();
    airflowConfiguration.setUsername("admin");
    airflowConfiguration.setPassword("admin");
    airflowConfiguration.setApiEndpoint("http://localhost:8080/api");
    airflowConfiguration.setMetadataApiEndpoint("http://localhost:8585/api");
    airflowConfiguration.setAuthProvider(authProvider.value());
    return airflowConfiguration;
  }

  private AuthConfiguration buildAuth0Config() {
    AuthConfiguration authConfig = new AuthConfiguration();
    Auth0SSOClientConfig auth0SSOClientConfig =
        new Auth0SSOClientConfig().withClientId("1234").withDomain("local").withSecretKey("34123");
    authConfig.setAuth0(auth0SSOClientConfig);
    return authConfig;
  }

  private AuthConfiguration buildAzureAuthConfig() {
    AuthConfiguration authConfig = new AuthConfiguration();
    List<String> scopes = List.of("local", "prod", "test");
    AzureSSOClientConfig azureSSOClientConfig =
        new AzureSSOClientConfig()
            .withClientId("1234")
            .withClientSecret("34123")
            .withAuthority("local")
            .withScopes(scopes);
    authConfig.setAzure(azureSSOClientConfig);
    return authConfig;
  }

  private AuthConfiguration buildOpenmetadataAuthConfig() {
    AuthConfiguration authConfig = new AuthConfiguration();
    OpenMetadataJWTClientConfig openMetadataJWTClientConfig =
        new OpenMetadataJWTClientConfig().withJwtToken("fakeToken");
    authConfig.setOpenmetadata(openMetadataJWTClientConfig);
    return authConfig;
  }

  private AuthConfiguration buildCustomOIDCConfig() {
    AuthConfiguration authConfig = new AuthConfiguration();
    CustomOIDCSSOClientConfig customOIDCSSOClientConfig =
        new CustomOIDCSSOClientConfig()
            .withClientId("1234")
            .withSecretKey("34123")
            .withTokenEndpoint("https://localhost/");
    authConfig.setCustomOidc(customOIDCSSOClientConfig);
    return authConfig;
  }
}
