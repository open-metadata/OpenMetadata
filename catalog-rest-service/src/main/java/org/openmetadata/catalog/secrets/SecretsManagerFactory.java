package org.openmetadata.catalog.secrets;

public class SecretsManagerFactory {

  public static SecretsManager createSecretsManager(SecretsManagerConfiguration config) {
    String secretManager =
        config != null && config.getSecretsManager() != null
            ? config.getSecretsManager()
            : SecretsManagerConfiguration.DEFAULT_SECRET_MANAGER;
    switch (secretManager) {
      case "LocalSecretsManager":
        return new LocalSecretsManager();
      case "AWSSecretsManager":
        return new AWSSecretsManager(config);
      default:
        throw new IllegalArgumentException("Unknown secret manager store: " + secretManager);
    }
  }
}
