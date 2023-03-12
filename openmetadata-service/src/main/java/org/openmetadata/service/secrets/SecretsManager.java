/*
 *  Copyright 2021 Collate
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

import static java.util.Objects.isNull;

import com.google.common.annotations.VisibleForTesting;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import javax.ws.rs.core.Response;
import lombok.Getter;
import org.openmetadata.annotations.PasswordField;
import org.openmetadata.schema.auth.BasicAuthMechanism;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;
import org.openmetadata.service.util.AuthenticationMechanismBuilder;
import org.openmetadata.service.util.IngestionPipelineBuilder;
import org.openmetadata.service.util.ReflectionUtil;

public abstract class SecretsManager {
  @Getter private final String clusterPrefix;
  @Getter private final SecretsManagerProvider secretsManagerProvider;
  private Fernet fernet;

  private static final Set<Class<?>> DO_NOT_ENCRYPT_CLASSES =
      Set.of(OpenMetadataJWTClientConfig.class, BasicAuthMechanism.class);

  protected SecretsManager(SecretsManagerProvider secretsManagerProvider, String clusterPrefix) {
    this.secretsManagerProvider = secretsManagerProvider;
    this.clusterPrefix = clusterPrefix;
    this.fernet = Fernet.getInstance();
  }

  public Object encryptOrDecryptServiceConnectionConfig(
      Object connectionConfig, String connectionType, String connectionName, ServiceType serviceType, boolean encrypt) {
    try {
      Class<?> clazz = ReflectionUtil.createConnectionConfigClass(connectionType, serviceType);
      Object newConnectionConfig = ClassConverterFactory.getConverter(clazz).convert(connectionConfig);
      return encryptOrDecryptPasswordFields(
          newConnectionConfig, buildSecretId(true, serviceType.value(), connectionName), encrypt, true);
    } catch (Exception e) {
      throw InvalidServiceConnectionException.byMessage(
          connectionType, String.format("Failed to encrypt connection instance of %s", connectionType));
    }
  }

  public void encryptOrDecryptAuthenticationMechanism(
      String name, AuthenticationMechanism authenticationMechanism, boolean encrypt) {
    if (authenticationMechanism != null) {
      AuthenticationMechanismBuilder.addDefinedConfig(authenticationMechanism);
      try {
        encryptOrDecryptPasswordFields(authenticationMechanism, buildSecretId(true, "bot", name), encrypt, true);
      } catch (Exception e) {
        throw new CustomExceptionMessage(
            Response.Status.BAD_REQUEST, String.format("Failed to encrypt user bot instance [%s]", name));
      }
    }
  }

  public void encryptOrDecryptIngestionPipeline(IngestionPipeline ingestionPipeline, boolean encrypt) {
    OpenMetadataConnection openMetadataConnection =
        encryptOrDecryptOpenMetadataConnection(ingestionPipeline.getOpenMetadataServerConnection(), encrypt, true);
    ingestionPipeline.setOpenMetadataServerConnection(null);
    // we don't store OM conn sensitive data
    IngestionPipelineBuilder.addDefinedConfig(ingestionPipeline);
    try {
      encryptOrDecryptPasswordFields(
          ingestionPipeline, buildSecretId(true, "pipeline", ingestionPipeline.getName()), encrypt, true);
    } catch (Exception e) {
      throw new CustomExceptionMessage(
          Response.Status.BAD_REQUEST,
          String.format("Failed to encrypt ingestion pipeline instance [%s]", ingestionPipeline.getName()));
    }
    ingestionPipeline.setOpenMetadataServerConnection(openMetadataConnection);
  }

  public Workflow encryptOrDecryptWorkflow(Workflow workflow, boolean encrypt) {
    OpenMetadataConnection openMetadataConnection =
        encryptOrDecryptOpenMetadataConnection(workflow.getOpenMetadataServerConnection(), encrypt, true);
    Workflow workflowConverted = (Workflow) ClassConverterFactory.getConverter(Workflow.class).convert(workflow);
    // we don't store OM conn sensitive data
    workflowConverted.setOpenMetadataServerConnection(null);
    try {
      encryptOrDecryptPasswordFields(
          workflowConverted, buildSecretId(true, "workflow", workflow.getName()), encrypt, true);
    } catch (Exception e) {
      throw new CustomExceptionMessage(
          Response.Status.BAD_REQUEST, String.format("Failed to encrypt workflow instance [%s]", workflow.getName()));
    }
    workflowConverted.setOpenMetadataServerConnection(openMetadataConnection);
    return workflowConverted;
  }

  public OpenMetadataConnection encryptOrDecryptOpenMetadataConnection(
      OpenMetadataConnection openMetadataConnection, boolean encrypt, boolean store) {
    if (openMetadataConnection != null) {
      OpenMetadataConnection openMetadataConnectionConverted =
          (OpenMetadataConnection)
              ClassConverterFactory.getConverter(OpenMetadataConnection.class).convert(openMetadataConnection);
      try {
        encryptOrDecryptPasswordFields(
            openMetadataConnectionConverted, buildSecretId(true, "serverconnection"), encrypt, store);
      } catch (Exception e) {
        throw new CustomExceptionMessage(
            Response.Status.BAD_REQUEST, "Failed to encrypt OpenMetadataConnection instance.");
      }
      return openMetadataConnectionConverted;
    }
    return null;
  }

  private Object encryptOrDecryptPasswordFields(Object targetObject, String name, boolean encrypt, boolean store) {
    if (encrypt) {
      encryptPasswordFields(targetObject, name, store);
    } else {
      decryptPasswordFields(targetObject);
    }
    return targetObject;
  }

  private void encryptPasswordFields(Object toEncryptObject, String secretId, boolean store) {
    if (!DO_NOT_ENCRYPT_CLASSES.contains(toEncryptObject.getClass())) {
      // for each get method
      Arrays.stream(toEncryptObject.getClass().getMethods())
          .filter(ReflectionUtil::isGetMethodOfObject)
          .forEach(
              method -> {
                Object obj = ReflectionUtil.getObjectFromMethod(method, toEncryptObject);
                String fieldName = method.getName().replaceFirst("get", "");
                // if the object matches the package of openmetadata
                if (obj != null && obj.getClass().getPackageName().startsWith("org.openmetadata")) {
                  // encryptPasswordFields
                  encryptPasswordFields(obj, buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT)), store);
                  // check if it has annotation
                } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                  // store value if proceed
                  String newFieldValue = storeValue(fieldName, fernet.decryptIfApplies((String) obj), secretId, store);
                  // get setMethod
                  Method toSet = ReflectionUtil.getToSetMethod(toEncryptObject, obj, fieldName);
                  // set new value
                  ReflectionUtil.setValueInMethod(
                      toEncryptObject,
                      Fernet.isTokenized(newFieldValue)
                          ? newFieldValue
                          : store ? fernet.encrypt(newFieldValue) : newFieldValue,
                      toSet);
                }
              });
    }
  }

  private void decryptPasswordFields(Object toDecryptObject) {
    // for each get method
    Arrays.stream(toDecryptObject.getClass().getMethods())
        .filter(ReflectionUtil::isGetMethodOfObject)
        .forEach(
            method -> {
              Object obj = ReflectionUtil.getObjectFromMethod(method, toDecryptObject);
              String fieldName = method.getName().replaceFirst("get", "");
              // if the object matches the package of openmetadata
              if (obj != null && obj.getClass().getPackageName().startsWith("org.openmetadata")) {
                // encryptPasswordFields
                decryptPasswordFields(obj);
                // check if it has annotation
              } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                String fieldValue = (String) obj;
                // get setMethod
                Method toSet = ReflectionUtil.getToSetMethod(toDecryptObject, obj, fieldName);
                // set new value
                ReflectionUtil.setValueInMethod(
                    toDecryptObject, Fernet.isTokenized(fieldValue) ? fernet.decrypt(fieldValue) : fieldValue, toSet);
              }
            });
  }

  protected abstract String storeValue(String fieldName, String value, String secretId, boolean store);

  protected String getSecretSeparator() {
    return "/";
  }

  protected boolean startsWithSeparator() {
    return true;
  }

  protected String buildSecretId(boolean addClusterPrefix, String... secretIdValues) {
    StringBuilder format = new StringBuilder();
    if (addClusterPrefix) {
      format.append(startsWithSeparator() ? getSecretSeparator() : "");
      format.append(clusterPrefix);
    } else {
      format.append("%s");
    }
    // skip first one in case of addClusterPrefix is false to avoid adding extra separator at the beginning
    Arrays.stream(secretIdValues)
        .skip(addClusterPrefix ? 0 : 1)
        .forEach(
            secretIdValue -> {
              if (isNull(secretIdValue)) {
                throw new SecretsManagerException("Cannot build a secret id with null values.");
              }
              format.append(getSecretSeparator());
              format.append("%s");
            });
    return String.format(format.toString(), (Object[]) secretIdValues).toLowerCase();
  }

  @VisibleForTesting
  void setFernet(Fernet fernet) {
    this.fernet = fernet;
  }
}
