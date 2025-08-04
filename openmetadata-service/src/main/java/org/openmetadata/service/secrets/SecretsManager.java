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
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.annotations.PasswordField;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.auth.BasicAuthMechanism;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;
import org.openmetadata.service.util.AuthenticationMechanismBuilder;
import org.openmetadata.service.util.IngestionPipelineBuilder;
import org.openmetadata.service.util.ReflectionUtil;

@Slf4j
public abstract class SecretsManager {
  public static final String SECRET_FIELD_PREFIX = "secret:";
  public static final String EXTERNAL_APP_PRIVATE_CONFIG_PREFIX = "external-app/private-config/";

  public record SecretsConfig(
      String clusterName, String prefix, List<String> tags, Parameters parameters) {}

  protected record SecretsIdConfig(
      String separator,
      Boolean needsStartingSeparator,
      String cleanSecretReplacer,
      Pattern secretIdPattern) {}

  @Getter private final SecretsConfig secretsConfig;
  @Getter private final SecretsManagerProvider secretsManagerProvider;
  @Getter private final SecretsIdConfig secretsIdConfig;
  private Fernet fernet;
  private static final Set<Class<?>> DO_NOT_ENCRYPT_CLASSES =
      Set.of(OpenMetadataJWTClientConfig.class, BasicAuthMechanism.class);

  protected SecretsManager(
      SecretsManagerProvider secretsManagerProvider, SecretsConfig secretsConfig) {
    this.secretsManagerProvider = secretsManagerProvider;
    this.secretsConfig = secretsConfig;
    this.fernet = Fernet.getInstance();
    this.secretsIdConfig = builSecretsIdConfig();
  }

  public Boolean isSecret(String string) {
    return string.startsWith(SECRET_FIELD_PREFIX);
  }

  public String getSecretValue(String secretWithPrefix) {
    String secretName = secretWithPrefix.split(SECRET_FIELD_PREFIX, 2)[1];
    return getSecret(secretName);
  }

  /**
   * GET a secret using the SM implementation if the string starts with `secret:/`
   */
  abstract String getSecret(String secretName);

  /**
   * Override this method in any Secrets Manager implementation
   * that has other requirements
   */
  protected SecretsIdConfig builSecretsIdConfig() {
    return new SecretsIdConfig("/", Boolean.TRUE, "_", Pattern.compile("[^A-Za-z0-9/_\\-]"));
  }

  public Object encryptServiceConnectionConfig(
      Object connectionConfig,
      String connectionType,
      String connectionName,
      ServiceType serviceType) {
    try {
      Object newConnectionConfig =
          SecretsUtil.convert(connectionConfig, connectionType, connectionName, serviceType);
      return encryptPasswordFields(
          newConnectionConfig, buildSecretId(true, serviceType.value(), connectionName), true);
    } catch (Exception e) {
      String message =
          SecretsUtil.buildExceptionMessageConnection(e.getMessage(), connectionType, true);
      if (message != null) {
        throw new InvalidServiceConnectionException(message);
      }
      throw InvalidServiceConnectionException.byMessage(
          connectionType,
          String.format(
              "Failed to encrypt connection instance of %s. Did the Fernet Key change?",
              connectionType));
    }
  }

  public Object decryptServiceConnectionConfig(
      Object connectionConfig, String connectionType, ServiceType serviceType) {
    try {
      Object newConnectionConfig =
          SecretsUtil.convert(connectionConfig, connectionType, null, serviceType);
      return decryptPasswordFields(newConnectionConfig);
    } catch (Exception e) {
      String message =
          SecretsUtil.buildExceptionMessageConnection(e.getMessage(), connectionType, false);
      if (message != null) {
        throw new InvalidServiceConnectionException(message);
      }
      throw InvalidServiceConnectionException.byMessage(
          connectionType,
          String.format(
              "Failed to decrypt connection instance of %s. Did the Fernet Key change?",
              connectionType));
    }
  }

