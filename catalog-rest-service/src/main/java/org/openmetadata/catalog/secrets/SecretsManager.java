package org.openmetadata.catalog.secrets;

import com.google.common.base.CaseFormat;
import javax.validation.constraints.NotNull;
import org.openmetadata.catalog.ServiceConnectionEntityInterface;

public abstract class SecretsManager {

  public abstract boolean isLocal();

  public abstract Object encryptOrDecryptServiceConnectionConfig(
      Object connectionConfig, String connectionType, String connectionName, String connectionPackage, boolean encrypt);

  protected String buildSecretName(
      @NotNull String connectionPackage, @NotNull String connectionType, @NotNull String connectionName) {
    return String.format("openmetadata-%s-%s-%s", connectionPackage, connectionType, connectionName).toLowerCase();
  }

  protected Class<?> createConnectionConfigClass(String connectionType, String connectionPackage)
      throws ClassNotFoundException {
    String clazzName =
        "org.openmetadata.catalog.services.connections." + connectionPackage + "." + connectionType + "Connection";
    return Class.forName(clazzName);
  }

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

  private String extractConnectionPackageName(ServiceConnectionEntityInterface serviceConnection) {
    String upperCamelClassName = serviceConnection.getClass().getSimpleName().replace("Connection", "");
    return CaseFormat.UPPER_CAMEL.to(CaseFormat.LOWER_CAMEL, upperCamelClassName);
  }
}
