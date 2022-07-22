package org.openmetadata.catalog.secrets;

import static java.util.Objects.isNull;

import com.google.common.base.CaseFormat;
import java.util.List;
import lombok.Getter;
import org.openmetadata.catalog.ServiceConnectionEntityInterface;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.airflow.AuthConfiguration;
import org.openmetadata.catalog.exception.SecretsManagerException;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;

public abstract class SecretsManager {

  public static final String OPENMETADATA_PREFIX = "openmetadata";

  @Getter private final OpenMetadataServerConnection.SecretsManagerProvider secretsManagerProvider;

  protected SecretsManager(OpenMetadataServerConnection.SecretsManagerProvider secretsManagerProvider) {
    this.secretsManagerProvider = secretsManagerProvider;
  }

  public abstract boolean isLocal();

  public abstract Object encryptOrDecryptServiceConnectionConfig(
      Object connectionConfig, String connectionType, String connectionName, String connectionPackage, boolean encrypt);

  public void encryptOrDecryptServiceConnection(
      ServiceConnectionEntityInterface serviceConnection, String serviceType, String connectionName, boolean encrypt) {
    serviceConnection.setConfig(
        encryptOrDecryptServiceConnectionConfig(
            serviceConnection.getConfig(),
            serviceType,
            connectionName,
            extractConnectionPackageName(serviceConnection),
            encrypt));
  }

  public OpenMetadataServerConnection decryptServerConnection(AirflowConfiguration airflowConfiguration) {
    OpenMetadataServerConnection.AuthProvider authProvider =
        OpenMetadataServerConnection.AuthProvider.fromValue(airflowConfiguration.getAuthProvider());
    String openMetadataURL = airflowConfiguration.getMetadataApiEndpoint();
    OpenMetadataServerConnection openMetadataServerConnection = new OpenMetadataServerConnection();
    openMetadataServerConnection.setAuthProvider(authProvider);
    openMetadataServerConnection.setHostPort(openMetadataURL);
    openMetadataServerConnection.setSecurityConfig(
        decryptAuthProviderConfig(authProvider, airflowConfiguration.getAuthConfig()));
    return openMetadataServerConnection;
  }

  public abstract AirflowConfiguration encryptAirflowConnection(AirflowConfiguration airflowConfiguration);

  protected abstract Object decryptAuthProviderConfig(
      OpenMetadataServerConnection.AuthProvider authProvider, AuthConfiguration authConfig);

  protected String buildSecretId(String... suffixes) {
    StringBuilder format = new StringBuilder();
    format.append(OPENMETADATA_PREFIX);
    for (String suffix : List.of(suffixes)) {
      if (isNull(suffix)) {
        throw new SecretsManagerException("Cannot build a secret id with null values.");
      }
      format.append("-%s");
    }
    return String.format(format.toString(), (Object[]) suffixes).toLowerCase();
  }

  protected Class<?> createConnectionConfigClass(String connectionType, String connectionPackage)
      throws ClassNotFoundException {
    String clazzName =
        "org.openmetadata.catalog.services.connections." + connectionPackage + "." + connectionType + "Connection";
    return Class.forName(clazzName);
  }

  private String extractConnectionPackageName(ServiceConnectionEntityInterface serviceConnection) {
    String upperCamelClassName = serviceConnection.getClass().getSimpleName().replace("Connection", "");
    return CaseFormat.UPPER_CAMEL.to(CaseFormat.LOWER_CAMEL, upperCamelClassName);
  }
}