  public Object encryptAuthenticationMechanism(
      String name, AuthenticationMechanism authenticationMechanism) {
    if (authenticationMechanism != null) {
      AuthenticationMechanismBuilder.addDefinedConfig(authenticationMechanism);
      try {
        return encryptPasswordFields(
            authenticationMechanism, buildSecretId(true, "bot", name), true);
      } catch (Exception e) {
        throw new SecretsManagerException(
            Response.Status.BAD_REQUEST,
            String.format("Failed to encrypt user bot instance [%s]", name));
      }
    }
    return null;
  }

  /**
   * This is used to handle the JWT Token internally, in the JWTFilter, when
   * calling for the auth-mechanism in the UI, etc.
   * If using SM, we need to decrypt and GET the secret to ensure we are comparing
   * the right values.
   */
  public AuthenticationMechanism decryptAuthenticationMechanism(
      String name, AuthenticationMechanism authenticationMechanism) {
    if (authenticationMechanism != null) {
      AuthenticationMechanismBuilder.addDefinedConfig(authenticationMechanism);
      try {
        AuthenticationMechanism fernetDecrypted =
            (AuthenticationMechanism) decryptPasswordFields(authenticationMechanism);
        return (AuthenticationMechanism) getSecretFields(fernetDecrypted);
      } catch (Exception e) {
        throw new SecretsManagerException(
            Response.Status.BAD_REQUEST,
            String.format("Failed to decrypt user bot instance [%s]", name));
      }
    }
    return null;
  }

  public OpenMetadataJWTClientConfig decryptJWTConfig(OpenMetadataJWTClientConfig jwtConfig) {
    if (jwtConfig != null) {
      try {
        OpenMetadataJWTClientConfig decrypted =
            (OpenMetadataJWTClientConfig) decryptPasswordFields(jwtConfig);
        return (OpenMetadataJWTClientConfig) getSecretFields(decrypted);
      } catch (Exception e) {
        throw new SecretsManagerException(
            Response.Status.BAD_REQUEST, "Failed to decrypt JWT Client Config instance.");
      }
    }
    return null;
  }

  public void encryptIngestionPipeline(IngestionPipeline ingestionPipeline) {
    OpenMetadataConnection openMetadataConnection =
        encryptOpenMetadataConnection(ingestionPipeline.getOpenMetadataServerConnection(), true);
    ingestionPipeline.setOpenMetadataServerConnection(null);
    // we don't store OM conn sensitive data
    IngestionPipelineBuilder.addDefinedConfig(ingestionPipeline);
    try {
      encryptPasswordFields(
          ingestionPipeline, buildSecretId(true, "pipeline", ingestionPipeline.getName()), true);
    } catch (Exception e) {
      throw new SecretsManagerException(
          Response.Status.BAD_REQUEST,
          String.format(
              "Failed to encrypt ingestion pipeline instance [%s]", ingestionPipeline.getName()));
    }
    ingestionPipeline.setOpenMetadataServerConnection(openMetadataConnection);
  }

  public void decryptIngestionPipeline(IngestionPipeline ingestionPipeline) {
    OpenMetadataConnection openMetadataConnection =
        decryptOpenMetadataConnection(ingestionPipeline.getOpenMetadataServerConnection());
    ingestionPipeline.setOpenMetadataServerConnection(null);
    // we don't store OM conn sensitive data
    IngestionPipelineBuilder.addDefinedConfig(ingestionPipeline);
    try {
      decryptPasswordFields(ingestionPipeline);
    } catch (Exception e) {
      throw new SecretsManagerException(
          Response.Status.BAD_REQUEST,
          String.format(
              "Failed to decrypt ingestion pipeline instance [%s]", ingestionPipeline.getName()));
    }
    ingestionPipeline.setOpenMetadataServerConnection(openMetadataConnection);
  }

