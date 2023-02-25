package org.openmetadata.service.util;

import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.api.configuration.airflow.SSLConfig;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.security.ssl.VerifySSL;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class OpenMetadataConnectionBuilder {

  OpenMetadataConnection.AuthProvider authProvider;
  String bot;
  Object securityConfig;
  private final VerifySSL verifySSL;
  private final String openMetadataURL;
  private final String clusterName;
  private final SecretsManagerProvider secretsManagerProvider;
  private final Object airflowSSLConfig;
  BotRepository botRepository;
  UserRepository userRepository;

  public OpenMetadataConnectionBuilder(OpenMetadataApplicationConfig openMetadataApplicationConfig) {
    // TODO: https://github.com/open-metadata/OpenMetadata/issues/7712
    authProvider =
        "basic".equals(openMetadataApplicationConfig.getAuthenticationConfiguration().getProvider())
            ? OpenMetadataConnection.AuthProvider.OPENMETADATA
            : OpenMetadataConnection.AuthProvider.fromValue(
                openMetadataApplicationConfig.getAuthenticationConfiguration().getProvider());

    if (!OpenMetadataConnection.AuthProvider.NO_AUTH.equals(authProvider)) {
      botRepository = BotRepository.class.cast(Entity.getEntityRepository(Entity.BOT));
      userRepository = UserRepository.class.cast(Entity.getEntityRepository(Entity.USER));
      User botUser = retrieveBotUser();
      securityConfig = extractSecurityConfig(botUser);
      authProvider = extractAuthProvider(botUser);
    }

    PipelineServiceClientConfiguration pipelineServiceClientConfiguration =
        openMetadataApplicationConfig.getPipelineServiceClientConfiguration();
    openMetadataURL = pipelineServiceClientConfiguration.getMetadataApiEndpoint();
    verifySSL = VerifySSL.fromValue(pipelineServiceClientConfiguration.getVerifySSL());
    airflowSSLConfig =
        getAirflowSSLConfig(
            VerifySSL.fromValue(pipelineServiceClientConfiguration.getVerifySSL()),
            pipelineServiceClientConfiguration.getSslConfig());

    clusterName = openMetadataApplicationConfig.getClusterName();
    secretsManagerProvider = SecretsManagerFactory.getSecretsManager().getSecretsManagerProvider();
  }

  private OpenMetadataConnection.AuthProvider extractAuthProvider(User botUser) {
    AuthenticationMechanism.AuthType authType = botUser.getAuthenticationMechanism().getAuthType();
    switch (authType) {
      case SSO:
        return OpenMetadataConnection.AuthProvider.fromValue(
            JsonUtils.convertValue(botUser.getAuthenticationMechanism().getConfig(), SSOAuthMechanism.class)
                .getSsoServiceType()
                .value());
      case JWT:
        return OpenMetadataConnection.AuthProvider.OPENMETADATA;
      default:
        throw new IllegalArgumentException(
            String.format("Not supported authentication mechanism type: [%s]", authType.value()));
    }
  }

  private Object extractSecurityConfig(User botUser) {
    AuthenticationMechanism authMechanism = botUser.getAuthenticationMechanism();
    switch (botUser.getAuthenticationMechanism().getAuthType()) {
      case SSO:
        return JsonUtils.convertValue(authMechanism.getConfig(), SSOAuthMechanism.class).getAuthConfig();
      case JWT:
        JWTAuthMechanism jwtAuthMechanism = JsonUtils.convertValue(authMechanism.getConfig(), JWTAuthMechanism.class);
        return new OpenMetadataJWTClientConfig().withJwtToken(jwtAuthMechanism.getJWTToken());
      default:
        throw new IllegalArgumentException(
            String.format("Not supported authentication mechanism type: [%s]", authMechanism.getAuthType().value()));
    }
  }

  public OpenMetadataConnection build() {
    return new OpenMetadataConnection()
        .withAuthProvider(authProvider)
        .withHostPort(openMetadataURL)
        .withSecurityConfig(securityConfig)
        .withVerifySSL(verifySSL)
        .withClusterName(clusterName)
        .withSecretsManagerProvider(secretsManagerProvider)
        .withSslConfig(airflowSSLConfig);
  }

  private User retrieveBotUser() {
    User botUser = retrieveIngestionBotUser(Entity.INGESTION_BOT_NAME);
    if (botUser == null) {
      throw new IllegalArgumentException("Please, verify that the ingestion-bot is present.");
    }
    return botUser;
  }

  private User retrieveIngestionBotUser(String botName) {
    try {
      Bot bot1 = botRepository.getByName(null, botName, Fields.EMPTY_FIELDS);
      if (bot1.getBotUser() == null) {
        return null;
      }
      User user =
          userRepository.getByName(
              null,
              bot1.getBotUser().getFullyQualifiedName(),
              new EntityUtil.Fields(List.of("authenticationMechanism")));
      if (user.getAuthenticationMechanism() != null) {
        user.getAuthenticationMechanism().setConfig(user.getAuthenticationMechanism().getConfig());
      }
      return user;
    } catch (IOException | EntityNotFoundException ex) {
      LOG.debug((bot == null ? "Bot" : String.format("User for bot [%s]", botName)) + " [{}] not found.", botName);
      return null;
    }
  }

  protected Object getAirflowSSLConfig(VerifySSL verifySSL, SSLConfig sslConfig) {
    switch (verifySSL) {
      case NO_SSL:
      case IGNORE:
        return null;
      case VALIDATE:
        return sslConfig.getValidate();
      default:
        throw new IllegalArgumentException("OpenMetadata doesn't support SSL verification type " + verifySSL.value());
    }
  }
}
