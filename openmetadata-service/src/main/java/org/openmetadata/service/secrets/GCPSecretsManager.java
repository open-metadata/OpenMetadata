package org.openmetadata.service.secrets;

import static org.openmetadata.schema.security.secrets.SecretsManagerProvider.GCP;

import com.google.cloud.secretmanager.v1.AccessSecretVersionResponse;
import com.google.cloud.secretmanager.v1.ProjectName;
import com.google.cloud.secretmanager.v1.Replication;
import com.google.cloud.secretmanager.v1.Secret;
import com.google.cloud.secretmanager.v1.SecretManagerServiceClient;
import com.google.cloud.secretmanager.v1.SecretName;
import com.google.cloud.secretmanager.v1.SecretPayload;
import com.google.cloud.secretmanager.v1.SecretVersionName;
import com.google.protobuf.ByteString;
import java.io.IOException;
import java.util.regex.Pattern;
import java.util.zip.CRC32C;
import java.util.zip.Checksum;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.exception.SecretsManagerUpdateException;

public class GCPSecretsManager extends ExternalSecretsManager {
  private static final String FIXED_VERSION_ID = "latest";
  public static final String PROJECT_ID_NAME = "projectId";
  private static GCPSecretsManager instance = null;
  private String projectId = null;

  private GCPSecretsManager(SecretsConfig secretsConfig) {
    super(GCP, secretsConfig, 100);

    this.projectId =
        (String)
            secretsConfig.parameters().getAdditionalProperties().getOrDefault(PROJECT_ID_NAME, "");
  }

  /**
   * GCP Secret Manager does not allow the default '/' separator: They can only contain alphanumeric characters and underscores.
   * GCP Secret Manager does not need a prefixed separator.
   */
  @Override
  protected SecretsIdConfig builSecretsIdConfig() {
    return new SecretsIdConfig("_", Boolean.FALSE, "", Pattern.compile("[^A-Za-z0-9_]"));
  }

  @Override
  void storeSecret(String secretId, String secretValue) {
    try (SecretManagerServiceClient client = SecretManagerServiceClient.create()) {
      ProjectName projectName = ProjectName.of(this.projectId);

      // Build the secret to create.
      Secret secret =
          Secret.newBuilder()
              .setReplication(
                  Replication.newBuilder()
                      .setAutomatic(Replication.Automatic.newBuilder().build())
                      .build())
              .build();

      // Create the secret.
      client.createSecret(projectName, secretId, secret);
    } catch (IOException e) {
      throw new SecretsManagerUpdateException(e.getMessage(), e);
    }
    updateSecret(secretId, cleanNullOrEmpty(secretValue));
  }

  @Override
  void updateSecret(String secretId, String secretValue) {
    try (SecretManagerServiceClient client = SecretManagerServiceClient.create()) {
      SecretName secretName = SecretName.of(this.projectId, secretId);
      byte[] data = secretValue.getBytes();
      Checksum checksum = new CRC32C();
      checksum.update(data, 0, data.length);

      // Create the secret payload.
      SecretPayload payload =
          SecretPayload.newBuilder()
              .setData(ByteString.copyFrom(data))
              .setDataCrc32C(checksum.getValue())
              .build();

      // Add the secret version.
      client.addSecretVersion(secretName, payload);
    } catch (IOException e) {
      throw new SecretsManagerUpdateException(e.getMessage(), e);
    }
  }

  @Override
  String getSecret(String secretId) {
    try (SecretManagerServiceClient client = SecretManagerServiceClient.create()) {
      SecretVersionName secretVersionName =
          SecretVersionName.of(this.projectId, secretId, FIXED_VERSION_ID);

      // Access the secret version.
      AccessSecretVersionResponse response = client.accessSecretVersion(secretVersionName);

      // Verify checksum.
      byte[] data = response.getPayload().getData().toByteArray();
      Checksum checksum = new CRC32C();
      checksum.update(data, 0, data.length);
      if (response.getPayload().getDataCrc32C() != checksum.getValue()) {
        throw new SecretsManagerException("Data corruption detected.");
      }
      return response.getPayload().getData().toStringUtf8();
    } catch (IOException e) {
      throw new SecretsManagerUpdateException(e.getMessage(), e);
    }
  }

  @Override
  protected void deleteSecretInternal(String secretId) {
    // Initialize client that will be used to send requests. This client only needs to be created
    // once, and can be reused for multiple requests. After completing all of your requests, call
    // the "close" method on the client to safely clean up any remaining background resources.
    try (SecretManagerServiceClient client = SecretManagerServiceClient.create()) {
      // Build the secret name.
      SecretName secretName = SecretName.of(projectId, secretId);

      // Delete the secret.
      client.deleteSecret(secretName);
      System.out.printf("Deleted secret %s\n", secretId);
    } catch (IOException e) {
      throw new SecretsManagerUpdateException(e.getMessage(), e);
    }
  }

  public static GCPSecretsManager getInstance(SecretsConfig secretsConfig) {
    if (instance == null) instance = new GCPSecretsManager(secretsConfig);
    return instance;
  }
}