  public Workflow encryptWorkflow(Workflow workflow) {
    OpenMetadataConnection openMetadataConnection =
        encryptOpenMetadataConnection(workflow.getOpenMetadataServerConnection(), true);
    Workflow workflowConverted =
        (Workflow) ClassConverterFactory.getConverter(Workflow.class).convert(workflow);
    // we don't store OM conn sensitive data
    workflowConverted.setOpenMetadataServerConnection(null);
    try {
      encryptPasswordFields(
          workflowConverted, buildSecretId(true, "workflow", workflow.getName()), true);
    } catch (Exception e) {
      throw new SecretsManagerException(
          Response.Status.BAD_REQUEST,
          String.format("Failed to encrypt workflow instance [%s]", workflow.getName()));
    }
    workflowConverted.setOpenMetadataServerConnection(openMetadataConnection);
    return workflowConverted;
  }

  public Workflow decryptWorkflow(Workflow workflow) {
    OpenMetadataConnection openMetadataConnection =
        decryptOpenMetadataConnection(workflow.getOpenMetadataServerConnection());
    Workflow workflowConverted =
        (Workflow) ClassConverterFactory.getConverter(Workflow.class).convert(workflow);
    // we don't store OM conn sensitive data
    workflowConverted.setOpenMetadataServerConnection(null);
    try {
      decryptPasswordFields(workflowConverted);
    } catch (Exception e) {
      throw new SecretsManagerException(
          Response.Status.BAD_REQUEST,
          String.format("Failed to decrypt workflow instance [%s]", workflow.getName()));
    }
    workflowConverted.setOpenMetadataServerConnection(openMetadataConnection);
    return workflowConverted;
  }

  public OpenMetadataConnection encryptOpenMetadataConnection(
      OpenMetadataConnection openMetadataConnection, boolean store) {
    if (openMetadataConnection != null) {
      OpenMetadataConnection openMetadataConnectionConverted =
          (OpenMetadataConnection)
              ClassConverterFactory.getConverter(OpenMetadataConnection.class)
                  .convert(openMetadataConnection);
      try {
        encryptPasswordFields(
            openMetadataConnectionConverted, buildSecretId(true, "serverconnection"), store);
      } catch (Exception e) {
        throw new SecretsManagerException(
            Response.Status.BAD_REQUEST, "Failed to encrypt OpenMetadataConnection instance.");
      }
      return openMetadataConnectionConverted;
    }
    return null;
  }

  public OpenMetadataConnection decryptOpenMetadataConnection(
      OpenMetadataConnection openMetadataConnection) {
    if (openMetadataConnection != null) {
      OpenMetadataConnection openMetadataConnectionConverted =
          (OpenMetadataConnection)
              ClassConverterFactory.getConverter(OpenMetadataConnection.class)
                  .convert(openMetadataConnection);
      try {
        decryptPasswordFields(openMetadataConnectionConverted);
      } catch (Exception e) {
        throw new SecretsManagerException(
            Response.Status.BAD_REQUEST, "Failed to decrypt OpenMetadataConnection instance.");
      }
      return openMetadataConnectionConverted;
    }
    return null;
  }

  /**
   * Used only in the OM Connection Builder, which sends the credentials to Ingestion Workflows
   */
  public JWTAuthMechanism decryptJWTAuthMechanism(JWTAuthMechanism authMechanism) {
    if (authMechanism != null) {
      try {
        decryptPasswordFields(authMechanism);
      } catch (Exception e) {
        throw new SecretsManagerException(
            Response.Status.BAD_REQUEST, "Failed to decrypt OpenMetadataConnection instance.");
      }
      return authMechanism;
    }
    return null;
  }

