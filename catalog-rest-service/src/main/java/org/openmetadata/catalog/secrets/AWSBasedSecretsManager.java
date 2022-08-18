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

package org.openmetadata.catalog.secrets;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.Locale;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.airflow.AuthConfiguration;
import org.openmetadata.catalog.entity.services.ServiceType;
import org.openmetadata.catalog.exception.InvalidServiceConnectionException;
import org.openmetadata.catalog.exception.SecretsManagerException;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.catalog.util.JsonUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;

public abstract class AWSBasedSecretsManager extends SecretsManager {

  public static final String AUTH_PROVIDER_SECRET_ID_SUFFIX = "auth-provider";
  public static final String ACCESS_KEY_ID = "accessKeyId";
  public static final String SECRET_ACCESS_KEY = "secretAccessKey";
  public static final String REGION = "region";
  public static final String DATABASE_METADATA_PIPELINE_SECRET_ID_SUFFIX = "database-metadata-pipeline";
  public static final String NULL_SECRET_STRING = "null";

  protected AWSBasedSecretsManager(
      OpenMetadataServerConnection.SecretsManagerProvider awsProvider,
      SecretsManagerConfiguration config,
      String clusterPrefix) {
    super(awsProvider, clusterPrefix);
    // initialize the secret client depending on the SecretsManagerConfiguration passed
    if (config != null && config.getParameters() != null) {
      String region = config.getParameters().getOrDefault(REGION, "");
      String accessKeyId = config.getParameters().getOrDefault(ACCESS_KEY_ID, "");
      String secretAccessKey = config.getParameters().getOrDefault(SECRET_ACCESS_KEY, "");
      StaticCredentialsProvider staticCredentialsProvider =
          StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretAccessKey));
      initClientWithCredentials(region, staticCredentialsProvider);
    } else {
      // initialized with the region loaded from the DefaultAwsRegionProviderChain and credentials loaded from the
      // DefaultCredentialsProvider
      initClientWithoutCredentials();
    }
  }

  abstract void initClientWithoutCredentials();

  abstract void initClientWithCredentials(String region, StaticCredentialsProvider staticCredentialsProvider);

  @Override
  public Object encryptOrDecryptServiceConnectionConfig(
      Object connectionConfig, String connectionType, String connectionName, ServiceType serviceType, boolean encrypt) {
    String secretName =
        buildSecretId("service", serviceType.value().toLowerCase(Locale.ROOT), connectionType, connectionName);
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
      upsertSecret(buildSecretId(AUTH_PROVIDER_SECRET_ID_SUFFIX, authProvider.value()), authProviderJson);
    }
    airflowConfiguration.setAuthConfig(null);
    return airflowConfiguration;
  }

  @Override
  public Object encryptOrDecryptDbtConfigSource(Object dbtConfigSource, String ingestionPipelineName, boolean encrypt) {
    String secretName = buildSecretId(DATABASE_METADATA_PIPELINE_SECRET_ID_SUFFIX, ingestionPipelineName);
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

  private void upsertSecret(String secretName, String password) {
    if (existSecret(secretName)) {
      updateSecret(secretName, password);
    } else {
      storeSecret(secretName, password);
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
