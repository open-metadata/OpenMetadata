package org.openmetadata.catalog.secrets;

import com.google.common.annotations.VisibleForTesting;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import org.openmetadata.catalog.exception.InvalidServiceConnectionException;
import org.openmetadata.catalog.fernet.Fernet;
import org.openmetadata.catalog.util.JsonUtils;

public class LocalSecretsManager extends SecretsManager {

  private static LocalSecretsManager INSTANCE;

  private Fernet fernet;

  private LocalSecretsManager() {
    this.fernet = Fernet.getInstance();
  }

  @Override
  public boolean isLocal() {
    return true;
  }

  @Override
  public Object encryptOrDecryptServiceConnectionConfig(
      Object connectionConfig,
      String connectionType,
      String connectionName,
      String connectionPackage,
      boolean encrypt) {
    try {
      Class<?> clazz = createConnectionConfigClass(connectionType, connectionPackage);
      Object newConnectionConfig = JsonUtils.convertValue(connectionConfig, clazz);
      encryptOrDecryptField(newConnectionConfig, "Password", clazz, encrypt);
      return newConnectionConfig;
    } catch (Exception e) {
      throw InvalidServiceConnectionException.byMessage(
          connectionType, String.format("Failed to construct connection instance of %s", connectionType));
    }
  }

  private void encryptOrDecryptField(Object connConfig, String field, Class<?> clazz, boolean encrypt)
      throws InvocationTargetException, IllegalAccessException {
    try {
      Method getPasswordMethod = clazz.getMethod("get" + field);
      Method setPasswordMethod = clazz.getMethod("set" + field, String.class);
      String password = (String) getPasswordMethod.invoke(connConfig);
      if (password != null) {
        if (!Fernet.isTokenized(password) && encrypt) {
          password = fernet.encrypt(password);
        } else if (Fernet.isTokenized(password) && !encrypt) {
          password = fernet.decrypt(password);
        }
        setPasswordMethod.invoke(connConfig, password);
      }
    } catch (NoSuchMethodException ignore) {
    }
  }

  public static LocalSecretsManager getInstance() {
    if (INSTANCE == null) INSTANCE = new LocalSecretsManager();
    return INSTANCE;
  }

  @VisibleForTesting
  void setFernet(Fernet fernet) {
    this.fernet = fernet;
  }
}