  private Object encryptPasswordFields(Object toEncryptObject, String secretId, boolean store) {
    try {
      if (!DO_NOT_ENCRYPT_CLASSES.contains(toEncryptObject.getClass())) {
        // for each get method
        Arrays.stream(toEncryptObject.getClass().getMethods())
            .filter(ReflectionUtil::isGetMethodOfObject)
            .forEach(
                method -> {
                  Object obj = ReflectionUtil.getObjectFromMethod(method, toEncryptObject);
                  String fieldName = method.getName().replaceFirst("get", "");
                  // if the object matches the package of openmetadata
                  if (Boolean.TRUE.equals(CommonUtil.isOpenMetadataObject(obj))) {
                    // encryptPasswordFields
                    encryptPasswordFields(
                        obj,
                        buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT)),
                        store);
                    // check if it has annotation
                  } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                    // store value if proceed
                    String newFieldValue =
                        storeValue(
                            fieldName, fernet.decryptIfApplies((String) obj), secretId, store);
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
      return toEncryptObject;
    } catch (Exception e) {
      String msg =
          String.format(
              "Error trying to encrypt object with secret ID [%s] due to [%s]",
              secretId, e.getMessage());
      LOG.error(msg);
      throw new SecretsManagerException(msg);
    }
  }

  private Object decryptPasswordFields(Object toDecryptObject) {
    try {
      // for each get method
      Arrays.stream(toDecryptObject.getClass().getMethods())
          .filter(ReflectionUtil::isGetMethodOfObject)
          .forEach(
              method -> {
                Object obj = ReflectionUtil.getObjectFromMethod(method, toDecryptObject);
                String fieldName = method.getName().replaceFirst("get", "");
                // if the object matches the package of openmetadata
                if (Boolean.TRUE.equals(CommonUtil.isOpenMetadataObject(obj))) {
                  // encryptPasswordFields
                  decryptPasswordFields(obj);
                  // check if it has annotation
                } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                  String fieldValue = (String) obj;
                  // get setMethod
                  Method toSet = ReflectionUtil.getToSetMethod(toDecryptObject, obj, fieldName);
                  // set new value
                  ReflectionUtil.setValueInMethod(
                      toDecryptObject,
                      Fernet.isTokenized(fieldValue) ? fernet.decrypt(fieldValue) : fieldValue,
                      toSet);
                }
              });
      return toDecryptObject;
    } catch (Exception e) {
      LOG.error("Error trying to decrypt object due to [{}]", e.getMessage());
      throw new SecretsManagerException(
          String.format(
              "Error trying to decrypt object [%s] due to [%s]",
              toDecryptObject.toString(), e.getMessage()));
    }
  }

