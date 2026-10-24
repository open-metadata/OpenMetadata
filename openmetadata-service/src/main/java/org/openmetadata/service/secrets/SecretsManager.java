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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.regex.Pattern;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.annotations.PasswordField;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.auth.BasicAuthMechanism;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.sdk.exception.WebServiceException;
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

  public record SecretsConfig(
      String clusterName, String prefix, List<String> tags, Parameters parameters) {}

  protected record SecretsIdConfig(
      String separator,
      Boolean needsStartingSeparator,
      String cleanSecretReplacer,
      Pattern secretIdPattern) {}

  /**
   * What an encrypt pass accepts when a password field arrives already encoded - a Fernet token or
   * a {@code secret:} reference - instead of as a plain credential.
   *
   * <p>A value supplied by a user reaches the encrypt pass as plaintext: every legitimate
   * round trip (a PATCH, a PUT, a masked field restored from the stored entity) passes through the
   * entity masker first, and the masker only lets through plaintext or a value the entity already
   * holds. An encoded value on a user path is therefore suspect: the token decrypts (the Fernet key
   * is global) into a secret the caller never had, and a reference inside the deployment's managed
   * namespace (see {@link #isManagedSecretReference}) is a pointer to a secret this entity does
   * not own - unless it falls under one of the accepted bases. A reference outside the namespace
   * points into a vault the submitter manages themselves and is accepted.
   *
   * @param internalReStorage the values are being re-stored from a copy the server already holds
   *     (a restore, a provider migration, a stored copy of the entity), so encoded values are the
   *     entity's own and are accepted
   * @param acceptedReferenceBases secret-id bases ({@code /cluster/workflow/myworkflow}, say)
   *     whose {@code secret:} references this pass accepts in addition to plaintext and external
   *     references; a managed reference under any other base is rejected
   */
  public record CredentialPolicy(boolean internalReStorage, List<String> acceptedReferenceBases) {
    /** User-supplied values: encoded credentials and foreign references are rejected. */
    public static final CredentialPolicy STRICT = new CredentialPolicy(false, List.of());

    /** Re-storage of values the server already holds for this entity. */
    public static final CredentialPolicy INTERNAL_RE_STORAGE =
        new CredentialPolicy(true, List.of());

    public CredentialPolicy {
      acceptedReferenceBases = List.copyOf(acceptedReferenceBases);
    }

    public static CredentialPolicy strictWithReferenceBases(List<String> acceptedReferenceBases) {
      return new CredentialPolicy(false, acceptedReferenceBases);
    }
  }

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
    return encryptServiceConnectionConfig(
        connectionConfig,
        connectionType,
        connectionName,
        serviceType,
        CredentialPolicy.strictWithReferenceBases(
            List.of(buildSecretId(true, serviceType.value(), connectionName))));
  }

  public Object encryptServiceConnectionConfig(
      Object connectionConfig,
      String connectionType,
      String connectionName,
      ServiceType serviceType,
      CredentialPolicy policy) {
    try {
      Object newConnectionConfig =
          SecretsUtil.convert(connectionConfig, connectionType, connectionName, serviceType);
      return encryptPasswordFields(
          newConnectionConfig,
          buildSecretId(true, serviceType.value(), connectionName),
          true,
          policy);
    } catch (SecretsManagerException e) {
      // A rejection of a foreign credential is already classified with its own status and
      // user-facing message; re-wrapping would relabel a deliberate 400. A conversion failure
      // is not a SecretsManagerException and keeps its translated message below.
      throw e;
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
    return encryptAuthenticationMechanism(
        name,
        authenticationMechanism,
        CredentialPolicy.strictWithReferenceBases(List.of(buildSecretId(true, "bot", name))));
  }

  public Object encryptAuthenticationMechanism(
      String name, AuthenticationMechanism authenticationMechanism, CredentialPolicy policy) {
    if (authenticationMechanism != null) {
      AuthenticationMechanismBuilder.addDefinedConfig(authenticationMechanism);
      try {
        return encryptPasswordFields(
            authenticationMechanism, buildSecretId(true, "bot", name), true, policy);
      } catch (SecretsManagerException e) {
        // A rejection of a foreign credential is already classified with its own status.
        throw e;
      } catch (Exception e) {
        throw new SecretsManagerException(
            Response.Status.BAD_REQUEST,
            String.format("Failed to encrypt user bot instance [%s]", name));
      }
    }
    return null;
  }

  /**
   * Encrypts QueryRunner config secrets using a path structure that groups secrets under the
   * database service: /{cluster}/DatabaseService/{serviceName}/queryrunner/{configType}/{field}
   *
   * @param authConfig The auth config object containing password fields to encrypt
   * @param serviceName The database service name (e.g., "my-snowflake-prod")
   * @param configType The config type (ADMIN or USER)
   * @return The auth config with password fields replaced by secret references
   */
  public Object encryptQueryRunnerConfig(Object authConfig, String serviceName, String configType) {
    return encryptQueryRunnerConfig(
        authConfig,
        serviceName,
        configType,
        CredentialPolicy.strictWithReferenceBases(
            List.of(
                buildSecretId(true, "DatabaseService", serviceName, "queryrunner", configType))));
  }

  public Object encryptQueryRunnerConfig(
      Object authConfig, String serviceName, String configType, CredentialPolicy policy) {
    if (authConfig == null) {
      return null;
    }
    try {
      // Path: /argo/DatabaseService/my-snowflake-prod/queryrunner/admin/clientsecret
      return encryptPasswordFields(
          authConfig,
          buildSecretId(true, "DatabaseService", serviceName, "queryrunner", configType),
          true,
          policy);
    } catch (SecretsManagerException e) {
      // A rejection of a foreign credential is already classified with its own status.
      throw e;
    } catch (Exception e) {
      throw new SecretsManagerException(
          Response.Status.BAD_REQUEST,
          String.format(
              "Failed to encrypt query runner config for service [%s], type [%s]",
              serviceName, configType));
    }
  }

  public Object decryptQueryRunnerConfig(Object authConfig) {
    if (authConfig == null) {
      return null;
    }
    try {
      return decryptPasswordFields(authConfig);
    } catch (Exception e) {
      throw new SecretsManagerException(
          Response.Status.BAD_REQUEST, "Failed to decrypt query runner config");
    }
  }

  /**
   * Deletes QueryRunner config secrets from the secrets manager.
   * Uses the same path structure as encryptQueryRunnerConfig:
   * /{cluster}/DatabaseService/{serviceName}/queryrunner/{configType}/{field}
   *
   * @param authConfig The auth config object to identify which fields to delete
   * @param serviceName The database service name
   * @param configType The config type: "admin" or "user"
   */
  public void deleteQueryRunnerConfigSecrets(
      Object authConfig, String serviceName, String configType) {
    if (authConfig != null) {
      try {
        deleteSecrets(
            authConfig,
            buildSecretId(true, "DatabaseService", serviceName, "queryrunner", configType));
      } catch (Exception e) {
        throw new SecretsManagerException(
            Response.Status.BAD_REQUEST,
            String.format(
                "Failed to delete secrets for query runner config, service [%s], type [%s]",
                serviceName, configType));
      }
    }
  }

  /**
   * Encrypts a Context Plugin connection's password fields under the path
   * /{cluster}/contextPlugin/{name}/{field}, mirroring {@link #encryptQueryRunnerConfig}.
   *
   * @param connectionConfig An object whose {@code @PasswordField} string fields should be encrypted
   * @param pluginName The context plugin name
   * @return The config with password fields replaced by secret references
   */
  public Object encryptContextPluginConnection(Object connectionConfig, String pluginName) {
    return encryptContextPluginConnection(
        connectionConfig,
        pluginName,
        CredentialPolicy.strictWithReferenceBases(
            List.of(buildSecretId(true, "contextPlugin", pluginName))));
  }

  public Object encryptContextPluginConnection(
      Object connectionConfig, String pluginName, CredentialPolicy policy) {
    if (connectionConfig == null) {
      return null;
    }
    try {
      return encryptPasswordFields(
          connectionConfig, buildSecretId(true, "contextPlugin", pluginName), true, policy);
    } catch (SecretsManagerException e) {
      // A rejection of a foreign credential is already classified with its own status.
      throw e;
    } catch (Exception e) {
      throw new SecretsManagerException(
          Response.Status.BAD_REQUEST,
          String.format("Failed to encrypt context plugin connection for plugin [%s]", pluginName));
    }
  }

  public Object decryptContextPluginConnection(Object connectionConfig) {
    if (connectionConfig == null) {
      return null;
    }
    try {
      return decryptPasswordFields(connectionConfig);
    } catch (Exception e) {
      throw new SecretsManagerException(
          Response.Status.BAD_REQUEST, "Failed to decrypt context plugin connection");
    }
  }

  /**
   * Deletes Context Plugin connection secrets. Same path as {@link
   * #encryptContextPluginConnection(Object, String)}: /{cluster}/contextPlugin/{pluginName}/{field}.
   */
  public void deleteContextPluginConnectionSecrets(Object connectionConfig, String pluginName) {
    if (connectionConfig != null) {
      try {
        deleteSecrets(connectionConfig, buildSecretId(true, "contextPlugin", pluginName));
      } catch (Exception e) {
        throw new SecretsManagerException(
            Response.Status.BAD_REQUEST,
            String.format(
                "Failed to delete secrets for context plugin connection [%s]", pluginName));
      }
    }
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
            String.format(
                "Failed to decrypt user bot instance [%s] due to [%s]", name, e.getMessage()));
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
    encryptIngestionPipeline(
        ingestionPipeline,
        CredentialPolicy.strictWithReferenceBases(
            List.of(buildSecretId(true, "pipeline", ingestionPipeline.getName()))));
  }

  public void encryptIngestionPipeline(
      IngestionPipeline ingestionPipeline, CredentialPolicy policy) {
    OpenMetadataConnection openMetadataConnection =
        encryptOpenMetadataConnection(ingestionPipeline.getOpenMetadataServerConnection(), true);
    ingestionPipeline.setOpenMetadataServerConnection(null);
    // we don't store OM conn sensitive data
    IngestionPipelineBuilder.addDefinedConfig(ingestionPipeline);
    try {
      encryptPasswordFields(
          ingestionPipeline,
          buildSecretId(true, "pipeline", ingestionPipeline.getName()),
          true,
          policy);
    } catch (SecretsManagerException e) {
      // A rejection of a foreign credential is already classified with its own status.
      throw e;
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
    return encryptWorkflow(workflow, workflowCredentialPolicy(workflow));
  }

  public Workflow encryptWorkflow(Workflow workflow, CredentialPolicy policy) {
    OpenMetadataConnection openMetadataConnection =
        encryptOpenMetadataConnection(workflow.getOpenMetadataServerConnection(), true);
    Workflow workflowConverted =
        (Workflow) ClassConverterFactory.getConverter(Workflow.class).convert(workflow);
    // we don't store OM conn sensitive data
    workflowConverted.setOpenMetadataServerConnection(null);
    try {
      encryptPasswordFields(
          workflowConverted, buildSecretId(true, "workflow", workflow.getName()), true, policy);
    } catch (SecretsManagerException e) {
      // A rejection of a foreign credential is already classified with its own status.
      throw e;
    } catch (Exception e) {
      throw new SecretsManagerException(
          Response.Status.BAD_REQUEST,
          String.format("Failed to encrypt workflow instance [%s]", workflow.getName()));
    }
    workflowConverted.setOpenMetadataServerConnection(openMetadataConnection);
    return workflowConverted;
  }

  /**
   * Strict policy for a user-submitted workflow: it accepts references into the workflow's own
   * secret-id namespace (a PATCH may echo back the references a GET returned) and, for a
   * TEST_CONNECTION request, the tested service's namespace. The masker restores a masked
   * TEST_CONNECTION request from that service's stored connection, whose references belong to the
   * service, not the workflow.
   */
  private CredentialPolicy workflowCredentialPolicy(Workflow workflow) {
    List<String> referenceBases = new ArrayList<>();
    referenceBases.add(buildSecretId(true, "workflow", workflow.getName()));
    if (workflow.getRequest() instanceof TestServiceConnectionRequest testRequest
        && testRequest.getServiceName() != null
        && testRequest.getServiceType() != null) {
      referenceBases.add(
          buildSecretId(true, testRequest.getServiceType().value(), testRequest.getServiceName()));
    }
    return CredentialPolicy.strictWithReferenceBases(referenceBases);
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
            openMetadataConnectionConverted,
            buildSecretId(true, "serverconnection"),
            store,
            // The connection is server-built (OpenMetadataConnectionBuilder) or comes from the
            // request; its only sensitive fields live in classes the walker skips, so no encoded
            // value can legitimately be in flight here.
            CredentialPolicy.STRICT);
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

  /**
   * Applies {@code action} to each OpenMetadata object held in {@code obj} when it is a collection,
   * passing the element index. Collections were previously not traversed, so a secret declared
   * inside a JSON-schema array was never encrypted and was persisted in cleartext.
   *
   * <p>Every walker here routes through this so that encrypt and delete derive the same secret id
   * for the same element - otherwise deleting a service would strand its secrets in the store.
   */
  private static void forEachTraversableElement(Object obj, BiConsumer<Object, String> action) {
    if (!(obj instanceof Collection<?> collection)) {
      return;
    }
    List<String> elementKeys = ReflectionUtil.getCollectionElementKeys(collection);
    int index = 0;
    for (Object element : collection) {
      if (Boolean.TRUE.equals(CommonUtil.isOpenMetadataObject(element))) {
        action.accept(element, elementKeys.get(index));
      }
      index++;
    }
  }

  private Object encryptPasswordFields(
      Object toEncryptObject, String secretId, boolean store, CredentialPolicy policy) {
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
                  if (CommonUtil.isOpenMetadataObject(obj)) {
                    // encryptPasswordFields
                    encryptPasswordFields(
                        obj,
                        buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT)),
                        store,
                        policy);
                    // check if it has annotation
                  } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                    // reject a credential the entity does not own before it can be decrypted
                    requireOwnCredential(fieldName, obj, policy);
                    // store value if proceed
                    String newFieldValue =
                        storeValue(
                            fieldName, fernet.decryptIfApplies((String) obj), secretId, store);
                    // get setMethod
                    Method toSet = ReflectionUtil.getToSetMethod(toEncryptObject, obj, fieldName);
                    // set new value. A null means the field was cleared, so there is nothing left
                    // to encrypt and the entity must not keep a reference to a removed secret.
                    ReflectionUtil.setValueInMethod(
                        toEncryptObject,
                        newFieldValue == null || Fernet.isTokenized(newFieldValue)
                            ? newFieldValue
                            : store ? fernet.encrypt(newFieldValue) : newFieldValue,
                        toSet);
                  } else {
                    forEachTraversableElement(
                        obj,
                        (element, elementKey) ->
                            encryptPasswordFields(
                                element,
                                buildSecretId(
                                    false,
                                    secretId,
                                    fieldName.toLowerCase(Locale.ROOT),
                                    elementKey),
                                store,
                                policy));
                  }
                });
      }
      return toEncryptObject;
    } catch (WebServiceException e) {
      // Already classified with its own status and user-facing message — a rejection of a
      // foreign credential in requireOwnCredential, for one. Re-wrapping would relabel a
      // deliberate 400 as a 500.
      throw e;
    } catch (Exception e) {
      String msg =
          String.format(
              "Error trying to encrypt object with secret ID [%s] due to [%s]",
              secretId, exceptionMessage(e));
      LOG.error(msg);
      throw new SecretsManagerException(msg, e);
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
                if (CommonUtil.isOpenMetadataObject(obj)) {
                  // encryptPasswordFields
                  decryptPasswordFields(obj);
                  // check if it has annotation
                } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                  String fieldValue = (String) obj;
                  // get setMethod
                  Method toSet = ReflectionUtil.getToSetMethod(toDecryptObject, obj, fieldName);
                  // Only Fernet-decrypt. Secret references (secret:/path) are returned as-is
                  // for the ingestion client to resolve. The server does not fetch secrets.
                  ReflectionUtil.setValueInMethod(
                      toDecryptObject,
                      Fernet.isTokenized(fieldValue) ? fernet.decrypt(fieldValue) : fieldValue,
                      toSet);
                } else {
                  forEachTraversableElement(
                      obj, (element, elementKey) -> decryptPasswordFields(element));
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
                if (CommonUtil.isOpenMetadataObject(obj)) {
                  // encryptPasswordFields
                  getSecretFields(obj);
                  // check if it has annotation
                } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                  String fieldValue = (String) obj;
                  // get setMethod
                  Method toSet = ReflectionUtil.getToSetMethod(toDecryptObject, obj, fieldName);
                  // Fetch from SM if it's a secret reference
                  ReflectionUtil.setValueInMethod(
                      toDecryptObject,
                      Boolean.TRUE.equals(isSecret(fieldValue))
                          ? getSecretValue(fieldValue)
                          : fieldValue,
                      toSet);
                } else {
                  forEachTraversableElement(obj, (element, elementKey) -> getSecretFields(element));
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

  /**
   * Rejects a password field set to an encoded credential the entity does not own - the
   * store-time counterpart of the delete walker's rule that a user-supplied reference "points at a
   * secret this entity does not own, and is never deleted" (see {@link #storedSecretName}). A
   * Fernet token submitted on a user path decrypts with the server's own key, so it copies a
   * secret the submitter never had; a {@code secret:} reference inside this deployment's managed
   * namespace and outside the accepted bases is a pointer to another entity's secret. Either way
   * the value would be re-stored as this entity's credential. A reference into a vault the
   * submitter manages themselves is left alone (see {@link #isManagedSecretReference}). The
   * submitted value is deliberately not echoed: it may itself be a stolen token.
   */
  private void requireOwnCredential(String fieldName, Object value, CredentialPolicy policy) {
    if (policy.internalReStorage()) {
      return;
    }
    String fieldValue = (String) value;
    if (!Fernet.isTokenized(fieldValue) && !Boolean.TRUE.equals(isSecret(fieldValue))) {
      return; // a plain value the caller is entitled to store
    }
    if (Boolean.TRUE.equals(isSecret(fieldValue)) && isAcceptedReference(fieldValue, policy)) {
      return;
    }
    throw new SecretsManagerException(
        Response.Status.BAD_REQUEST,
        String.format(
            "Field [%s] cannot be set to an encrypted credential or a secret reference of "
                + "another entity. Send the plain value instead.",
            fieldName));
  }

  private boolean isAcceptedReference(String reference, CredentialPolicy policy) {
    String secretName = reference.substring(SECRET_FIELD_PREFIX.length()).toLowerCase(Locale.ROOT);
    boolean ownBase =
        policy.acceptedReferenceBases().stream()
            .anyMatch(base -> secretName.startsWith(base + secretsIdConfig.separator()));
    return ownBase || !isManagedSecretName(secretName);
  }

  /**
   * Whether a {@code secret:} reference names a secret this deployment's own secrets manager
   * owns: its path falls under the cluster-prefixed root every stored secret id is built from
   * (see {@link #buildSecretId(boolean, String...)}). A reference outside that root points into a
   * vault the submitter manages themselves - the ingestion framework resolves those at runtime and
   * the delete walker leaves them alone - so it stays acceptable on user paths. Inside the root
   * every secret belongs to some entity, and only that entity may submit its reference. The
   * comparison is lower-cased because {@link #buildSecretId(boolean, String...)} lower-cases
   * every id it builds and Azure Key Vault, unlike AWS or GCP, resolves names case-insensitively,
   * so a case variant of a stored reference must not slip out of the namespace.
   */
  public boolean isManagedSecretReference(String reference) {
    return isManagedSecretName(reference.substring(SECRET_FIELD_PREFIX.length()));
  }

  private boolean isManagedSecretName(String secretName) {
    String namespaceRoot = buildSecretId(true);
    return secretName
        .toLowerCase(Locale.ROOT)
        .startsWith(namespaceRoot + secretsIdConfig.separator());
  }

  protected abstract String storeValue(
      String fieldName, String value, String secretId, boolean store);

  protected static String exceptionMessage(Throwable throwable) {
    return throwable.getMessage() != null
        ? throwable.getMessage()
        : throwable.getClass().getSimpleName();
  }

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
    deleteSecrets(toDeleteSecretsFrom, List.of(secretId));
  }

  /**
   * @param secretIds the secret id of {@code toDeleteSecretsFrom} last, preceded by the ids of the
   *     objects that enclose it
   */
  private void deleteSecrets(Object toDeleteSecretsFrom, List<String> secretIds) {
    String secretId = secretIds.getLast();
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
                if (CommonUtil.isOpenMetadataObject(obj)) {
                  deleteSecrets(
                      obj,
                      withNestedSecretId(
                          secretIds,
                          buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT))));
                } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                  deleteStoredSecret(
                      storedSecretName(
                          (String) obj, secretIds, fieldName.toLowerCase(Locale.ROOT)));
                } else {
                  forEachTraversableElement(
                      obj,
                      (element, elementKey) ->
                          deleteSecrets(
                              element,
                              withNestedSecretId(
                                  secretIds,
                                  buildSecretId(
                                      false,
                                      secretId,
                                      fieldName.toLowerCase(Locale.ROOT),
                                      elementKey))));
                }
              });
    }
  }

  private static List<String> withNestedSecretId(List<String> secretIds, String nestedSecretId) {
    List<String> nestedSecretIds = new ArrayList<>(secretIds);
    nestedSecretIds.add(nestedSecretId);
    return nestedSecretIds;
  }

  /**
   * Names the secret that holds a password field. A migration that moves a field into a nested
   * object leaves its {@code secret:} reference where the field used to be, so a reference to the
   * same field under an enclosing object is the secret to delete. Any other reference was supplied
   * by the user, points at a secret this entity does not own, and is never deleted.
   */
  private String storedSecretName(String fieldValue, List<String> secretIds, String fieldName) {
    List<String> fieldSecretNames =
        secretIds.stream().map(secretId -> buildSecretId(false, secretId, fieldName)).toList();
    return referencedSecretName(fieldValue)
        .filter(fieldSecretNames::contains)
        .orElse(fieldSecretNames.getLast());
  }

  private Optional<String> referencedSecretName(String fieldValue) {
    return Boolean.TRUE.equals(isSecret(fieldValue))
        ? Optional.of(fieldValue.substring(SECRET_FIELD_PREFIX.length()))
        : Optional.empty();
  }

  /** Removes one secret of an entity that is being hard deleted. */
  protected void deleteStoredSecret(String secretName) {
    deleteSecretInternal(secretName);
  }

  public static Map<String, String> getTags(SecretsConfig secretsConfig) {
    Map<String, String> tags = new HashMap<>();
    secretsConfig.tags.forEach(
        keyValue -> {
          try {
            tags.put(keyValue.split(":")[0], keyValue.split(":")[1]);
          } catch (Exception e) {
            LOG.error(
                "The SecretsConfig could not extract tag from [{}] due to [{}]",
                keyValue,
                e.getMessage());
          }
        });
    return tags;
  }
}
