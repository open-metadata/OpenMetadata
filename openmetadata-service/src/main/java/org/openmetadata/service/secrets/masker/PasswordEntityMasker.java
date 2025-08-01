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
            SecretsUtil.convert(connectionConfig, connectionType, null, serviceType);
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
    if (!DO_NOT_MASK_CLASSES.contains(toMaskObject.getClass())) {
      // for each get method
      Arrays.stream(toMaskObject.getClass().getMethods())
          .filter(ReflectionUtil::isGetMethodOfObject)
          .forEach(
              method -> {
                Object obj = ReflectionUtil.getObjectFromMethod(method, toMaskObject);
                String fieldName = method.getName().replaceFirst("get", "");
                // if the object matches the package of openmetadata
                if (obj != null && obj.getClass().getPackageName().startsWith("org.openmetadata")) {
                  // maskPasswordFields
                  maskPasswordFields(obj);
                  // check if it has PasswordField annotation
                } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                  // get setMethod
                  Method toSet = ReflectionUtil.getToSetMethod(toMaskObject, obj, fieldName);
                  // set new value
                  ReflectionUtil.setValueInMethod(toMaskObject, PASSWORD_MASK, toSet);
                }
              });
    }
  }

  private void unmaskPasswordFields(
      Object toUnmaskObject, String key, Map<String, String> passwordsMap) {
    if (!DO_NOT_MASK_CLASSES.contains(toUnmaskObject.getClass())) {
      // for each get method
      Arrays.stream(toUnmaskObject.getClass().getMethods())
          .filter(ReflectionUtil::isGetMethodOfObject)
          .forEach(
              method -> {
                Object obj = ReflectionUtil.getObjectFromMethod(method, toUnmaskObject);
                String fieldName = method.getName().replaceFirst("get", "");
                // if the object matches the package of openmetadata
                if (obj != null && obj.getClass().getPackageName().startsWith("org.openmetadata")) {
                  // maskPasswordFields
                  unmaskPasswordFields(obj, createKey(key, fieldName), passwordsMap);
                  // check if it has PasswordField annotation
                } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                  String valueToSet =
                      PASSWORD_MASK.equals(obj)
                          ? passwordsMap.getOrDefault(createKey(key, fieldName), PASSWORD_MASK)
                          : Fernet.getInstance().decryptIfApplies((String) obj);
                  // get setMethod
                  Method toSet = ReflectionUtil.getToSetMethod(toUnmaskObject, obj, fieldName);
                  // set new value
                  ReflectionUtil.setValueInMethod(toUnmaskObject, valueToSet, toSet);
                }
              });
    }
  }

  private void buildPasswordsMap(Object toMapObject, String key, Map<String, String> passwordsMap) {
    if (!DO_NOT_MASK_CLASSES.contains(toMapObject.getClass())) {
      // for each get method
      Arrays.stream(toMapObject.getClass().getMethods())
          .filter(ReflectionUtil::isGetMethodOfObject)
          .forEach(
              method -> {
                Object obj = ReflectionUtil.getObjectFromMethod(method, toMapObject);
                String fieldName = method.getName().replaceFirst("get", "");
                // if the object matches the package of openmetadata
                if (obj != null && obj.getClass().getPackageName().startsWith("org.openmetadata")) {
                  // maskPasswordFields
                  buildPasswordsMap(obj, createKey(key, fieldName), passwordsMap);
                  // check if it has PasswordField annotation
                } else if (obj != null && method.getAnnotation(PasswordField.class) != null) {
                  // get value
                  String value = Fernet.getInstance().decryptIfApplies((String) obj);
                  // store in passwordsMap
                  passwordsMap.put(createKey(key, fieldName), value);
                }
              });
    }
  }

  private String createKey(String previousKey, String key) {
    return NEW_KEY.equals(previousKey) ? key : previousKey + "." + key;
  }

  public Object maskAppPrivateConfig(Object privateConfig, String appType) {
    if (privateConfig != null) {
      return PASSWORD_MASK;
    }
    return null;
  }
}
