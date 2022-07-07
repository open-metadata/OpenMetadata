package org.openmetadata.catalog.secrets;

import com.google.common.annotations.VisibleForTesting;
import org.openmetadata.catalog.exception.InvalidServiceConnectionException;
import org.openmetadata.catalog.exception.SecretsManagerException;
import org.openmetadata.catalog.util.JsonUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.CreateSecretRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.UpdateSecretRequest;

public class AWSSecretsManager extends SecretsManager {

  private SecretsManagerClient secretsClient;

  public AWSSecretsManager(SecretsManagerConfiguration config) {
    String region = config.getParameters().getOrDefault("region", "");
    String accessKeyId = config.getParameters().getOrDefault("accessKeyId", "");
    String secretAccessKey = config.getParameters().getOrDefault("secretAccessKey", "");
    this.secretsClient =
        SecretsManagerClient.builder()
            .region(Region.of(region))
            .credentialsProvider(
                StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretAccessKey)))
            .build();
  }

  @Override
  public boolean isLocal() {
    return false;
  }

  @Override
  public Object encryptOrDecryptServiceConnectionConfig(
      Object connectionConfig,
      String connectionType,
      String connectionName,
      String connectionPackage,
      boolean encrypt) {
    String secretName = buildSecretName(connectionPackage, connectionType, connectionName);
    try {
      if (encrypt) {
        String connectionConfigJson = JsonUtils.pojoToJson(connectionConfig);
        if (connectionConfigJson != null) {
          upsertSecret(secretName, connectionConfigJson);
        }
        return null;
      } else {
        Class<?> clazz = createConnectionConfigClass(connectionType, connectionPackage);
        return JsonUtils.readValue(getSecret(secretName), clazz);
      }
    } catch (ClassNotFoundException ex) {
      throw InvalidServiceConnectionException.byMessage(
          connectionType, String.format("Failed to construct connection instance of %s", connectionType));
    } catch (Exception e) {
      throw SecretsManagerException.byMessage(getClass().getSimpleName(), secretName, e.getMessage());
    }
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

  @VisibleForTesting
  protected void setSecretsClient(SecretsManagerClient secretsClient) {
    this.secretsClient = secretsClient;
  }
}
