package org.openmetadata.service.validators;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;
import javax.validation.ConstraintViolation;
import javax.validation.Validation;
import javax.validation.Validator;
import javax.validation.ValidatorFactory;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.api.configuration.airflow.AuthConfiguration;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.fixtures.ConfigurationFixtures;

public class AirflowConfigValidationTest {

  private static Validator validator;

  @BeforeAll
  static void setUp() {
    ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
    validator = factory.getValidator();
  }

  @Test
  void testOpenMetadataGoogleClientConfigValidation() {
    OpenMetadataApplicationConfig openMetadataApplicationConfig =
        ConfigurationFixtures.buildOpenMetadataApplicationConfig(OpenMetadataServerConnection.AuthProvider.GOOGLE);
    openMetadataApplicationConfig
        .getAirflowConfiguration()
        .setAuthConfig(ConfigurationFixtures.buildGoogleAuthConfig());
    List<ConstraintViolation<OpenMetadataApplicationConfig>> violations =
        new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(0, violations.size());
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getGoogle().setSecretKey("");
    violations = new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals("\ngoogle SSO client config requires secretKey", violations.get(0).getMessage());
  }

  @Test
  void testOpenMetadataOktaClientConfigValidation() {
    OpenMetadataApplicationConfig openMetadataApplicationConfig =
        ConfigurationFixtures.buildOpenMetadataApplicationConfig(OpenMetadataServerConnection.AuthProvider.OKTA);
    openMetadataApplicationConfig.getAirflowConfiguration().setAuthConfig(ConfigurationFixtures.buildOktaAuthConfig());
    List<ConstraintViolation<OpenMetadataApplicationConfig>> violations =
        new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(0, violations.size());
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getOkta().setClientId("");
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getOkta().setPrivateKey("");
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getOkta().setEmail("");
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getOkta().setOrgURL("");
    violations = new ArrayList<>(validator.validate(openMetadataApplicationConfig));
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
    OpenMetadataApplicationConfig openMetadataApplicationConfig =
        ConfigurationFixtures.buildOpenMetadataApplicationConfig(OpenMetadataServerConnection.AuthProvider.AUTH_0);
    openMetadataApplicationConfig.getAirflowConfiguration().setAuthConfig(ConfigurationFixtures.buildAuth0Config());
    List<ConstraintViolation<OpenMetadataApplicationConfig>> violations =
        new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(0, violations.size());
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getAuth0().setClientId("");
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getAuth0().setSecretKey("");
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getAuth0().setDomain("");
    violations = new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals(
        "\nauth0 SSO client config requires clientId\n"
            + "auth0 SSO client config requires secretKey\n"
            + "auth0 SSO client config requires domain",
        violations.get(0).getMessage());
  }

  @Test
  void testOpenMetadataAzureClientConfigValidation() {
    OpenMetadataApplicationConfig openMetadataApplicationConfig =
        ConfigurationFixtures.buildOpenMetadataApplicationConfig(OpenMetadataServerConnection.AuthProvider.AZURE);
    openMetadataApplicationConfig.getAirflowConfiguration().setAuthConfig(ConfigurationFixtures.buildAzureAuthConfig());
    List<ConstraintViolation<OpenMetadataApplicationConfig>> violations =
        new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(0, violations.size());
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getAzure().setClientId("");
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getAzure().setClientSecret("");
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getAzure().setAuthority("");
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getAzure().setScopes(List.of());
    violations = new ArrayList<>(validator.validate(openMetadataApplicationConfig));
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
    OpenMetadataApplicationConfig openMetadataApplicationConfig =
        ConfigurationFixtures.buildOpenMetadataApplicationConfig(OpenMetadataServerConnection.AuthProvider.CUSTOM_OIDC);
    openMetadataApplicationConfig
        .getAirflowConfiguration()
        .setAuthConfig(ConfigurationFixtures.buildCustomOIDCConfig());
    List<ConstraintViolation<OpenMetadataApplicationConfig>> violations =
        new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(0, violations.size());
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getCustomOidc().setClientId("");
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getCustomOidc().setSecretKey("");
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getCustomOidc().setTokenEndpoint("");
    violations = new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals(
        "\ncustom-oidc SSO client config requires clientId\n"
            + "custom-oidc SSO client config requires secretKey\n"
            + "custom-oidc SSO client config requires tokenEndpoint",
        violations.get(0).getMessage());
  }

  @Test
  void testOpenMetadataNoAuthClientConfigValidation() {
    OpenMetadataApplicationConfig openMetadataApplicationConfig =
        ConfigurationFixtures.buildOpenMetadataApplicationConfig(OpenMetadataServerConnection.AuthProvider.CUSTOM_OIDC);
    openMetadataApplicationConfig
        .getAirflowConfiguration()
        .setAuthConfig(ConfigurationFixtures.buildCustomOIDCConfig());
    List<ConstraintViolation<OpenMetadataApplicationConfig>> violations =
        new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(0, violations.size());
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getCustomOidc().setClientId("");
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getCustomOidc().setSecretKey("");
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getCustomOidc().setTokenEndpoint("");
    violations = new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals(
        "\ncustom-oidc SSO client config requires clientId\n"
            + "custom-oidc SSO client config requires secretKey\n"
            + "custom-oidc SSO client config requires tokenEndpoint",
        violations.get(0).getMessage());
  }

  @Test
  void testOpenMetadataOpenmetadataClientConfigValidation() {
    OpenMetadataApplicationConfig openMetadataApplicationConfig =
        ConfigurationFixtures.buildOpenMetadataApplicationConfig(
            OpenMetadataServerConnection.AuthProvider.OPENMETADATA);
    openMetadataApplicationConfig
        .getAirflowConfiguration()
        .setAuthConfig(ConfigurationFixtures.buildOpenmetadataAuthConfig());
    List<ConstraintViolation<OpenMetadataApplicationConfig>> violations =
        new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(0, violations.size());
    openMetadataApplicationConfig.getAirflowConfiguration().getAuthConfig().getOpenmetadata().setJwtToken("");
    violations = new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals("\nopenmetadata SSO client config requires jwtToken", violations.get(0).getMessage());
  }

  @Test
  void testNoAuthClientConfigValidation() {
    OpenMetadataApplicationConfig openMetadataApplicationConfig =
        ConfigurationFixtures.buildOpenMetadataApplicationConfig(OpenMetadataServerConnection.AuthProvider.NO_AUTH);
    openMetadataApplicationConfig.getAirflowConfiguration().setAuthConfig(new AuthConfiguration());
    List<ConstraintViolation<OpenMetadataApplicationConfig>> violations =
        new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(0, violations.size());
  }

  @Test
  void testAuthClientConfiguredWithoutConfigValidation() {
    OpenMetadataApplicationConfig openMetadataApplicationConfig =
        ConfigurationFixtures.buildOpenMetadataApplicationConfig(OpenMetadataServerConnection.AuthProvider.GOOGLE);
    openMetadataApplicationConfig.getAirflowConfiguration().setAuthConfig(null);
    List<ConstraintViolation<OpenMetadataApplicationConfig>> violations =
        new ArrayList<>(validator.validate(openMetadataApplicationConfig));
    assertEquals(1, violations.size());
    assertEquals("\ngoogle SSO client config requires authConfig section", violations.get(0).getMessage());
  }
}
