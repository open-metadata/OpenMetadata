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
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.regex.Pattern;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.annotations.PasswordField;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ServiceEntityInterface;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.WebServiceException;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.SecretMapOwnership.WriteContext;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;
import org.openmetadata.service.util.AuthenticationMechanismBuilder;
import org.openmetadata.service.util.IngestionPipelineBuilder;
import org.openmetadata.service.util.ReflectionUtil;

@Slf4j
public abstract class SecretsManager {
  public static final String SECRET_FIELD_PREFIX = "secret:";
  private static final Pattern COMPACT_FIELD_TAG = Pattern.compile("f[0-9a-f]{16}");

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
  static final Set<Class<?>> DO_NOT_ENCRYPT_CLASSES =
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
        true,
        WriteContext.untracked(null));
  }

  public Object encryptServiceConnectionConfig(
      Object connectionConfig,
      Object originalConnectionConfig,
      String connectionType,
      String connectionName,
      ServiceType serviceType) {
    return encryptServiceConnectionConfig(
        connectionConfig,
        connectionType,
        connectionName,
        serviceType,
        true,
        WriteContext.untracked(originalConnectionConfig));
  }

  public Object encryptServiceConnectionConfigForWrite(
      Object connectionConfig,
      String connectionType,
      String connectionName,
      ServiceType serviceType,
      WriteContext<Object> context) {
    return encryptServiceConnectionConfig(
        connectionConfig, connectionType, connectionName, serviceType, true, context);
  }

  /** Protects prepared and approval-staged values without creating or changing external secrets. */
  public Object prepareServiceConnectionConfig(
      Object connectionConfig,
      String connectionType,
      String connectionName,
      ServiceType serviceType) {
    return encryptServiceConnectionConfig(
        connectionConfig,
        connectionType,
        connectionName,
        serviceType,
        false,
        WriteContext.untracked(null));
  }

  private Object encryptServiceConnectionConfig(
      Object connectionConfig,
      String connectionType,
      String connectionName,
      ServiceType serviceType,
      boolean persistExternalSecrets,
      WriteContext<Object> context) {
    try {
      Object newConnectionConfig =
          SecretsUtil.convert(connectionConfig, connectionType, connectionName, serviceType);
      Object originalConnectionConfig = context.original();
      Object savedConnectionConfig =
          originalConnectionConfig == null
              ? null
              : SecretsUtil.convert(
                  originalConnectionConfig, connectionType, connectionName, serviceType);
      return encryptPasswordFields(
          newConnectionConfig,
          context.withOriginal(savedConnectionConfig),
          buildSecretId(true, serviceType.value(), connectionName),
          true,
          persistExternalSecrets);
    } catch (SecretsManagerException e) {
      // A deliberate 400 names the offending value; the generic message would blame the key.
      if (e.getResponse().getStatus() == Response.Status.BAD_REQUEST.getStatusCode()) {
        throw e;
      }
      throw invalidConnection(e, connectionType);
    } catch (Exception e) {
      throw invalidConnection(e, connectionType);
    }
  }

  private static InvalidServiceConnectionException invalidConnection(
      Exception e, String connectionType) {
    String message =
        SecretsUtil.buildExceptionMessageConnection(e.getMessage(), connectionType, true);
    return message != null
        ? new InvalidServiceConnectionException(message)
        : InvalidServiceConnectionException.byMessage(
            connectionType,
            String.format(
                "Failed to encrypt connection instance of %s. Did the Fernet Key change?",
                connectionType));
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
   * Encrypts QueryRunner config secrets using a path structure that groups secrets under the
   * database service: /{cluster}/DatabaseService/{serviceName}/queryrunner/{configType}/{field}
   *
   * @param authConfig The auth config object containing password fields to encrypt
   * @param serviceName The database service name (e.g., "my-snowflake-prod")
   * @param configType The config type (ADMIN or USER)
   * @return The auth config with password fields replaced by secret references
   */
  public Object encryptQueryRunnerConfig(Object authConfig, String serviceName, String configType) {
    if (authConfig == null) {
      return null;
    }
    try {
      // Path: /argo/DatabaseService/my-snowflake-prod/queryrunner/admin/clientsecret
      return encryptPasswordFields(
          authConfig,
          buildSecretId(true, "DatabaseService", serviceName, "queryrunner", configType),
          true);
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
    if (connectionConfig == null) {
      return null;
    }
    try {
      return encryptPasswordFields(
          connectionConfig, buildSecretId(true, "contextPlugin", pluginName), true);
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
    encryptIngestionPipeline(ingestionPipeline, null);
  }

  public void encryptIngestionPipeline(
      IngestionPipeline ingestionPipeline, IngestionPipeline originalIngestionPipeline) {
    encryptIngestionPipelineForWrite(
        ingestionPipeline, WriteContext.untracked(originalIngestionPipeline));
  }

  public void encryptIngestionPipelineForWrite(
      IngestionPipeline ingestionPipeline, WriteContext<IngestionPipeline> context) {
    OpenMetadataConnection openMetadataConnection =
        encryptOpenMetadataConnection(ingestionPipeline.getOpenMetadataServerConnection(), true);
    ingestionPipeline.setOpenMetadataServerConnection(null);
    // we don't store OM conn sensitive data
    IngestionPipelineBuilder.addDefinedConfig(ingestionPipeline);
    IngestionPipeline savedPipeline = null;
    IngestionPipeline originalIngestionPipeline = context.original();
    if (originalIngestionPipeline != null) {
      savedPipeline = JsonUtils.deepCopy(originalIngestionPipeline, IngestionPipeline.class);
      IngestionPipelineBuilder.addDefinedConfigForRead(savedPipeline);
      savedPipeline.setOpenMetadataServerConnection(null);
    }
    try {
      // A pipeline name is unique only within its service, so it cannot key the vault entry.
      encryptPasswordFields(
          ingestionPipeline,
          context.withOriginal(savedPipeline),
          buildSecretId(true, "pipeline", ingestionPipeline.getId().toString()),
          true,
          true);
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
    IngestionPipelineBuilder.addDefinedConfigForRead(ingestionPipeline);
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

  /**
   * Applies {@code action} to each OpenMetadata object held in {@code obj} when it is a collection,
   * passing the element index. Collections were previously not traversed, so a secret declared
   * inside a JSON-schema array was never encrypted and was persisted in cleartext.
   *
   * <p>Every walker here routes through this so that encrypt and delete derive the same secret id
   * for the same element - otherwise deleting a service would strand its secrets in the store.
   */
  static void forEachTraversableElement(Object obj, BiConsumer<Object, String> action) {
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

  private static final int MAX_FRESH_ID_ATTEMPTS = 8;

  private Object encryptPasswordFields(Object toEncryptObject, String secretId, boolean store) {
    return encryptPasswordFields(
        toEncryptObject, WriteContext.untracked(null), secretId, store, true);
  }

  private Object encryptPasswordFields(
      Object toEncryptObject,
      WriteContext<?> context,
      String secretId,
      boolean store,
      boolean persistExternalSecrets) {
    ReferenceScope scope =
        store && persistExternalSecrets && this instanceof ExternalSecretsManager external
            ? ReferenceScope.from(external, secretId, toEncryptObject, context)
            : null;
    if (scope != null) {
      validateIncomingSecretValues(toEncryptObject, secretId);
    }
    return encryptPasswordFields(
        toEncryptObject, secretId, store, persistExternalSecrets, false, scope);
  }

  private Object encryptPasswordFields(
      Object toEncryptObject,
      String secretId,
      boolean store,
      boolean persistExternalSecrets,
      boolean inCollection,
      ReferenceScope scope) {
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
                        persistExternalSecrets,
                        inCollection,
                        scope);
                    // check if it has annotation
                  } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                    if (obj instanceof Map<?, ?> secretMap) {
                      encryptSecretMapEntries(
                          secretMap,
                          fieldName,
                          secretId,
                          store,
                          persistExternalSecrets,
                          inCollection,
                          scope);
                    } else {
                      String clearValue = fernet.decryptIfApplies((String) obj);
                      // store value if proceed
                      String storedFieldValue =
                          inCollection && scope != null
                              ? storeListFieldValue(fieldName, clearValue, secretId, scope)
                              : storeValue(
                                  fieldName, clearValue, secretId, store && persistExternalSecrets);
                      if (!inCollection
                          && scope != null
                          && storedFieldValue != null
                          && Boolean.TRUE.equals(isSecret(storedFieldValue))) {
                        scope.claim(storedFieldValue.substring(SECRET_FIELD_PREFIX.length()));
                      }
                      String newFieldValue =
                          persistExternalSecrets ? storedFieldValue : (String) obj;
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
                    }
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
                                persistExternalSecrets,
                                true,
                                scope));
                  }
                });
      }
      return toEncryptObject;
    } catch (WebServiceException e) {
      // Already classified with its own status and user-facing message — the reserved-value
      // rejection in storeValue, for one. Re-wrapping would relabel a deliberate 400 as a 500.
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

  private void validateIncomingSecretValues(Object toEncryptObject, String secretId) {
    visitStoredSecrets(
        toEncryptObject,
        List.of(secretId),
        secret -> {
          String clear = fernet.decryptIfApplies(secret.value());
          if (clear != null && !clear.isEmpty() && Boolean.FALSE.equals(isSecret(clear))) {
            validateSecretValue(secret.fieldName(), clear);
          }
        });
  }

  /**
   * Stores or clears a password field inside a collection element without overwriting or deleting a
   * secret that another element in the saved or incoming config still references.
   */
  private String storeListFieldValue(
      String fieldName, String value, String secretId, ReferenceScope scope) {
    String defaultSecretId = buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT));
    if (value == null || value.isEmpty()) {
      scope.secretIdToDeleteOnClear(defaultSecretId).ifPresent(this::deleteStoredSecret);
      return null;
    }
    if (Boolean.TRUE.equals(isSecret(value))) {
      return value;
    }
    String storedRef = storeWithFreshFallback(fieldName, defaultSecretId, value, scope);
    if (Boolean.TRUE.equals(isSecret(storedRef))) {
      scope.claim(storedRef.substring(SECRET_FIELD_PREFIX.length()));
    }
    return storedRef;
  }

  private String storeWithFreshFallback(
      String fieldName, String defaultSecretId, String value, ReferenceScope scope) {
    Optional<String> existingId = scope.selectExistingWriteId(defaultSecretId);
    if (existingId.isPresent()) {
      try {
        return storeOwnedValue(fieldName, existingId.get(), value);
      } catch (SecretNameReservedException e) {
        LOG.debug("Secret [{}] is held by a deleted secret; using a fresh key", existingId.get());
      }
    }

    String base = scope.freshIdBase(defaultSecretId);
    for (int attempt = 0; attempt < MAX_FRESH_ID_ATTEMPTS; attempt++) {
      String candidate = buildSecretId(false, base, SecretKeyEncoding.freshSuffix());
      if (!scope.claimFresh(candidate)) {
        continue;
      }
      try {
        return scope.manager.storeFreshValue(
            fieldName, candidate, value, scope.context::freshCreated);
      } catch (SecretNameReservedException e) {
        LOG.debug("Fresh secret name [{}] is unavailable; trying another key", candidate);
      }
    }
    throw new SecretsManagerException(
        String.format("Could not allocate a fresh secret id for [%s].", defaultSecretId));
  }

  /**
   * Encrypts each string entry of a password-annotated map - a schema property whose {@code
   * additionalProperties} carry {@code format: password}, such as Kafka {@code consumerConfig}.
   * Non-string values are left alone: those maps also carry numbers and booleans that are not
   * secrets. Each entry is stored under its own secret id, derived from the map's id and the entry
   * key, so that {@code deleteSecrets} derives the same id for the same entry. An empty entry is
   * kept as an empty string; its backing secret is reconciled only after the entity write commits.
   */
  private void encryptSecretMapEntries(
      Map<?, ?> secretMap,
      String fieldName,
      String secretId,
      boolean store,
      boolean persistExternalSecrets,
      boolean inCollection,
      ReferenceScope scope) {
    String mapSecretId = buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT));
    rejectCollidingEntrySecretIds(secretMap, fieldName, mapSecretId);
    transformSecretMapEntries(
        secretMap,
        (entryKey, entryValue) -> {
          String clearValue = fernet.decryptIfApplies(entryValue);
          if (clearValue == null || clearValue.isEmpty()) {
            return clearValue;
          }
          String storedValue =
              inCollection && scope != null
                  ? storeListFieldValue(entryKey, clearValue, mapSecretId, scope)
                  : storeValue(entryKey, clearValue, mapSecretId, store && persistExternalSecrets);
          if (!inCollection
              && scope != null
              && storedValue != null
              && Boolean.TRUE.equals(isSecret(storedValue))) {
            scope.claim(storedValue.substring(SECRET_FIELD_PREFIX.length()));
          }
          String newValue = persistExternalSecrets ? storedValue : entryValue;
          return encryptedForStorage(newValue, store);
        });
  }

  private String encryptedForStorage(String value, boolean store) {
    return value == null || Fernet.isTokenized(value) || !store ? value : fernet.encrypt(value);
  }

  /**
   * Secret ids are normalized - lower-cased, with characters the store does not accept replaced -
   * so distinct entry keys such as {@code X.Auth.Token} and {@code X_Auth_Token} can share one id.
   * Storing both would overwrite one secret with the other and resolve both references to the same
   * value, so such a map is refused before any entry is written.
   */
  private void rejectCollidingEntrySecretIds(
      Map<?, ?> secretMap, String fieldName, String mapSecretId) {
    Map<String, String> keyBySecretId = new HashMap<>();
    secretMap.forEach(
        (key, value) -> {
          String entryKey = String.valueOf(key);
          String entrySecretId =
              buildSecretId(false, mapSecretId, entryKey.toLowerCase(Locale.ROOT));
          String clashingKey =
              value instanceof String ? keyBySecretId.putIfAbsent(entrySecretId, entryKey) : null;
          if (clashingKey != null) {
            throw new SecretsManagerException(
                Response.Status.BAD_REQUEST,
                String.format(
                    "Entries [%s] and [%s] of [%s] would be stored under the same secret id. "
                        + "Rename one of them.",
                    clashingKey, entryKey, fieldName));
          }
        });
  }

  /**
   * Applies {@code transform} to every string-valued entry of a password-annotated map, keyed by
   * the entry's own key. Iterates over a copy of the entries so the transform may replace values.
   */
  private void transformSecretMapEntries(
      Map<?, ?> secretMap, BiFunction<String, String, String> transform) {
    new ArrayList<>(secretMap.entrySet())
        .forEach(
            entry -> {
              if (entry.getValue() instanceof String stringValue) {
                String entryKey = String.valueOf(entry.getKey());
                @SuppressWarnings("unchecked")
                Map<String, Object> mutableMap = (Map<String, Object>) secretMap;
                mutableMap.put(entryKey, transform.apply(entryKey, stringValue));
              }
            });
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
                  if (obj instanceof Map<?, ?> secretMap) {
                    // Only Fernet-decrypt. Secret references (secret:/path) are returned as-is
                    // for the ingestion client to resolve. The server does not fetch secrets.
                    transformSecretMapEntries(
                        secretMap,
                        (entryKey, entryValue) ->
                            Fernet.isTokenized(entryValue)
                                ? fernet.decrypt(entryValue)
                                : entryValue);
                  } else {
                    String fieldValue = (String) obj;
                    // get setMethod
                    Method toSet = ReflectionUtil.getToSetMethod(toDecryptObject, obj, fieldName);
                    // Only Fernet-decrypt. Secret references (secret:/path) are returned as-is
                    // for the ingestion client to resolve. The server does not fetch secrets.
                    ReflectionUtil.setValueInMethod(
                        toDecryptObject,
                        Fernet.isTokenized(fieldValue) ? fernet.decrypt(fieldValue) : fieldValue,
                        toSet);
                  }
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
                  if (obj instanceof Map<?, ?> secretMap) {
                    transformSecretMapEntries(
                        secretMap,
                        (entryKey, entryValue) ->
                            Boolean.TRUE.equals(isSecret(entryValue))
                                ? getSecretValue(entryValue)
                                : entryValue);
                  } else {
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
                  }
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

  protected abstract String storeValue(
      String fieldName, String value, String secretId, boolean store);

  /** Credentials stored under keys derived from their owner's identity rather than a name. */
  public OwnedSecrets ownedSecrets() {
    return new OwnedSecrets(this);
  }

  /**
   * Stores {@code value} under {@code secretId} and returns what the field holds instead. Only an
   * external manager writes anywhere; here the value stays in the field, Fernet-encrypted.
   */
  protected String storeOwnedValue(String fieldName, String secretId, String value) {
    return value;
  }

  /** Validates a plaintext secret value before any vault writes or deletes occur. */
  protected void validateSecretValue(String fieldName, String value) {}

  /** The value {@code reference} points at, or empty when its secret does not exist. */
  protected Optional<String> findSecretValue(String reference) {
    return Optional.ofNullable(getSecretValue(reference));
  }

  /** Longest secret id the provider accepts. */
  protected int maxSecretIdLength() {
    return Integer.MAX_VALUE;
  }

  /**
   * The name the provider resolves {@code secretName} to, so that two spellings of one secret
   * compare equal.
   */
  protected String canonicalSecretName(String secretName) {
    return secretName;
  }

  Fernet fernet() {
    return fernet;
  }

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
    visitStoredSecrets(
        toDeleteSecretsFrom, List.of(secretId), secret -> deleteStoredSecret(secret.name()));
  }

  /**
   * @param secretIds the secret id of {@code toDeleteSecretsFrom} last, preceded by the ids of the
   *     objects that enclose it
   */
  private void visitStoredSecrets(
      Object toDeleteSecretsFrom, List<String> secretIds, Consumer<StoredSecret> visitor) {
    String secretId = secretIds.getLast();
    if (toDeleteSecretsFrom != null
        && !DO_NOT_ENCRYPT_CLASSES.contains(toDeleteSecretsFrom.getClass())) {
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
                  visitStoredSecrets(
                      obj,
                      withNestedSecretId(
                          secretIds,
                          buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT))),
                      visitor);
                } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                  if (obj instanceof Map<?, ?> secretMap) {
                    visitSecretMapEntries(
                        secretMap,
                        withNestedSecretId(
                            secretIds,
                            buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT))),
                        visitor);
                  } else {
                    visitor.accept(
                        new StoredSecret(
                            storedSecretName(
                                (String) obj, secretIds, fieldName.toLowerCase(Locale.ROOT)),
                            buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT)),
                            fieldName,
                            (String) obj,
                            false));
                  }
                } else {
                  forEachTraversableElement(
                      obj,
                      (element, elementKey) ->
                          visitStoredSecrets(
                              element,
                              withNestedSecretId(
                                  secretIds,
                                  buildSecretId(
                                      false,
                                      secretId,
                                      fieldName.toLowerCase(Locale.ROOT),
                                      elementKey)),
                              visitor));
                }
              });
    }
  }

  private void visitSecretMapEntries(
      Map<?, ?> secretMap, List<String> mapSecretIds, Consumer<StoredSecret> visitor) {
    String mapSecretId = mapSecretIds.getLast();
    secretMap.forEach(
        (key, value) -> {
          if (value instanceof String stringValue) {
            String entryKey = String.valueOf(key);
            String lowerEntryKey = entryKey.toLowerCase(Locale.ROOT);
            visitor.accept(
                new StoredSecret(
                    storedSecretName(stringValue, mapSecretIds, lowerEntryKey),
                    buildSecretId(false, mapSecretId, lowerEntryKey),
                    entryKey,
                    stringValue,
                    true));
          }
        });
  }

  public SecretInventory secretInventory(ServiceEntityInterface service, ServiceType serviceType) {
    Object config =
        service.getConnection() == null || service.getConnection().getConfig() == null
            ? null
            : SecretsUtil.convert(
                service.getConnection().getConfig(),
                service.getServiceType().value(),
                service.getName(),
                serviceType);
    return secretInventory(config, buildSecretId(true, serviceType.value(), service.getName()));
  }

  public SecretInventory secretInventory(IngestionPipeline pipeline) {
    IngestionPipeline typed = JsonUtils.deepCopy(pipeline, IngestionPipeline.class);
    IngestionPipelineBuilder.addDefinedConfigForRead(typed);
    typed.setOpenMetadataServerConnection(null);
    return secretInventory(typed, buildSecretId(true, "pipeline", pipeline.getId().toString()));
  }

  /** Local inventory only: reference targets are never fetched to establish ownership. */
  public record SecretInventory(
      String root,
      Set<String> writtenMaps,
      Set<String> storedMaps,
      Set<String> writtenScalars,
      Set<String> storedScalars,
      Set<String> references,
      Map<String, String> referencesBySlot) {
    Set<String> writtenSecretsFor(Set<String> writtenSlots) {
      Set<String> written = new HashSet<>();
      for (String slot : writtenSlots) {
        written.add(referencesBySlot.getOrDefault(slot, slot));
      }
      return written;
    }
  }

  private record StoredSecret(
      String name, String slot, String fieldName, String value, boolean mapEntry) {}

  @VisibleForTesting
  SecretInventory secretInventory(Object config, String root) {
    Set<String> writtenMaps = new HashSet<>();
    Set<String> storedMaps = new HashSet<>();
    Set<String> writtenScalars = new HashSet<>();
    Set<String> storedScalars = new HashSet<>();
    Set<String> references = new HashSet<>();
    Map<String, String> referencesBySlot = new HashMap<>();
    visitStoredSecrets(
        config,
        List.of(root),
        secret ->
            collectSecret(
                secret,
                secret.mapEntry() ? writtenMaps : writtenScalars,
                secret.mapEntry() ? storedMaps : storedScalars,
                references,
                referencesBySlot));
    return new SecretInventory(
        root,
        Set.copyOf(writtenMaps),
        Set.copyOf(storedMaps),
        Set.copyOf(writtenScalars),
        Set.copyOf(storedScalars),
        Set.copyOf(references),
        Map.copyOf(referencesBySlot));
  }

  private void collectSecret(
      StoredSecret secret,
      Set<String> written,
      Set<String> stored,
      Set<String> references,
      Map<String, String> referencesBySlot) {
    String clear = fernet.decryptIfApplies(secret.value());
    if (clear == null || clear.isEmpty()) {
      return;
    }
    Optional<String> reference = referencedSecretName(clear);
    reference.ifPresent(
        ref -> {
          references.add(ref);
          referencesBySlot.put(secret.slot(), ref);
        });
    if (reference.isEmpty()) {
      written.add(secret.slot());
    }
    if (reference.isEmpty() || reference.get().equals(secret.name())) {
      stored.add(secret.name());
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
   * same field under an enclosing object is the legacy secret to delete. Fresh secret ownership
   * comes from the write ledger, since a reference can have the same suffix without being owned.
   */
  private String storedSecretName(String fieldValue, List<String> secretIds, String fieldName) {
    List<String> fieldSecretNames =
        secretIds.stream().map(secretId -> buildSecretId(false, secretId, fieldName)).toList();
    return referencedSecretName(fieldValue)
        .filter(ref -> isOwnFieldSecret(ref, fieldSecretNames))
        .orElse(fieldSecretNames.getLast());
  }

  private boolean isOwnFieldSecret(String reference, List<String> fieldSecretNames) {
    String canonicalRef = canonicalSecretName(reference);
    for (String candidate : fieldSecretNames) {
      if (canonicalRef.equals(canonicalSecretName(candidate))) {
        return true;
      }
    }
    return false;
  }

  final String compactFieldTag(String fieldSecretId) {
    return "f" + DigestUtils.sha256Hex(canonicalSecretName(fieldSecretId)).substring(0, 16);
  }

  /** Recognizes a generated id after a rename. Ownership is checked separately against the ledger. */
  final boolean isGeneratedListReference(String root, String slot, String ref) {
    String separator = secretsIdConfig.separator();
    String canonical = canonicalSecretName(ref);
    String namespace = canonicalSecretName(root) + separator;
    String fieldSlot = canonicalSecretName(slot);
    int last = canonical.lastIndexOf(separator);
    if (!canonical.startsWith(namespace)
        || canonical.equals(fieldSlot)
        || last < namespace.length()
        || !SecretKeyEncoding.isFreshSuffix(canonical.substring(last + separator.length()))) {
      return false;
    }
    String base = canonical.substring(0, last);
    int field = fieldSlot.lastIndexOf(separator);
    return (field >= 0 && base.endsWith(fieldSlot.substring(field)))
        || COMPACT_FIELD_TAG.matcher(base.substring(namespace.length())).matches();
  }

  private Optional<String> referencedSecretName(String fieldValue) {
    String value = Fernet.isTokenized(fieldValue) ? fernet.decrypt(fieldValue) : fieldValue;
    return value != null && Boolean.TRUE.equals(isSecret(value))
        ? Optional.of(value.substring(SECRET_FIELD_PREFIX.length()))
        : Optional.empty();
  }

  /**
   * References held by the incoming and saved configs for one entity write, used to decide whether
   * a list element's secret id may be overwritten or deleted without clobbering another element.
   */
  private static final class ReferenceScope {
    private final ExternalSecretsManager manager;
    private final WriteContext<?> context;
    private final String root;
    private final Map<String, Set<String>> incomingReferrers;
    private final Map<String, Set<String>> savedReferrers;
    private final Map<String, String> savedRefBySlot;
    private final Set<String> claimed = new HashSet<>();

    private ReferenceScope(
        ExternalSecretsManager manager,
        String root,
        WriteContext<?> context,
        Map<String, Set<String>> incomingReferrers,
        Map<String, Set<String>> savedReferrers,
        Map<String, String> savedRefBySlot) {
      this.manager = manager;
      this.root = root;
      this.context = context;
      this.incomingReferrers = incomingReferrers;
      this.savedReferrers = savedReferrers;
      this.savedRefBySlot = savedRefBySlot;
    }

    private static ReferenceScope from(
        ExternalSecretsManager manager, String root, Object incoming, WriteContext<?> context) {
      Map<String, Set<String>> incomingReferrers = new HashMap<>();
      collectReferences(manager, root, incoming, incomingReferrers, null);
      Map<String, Set<String>> savedReferrers = new HashMap<>();
      Map<String, String> savedRefBySlot = new HashMap<>();
      Object saved = context.original();
      if (saved != null) {
        collectReferences(manager, root, saved, savedReferrers, savedRefBySlot);
      }
      return new ReferenceScope(
          manager, root, context, incomingReferrers, savedReferrers, savedRefBySlot);
    }

    private static void collectReferences(
        SecretsManager manager,
        String root,
        Object config,
        Map<String, Set<String>> referrers,
        Map<String, String> refBySlot) {
      manager.visitStoredSecrets(
          config,
          List.of(root),
          secret ->
              manager
                  .referencedSecretName(secret.value())
                  .ifPresent(
                      ref -> {
                        String canonRef = manager.canonicalSecretName(ref);
                        String canonSlot = manager.canonicalSecretName(secret.slot());
                        referrers
                            .computeIfAbsent(canonRef, unused -> new HashSet<>())
                            .add(canonSlot);
                        if (refBySlot != null) {
                          refBySlot.put(canonSlot, ref);
                        }
                      }));
    }

    private Optional<String> selectExistingWriteId(String defaultSecretId) {
      Optional<String> previous = displacedReference(defaultSecretId);
      if (previous
          .filter(context::owns)
          .filter(ref -> manager.isGeneratedListReference(root, defaultSecretId, ref))
          .isPresent()) {
        return Optional.empty();
      }
      return availableDefaultId(defaultSecretId);
    }

    private Optional<String> secretIdToDeleteOnClear(String defaultSecretId) {
      return displacedReference(defaultSecretId).isPresent()
          ? Optional.empty()
          : availableDefaultId(defaultSecretId);
    }

    /** A renamed slot can still hold a reference allocated under its old name. */
    private Optional<String> displacedReference(String defaultSecretId) {
      String slot = manager.canonicalSecretName(defaultSecretId);
      return Optional.ofNullable(savedRefBySlot.get(slot))
          .map(manager::canonicalSecretName)
          .filter(reference -> !slot.equals(reference));
    }

    private Optional<String> availableDefaultId(String defaultSecretId) {
      return isReferencedByOther(defaultSecretId, defaultSecretId)
          ? Optional.empty()
          : Optional.of(defaultSecretId);
    }

    private boolean isReferencedByOther(String candidateSecretId, String currentSlot) {
      String canonCandidate = manager.canonicalSecretName(candidateSecretId);
      String canonSlot = manager.canonicalSecretName(currentSlot);
      return claimed.contains(canonCandidate)
          || hasOtherReferrer(incomingReferrers, canonCandidate, canonSlot)
          || hasOtherReferrer(savedReferrers, canonCandidate, canonSlot);
    }

    private static boolean hasOtherReferrer(
        Map<String, Set<String>> referrers, String canonCandidate, String canonSlot) {
      Set<String> slots = referrers.get(canonCandidate);
      if (slots == null || slots.isEmpty()) {
        return false;
      }
      return slots.size() > 1 || !slots.contains(canonSlot);
    }

    private String freshIdBase(String defaultSecretId) {
      String sep = manager.getSecretsIdConfig().separator();
      int maxLength = manager.maxSecretIdLength();
      String base;
      if (defaultSecretId.length() + sep.length() + SecretKeyEncoding.FIELD_KEY_LENGTH
          <= maxLength) {
        base = defaultSecretId;
      } else {
        base = manager.buildSecretId(false, root, manager.compactFieldTag(defaultSecretId));
        if (base.length() + sep.length() + SecretKeyEncoding.FIELD_KEY_LENGTH > maxLength) {
          throw new SecretsManagerException(
              String.format(
                  "Fresh secret id under [%s] would exceed the %d-character limit of %s.",
                  root, maxLength, manager.getSecretsManagerProvider().value()));
        }
      }
      return base;
    }

    private boolean claimFresh(String candidate) {
      String canonical = manager.canonicalSecretName(candidate);
      return !context.owns(canonical)
          && !incomingReferrers.containsKey(canonical)
          && !savedReferrers.containsKey(canonical)
          && claimed.add(canonical);
    }

    private void claim(String secretName) {
      claimed.add(manager.canonicalSecretName(secretName));
    }
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
