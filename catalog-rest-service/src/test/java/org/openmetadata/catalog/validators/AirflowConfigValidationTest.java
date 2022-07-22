package org.openmetadata.catalog.validators;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;
import javax.validation.ConstraintViolation;
import javax.validation.Validation;
import javax.validation.Validator;
import javax.validation.ValidatorFactory;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.airflow.AuthConfiguration;
import org.openmetadata.catalog.fixtures.ConfigurationFixtures;
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
        ConfigurationFixtures.buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.GOOGLE);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(ConfigurationFixtures.buildGoogleAuthConfig());
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
        ConfigurationFixtures.buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.OKTA);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(ConfigurationFixtures.buildOktaAuthConfig());
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
        ConfigurationFixtures.buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.AUTH_0);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(ConfigurationFixtures.buildAuth0Config());
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
        ConfigurationFixtures.buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.AZURE);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(ConfigurationFixtures.buildAzureAuthConfig());
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
        ConfigurationFixtures.buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.CUSTOM_OIDC);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(ConfigurationFixtures.buildCustomOIDCConfig());
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
        ConfigurationFixtures.buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.CUSTOM_OIDC);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(ConfigurationFixtures.buildCustomOIDCConfig());
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
        ConfigurationFixtures.buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.OPENMETADATA);
    catalogApplicationConfig
        .getAirflowConfiguration()
        .setAuthConfig(ConfigurationFixtures.buildOpenmetadataAuthConfig());
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
        ConfigurationFixtures.buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.NO_AUTH);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(new AuthConfiguration());
    List<ConstraintViolation<CatalogApplicationConfig>> violations =
        new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(0, violations.size());
  }

  @Test
  void testAuthClientConfiguredWithoutConfigValidation() {
    CatalogApplicationConfig catalogApplicationConfig =
        ConfigurationFixtures.buildCatalogApplicationConfig(OpenMetadataServerConnection.AuthProvider.GOOGLE);
    catalogApplicationConfig.getAirflowConfiguration().setAuthConfig(null);
    List<ConstraintViolation<CatalogApplicationConfig>> violations =
        new ArrayList<>(validator.validate(catalogApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals("\ngoogle SSO client config requires authConfig section", violations.get(0).getMessage());
  }
}