  /**
   * Get the object and use the secrets manager to get the right value to show
   */
  private Object getSecretFields(Object toDecryptObject) {
    try {
      // for each get method
      Arrays.stream(toDecryptObject.getClass().getMethods())
          .filter(ReflectionUtil::isGetMethodOfObject)
          .forEach(
              method -> {
                Object obj = ReflectionUtil.getObjectFromMethod(method, toDecryptObject);
                String fieldName = method.getName().replaceFirst("get", "");
                // if the object matches the package of openmetadata
                if (Boolean.TRUE.equals(CommonUtil.isOpenMetadataObject(obj))) {
                  // encryptPasswordFields
                  getSecretFields(obj);
                  // check if it has annotation
                } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                  String fieldValue = (String) obj;
                  // get setMethod
                  Method toSet = ReflectionUtil.getToSetMethod(toDecryptObject, obj, fieldName);
                  // set new value
                  ReflectionUtil.setValueInMethod(
                      toDecryptObject,
                      Boolean.TRUE.equals(isSecret(fieldValue))
                          ? getSecretValue(fieldValue)
                          : fieldValue,
                      toSet);
                }
              });
      return toDecryptObject;
    } catch (Exception e) {
      throw new SecretsManagerException(
          String.format(
              "Error trying to GET secret [%s] due to [%s]",
              toDecryptObject.toString(), e.getMessage()));
    }
  }

  protected abstract String storeValue(
      String fieldName, String value, String secretId, boolean store);

  protected String buildSecretId(boolean addClusterPrefix, String... secretIdValues) {
    StringBuilder format = new StringBuilder();
    if (addClusterPrefix) {
      if (secretsConfig.prefix != null && !secretsConfig.prefix.isEmpty()) {
        if (Boolean.TRUE.equals(secretsIdConfig.needsStartingSeparator())) {
          format.append(secretsIdConfig.separator());
        }
        format.append(secretsConfig.prefix);
      }
      if (Boolean.TRUE.equals(secretsIdConfig.needsStartingSeparator)) {
        format.append(secretsIdConfig.separator());
      }
      format.append(secretsConfig.clusterName);
    } else {
      format.append("%s");
    }

    Object[] cleanIdValues =
        Arrays.stream(secretIdValues)
            .map(
                str ->
                    secretsIdConfig
                        .secretIdPattern
                        .matcher(str)
                        .replaceAll(secretsIdConfig.cleanSecretReplacer))
            .toArray();
    // skip first one in case of addClusterPrefix is false to avoid adding extra separator at the
    // beginning
    Arrays.stream(cleanIdValues)
        .skip(addClusterPrefix ? 0 : 1)
        .forEach(
            secretIdValue -> {
              if (isNull(secretIdValue)) {
                throw new SecretsManagerException("Cannot build a secret id with null values.");
              }
              format.append(secretsIdConfig.separator);
              format.append("%s");
            });
    return String.format(format.toString(), cleanIdValues).toLowerCase();
  }

  @VisibleForTesting
  void setFernet(Fernet fernet) {
    this.fernet = fernet;
  }

  protected abstract void deleteSecretInternal(String secretName);

  public void deleteSecretsFromServiceConnectionConfig(
      Object connectionConfig,
      String connectionType,
      String connectionName,
      ServiceType serviceType) {

    try {
      Object newConnectionConfig =
          SecretsUtil.convert(connectionConfig, connectionType, connectionName, serviceType);
      deleteSecrets(newConnectionConfig, buildSecretId(true, serviceType.value(), connectionName));
    } catch (Exception e) {
      String message =
          SecretsUtil.buildExceptionMessageConnection(e.getMessage(), connectionType, true);
      if (message != null) {
        throw new InvalidServiceConnectionException(message);
      }
      throw InvalidServiceConnectionException.byMessage(
          connectionType,
          String.format("Failed to delete secrets from connection instance of %s", connectionType));
    }
  }

  public void deleteSecretsFromWorkflow(Workflow workflow) {
    Workflow workflowConverted =
        (Workflow) ClassConverterFactory.getConverter(Workflow.class).convert(workflow);
    // we don't store OM conn sensitive data
    workflowConverted.setOpenMetadataServerConnection(null);
    try {
      deleteSecrets(workflowConverted, buildSecretId(true, "workflow", workflow.getName()));
    } catch (Exception e) {
      throw new SecretsManagerException(
          Response.Status.BAD_REQUEST,
          String.format(
              "Failed to delete secrets from workflow instance [%s]", workflow.getName()));
    }
  }

  private void deleteSecrets(Object toDeleteSecretsFrom, String secretId) {
    if (!DO_NOT_ENCRYPT_CLASSES.contains(toDeleteSecretsFrom.getClass())) {
      Arrays.stream(toDeleteSecretsFrom.getClass().getMethods())
          .filter(ReflectionUtil::isGetMethodOfObject)
          .forEach(
              method -> {
                Object obj = ReflectionUtil.getObjectFromMethod(method, toDeleteSecretsFrom);
                String fieldName = method.getName().replaceFirst("get", "");
                // check if it has annotation:
                // We are replicating the logic that we use for storing the fields we need to
                // encrypt at encryptPasswordFields
                if (Boolean.TRUE.equals(CommonUtil.isOpenMetadataObject(obj))) {
                  deleteSecrets(
                      obj, buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT)));
                } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                  deleteSecretInternal(
                      buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT)));
                }
              });
    }
  }

  /**
   * Builds external app private config secret reference
   */
  public String buildExternalAppPrivateConfigReference(String appName) {
    String secretId =
        buildSecretId(false, EXTERNAL_APP_PRIVATE_CONFIG_PREFIX, appName.toLowerCase());
    return SECRET_FIELD_PREFIX + secretId;
  }

  public static Map<String, String> getTags(SecretsConfig secretsConfig) {
    Map<String, String> tags = new HashMap<>();
    secretsConfig.tags.forEach(
        keyValue -> {
          try {
            tags.put(keyValue.split(":")[0], keyValue.split(":")[1]);
          } catch (Exception e) {
            LOG.error(
                String.format(
                    "The SecretsConfig could not extract tag from [%s] due to [%s]",
                    keyValue, e.getMessage()));
          }
        });
    return tags;
  }
}
