package org.openmetadata.service.fixtures;

import io.dropwizard.db.DataSourceFactory;
import java.util.List;
import org.openmetadata.api.configuration.airflow.SSLConfig;
import org.openmetadata.schema.api.configuration.airflow.AirflowConfiguration;
import org.openmetadata.schema.security.client.Auth0SSOClientConfig;
import org.openmetadata.schema.security.client.AzureSSOClientConfig;
import org.openmetadata.schema.security.client.CustomOIDCSSOClientConfig;
import org.openmetadata.schema.security.client.OktaSSOClientConfig;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.migration.MigrationConfiguration;

public class ConfigurationFixtures {

  public static OpenMetadataApplicationConfig buildOpenMetadataApplicationConfig(
      OpenMetadataServerConnection.AuthProvider authProvider) {
    OpenMetadataApplicationConfig openMetadataApplicationConfig = new OpenMetadataApplicationConfig();
    DataSourceFactory dataSourceFactory = new DataSourceFactory();
    dataSourceFactory.setDriverClass("driverClass");
    dataSourceFactory.setUrl("http://localhost");
    MigrationConfiguration migrationConfiguration = new MigrationConfiguration();
    migrationConfiguration.setPath("/fake/path");
    openMetadataApplicationConfig.setDataSourceFactory(dataSourceFactory);
    openMetadataApplicationConfig.setMigrationConfiguration(migrationConfiguration);
    openMetadataApplicationConfig.setAirflowConfiguration(buildAirflowConfig(authProvider));
    return openMetadataApplicationConfig;
  }

  public static AirflowConfiguration buildAirflowConfig(OpenMetadataServerConnection.AuthProvider authProvider) {
    AirflowConfiguration airflowConfiguration = new AirflowConfiguration();
    airflowConfiguration.setUsername("admin");
    airflowConfiguration.setPassword("admin");
    airflowConfiguration.setApiEndpoint("http://localhost:8080/api");
    airflowConfiguration.setMetadataApiEndpoint("http://localhost:8585/api");
    return airflowConfiguration;
  }

  public static AirflowConfiguration buildAirflowSSLConfig(OpenMetadataServerConnection.AuthProvider authProvider) {
    AirflowConfiguration airflowConfiguration = new AirflowConfiguration();
    airflowConfiguration.setUsername("admin");
    airflowConfiguration.setPassword("admin");
    airflowConfiguration.setApiEndpoint("http://localhost:8080/api");
    airflowConfiguration.setMetadataApiEndpoint("http://localhost:8585/api");
    airflowConfiguration.setVerifySSL(String.valueOf(OpenMetadataServerConnection.VerifySSL.VALIDATE));

    ValidateSSLClientConfig validateSSLClientConfig = new ValidateSSLClientConfig().withCertificatePath("/public.cert");
    SSLConfig sslConfig = new SSLConfig().withValidate(validateSSLClientConfig);

    airflowConfiguration.setSslConfig(sslConfig);
    return airflowConfiguration;
  }

  public static OktaSSOClientConfig buildOktaSSOClientConfig() {
    return new OktaSSOClientConfig()
        .withClientId("1234")
        .withEmail("test@test.com")
        .withOrgURL("https://okta.domain.com")
        .withPrivateKey("34123")
        .withScopes(List.of("local", "prod", "test"));
  }

  public static Auth0SSOClientConfig buildAuth0SSOClientConfig() {
    return new Auth0SSOClientConfig().withClientId("1234").withDomain("local").withSecretKey("34123");
  }

  public static AzureSSOClientConfig buildAzureClientConfig() {
    return new AzureSSOClientConfig()
        .withClientId("1234")
        .withClientSecret("34123")
        .withAuthority("local")
        .withScopes(List.of("local", "prod", "test"));
  }

  public static OpenMetadataJWTClientConfig buildOpenMetadataJWTClientConfig() {
    return new OpenMetadataJWTClientConfig().withJwtToken("fakeToken");
  }

  public static CustomOIDCSSOClientConfig buildCustomOIDCSSOClientConfig() {
    return new CustomOIDCSSOClientConfig()
        .withClientId("1234")
        .withSecretKey("34123")
        .withTokenEndpoint("https://localhost/");
  }
}
