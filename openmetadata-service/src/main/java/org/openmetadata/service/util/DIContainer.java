package org.openmetadata.service.util;

import java.util.HashMap;
import java.util.Map;

public class DIContainer {
  private final Map<Class<?>, Object> resources = new HashMap<>();

  public <T> void registerResource(Class<T> resourceClass, T resource) {
    resources.put(resourceClass, resource);
  }

  public <T> T getResource(Class<T> resourceClass) {
    T resource = resourceClass.cast(resources.get(resourceClass));
    if (resource == null) {
      throw new IllegalStateException("Resource not initialized: " + resourceClass.getName());
    }
    return resource;
  }
}
