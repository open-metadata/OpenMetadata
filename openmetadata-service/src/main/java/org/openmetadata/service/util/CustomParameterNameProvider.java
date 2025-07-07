package org.openmetadata.service.util;

import jakarta.validation.ParameterNameProvider;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.QueryParam;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.Arrays;
import java.util.List;

public class CustomParameterNameProvider implements ParameterNameProvider {
  @Override
  public List<String> getParameterNames(Constructor<?> constructor) {
    return Arrays.stream(constructor.getParameters()).map(this::getParameterName).toList();
  }

  @Override
  public List<String> getParameterNames(Method method) {
    return Arrays.stream(method.getParameters()).map(this::getParameterName).toList();
  }

  private String getParameterName(Parameter parameter) {
    QueryParam queryParam = parameter.getAnnotation(QueryParam.class);
    if (queryParam != null) {
      return queryParam.value();
    }
    PathParam pathParam = parameter.getAnnotation(PathParam.class);
    if (pathParam != null) {
      return pathParam.value();
    }
    return parameter.getName(); // Fallback to the parameter name
  }
}
