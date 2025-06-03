package org.openmetadata.service.util;

import com.auth0.jwt.JWT;
import com.auth0.jwt.interfaces.DecodedJWT;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerClientLoader;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.security.ssl.VerifySSL;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.secrets.SecretsManagerFactory;

@Slf4j
public class OpenMetadataConnectionBuilderTest extends OpenMetadataApplicationTest {

  private static SecretsManagerConfiguration config;
  static final String CLUSTER_NAME = "test";

  @BeforeAll
  static void setUp() {
    config = new SecretsManagerConfiguration();
    config.setSecretsManager(SecretsManagerProvider.DB);
    SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME);
  }

  @Test
  void testOpenMetadataConnectionBuilder() {

    OpenMetadataApplicationConfig openMetadataApplicationConfig =
        new OpenMetadataApplicationConfig();
    openMetadataApplicationConfig.setClusterName(CLUSTER_NAME);
    openMetadataApplicationConfig.setPipelineServiceClientConfiguration(
        new PipelineServiceClientConfiguration()
            .withMetadataApiEndpoint("http://localhost:8585/api")
            .withVerifySSL(VerifySSL.NO_SSL)
            .withSecretsManagerLoader(SecretsManagerClientLoader.ENV));

    String botName =
        "autoClassification-bot"; // Whichever bot other than the ingestion-bot, which is the
    // default
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig, botName).build();

    // The OM Connection passes the right JWT based on the incoming bot
    DecodedJWT jwt = JWT.decode(openMetadataServerConnection.getSecurityConfig().getJwtToken());
    Assertions.assertEquals("autoclassification-bot", jwt.getClaim("sub").asString());
  }
}
