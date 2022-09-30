/*
 *  Copyright 2022 Collate
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

package org.openmetadata.service.secrets;

import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT;
import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.SSO;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.List;
import org.jetbrains.annotations.Nullable;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.schema.services.connections.metadata.SecretsManagerProvider;
import org.openmetadata.schema.teams.authn.JWTAuthMechanism;
import org.openmetadata.schema.teams.authn.SSOAuthMechanism;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;

public abstract class ThirdPartySecretsManager extends SecretsManager {
  public static final String DATABASE_METADATA_PIPELINE_SECRET_ID_PREFIX = "database-metadata-pipeline";
  public static final String TEST_CONNECTION_TEMP_SECRET_ID_PREFIX = "test-connection-temp";
  public static final String BOT_USER_PREFIX = "bot-user";
  public static final String BOT_PREFIX = "bot";
  public static final String AUTH_PROVIDER = "auth-provider";
  public static final String NULL_SECRET_STRING = "null";

  protected ThirdPartySecretsManager(SecretsManagerProvider secretsManagerProvider, String clusterPrefix) {
    super(secretsManagerProvider, clusterPrefix);
  }

  @Override
  public Object encryptOrDecryptServiceConnectionConfig(
      Object connectionConfig, String connectionType, String connectionName, ServiceType serviceType, boolean encrypt) {
    String secretName = buildSecretId("service", serviceType.value(), connectionType, connectionName);
    try {
      if (encrypt) {
        validateServiceConnection(connectionConfig, connectionType, serviceType);
        String connectionConfigJson = JsonUtils.pojoToJson(connectionConfig);
        if (connectionConfigJson != null) {
          upsertSecret(secretName, connectionConfigJson);
        }
        return null;
      } else {
        Class<?> clazz = createConnectionConfigClass(connectionType, extractConnectionPackageName(serviceType));
        return JsonUtils.readValue(getSecret(secretName), clazz);
      }
    } catch (ClassNotFoundException | InvalidServiceConnectionException ex) {
      throw InvalidServiceConnectionException.byMessage(
          connectionType, String.format("Failed to construct connection instance of %s", connectionType));
    } catch (Exception e) {
      throw SecretsManagerException.byMessage(getClass().getSimpleName(), secretName, e.getMessage());
    }
  }

  @Override
  public Object storeTestConnectionObject(TestServiceConnection testServiceConnection) {
    String secretName =
        buildSecretId(TEST_CONNECTION_TEMP_SECRET_ID_PREFIX, testServiceConnection.getConnectionType().value());
    try {
      String connectionConfigJson = JsonUtils.pojoToJson(testServiceConnection.getConnection());
      upsertSecret(secretName, connectionConfigJson);
    } catch (JsonProcessingException e) {
      throw new SecretsManagerException("Error parsing to JSON the service connection config: " + e.getMessage());
    }
    return null;
  }

  @Override
  public Object encryptOrDecryptBotUserCredentials(String botUserName, Object securityConfig, boolean encrypt) {
    String secretName = buildSecretId(BOT_USER_PREFIX, botUserName);
    return encryptOrDecryptObject(securityConfig, encrypt, secretName);
  }

  // TODO: move this logic outside secrets manager
  public Object encryptOrDecryptBotCredentials(String botName, String botUserName, boolean encrypt) {
    String secretName = buildSecretId(BOT_PREFIX, botName);
    if (encrypt) {
      try {
        // save bot user auth config
        Object authConfig = encryptOrDecryptBotUserCredentials(botUserName, null, false);
        // save bot user auth provider
        User botUser =
            UserRepository.class
                .cast(Entity.getEntityRepository(Entity.USER))
                .getByName(null, botUserName, new EntityUtil.Fields(List.of("authenticationMechanism")));
        AuthenticationMechanism authMechanism = botUser.getAuthenticationMechanism();
        if (authMechanism != null) {
          String authProviderSecretName = buildSecretId(BOT_PREFIX, botName, AUTH_PROVIDER);
          String authProvider = null;
          if (JWT.equals(authMechanism.getAuthType())) {
            JWTAuthMechanism jwtAuthMechanism = JsonUtils.convertValue(authConfig, JWTAuthMechanism.class);
            encryptOrDecryptObject(
                new OpenMetadataJWTClientConfig().withJwtToken(jwtAuthMechanism.getJWTToken()), true, secretName);
            authProvider = OpenMetadataServerConnection.AuthProvider.OPENMETADATA.value();
          } else if (authConfig != null && SSO.equals(authMechanism.getAuthType())) {
            encryptOrDecryptObject(
                JsonUtils.convertValue(authConfig, SSOAuthMechanism.class).getAuthConfig(), true, secretName);
            authProvider =
                OpenMetadataServerConnection.AuthProvider.fromValue(
                        (String) JsonUtils.getMap(authConfig).get("ssoServiceType"))
                    .value();
          }
          encryptOrDecryptObject(authProvider, true, authProviderSecretName);
        }
      } catch (Exception e) {
        throw SecretsManagerException.byMessage(getClass().getSimpleName(), secretName, e.getMessage());
      }
    } else {
      return encryptOrDecryptObject(null, false, secretName);
    }
    return null;
  }

  @Override
  public Object encryptOrDecryptDbtConfigSource(Object dbtConfigSource, String serviceName, boolean encrypt) {
    String secretName = buildSecretId(DATABASE_METADATA_PIPELINE_SECRET_ID_PREFIX, serviceName);
    return encryptOrDecryptObject(dbtConfigSource, encrypt, secretName);
  }

  @Nullable
  private Object encryptOrDecryptObject(Object objectValue, boolean encrypt, String secretName) {
    try {
      if (encrypt) {
        String securityConfigJson = JsonUtils.pojoToJson(objectValue);
        upsertSecret(secretName, securityConfigJson);
        return null;
      } else {
        String securityConfigJson = getSecret(secretName);
        return NULL_SECRET_STRING.equals(securityConfigJson)
            ? null
            : JsonUtils.readValue(securityConfigJson, Object.class);
      }
    } catch (Exception e) {
      throw SecretsManagerException.byMessage(getClass().getSimpleName(), secretName, e.getMessage());
    }
  }

  private void upsertSecret(String secretName, String secretValue) {
    if (existSecret(secretName)) {
      updateSecret(secretName, secretValue != null ? secretValue : NULL_SECRET_STRING);
    } else {
      storeSecret(secretName, secretValue != null ? secretValue : NULL_SECRET_STRING);
    }
  }

  public boolean existSecret(String secretName) {
    try {
      return getSecret(secretName) != null;
    } catch (Exception e) {
      return false;
    }
  }

  abstract void storeSecret(String secretName, String secretValue);

  abstract void updateSecret(String secretName, String secretValue);

  abstract String getSecret(String secretName);
}
