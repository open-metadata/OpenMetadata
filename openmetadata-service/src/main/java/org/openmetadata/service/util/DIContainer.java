package org.openmetadata.service.util;

import java.util.HashMap;
import java.util.Map;

/**
 * Dependency Injection container to manage resources. This is a simple implementation and does not
 * support any lifecycle management. It allows registering resources and retrieving them by a
 * a consuming class. Consuming class might use a subset of the resources registered (or none at all)
 * Example:
 *
 * <pre>
 *     DIContainer container = new DIContainer();
 *     container.registerResource(MyService.class, new MyService());
 *     MyService service = container.getResource(MyService.class);
 *     service.doSomething();
 * </pre>
 *
 * TODO - Add support for lifecycle management.
 */
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
