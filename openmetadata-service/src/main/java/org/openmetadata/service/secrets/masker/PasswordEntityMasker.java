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

package org.openmetadata.service.secrets.masker;

import jakarta.ws.rs.core.Response;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import org.openmetadata.annotations.PasswordField;
import org.openmetadata.schema.auth.BasicAuthMechanism;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.service.exception.EntityMaskException;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.SecretsUtil;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;
import org.openmetadata.service.util.AuthenticationMechanismBuilder;
import org.openmetadata.service.util.IngestionPipelineBuilder;
import org.openmetadata.service.util.ReflectionUtil;

public class PasswordEntityMasker extends EntityMasker {
  public static final String PASSWORD_MASK = "*********";
  private static final String NEW_KEY = "";
  private static final String OPENMETADATA_PACKAGE = "org.openmetadata";

  /**
   * What the unmask walk skips: exactly the classes the SecretsManager's encrypt walk skips (see
   * {@code SecretsManager.DO_NOT_ENCRYPT_CLASSES}). Whatever is never encrypted holds no encoded
   * credential that could be validated, so skipping the same set keeps the two walks in step.
   * Everything the encrypter does encrypt - a bot's JWTAuthMechanism token, which the {@link
   * #maskPasswordFields mask} deliberately leaves visible to its admin - is validated on unmask.
   */
  private static final Set<Class<?>> DO_NOT_UNMASK_CLASSES =
      Set.of(OpenMetadataJWTClientConfig.class, BasicAuthMechanism.class);

  protected PasswordEntityMasker() {}

  public Object maskServiceConnectionConfig(
      Object connectionConfig, String connectionType, ServiceType serviceType) {
    if (connectionConfig != null) {
      try {
        Object convertedConnectionConfig =
            SecretsUtil.convert(connectionConfig, connectionType, null, serviceType);
        maskPasswordFields(convertedConnectionConfig);
        return convertedConnectionConfig;
      } catch (Exception e) {
        String message =
            SecretsUtil.buildExceptionMessageConnectionMask(e.getMessage(), connectionType, true);
        if (message != null) {
          throw new EntityMaskException(message);
        }
        throw new EntityMaskException(
            String.format("Failed to mask connection instance of %s", connectionType));
      }
    }
    return null;
  }

  public void maskAuthenticationMechanism(
      String name, AuthenticationMechanism authenticationMechanism) {
    if (authenticationMechanism != null) {
      AuthenticationMechanismBuilder.addDefinedConfig(authenticationMechanism);
      try {
        maskPasswordFields(authenticationMechanism);
      } catch (Exception e) {
        throw new EntityMaskException(String.format("Failed to mask user bot instance [%s]", name));
      }
    }
  }

  public void maskIngestionPipeline(IngestionPipeline ingestionPipeline) {
    if (ingestionPipeline != null) {
      IngestionPipelineBuilder.addDefinedConfig(ingestionPipeline);
      try {
        maskPasswordFields(ingestionPipeline);
      } catch (Exception e) {
        throw new EntityMaskException(
            String.format(
                "Failed to mask ingestion pipeline instance [%s]", ingestionPipeline.getName()));
      }
    }
  }

  @Override
  public Workflow maskWorkflow(Workflow workflow) {
    if (workflow != null) {
      Workflow workflowConverted =
          (Workflow) ClassConverterFactory.getConverter(Workflow.class).convert(workflow);
      try {
        maskPasswordFields(workflowConverted);
      } catch (Exception e) {
        throw new EntityMaskException(
            String.format("Failed to mask workflow instance [%s]", workflow.getName()));
      }
      return workflowConverted;
    }
    return null;
  }

  public Object unmaskServiceConnectionConfig(
      Object connectionConfig,
      Object originalConnectionConfig,
      String connectionType,
      ServiceType serviceType) {
    if (connectionConfig != null) {
      try {
        Object toUnmaskConfig =
            SecretsUtil.convert(connectionConfig, connectionType, null, serviceType);
        // A null original - a patch that adds a connection where none was stored - still walks:
        // with nothing to compare against, an encoded value cannot be the entity's own (see
        // unmaskAgainstOriginal).
        Object originalConvertedConfig =
            originalConnectionConfig != null
                ? SecretsUtil.convert(originalConnectionConfig, connectionType, null, serviceType)
                : null;
        unmaskAgainstOriginal(toUnmaskConfig, originalConvertedConfig);
        return toUnmaskConfig;
      } catch (SecretsManagerException e) {
        // A rejection of a foreign credential is already classified with its own status and
        // user-facing message; re-wrapping would relabel a deliberate 400. A conversion failure
        // is not a SecretsManagerException and keeps its translated message below.
        throw e;
      } catch (Exception e) {
        String message =
            SecretsUtil.buildExceptionMessageConnectionMask(e.getMessage(), connectionType, false);
        if (message != null) {
          throw new EntityMaskException(message);
        }
        throw new EntityMaskException(
            String.format("Failed to unmask connection instance of %s", connectionType));
      }
    }
    return connectionConfig;
  }

