package org.openmetadata.service.util;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.api.configuration.airflow.SSLConfig;
import org.openmetadata.schema.api.configuration.airflow.AirflowConfiguration;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.schema.services.connections.metadata.SecretsManagerProvider;
import org.openmetadata.schema.teams.authn.JWTAuthMechanism;
import org.openmetadata.schema.teams.authn.SSOAuthMechanism;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.secrets.SecretsManager;

@Slf4j
public class OpenMetadataServerConnectionBuilder {

  private static final String INGESTION_BOT = "ingestion-bot";

  OpenMetadataServerConnection.AuthProvider authProvider;
  String bot;
  Object securityConfig;
  OpenMetadataServerConnection.VerifySSL verifySSL;
  String openMetadataURL;
  String clusterName;
  SecretsManagerProvider secretsManagerProvider;
  Object airflowSSLConfig;
  BotRepository botRepository;
  UserRepository userRepository;
  SecretsManager secretsManager;

  public OpenMetadataServerConnectionBuilder(
      SecretsManager secretsManager,
      OpenMetadataApplicationConfig openMetadataApplicationConfig,
      CollectionDAO collectionDAO) {
    this.secretsManager = secretsManager;
    // TODO: https://github.com/open-metadata/OpenMetadata/issues/7712
    authProvider =
        "basic".equals(openMetadataApplicationConfig.getAuthenticationConfiguration().getProvider())
            ? OpenMetadataServerConnection.AuthProvider.OPENMETADATA
            : OpenMetadataServerConnection.AuthProvider.fromValue(
                openMetadataApplicationConfig.getAuthenticationConfiguration().getProvider());

    if (!OpenMetadataServerConnection.AuthProvider.NO_AUTH.equals(authProvider)) {
      botRepository = new BotRepository(collectionDAO);
      userRepository = new UserRepository(collectionDAO, secretsManager);
      User botUser = retrieveBotUser(openMetadataApplicationConfig);
      if (secretsManager.isLocal()) {
        securityConfig = extractSecurityConfig(botUser);
      }
      authProvider = extractAuthProvider(botUser);
    }

    AirflowConfiguration airflowConfiguration = openMetadataApplicationConfig.getAirflowConfiguration();
    openMetadataURL = airflowConfiguration.getMetadataApiEndpoint();
    clusterName = openMetadataApplicationConfig.getClusterName();
    secretsManagerProvider = secretsManager.getSecretsManagerProvider();
    verifySSL = OpenMetadataServerConnection.VerifySSL.fromValue(airflowConfiguration.getVerifySSL());
    airflowSSLConfig =
        getAirflowSSLConfig(
            OpenMetadataServerConnection.VerifySSL.fromValue(airflowConfiguration.getVerifySSL()),
            airflowConfiguration.getSslConfig());
  }

  private OpenMetadataServerConnection.AuthProvider extractAuthProvider(User botUser) {
    AuthenticationMechanism.AuthType authType = botUser.getAuthenticationMechanism().getAuthType();
    switch (authType) {
      case SSO:
        return OpenMetadataServerConnection.AuthProvider.fromValue(
            JsonUtils.convertValue(botUser.getAuthenticationMechanism().getConfig(), SSOAuthMechanism.class)
                .getSsoServiceType()
                .value());
      case JWT:
        return OpenMetadataServerConnection.AuthProvider.OPENMETADATA;
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

  public OpenMetadataServerConnection build() {
    return new OpenMetadataServerConnection()
        .withAuthProvider(authProvider)
        .withHostPort(openMetadataURL)
        .withSecurityConfig(securityConfig)
        .withVerifySSL(verifySSL)
        .withClusterName(clusterName)
        .withSecretsManagerProvider(secretsManagerProvider)
        .withWorkflowBot(bot)
        .withSslConfig(airflowSSLConfig);
  }

  private User retrieveBotUser(OpenMetadataApplicationConfig openMetadataApplicationConfig) {
    Set<String> botPrincipals = openMetadataApplicationConfig.getAuthorizerConfiguration().getBotPrincipals();
    if (botPrincipals == null || botPrincipals.isEmpty()) {
      throw new IllegalArgumentException(
          "Please, add at least one bot to the 'authorizerConfiguration.botPrincipals' in the OpenMetadata configuration");
    }
    User botUser = null;
    // try to find ingestion-bot user
    if (botPrincipals.contains(INGESTION_BOT)) {
      botUser = retrieveIngestionBotUser(INGESTION_BOT);
      addBotNameIfUserExists(botUser, INGESTION_BOT);
    }
    // sort botPrincipals in order to use always the same alternate bot
    List<String> sortedBotPrincipals = new ArrayList<>(botPrincipals);
    sortedBotPrincipals.sort(String::compareTo);
    Iterator<String> it = sortedBotPrincipals.iterator();
    while (botUser == null && it.hasNext()) {
      String botName = it.next();
      botUser = retrieveIngestionBotUser(botName);
      if (botUser != null && botUser.getAuthenticationMechanism() == null) {
        botUser = null;
      }
      addBotNameIfUserExists(botUser, botName);
    }
    if (botUser == null) {
      throw new IllegalArgumentException(
          "Please, create at least one bot with valid authentication mechanism that matches any of the names from 'authorizerConfiguration.botPrincipals' in the OpenMetadata configuration");
    }
    return botUser;
  }

  private User retrieveIngestionBotUser(String botName) {
    try {
      Bot bot = botRepository.getByName(null, botName, new EntityUtil.Fields(List.of("botUser")));
      if (bot.getBotUser() == null) {
        return null;
      }
      User user =
          userRepository.getByName(
              null,
              bot.getBotUser().getFullyQualifiedName(),
              new EntityUtil.Fields(List.of("authenticationMechanism")));
      if (user.getAuthenticationMechanism() != null) {
        user.getAuthenticationMechanism()
            .setConfig(
                secretsManager.encryptOrDecryptIngestionBotCredentials(
                    botName, user.getAuthenticationMechanism().getConfig(), false));
      }
      return user;
    } catch (IOException | EntityNotFoundException ex) {
      LOG.debug((bot == null ? "Bot" : String.format("User for bot [%s]", botName)) + " [{}] not found.", botName);
      return null;
    }
  }

  private void addBotNameIfUserExists(User botUser, String bot) {
    if (botUser != null) {
      this.bot = bot;
    }
  }

  protected Object getAirflowSSLConfig(OpenMetadataServerConnection.VerifySSL verifySSL, SSLConfig sslConfig) {
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
