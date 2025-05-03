package org.openmetadata.annotations;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.codemodel.JAnnotationUse;
import com.sun.codemodel.JClass;
import com.sun.codemodel.JDefinedClass;
import com.sun.codemodel.JFieldVar;
import com.sun.codemodel.JMethod;
import java.lang.reflect.Field;
import java.util.TreeMap;
import org.jsonschema2pojo.AbstractAnnotator;

/** Add {@link Deprecated} annotation to generated Java classes */
public class DeprecatedAnnotator extends AbstractAnnotator {

  /** Add {@link Deprecated} annotation to property fields */
  @Override
  public void propertyField(
      JFieldVar field, JDefinedClass clazz, String propertyName, JsonNode propertyNode) {
    super.propertyField(field, clazz, propertyName, propertyNode);
    if (propertyNode.get("deprecated") != null && propertyNode.get("deprecated").asBoolean()) {
      field.annotate(Deprecated.class);
    }
  }

  /** Add {@link Deprecated} annotation to getter methods */
  @Override
  public void propertyGetter(JMethod getter, JDefinedClass clazz, String propertyName) {
    super.propertyGetter(getter, clazz, propertyName);
    addDeprecatedAnnotationIfApplies(getter, propertyName);
  }

  /** Add {@link Deprecated} annotation to setter methods */
  @Override
  public void propertySetter(JMethod setter, JDefinedClass clazz, String propertyName) {
    super.propertySetter(setter, clazz, propertyName);
    addDeprecatedAnnotationIfApplies(setter, propertyName);
  }

  /**
   * Use reflection methods to access the {@link JDefinedClass} of the {@link JMethod} object. If
   * the {@link JMethod} is pointing to a field annotated with {@link Deprecated} then annotates
   * the {@link JMethod} object with {@link Deprecated}
   */
  private void addDeprecatedAnnotationIfApplies(JMethod jMethod, String propertyName) {
    try {
      Field outerClassField = JMethod.class.getDeclaredField("outer");
      outerClassField.setAccessible(true);
      JDefinedClass outerClass = (JDefinedClass) outerClassField.get(jMethod);

      TreeMap<String, JFieldVar> insensitiveFieldsMap =
          new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
      insensitiveFieldsMap.putAll(outerClass.fields());

      if (insensitiveFieldsMap.containsKey(propertyName)
          && insensitiveFieldsMap.get(propertyName).annotations().stream()
              .anyMatch(
                  annotation ->
                      Deprecated.class.getName().equals(getAnnotationClassName(annotation)))) {
        jMethod.annotate(Deprecated.class);
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