  public void unmaskIngestionPipeline(
      IngestionPipeline ingestionPipeline, IngestionPipeline originalIngestionPipeline) {
    if (ingestionPipeline != null) {
      IngestionPipelineBuilder.addDefinedConfig(ingestionPipeline);
      if (originalIngestionPipeline != null) {
        IngestionPipelineBuilder.addDefinedConfig(originalIngestionPipeline);
      }
      unmaskOrThrow(
          () -> unmaskAgainstOriginal(ingestionPipeline, originalIngestionPipeline),
          () ->
              String.format(
                  "Failed to unmask ingestion pipeline instance [%s]",
                  ingestionPipeline.getName()));
    }
  }

  public void unmaskAuthenticationMechanism(
      String name,
      AuthenticationMechanism authenticationMechanism,
      AuthenticationMechanism originalAuthenticationMechanism) {
    if (authenticationMechanism != null) {
      AuthenticationMechanismBuilder.addDefinedConfig(authenticationMechanism);
      if (originalAuthenticationMechanism != null) {
        AuthenticationMechanismBuilder.addDefinedConfig(originalAuthenticationMechanism);
      }
      unmaskOrThrow(
          () -> unmaskAgainstOriginal(authenticationMechanism, originalAuthenticationMechanism),
          () -> String.format("Failed to unmask auth mechanism instance [%s]", name));
    }
  }

  @Override
  public Workflow unmaskWorkflow(Workflow workflow, Workflow originalWorkflow) {
    if (workflow != null) {
      Workflow workflowConverted =
          (Workflow) ClassConverterFactory.getConverter(Workflow.class).convert(workflow);
      Workflow origWorkflowConverted =
          originalWorkflow != null
              ? (Workflow)
                  ClassConverterFactory.getConverter(Workflow.class).convert(originalWorkflow)
              : null;
      unmaskOrThrow(
          () -> unmaskAgainstOriginal(workflowConverted, origWorkflowConverted),
          () -> String.format("Failed to unmask workflow instance [%s]", workflow.getName()));
      return workflowConverted;
    }
    return workflow;
  }

  private void unmaskOrThrow(Runnable unmask, Supplier<String> failureMessage) {
    try {
      unmask.run();
    } catch (SecretsManagerException e) {
      // A rejection of a foreign credential is already classified with its own status.
      throw e;
    } catch (Exception e) {
      throw new EntityMaskException(failureMessage.get());
    }
  }

  /**
   * Unmasks {@code toUnmask} against {@code original}. A null original - an entity being created -
   * still walks: a masked field has nothing to restore from and stays masked, and an encoded value
   * is accepted only as a reference into a vault the submitter manages themselves (see {@link
   * #requireOwnStoredValue}), because with no stored value to compare against it cannot be the
   * entity's own.
   */
  private void unmaskAgainstOriginal(Object toUnmask, Object original) {
    Map<String, StoredPassword> passwordsMap = new HashMap<>();
    if (original != null) {
      buildPasswordsMap(original, NEW_KEY, passwordsMap);
    }
    unmaskPasswordFields(toUnmask, NEW_KEY, passwordsMap);
  }

  private void maskPasswordFields(Object toMaskObject) {
    walkPasswordFields(
        toMaskObject,
        NEW_KEY,
        DO_NOT_MASK_CLASSES,
        (holder, fieldName, fieldKey, value) -> setField(holder, fieldName, value, PASSWORD_MASK));
  }

  private void unmaskPasswordFields(
      Object toUnmaskObject, String key, Map<String, StoredPassword> passwordsMap) {
    walkPasswordFields(
        toUnmaskObject,
        key,
        DO_NOT_UNMASK_CLASSES,
        (holder, fieldName, fieldKey, value) ->
            setField(
                holder,
                fieldName,
                value,
                restoreOrRequireOwn(fieldKey, value, passwordsMap.get(fieldKey))));
  }

  private String restoreOrRequireOwn(String fieldKey, Object value, StoredPassword storedPassword) {
    if (PASSWORD_MASK.equals(value)) {
      return storedPassword != null ? storedPassword.resolved() : PASSWORD_MASK;
    }
    return requireOwnStoredValue(fieldKey, (String) value, storedPassword);
  }

  /**
   * Accepts an incoming password field that already holds an encoded value - a Fernet token or a
   * {@code secret:} reference - only when it is byte-for-byte a value the field already holds in
   * storage, as stored or as the unmask hands it back: the round trip of a PATCH or PUT that did
   * not touch the field. Otherwise the value is acceptable only as a reference into a vault the
   * submitter manages themselves (see SecretsManager#isManagedSecretReference); any other encoded
   * value is a credential lifted from another entity (the token decrypts with the server's key,
   * the reference points at a secret this entity does not own) and is rejected. The submitted
   * value is deliberately not echoed: it may itself be a stolen token.
   */
  private String requireOwnStoredValue(
      String fieldKey, String fieldValue, StoredPassword storedPassword) {
    if (!isEncoded(fieldValue)
        || isEchoOfTheStoredValue(fieldValue, storedPassword)
        || isExternalReference(fieldValue)) {
      return Fernet.getInstance().decryptIfApplies(fieldValue);
    }
    throw new SecretsManagerException(
        Response.Status.BAD_REQUEST,
        String.format(
            "Field [%s] cannot be set to an encrypted credential or a secret reference of "
                + "another entity. Send the plain value instead.",
            fieldKey));
  }

