package org.openmetadata.service.secrets;

import org.openmetadata.schema.security.secrets.SecretsManagerProvider;

import static org.openmetadata.schema.security.secrets.SecretsManagerProvider.GCP;

public class GCPSecretsManager extends ExternalSecretsManager {
  private static GCPSecretsManager instance = null;

  private GCPSecretsManager(SecretsConfig secretsConfig) {
    super(GCP, secretsConfig, 100);
  }

  @Override
  void storeSecret(String secretName, String secretValue) {

  }

  @Override
  void updateSecret(String secretName, String secretValue) {

  }

  @Override
  String getSecret(String secretName) {
    return null;
  }

  @Override
  protected void deleteSecretInternal(String secretName) {

  }

  public static GCPSecretsManager getInstance(SecretsConfig secretsConfig) {
    if (instance == null) instance = new GCPSecretsManager(secretsConfig);
    return instance;
  }
}
