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

import com.fasterxml.jackson.core.JsonProcessingException;
import org.openmetadata.api.configuration.airflow.AuthConfiguration;
import org.openmetadata.schema.api.configuration.airflow.AirflowConfiguration;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.schema.services.connections.metadata.SecretsManagerProvider;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.util.JsonUtils;

public abstract class ThirdPartySecretsManager extends SecretsManager {

  public static final String AUTH_PROVIDER_SECRET_ID_PREFIX = "auth-provider";
  public static final String DATABASE_METADATA_PIPELINE_SECRET_ID_PREFIX = "database-metadata-pipeline";
  public static final String TEST_CONNECTION_TEMP_SECRET_ID_PREFIX = "test-connection-temp";
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
        String connectionConfigJson = JsonUtils.pojoToJson(connectionConfig);
        if (connectionConfigJson != null) {
          upsertSecret(secretName, connectionConfigJson);
        }
        return null;
      } else {
        Class<?> clazz = createConnectionConfigClass(connectionType, extractConnectionPackageName(serviceType));
        return JsonUtils.readValue(getSecret(secretName), clazz);
      }
    } catch (ClassNotFoundException ex) {
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
  public AirflowConfiguration encryptAirflowConnection(AirflowConfiguration airflowConfiguration) {
    OpenMetadataServerConnection.AuthProvider authProvider =
        OpenMetadataServerConnection.AuthProvider.fromValue(airflowConfiguration.getAuthProvider());
    AuthConfiguration authConfig = airflowConfiguration.getAuthConfig();
    String authProviderJson = null;
    try {
      switch (authProvider) {
        case GOOGLE:
          authProviderJson = JsonUtils.pojoToJson(authConfig.getGoogle());
          break;
        case AUTH_0:
          authProviderJson = JsonUtils.pojoToJson(authConfig.getAuth0());
          break;
        case OKTA:
          authProviderJson = JsonUtils.pojoToJson(authConfig.getOkta());
          break;
        case AZURE:
          authProviderJson = JsonUtils.pojoToJson(authConfig.getAzure());
          break;
        case CUSTOM_OIDC:
          authProviderJson = JsonUtils.pojoToJson(authConfig.getCustomOidc());
          break;
        case OPENMETADATA:
          authProviderJson = JsonUtils.pojoToJson(authConfig.getOpenmetadata());
          break;
        case NO_AUTH:
          break;
        default:
          throw new IllegalArgumentException("OpenMetadata doesn't support auth provider type " + authProvider.value());
      }
    } catch (JsonProcessingException e) {
      throw new SecretsManagerException("Error parsing to JSON the auth config :" + e.getMessage());
    }
    if (authProviderJson != null) {
      upsertSecret(buildSecretId(AUTH_PROVIDER_SECRET_ID_PREFIX, authProvider.value()), authProviderJson);
    }
    airflowConfiguration.setAuthConfig(null);
    return airflowConfiguration;
  }

  @Override
  public Object encryptOrDecryptDbtConfigSource(Object dbtConfigSource, String serviceName, boolean encrypt) {
    String secretName = buildSecretId(DATABASE_METADATA_PIPELINE_SECRET_ID_PREFIX, serviceName);
    try {
      if (encrypt) {
        String dbtConfigSourceJson = JsonUtils.pojoToJson(dbtConfigSource);
        upsertSecret(secretName, dbtConfigSourceJson);
        return null;
      } else {
        String dbtConfigSourceJson = getSecret(secretName);
        return NULL_SECRET_STRING.equals(dbtConfigSourceJson)
            ? null
            : JsonUtils.readValue(dbtConfigSourceJson, Object.class);
      }
    } catch (Exception e) {
      throw SecretsManagerException.byMessage(getClass().getSimpleName(), secretName, e.getMessage());
    }
  }

  @Override
  protected Object decryptAuthProviderConfig(
      OpenMetadataServerConnection.AuthProvider authProvider, AuthConfiguration authConfig) {
    return null;
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
