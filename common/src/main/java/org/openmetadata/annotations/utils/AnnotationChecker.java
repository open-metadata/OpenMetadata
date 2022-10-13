package org.openmetadata.annotations.utils;

import java.lang.annotation.Annotation;
import java.lang.reflect.Field;
import java.util.HashSet;
import java.util.Set;
import org.openmetadata.annotations.ExposedField;

public class AnnotationChecker {

  private AnnotationChecker() {}

  private static boolean checkIfAnyClassFieldsHasAnnotation(
      Class<?> objectClass, Class<? extends Annotation> annotationClass) {
    return checkIfAnyClassFieldsHasAnnotation(objectClass, annotationClass, new HashSet<>());
  }

  private static boolean checkIfAnyClassFieldsHasAnnotation(
      Class<?> objectClass, Class<? extends Annotation> annotationClass, Set<Class<?>> visitedClasses) {
    for (Field field : objectClass.getDeclaredFields()) {
      if (field.isAnnotationPresent(annotationClass)) {
        return true;
      }
      if (!field.getType().isPrimitive() && !visitedClasses.contains(field.getType())) {
        visitedClasses.add(field.getType());
        if (checkIfAnyClassFieldsHasAnnotation(field.getType(), annotationClass, visitedClasses)) {
          return true;
        }
      }
    }
    if (objectClass.getSuperclass() != null && !visitedClasses.contains(objectClass.getSuperclass())) {
      visitedClasses.add(objectClass.getSuperclass());
      return checkIfAnyClassFieldsHasAnnotation(objectClass.getSuperclass(), annotationClass, visitedClasses);
    }
    return false;
  }

  /** Check if any field of a given class has the annotation {@link ExposedField}. */
  public static boolean isExposedFieldPresent(Class<?> objectClass) {
    return checkIfAnyClassFieldsHasAnnotation(objectClass, ExposedField.class);
  }
}
