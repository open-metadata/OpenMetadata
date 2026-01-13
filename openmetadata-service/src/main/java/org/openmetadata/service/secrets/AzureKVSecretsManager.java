package org.openmetadata.service.secrets;

import com.azure.core.credential.TokenCredential;
import com.azure.core.util.polling.SyncPoller;
import com.azure.identity.ClientSecretCredentialBuilder;
import com.azure.identity.DefaultAzureCredentialBuilder;
import com.azure.security.keyvault.secrets.SecretClient;
import com.azure.security.keyvault.secrets.SecretClientBuilder;
import com.azure.security.keyvault.secrets.models.DeletedSecret;
import com.azure.security.keyvault.secrets.models.KeyVaultSecret;
import com.azure.security.keyvault.secrets.models.SecretProperties;
import java.time.OffsetDateTime;
import java.util.regex.Pattern;
import org.apache.logging.log4j.util.Strings;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.service.exception.SecretsManagerException;

public class AzureKVSecretsManager extends ExternalSecretsManager {

  private static AzureKVSecretsManager instance = null;
  private final SecretClient client;

  public static final String CLIENT_ID = "clientId";
  public static final String CLIENT_SECRET = "clientSecret";
  public static final String TENANT_ID = "tenantId";
  public static final String VAULT_NAME = "vaultName";
  public static final String EXPIRES_AFTER_DAYS = "expiresAfterDays";

  private AzureKVSecretsManager(
      SecretsManagerProvider secretsManagerProvider, SecretsConfig secretsConfig) {
    super(secretsManagerProvider, secretsConfig, 100);

    String vaultName =
        (String) secretsConfig.parameters().getAdditionalProperties().getOrDefault(VAULT_NAME, "");

    if (Strings.isBlank(vaultName)) {
      throw new SecretsManagerException(
          "Using Azure Secrets Manager we found a missing or empty `vaultName` parameter. Review your configuration. ");
    }

    TokenCredential credential = buildAzureCredentials(secretsConfig);

    String vaultUrl = String.format("https://%s.vault.azure.net/", vaultName);
    client = new SecretClientBuilder().vaultUrl(vaultUrl).credential(credential).buildClient();
  }

  /**
   * Build Azure's credentials using <a href="https://learn.microsoft.com/en-us/java/api/overview/azure/identity-readme?view=azure-java-stable">Azure Identity</a>
   * We provide authentication either via Default Creds or by specifying the Client Secrets
   * <a href="https://github.com/Azure/azure-sdk-for-java/wiki/Azure-Identity-Examples#authenticating-a-service-principal-with-a-client-secret">docs</a>
   * If the TENANT_ID is informed, we'll use the ClientSecretCredentialBuilder
   */
  private TokenCredential buildAzureCredentials(SecretsConfig secretsConfig) {
    if (secretsConfig != null
        && secretsConfig.parameters() != null
        && !Strings.isBlank(
            (String)
                secretsConfig.parameters().getAdditionalProperties().getOrDefault(TENANT_ID, ""))) {
      String clientId =
          (String) secretsConfig.parameters().getAdditionalProperties().getOrDefault(CLIENT_ID, "");
      String clientSecret =
          (String)
              secretsConfig.parameters().getAdditionalProperties().getOrDefault(CLIENT_SECRET, "");
      String tenantId =
          (String) secretsConfig.parameters().getAdditionalProperties().getOrDefault(TENANT_ID, "");

      return new ClientSecretCredentialBuilder()
          .clientId(clientId)
          .clientSecret(clientSecret)
          .tenantId(tenantId)
          .build();
    } else {
      return new DefaultAzureCredentialBuilder().build();
    }
  }

  /**
   * Azure Key Vault does not allow the default '/' separator: They can only contain alphanumeric characters and dashes.
   * Azure key vault does not need a prefixed separator.
   */
  @Override
  protected SecretsIdConfig builSecretsIdConfig() {
    return new SecretsIdConfig("-", Boolean.FALSE, "", Pattern.compile("[^A-Za-z0-9\\-]"));
  }

  @Override
  void storeSecret(String secretName, String secretValue) {
    SecretProperties properties =
        new SecretProperties().setTags(SecretsManager.getTags(getSecretsConfig()));
    setExpirationDate(properties);
    client.setSecret(
        new KeyVaultSecret(secretName, cleanNullOrEmpty(secretValue)).setProperties(properties));
  }

  @Override
  void updateSecret(String secretName, String secretValue) {
    // No specific update commands
    storeSecret(secretName, secretValue);
  }

  @Override
  String getSecret(String secretName) {
    return client.getSecret(secretName).getValue();
  }

  @Override
  protected void deleteSecretInternal(String secretName) {
    SyncPoller<DeletedSecret, Void> deletionPoller = client.beginDeleteSecret(secretName);
    deletionPoller.waitForCompletion();
  }

  /**
   * Set the expiration date for the secret properties based on the configuration parameter.
   * If the expiresAfterDays parameter is provided, the expiration date is set to the current date plus the specified number of days.
   *
   * @param properties SecretProperties to configure with expiration date
   */
  private void setExpirationDate(SecretProperties properties) {
    if (getSecretsConfig() != null
        && getSecretsConfig().parameters() != null
        && getSecretsConfig()
            .parameters()
            .getAdditionalProperties()
            .containsKey(EXPIRES_AFTER_DAYS)) {
      try {
        String expiresAfterDaysStr =
            (String)
                getSecretsConfig().parameters().getAdditionalProperties().get(EXPIRES_AFTER_DAYS);
        if (!Strings.isBlank(expiresAfterDaysStr)) {
          long expiresAfterDays = Long.parseLong(expiresAfterDaysStr);
          OffsetDateTime expiresOn = OffsetDateTime.now().plusDays(expiresAfterDays);
          properties.setExpiresOn(expiresOn);
        }
      } catch (NumberFormatException e) {
        throw new SecretsManagerException(
            String.format(
                "Invalid value for '%s' parameter. Expected a number but got: %s",
                EXPIRES_AFTER_DAYS,
                getSecretsConfig().parameters().getAdditionalProperties().get(EXPIRES_AFTER_DAYS)));
      }
    }
  }

  public static AzureKVSecretsManager getInstance(SecretsConfig secretsConfig) {
    if (instance == null) {
      instance = new AzureKVSecretsManager(SecretsManagerProvider.MANAGED_AZURE_KV, secretsConfig);
    }
    return instance;
  }
}