  private boolean isEncoded(String fieldValue) {
    return Fernet.isTokenized(fieldValue)
        || fieldValue.startsWith(SecretsManager.SECRET_FIELD_PREFIX);
  }

  private boolean isEchoOfTheStoredValue(String fieldValue, StoredPassword storedPassword) {
    return storedPassword != null
        && (storedPassword.stored().equals(fieldValue)
            || storedPassword.resolved().equals(fieldValue));
  }

  /**
   * Whether the value is a {@code secret:} reference the deployment does not manage. A Fernet
   * token never is one. With no secrets manager configured the ownership cannot be established,
   * so the reference is treated as managed - the guard fails closed.
   */
  private boolean isExternalReference(String fieldValue) {
    if (!fieldValue.startsWith(SecretsManager.SECRET_FIELD_PREFIX)) {
      return false;
    }
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    return secretsManager != null && !secretsManager.isManagedSecretReference(fieldValue);
  }

  private void buildPasswordsMap(
      Object toMapObject, String key, Map<String, StoredPassword> passwordsMap) {
    walkPasswordFields(
        toMapObject,
        key,
        DO_NOT_UNMASK_CLASSES,
        (holder, fieldName, fieldKey, value) ->
            passwordsMap.put(
                fieldKey,
                new StoredPassword(
                    (String) value, Fernet.getInstance().decryptIfApplies((String) value))));
  }

  /** A password field as stored, alongside the value the unmask hands back for it. */
  private record StoredPassword(String stored, String resolved) {}

  /**
   * Walks every {@link PasswordField} reachable from {@code target}, including fields nested inside
   * collections. Collections were previously not traversed at all, so a secret declared inside a
   * JSON-schema array - {@code mcpConnection.servers[].apiKey}, say - was neither masked on read nor
   * encrypted at rest.
   *
   * <p>Masking, unmasking and password-map building all share this traversal so that they derive
   * identical keys for the same field. If they disagreed, unmasking would fail to find a stored
   * secret and would silently overwrite it with the mask value.
   */
  private void walkPasswordFields(
      Object target, String key, Set<Class<?>> skippedClasses, PasswordFieldVisitor visitor) {
    if (target == null || skippedClasses.contains(target.getClass())) {
      return;
    }
    Arrays.stream(target.getClass().getMethods())
        .filter(ReflectionUtil::isGetMethodOfObject)
        .forEach(method -> visitField(target, method, key, skippedClasses, visitor));
  }

  private void visitField(
      Object holder,
      Method method,
      String key,
      Set<Class<?>> skippedClasses,
      PasswordFieldVisitor visitor) {
    Object value = ReflectionUtil.getObjectFromMethod(method, holder);
    if (value == null) {
      return;
    }
    String fieldName = method.getName().replaceFirst("get", "");
    String fieldKey = createKey(key, fieldName);
    if (method.getAnnotation(PasswordField.class) != null) {
      visitor.visit(holder, fieldName, fieldKey, value);
    } else if (isTraversable(value)) {
      walkPasswordFields(value, fieldKey, skippedClasses, visitor);
    } else if (value instanceof Collection<?> collection) {
      walkCollection(collection, fieldKey, skippedClasses, visitor);
    }
  }

  private void walkCollection(
      Collection<?> collection,
      String key,
      Set<Class<?>> skippedClasses,
      PasswordFieldVisitor visitor) {
    List<String> elementKeys = ReflectionUtil.getCollectionElementKeys(collection);
    int index = 0;
    for (Object element : collection) {
      if (isTraversable(element)) {
        walkPasswordFields(
            element, createKey(key, elementKeys.get(index)), skippedClasses, visitor);
      }
      index++;
    }
  }

  private boolean isTraversable(Object value) {
    return value != null && value.getClass().getPackageName().startsWith(OPENMETADATA_PACKAGE);
  }

  private void setField(Object holder, String fieldName, Object currentValue, String newValue) {
    Method toSet = ReflectionUtil.getToSetMethod(holder, currentValue, fieldName);
    ReflectionUtil.setValueInMethod(holder, newValue, toSet);
  }

  private String createKey(String previousKey, String key) {
    return NEW_KEY.equals(previousKey) ? key : previousKey + "." + key;
  }

  @FunctionalInterface
  private interface PasswordFieldVisitor {
    void visit(Object holder, String fieldName, String fieldKey, Object value);
  }
}
