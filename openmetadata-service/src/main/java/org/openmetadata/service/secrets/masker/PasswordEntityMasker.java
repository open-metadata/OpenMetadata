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

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.openmetadata.annotations.PasswordField;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.service.exception.EntityMaskException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.SecretsUtil;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;
import org.openmetadata.service.util.AuthenticationMechanismBuilder;
import org.openmetadata.service.util.IngestionPipelineBuilder;
import org.openmetadata.service.util.ReflectionUtil;

public class PasswordEntityMasker extends EntityMasker {
  public static final String PASSWORD_MASK = "*********";
  private static final String NEW_KEY = "";
  private static final String OPENMETADATA_PACKAGE = "org.openmetadata";

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
    if (originalConnectionConfig != null && connectionConfig != null) {
      try {
        Object toUnmaskConfig =
            SecretsUtil.convert(connectionConfig, connectionType, null, serviceType);
        Object originalConvertedConfig =
            SecretsUtil.convert(originalConnectionConfig, connectionType, null, serviceType);
        Map<String, String> passwordsMap = new HashMap<>();
        buildPasswordsMap(originalConvertedConfig, NEW_KEY, passwordsMap);
        unmaskPasswordFields(toUnmaskConfig, NEW_KEY, passwordsMap);
        return toUnmaskConfig;
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
    if (ingestionPipeline != null && originalIngestionPipeline != null) {
      IngestionPipelineBuilder.addDefinedConfig(ingestionPipeline);
      IngestionPipelineBuilder.addDefinedConfig(originalIngestionPipeline);
      try {
        Map<String, String> passwordsMap = new HashMap<>();
        buildPasswordsMap(originalIngestionPipeline, NEW_KEY, passwordsMap);
        unmaskPasswordFields(ingestionPipeline, NEW_KEY, passwordsMap);
      } catch (Exception e) {
        throw new EntityMaskException(
            String.format(
                "Failed to unmask ingestion pipeline instance [%s]", ingestionPipeline.getName()));
      }
    }
  }

  public void unmaskAuthenticationMechanism(
      String name,
      AuthenticationMechanism authenticationMechanism,
      AuthenticationMechanism originalAuthenticationMechanism) {
    if (authenticationMechanism != null && originalAuthenticationMechanism != null) {
      AuthenticationMechanismBuilder.addDefinedConfig(authenticationMechanism);
      AuthenticationMechanismBuilder.addDefinedConfig(originalAuthenticationMechanism);
      try {
        Map<String, String> passwordsMap = new HashMap<>();
        buildPasswordsMap(originalAuthenticationMechanism, NEW_KEY, passwordsMap);
        unmaskPasswordFields(authenticationMechanism, NEW_KEY, passwordsMap);
      } catch (Exception e) {
        throw new EntityMaskException(
            String.format("Failed to unmask auth mechanism instance [%s]", name));
      }
    }
  }

  @Override
  public Workflow unmaskWorkflow(Workflow workflow, Workflow originalWorkflow) {
    if (workflow != null && originalWorkflow != null) {
      Workflow workflowConverted =
          (Workflow) ClassConverterFactory.getConverter(Workflow.class).convert(workflow);
      Workflow origWorkflowConverted =
          (Workflow) ClassConverterFactory.getConverter(Workflow.class).convert(originalWorkflow);
      try {
        Map<String, String> passwordsMap = new HashMap<>();
        buildPasswordsMap(origWorkflowConverted, NEW_KEY, passwordsMap);
        unmaskPasswordFields(workflowConverted, NEW_KEY, passwordsMap);
        return workflowConverted;
      } catch (Exception e) {
        throw new EntityMaskException(
            String.format("Failed to unmask workflow instance [%s]", workflow.getName()));
      }
    }
    return workflow;
  }

  private void maskPasswordFields(Object toMaskObject) {
    walkPasswordFields(
        toMaskObject,
        NEW_KEY,
        (holder, fieldName, fieldKey, value) -> setField(holder, fieldName, value, PASSWORD_MASK));
  }

  private void unmaskPasswordFields(
      Object toUnmaskObject, String key, Map<String, String> passwordsMap) {
    walkPasswordFields(
        toUnmaskObject,
        key,
        (holder, fieldName, fieldKey, value) -> {
          String valueToSet =
              PASSWORD_MASK.equals(value)
                  ? passwordsMap.getOrDefault(fieldKey, PASSWORD_MASK)
                  : Fernet.getInstance().decryptIfApplies((String) value);
          setField(holder, fieldName, value, valueToSet);
        });
  }

  private void buildPasswordsMap(Object toMapObject, String key, Map<String, String> passwordsMap) {
    walkPasswordFields(
        toMapObject,
        key,
        (holder, fieldName, fieldKey, value) ->
            passwordsMap.put(fieldKey, Fernet.getInstance().decryptIfApplies((String) value)));
  }

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
  private void walkPasswordFields(Object target, String key, PasswordFieldVisitor visitor) {
    if (target == null || DO_NOT_MASK_CLASSES.contains(target.getClass())) {
      return;
    }
    Arrays.stream(target.getClass().getMethods())
        .filter(ReflectionUtil::isGetMethodOfObject)
        .forEach(method -> visitField(target, method, key, visitor));
  }

  private void visitField(Object holder, Method method, String key, PasswordFieldVisitor visitor) {
    Object value = ReflectionUtil.getObjectFromMethod(method, holder);
    if (value == null) {
      return;
    }
    String fieldName = method.getName().replaceFirst("get", "");
    String fieldKey = createKey(key, fieldName);
    if (method.getAnnotation(PasswordField.class) != null) {
      visitor.visit(holder, fieldName, fieldKey, value);
    } else if (isTraversable(value)) {
      walkPasswordFields(value, fieldKey, visitor);
    } else if (value instanceof Collection<?> collection) {
      walkCollection(collection, fieldKey, visitor);
    }
  }

  private void walkCollection(Collection<?> collection, String key, PasswordFieldVisitor visitor) {
    int index = 0;
    for (Object element : collection) {
      if (isTraversable(element)) {
        walkPasswordFields(element, createKey(key, String.valueOf(index)), visitor);
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
