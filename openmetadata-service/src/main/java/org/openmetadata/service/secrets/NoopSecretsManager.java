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

package org.openmetadata.service.secrets;

import static org.openmetadata.schema.services.connections.metadata.SecretsManagerProvider.NOOP;

import com.google.common.annotations.VisibleForTesting;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import org.openmetadata.api.configuration.airflow.AuthConfiguration;
import org.openmetadata.schema.api.configuration.airflow.AirflowConfiguration;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.util.JsonUtils;

public class NoopSecretsManager extends SecretsManager {

  private static NoopSecretsManager INSTANCE;

  private Fernet fernet;

  private NoopSecretsManager(String clusterPrefix) {
    super(NOOP, clusterPrefix);
    this.fernet = Fernet.getInstance();
  }

  @Override
  public boolean isLocal() {
    return true;
  }

  @Override
  public Object encryptOrDecryptServiceConnectionConfig(
      Object connectionConfig, String connectionType, String connectionName, ServiceType serviceType, boolean encrypt) {
    try {
      Class<?> clazz = createConnectionConfigClass(connectionType, extractConnectionPackageName(serviceType));
      Object newConnectionConfig = JsonUtils.convertValue(connectionConfig, clazz);
      encryptOrDecryptField(newConnectionConfig, "Password", clazz, encrypt);
      return newConnectionConfig;
    } catch (Exception e) {
      throw InvalidServiceConnectionException.byMessage(
          connectionType, String.format("Failed to construct connection instance of %s", connectionType));
    }
  }

  @Override
  public Object encryptOrDecryptDbtConfigSource(Object dbtConfigSource, String serviceName, boolean encrypt) {
    return dbtConfigSource;
  }

  @Override
  public AirflowConfiguration encryptAirflowConnection(AirflowConfiguration airflowConfiguration) {
    return airflowConfiguration;
  }

  @Override
  protected Object decryptAuthProviderConfig(
      OpenMetadataServerConnection.AuthProvider authProvider, AuthConfiguration authConfig) {
    switch (authProvider) {
      case GOOGLE:
        return authConfig.getGoogle();
      case AUTH_0:
        return authConfig.getAuth0();
      case OKTA:
        return authConfig.getOkta();
      case AZURE:
        return authConfig.getAzure();
      case CUSTOM_OIDC:
        return authConfig.getCustomOidc();
      case OPENMETADATA:
        return authConfig.getOpenmetadata();
      case NO_AUTH:
        return null;
      default:
        throw new IllegalArgumentException("OpenMetadata doesn't support auth provider type " + authProvider.value());
    }
  }

  @Override
  public Object storeTestConnectionObject(TestServiceConnection testServiceConnection) {
    return testServiceConnection.getConnection();
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

  public static NoopSecretsManager getInstance(String clusterPrefix) {
    if (INSTANCE == null) INSTANCE = new NoopSecretsManager(clusterPrefix);
    return INSTANCE;
  }

  @VisibleForTesting
  void setFernet(Fernet fernet) {
    this.fernet = fernet;
  }
}
