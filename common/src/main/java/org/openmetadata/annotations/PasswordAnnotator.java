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

package org.openmetadata.annotations;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.codemodel.JAnnotationUse;
import com.sun.codemodel.JClass;
import com.sun.codemodel.JDefinedClass;
import com.sun.codemodel.JFieldVar;
import com.sun.codemodel.JMethod;
import java.lang.reflect.Field;
import org.jsonschema2pojo.AbstractAnnotator;

/** Add {@link PasswordField} annotation to generated Java classes */
public class PasswordAnnotator extends AbstractAnnotator {

  /** Add {@link PasswordField} annotation property fields */
  @Override
  public void propertyField(JFieldVar field, JDefinedClass clazz, String propertyName, JsonNode propertyNode) {
    super.propertyField(field, clazz, propertyName, propertyNode);
    if (propertyNode.get("format") != null && "password".equals(propertyNode.get("format").asText())) {
      field.annotate(PasswordField.class);
    }
  }

  /** Add {@link PasswordField} annotation to getter methods */
  @Override
  public void propertyGetter(JMethod getter, JDefinedClass clazz, String propertyName) {
    super.propertyGetter(getter, clazz, propertyName);
    addMaskedFieldAnnotationIfApplies(getter, propertyName);
  }

  /** Add {@link PasswordField} annotation to setter methods */
  @Override
  public void propertySetter(JMethod setter, JDefinedClass clazz, String propertyName) {
    super.propertySetter(setter, clazz, propertyName);
    addMaskedFieldAnnotationIfApplies(setter, propertyName);
  }

  /**
   * Use reflection methods to access the {@link JDefinedClass} of the {@link JMethod} object. If the {@link JMethod} is
   * pointing to a field annotated with {@link PasswordField} then annotates the {@link JMethod} object with {@link
   * PasswordField}
   */
  private void addMaskedFieldAnnotationIfApplies(JMethod jMethod, String propertyName) {
    try {
      Field outerClassField = JMethod.class.getDeclaredField("outer");
      outerClassField.setAccessible(true);
      JDefinedClass outerClass = (JDefinedClass) outerClassField.get(jMethod);
      if (outerClass.fields().containsKey(propertyName)
          && outerClass.fields().get(propertyName).annotations().stream()
              .anyMatch(annotation -> PasswordField.class.getName().equals(getAnnotationClassName(annotation)))) {
        jMethod.annotate(PasswordField.class);
      }
    } catch (NoSuchFieldException | IllegalAccessException e) {
      throw new RuntimeException(e);
    }
  }

  private String getAnnotationClassName(JAnnotationUse annotation) {
    try {
      Field clazzField = JAnnotationUse.class.getDeclaredField("clazz");
      clazzField.setAccessible(true);
      return ((JClass) clazzField.get(annotation)).fullName();
    } catch (NoSuchFieldException | IllegalAccessException e) {
      throw new RuntimeException(e);
    }
  }
}
