package org.openmetadata.catalog.secrets;

import static java.util.Objects.isNull;

import com.google.common.base.CaseFormat;
import java.util.List;
import lombok.Getter;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.airflow.AuthConfiguration;
import org.openmetadata.catalog.entity.services.ServiceType;
import org.openmetadata.catalog.exception.SecretsManagerException;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;

public abstract class SecretsManager {

  @Getter private final String clusterPrefix;

  @Getter private final OpenMetadataServerConnection.SecretsManagerProvider secretsManagerProvider;

  protected SecretsManager(
      OpenMetadataServerConnection.SecretsManagerProvider secretsManagerProvider, String clusterPrefix) {
    this.secretsManagerProvider = secretsManagerProvider;
    this.clusterPrefix = clusterPrefix;
  }

  public abstract boolean isLocal();

  public abstract Object encryptOrDecryptServiceConnectionConfig(
      Object connectionConfig, String connectionType, String connectionName, ServiceType serviceType, boolean encrypt);

  public OpenMetadataServerConnection decryptServerConnection(AirflowConfiguration airflowConfiguration) {
    OpenMetadataServerConnection.AuthProvider authProvider =
        OpenMetadataServerConnection.AuthProvider.fromValue(airflowConfiguration.getAuthProvider());
    String openMetadataURL = airflowConfiguration.getMetadataApiEndpoint();
    return new OpenMetadataServerConnection()
        .withAuthProvider(authProvider)
        .withHostPort(openMetadataURL)
        .withSecurityConfig(decryptAuthProviderConfig(authProvider, airflowConfiguration.getAuthConfig()));
  }

  public abstract AirflowConfiguration encryptAirflowConnection(AirflowConfiguration airflowConfiguration);

  protected abstract Object decryptAuthProviderConfig(
      OpenMetadataServerConnection.AuthProvider authProvider, AuthConfiguration authConfig);

  protected String getSecretSeparator() {
    return "/";
  }

  protected boolean startsWithSeparator() {
    return true;
  }

  protected String buildSecretId(String... secretIdValues) {
    StringBuilder format = new StringBuilder();
    format.append(startsWithSeparator() ? getSecretSeparator() : "");
    format.append(clusterPrefix);
    for (String secretIdValue : List.of(secretIdValues)) {
      if (isNull(secretIdValue)) {
        throw new SecretsManagerException("Cannot build a secret id with null values.");
      }
      format.append(getSecretSeparator());
      format.append("%s");
    }
    return String.format(format.toString(), (Object[]) secretIdValues).toLowerCase();
  }

  protected Class<?> createConnectionConfigClass(String connectionType, String connectionPackage)
      throws ClassNotFoundException {
    String clazzName =
        "org.openmetadata.catalog.services.connections." + connectionPackage + "." + connectionType + "Connection";
    return Class.forName(clazzName);
  }

  protected String extractConnectionPackageName(ServiceType serviceType) {
    return CaseFormat.UPPER_CAMEL.to(CaseFormat.LOWER_CAMEL, serviceType.value());
  }
}
