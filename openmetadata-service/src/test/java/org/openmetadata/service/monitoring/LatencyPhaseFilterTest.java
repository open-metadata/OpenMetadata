package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ResourceInfo;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class LatencyPhaseFilterTest {

  private final LatencyPhaseFilter filter = new LatencyPhaseFilter();

  @AfterEach
  void tearDown() {
    RequestLatencyContext.endRequest();
    RequestLatencyContext.reset();
  }

  @Test
  void testMethodAnnotationOverridesClassAndHttpMethod() throws Exception {
    Method method = PhaseAnnotatedResource.class.getDeclaredMethod("methodAnnotated");
    setResourceInfo(new TestResourceInfo(PhaseAnnotatedResource.class, method));

    Map<String, Object> properties = new HashMap<>();
    ContainerRequestContext requestContext = requestContext("GET", properties);

    RequestLatencyContext.startRequest("v1/test", "GET");
    filter.filter(requestContext);
    filter.filter(requestContext, null);

    assertTrue(
        RequestLatencyContext.getContext().getPhaseTime().containsKey("methodSpecificPhase"));
    assertFalse(properties.containsKey(phasePropertyKey()));
  }

  @Test
  void testClassAnnotationUsedWhenMethodHasNoValue() throws Exception {
    Method method = PhaseAnnotatedResource.class.getDeclaredMethod("classAnnotatedOnly");
    setResourceInfo(new TestResourceInfo(PhaseAnnotatedResource.class, method));

    ContainerRequestContext requestContext = requestContext("PATCH", new HashMap<>());

    RequestLatencyContext.startRequest("v1/test", "PATCH");
    filter.filter(requestContext);
    filter.filter(requestContext, null);

    assertTrue(RequestLatencyContext.getContext().getPhaseTime().containsKey("classPhase"));
  }

  @Test
  void testDefaultPhaseDerivedFromHttpMethodWhenAnnotationValueIsEmpty() throws Exception {
    Method method = DefaultAnnotatedResource.class.getDeclaredMethod("defaultAnnotated");
    setResourceInfo(new TestResourceInfo(DefaultAnnotatedResource.class, method));

    ContainerRequestContext requestContext = requestContext("DELETE", new HashMap<>());

    RequestLatencyContext.startRequest("v1/test", "DELETE");
    filter.filter(requestContext);
    filter.filter(requestContext, null);

    assertTrue(RequestLatencyContext.getContext().getPhaseTime().containsKey("resourceDelete"));
  }

  private void setResourceInfo(ResourceInfo info) throws Exception {
    Field field = LatencyPhaseFilter.class.getDeclaredField("resourceInfo");
    field.setAccessible(true);
    field.set(filter, info);
  }

  private ContainerRequestContext requestContext(String method, Map<String, Object> properties) {
    InvocationHandler handler =
        (proxy, invokedMethod, args) ->
            switch (invokedMethod.getName()) {
              case "getMethod" -> method;
              case "setProperty" -> {
                properties.put((String) args[0], args[1]);
                yield null;
              }
              case "getProperty" -> properties.get((String) args[0]);
              case "removeProperty" -> {
                properties.remove((String) args[0]);
                yield null;
              }
              case "getPropertyNames" -> Set.copyOf(properties.keySet());
              case "toString" -> "LatencyPhaseFilterTestRequestContext";
              case "hashCode" -> System.identityHashCode(proxy);
              case "equals" -> proxy == args[0];
              default -> defaultValue(invokedMethod.getReturnType());
            };

    return (ContainerRequestContext)
        Proxy.newProxyInstance(
            ContainerRequestContext.class.getClassLoader(),
            new Class<?>[] {ContainerRequestContext.class},
            handler);
  }

  private Object defaultValue(Class<?> returnType) {
    if (!returnType.isPrimitive()) {
      return null;
    }
    if (returnType.equals(Boolean.TYPE)) {
      return false;
    }
    if (returnType.equals(Byte.TYPE)) {
      return (byte) 0;
    }
    if (returnType.equals(Short.TYPE)) {
      return (short) 0;
    }
    if (returnType.equals(Integer.TYPE)) {
      return 0;
    }
    if (returnType.equals(Long.TYPE)) {
      return 0L;
    }
    if (returnType.equals(Float.TYPE)) {
      return 0f;
    }
    if (returnType.equals(Double.TYPE)) {
      return 0d;
    }
    if (returnType.equals(Character.TYPE)) {
      return '\0';
    }
    return null;
  }

  private String phasePropertyKey() {
    return LatencyPhaseFilter.class.getName() + ".phase";
  }

  private record TestResourceInfo(Class<?> resourceClass, Method resourceMethod)
      implements ResourceInfo {

    @Override
    public Method getResourceMethod() {
      return resourceMethod;
    }

    @Override
    public Class<?> getResourceClass() {
      return resourceClass;
    }
  }

  @LatencyPhase("classPhase")
  private static class PhaseAnnotatedResource {

    @LatencyPhase("methodSpecificPhase")
    public void methodAnnotated() {}

    public void classAnnotatedOnly() {}
  }

  @LatencyPhase
  private static class DefaultAnnotatedResource {
    public void defaultAnnotated() {}
  }
}
