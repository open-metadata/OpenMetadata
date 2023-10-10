/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util;

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerClientLoader;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.security.ssl.VerifySSL;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
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

  AuthProvider authProvider;
  String bot;
  Object securityConfig;
  private VerifySSL verifySSL;
  private String openMetadataURL;
  private String clusterName;
  private SecretsManagerProvider secretsManagerProvider;
  private SecretsManagerClientLoader secretsManagerLoader;
  private Object openMetadataSSLConfig;
  BotRepository botRepository;
  UserRepository userRepository;

  public OpenMetadataConnectionBuilder(OpenMetadataApplicationConfig openMetadataApplicationConfig) {
    initializeOpenMetadataConnectionBuilder(openMetadataApplicationConfig);
    initializeBotUser(Entity.INGESTION_BOT_NAME);
  }

  public OpenMetadataConnectionBuilder(OpenMetadataApplicationConfig openMetadataApplicationConfig, String botName) {
    initializeOpenMetadataConnectionBuilder(openMetadataApplicationConfig);
    initializeBotUser(botName);
  }

  private void initializeOpenMetadataConnectionBuilder(OpenMetadataApplicationConfig openMetadataApplicationConfig) {
    botRepository = (BotRepository) Entity.getEntityRepository(Entity.BOT);
    userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);

    PipelineServiceClientConfiguration pipelineServiceClientConfiguration =
        openMetadataApplicationConfig.getPipelineServiceClientConfiguration();
    openMetadataURL = pipelineServiceClientConfiguration.getMetadataApiEndpoint();
    verifySSL = pipelineServiceClientConfiguration.getVerifySSL();

    /*
     How this information flows:
     - The OM Server has SSL configured
     - We need to provide a way to tell the pipelineServiceClient to use / not use it when connecting
       to the server.

     Then, we pick up this information from the pipelineServiceClient configuration and will pass it
     inside the OpenMetadataServerConnection property of the IngestionPipeline.

     Based on that, the Ingestion Framework will instantiate the client. This means,
     that the SSL configs we add here are to go from pipelineServiceClient -> OpenMetadata Server.
    */
    openMetadataSSLConfig =
        getOMSSLConfigFromPipelineServiceClient(
            pipelineServiceClientConfiguration.getVerifySSL(), pipelineServiceClientConfiguration.getSslConfig());

    clusterName = openMetadataApplicationConfig.getClusterName();
    secretsManagerLoader = pipelineServiceClientConfiguration.getSecretsManagerLoader();
    secretsManagerProvider = SecretsManagerFactory.getSecretsManager().getSecretsManagerProvider();
  }

  private void initializeBotUser(String botName) {
    User botUser = retrieveBotUser(botName);
    securityConfig = extractSecurityConfig(botUser);
    authProvider = extractAuthProvider(botUser);
  }

  private AuthProvider extractAuthProvider(User botUser) {
    AuthenticationMechanism.AuthType authType = botUser.getAuthenticationMechanism().getAuthType();
    switch (authType) {
      case SSO:
        return AuthProvider.fromValue(
            JsonUtils.convertValue(botUser.getAuthenticationMechanism().getConfig(), SSOAuthMechanism.class)
                .getSsoServiceType()
                .value());
      case JWT:
        return AuthProvider.OPENMETADATA;
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
        // What is the SM configuration, i.e., tool used to manage secrets: AWS SM, Parameter Store,...
        .withSecretsManagerProvider(secretsManagerProvider)
        // How the Ingestion Framework will know how to load the SM creds in the client side, e.g., airflow.cfg
        .withSecretsManagerLoader(secretsManagerLoader)
        /*
        This is not about the pipeline service client SSL, but the OM server SSL.
        The Ingestion Framework will use this value to load the certificates when connecting to the server.
        */
        .withSslConfig(openMetadataSSLConfig);
  }

  private User retrieveBotUser(String botName) {
    User botUser = retrieveIngestionBotUser(botName);
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
              new EntityUtil.Fields(Set.of("authenticationMechanism")));
      if (user.getAuthenticationMechanism() != null) {
        user.getAuthenticationMechanism().setConfig(user.getAuthenticationMechanism().getConfig());
      }
      return user;
    } catch (EntityNotFoundException ex) {
      LOG.debug((bot == null ? "Bot" : String.format("User for bot [%s]", botName)) + " [{}] not found.", botName);
      return null;
    }
  }

  protected Object getOMSSLConfigFromPipelineServiceClient(VerifySSL verifySSL, Object sslConfig) {
    switch (verifySSL) {
      case NO_SSL:
      case IGNORE:
        return null;
      case VALIDATE:
        return JsonUtils.convertValue(sslConfig, ValidateSSLClientConfig.class);
      default:
        throw new IllegalArgumentException("OpenMetadata doesn't support SSL verification type " + verifySSL.value());
    }
  }
}
