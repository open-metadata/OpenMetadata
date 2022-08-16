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

import static org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection.SecretsManagerProvider.AWS;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.google.common.annotations.VisibleForTesting;
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
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.CreateSecretRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.UpdateSecretRequest;

public class AWSSecretsManager extends SecretsManager {

  public static final String AUTH_PROVIDER_SECRET_ID_SUFFIX = "auth-provider";
  public static final String ACCESS_KEY_ID = "accessKeyId";
  public static final String SECRET_ACCESS_KEY = "secretAccessKey";
  public static final String REGION = "region";

  private static AWSSecretsManager INSTANCE = null;

  private SecretsManagerClient secretsClient;

  private AWSSecretsManager(SecretsManagerConfiguration config, String clusterPrefix) {
    super(AWS, clusterPrefix);
    // initialize the secret client depending on the SecretsManagerConfiguration passed
    if (config != null && config.getParameters() != null) {
      String accessKeyId = config.getParameters().getOrDefault(ACCESS_KEY_ID, "");
      String secretAccessKey = config.getParameters().getOrDefault(SECRET_ACCESS_KEY, "");
      String region = config.getParameters().getOrDefault(REGION, "");
      this.secretsClient =
          SecretsManagerClient.builder()
              .region(Region.of(region))
              .credentialsProvider(
                  StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretAccessKey)))
              .build();
    } else {
      // initialized with the region loaded from the DefaultAwsRegionProviderChain and credentials loaded from the
      // DefaultCredentialsProvider
      this.secretsClient = SecretsManagerClient.create();
    }
  }

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

  public void storeSecret(String secretName, String secretValue) {
    CreateSecretRequest createSecretRequest =
        CreateSecretRequest.builder()
            .name(secretName)
            .description("This secret was created by OpenMetadata")
            .secretString(secretValue)
            .build();
    this.secretsClient.createSecret(createSecretRequest);
  }

  public void updateSecret(String secretName, String secretValue) {
    UpdateSecretRequest updateSecretRequest =
        UpdateSecretRequest.builder()
            .secretId(secretName)
            .description("This secret was created by OpenMetadata")
            .secretString(secretValue)
            .build();
    this.secretsClient.updateSecret(updateSecretRequest);
  }

  public boolean existSecret(String secretName) {
    try {
      return getSecret(secretName) != null;
    } catch (Exception e) {
      return false;
    }
  }

  public String getSecret(String secretName) {
    GetSecretValueRequest getSecretValueRequest = GetSecretValueRequest.builder().secretId(secretName).build();
    return this.secretsClient.getSecretValue(getSecretValueRequest).secretString();
  }

  public static AWSSecretsManager getInstance(SecretsManagerConfiguration config, String clusterPrefix) {
    if (INSTANCE == null) INSTANCE = new AWSSecretsManager(config, clusterPrefix);
    return INSTANCE;
  }

  @VisibleForTesting
  protected void setSecretsClient(SecretsManagerClient secretsClient) {
    this.secretsClient = secretsClient;
  }
}
