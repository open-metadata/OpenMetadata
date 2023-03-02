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
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.service.exception.EntityMaskException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;
import org.openmetadata.service.util.AuthenticationMechanismBuilder;
import org.openmetadata.service.util.IngestionPipelineBuilder;
import org.openmetadata.service.util.ReflectionUtil;

public class PasswordEntityMasker extends EntityMasker {

  private static PasswordEntityMasker INSTANCE;

  protected static final String PASSWORD_MASK = "*********";

  private static final String NEW_KEY = "";

  private PasswordEntityMasker() {}

  public static PasswordEntityMasker getInstance() {
    if (INSTANCE == null) {
      INSTANCE = new PasswordEntityMasker();
    }
    return INSTANCE;
  }

  public Object maskServiceConnectionConfig(Object connectionConfig, String connectionType, ServiceType serviceType) {
    try {
      Class<?> clazz = ReflectionUtil.createConnectionConfigClass(connectionType, serviceType);
      Object newConnectionConfig = ClassConverterFactory.getConverter(clazz).convert(connectionConfig);
      maskPasswordFields(newConnectionConfig);
      return newConnectionConfig;
    } catch (Exception e) {
      throw new EntityMaskException(String.format("Failed to mask connection instance of %s", connectionType));
    }
  }

  public void maskAuthenticationMechanism(String name, AuthenticationMechanism authenticationMechanism) {
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
    IngestionPipelineBuilder.addDefinedConfig(ingestionPipeline);
    try {
      maskPasswordFields(ingestionPipeline);
    } catch (Exception e) {
      throw new EntityMaskException(
          String.format("Failed to mask ingestion pipeline instance [%s]", ingestionPipeline.getName()));
    }
  }

  public Object unmaskServiceConnectionConfig(
      Object connectionConfig, Object originalConnectionConfig, String connectionType, ServiceType serviceType) {
    if (originalConnectionConfig != null && connectionConfig != null) {
      try {
        Class<?> clazz = ReflectionUtil.createConnectionConfigClass(connectionType, serviceType);
        Object toUnmaskConfig = ClassConverterFactory.getConverter(clazz).convert(connectionConfig);
        Object originalConvertedConfig = ClassConverterFactory.getConverter(clazz).convert(originalConnectionConfig);
        Map<String, String> passwordsMap = new HashMap<>();
        buildPasswordsMap(originalConvertedConfig, NEW_KEY, passwordsMap);
        unmaskPasswordFields(toUnmaskConfig, NEW_KEY, passwordsMap);
        return toUnmaskConfig;
      } catch (Exception e) {
        throw new EntityMaskException(String.format("Failed to mask connection instance of %s", connectionType));
      }
    }
    return connectionConfig;
  }

  public void unmaskIngestionPipeline(
      IngestionPipeline ingestionPipeline, IngestionPipeline originalIngestionPipeline) {
    IngestionPipelineBuilder.addDefinedConfig(ingestionPipeline);
    IngestionPipelineBuilder.addDefinedConfig(originalIngestionPipeline);
    try {
      Map<String, String> passwordsMap = new HashMap<>();
      buildPasswordsMap(originalIngestionPipeline, NEW_KEY, passwordsMap);
      unmaskPasswordFields(ingestionPipeline, NEW_KEY, passwordsMap);
    } catch (Exception e) {
      throw new EntityMaskException(
          String.format("Failed to mask ingestion pipeline instance [%s]", ingestionPipeline.getName()));
    }
  }

  public void unmaskAuthenticationMechanism(
      String name,
      AuthenticationMechanism authenticationMechanism,
      AuthenticationMechanism originalAuthenticationMechanism) {
    if (authenticationMechanism != null) {
      AuthenticationMechanismBuilder.addDefinedConfig(authenticationMechanism);
      AuthenticationMechanismBuilder.addDefinedConfig(originalAuthenticationMechanism);
      try {
        Map<String, String> passwordsMap = new HashMap<>();
        buildPasswordsMap(originalAuthenticationMechanism, NEW_KEY, passwordsMap);
        unmaskPasswordFields(authenticationMechanism, NEW_KEY, passwordsMap);
      } catch (Exception e) {
        throw new EntityMaskException(String.format("Failed to mask user bot instance [%s]", name));
      }
    }
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

  private void unmaskPasswordFields(Object toUnmaskObject, String key, Map<String, String> passwordsMap) {
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
    if (NEW_KEY.equals(previousKey)) {
      return key;
    }
    return previousKey + "." + key;
  }
}
