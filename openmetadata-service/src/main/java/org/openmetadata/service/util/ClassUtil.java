package org.openmetadata.service.util;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public final class ClassUtil {

  public static List<Method> getMethodsAnnotatedWith(
    final Class<?> clazz,
    final Class<? extends Annotation> annotation
  ) {
    final List<Method> methods = new ArrayList<>();
    for (final Method method : clazz.getDeclaredMethods()) {
      if (method.isAnnotationPresent(annotation)) {
        methods.add(method);
      }
    }
    return methods;
  }
}
