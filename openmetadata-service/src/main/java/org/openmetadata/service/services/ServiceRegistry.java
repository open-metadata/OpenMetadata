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

package org.openmetadata.service.services;

import io.github.classgraph.ClassGraph;
import io.github.classgraph.ClassInfo;
import io.github.classgraph.ClassInfoList;
import io.github.classgraph.ScanResult;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.di.ApplicationComponent;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Registry for managing entity services.
 *
 * <p>This registry provides a centralized location for storing and retrieving service instances.
 * Services are registered by their entity type string (e.g., "table", "database") and can be
 * retrieved by type or service class.
 *
 * <p>This replaces the static service locator pattern with an explicit registry that can be:
 *
 * <ul>
 *   <li>Easily tested with mock services
 *   <li>Injected into resources via constructor
 *   <li>Managed with clear lifecycle
 * </ul>
 */
@Slf4j
public class ServiceRegistry {
  private final Map<String, EntityService<?>> servicesByEntityType = new ConcurrentHashMap<>();
  private final Map<Class<?>, EntityService<?>> servicesByClass = new ConcurrentHashMap<>();

  /**
   * Register a service for an entity type.
   *
   * @param entityType The entity type string (e.g., "table", "database")
   * @param service The service instance
   * @param <T> The entity type
   */
  public <T extends EntityInterface> void register(String entityType, EntityService<T> service) {
    if (servicesByEntityType.containsKey(entityType)) {
      LOG.warn("Service for entity type '{}' is being re-registered", entityType);
    }
    servicesByEntityType.put(entityType, service);
    servicesByClass.put(service.getClass(), service);
    LOG.debug("Registered service for entity type: {}", entityType);
  }

  /**
   * Get service by entity type string.
   *
   * @param entityType The entity type (e.g., "table", "database")
   * @param <T> The entity type
   * @return The service instance
   * @throws EntityNotFoundException if no service is registered for the entity type
   */
  @SuppressWarnings("unchecked")
  public <T extends EntityInterface> EntityService<T> getService(String entityType) {
    EntityService<T> service = (EntityService<T>) servicesByEntityType.get(entityType);
    if (service == null) {
      throw EntityNotFoundException.byMessage(
          String.format("No service registered for entity type: %s", entityType));
    }
    return service;
  }

  /**
   * Get service by service class.
   *
   * @param serviceClass The service class
   * @param <S> The service type
   * @return The service instance
   * @throws EntityNotFoundException if no service of the specified class is registered
   */
  @SuppressWarnings("unchecked")
  public <S extends EntityService<?>> S getService(Class<S> serviceClass) {
    S service = (S) servicesByClass.get(serviceClass);
    if (service == null) {
      throw EntityNotFoundException.byMessage(
          String.format("No service registered for class: %s", serviceClass.getName()));
    }
    return service;
  }

  /**
   * Check if a service is registered for an entity type.
   *
   * @param entityType The entity type
   * @return true if service is registered
   */
  public boolean hasService(String entityType) {
    return servicesByEntityType.containsKey(entityType);
  }

  /**
   * Check if a service is registered for a service class.
   *
   * @param serviceClass The service class
   * @return true if service is registered
   */
  public boolean hasService(Class<?> serviceClass) {
    return servicesByClass.containsKey(serviceClass);
  }

  /**
   * Get all registered entity types.
   *
   * @return Set of entity type strings
   */
  public java.util.Set<String> getRegisteredEntityTypes() {
    return servicesByEntityType.keySet();
  }

  /**
   * Clear all registered services. Useful for testing.
   */
  public void clear() {
    servicesByEntityType.clear();
    servicesByClass.clear();
    LOG.debug("Cleared all registered services");
  }

  /**
   * Get the number of registered services.
   *
   * @return Number of services
   */
  public int size() {
    return servicesByEntityType.size();
  }

  /**
   * Initialize the service registry by discovering all @Service annotated classes and retrieving
   * instances from the Dagger ApplicationComponent.
   *
   * <p>This method uses ClassGraph to scan for all classes annotated with @Service, extracts the
   * entityType from the annotation, and uses reflection to get the corresponding service instance
   * from the ApplicationComponent.
   *
   * <p>Services are registered in order based on the order() attribute in the @Service annotation.
   *
   * @param component The Dagger ApplicationComponent containing service instances
   */
  public void initializeFromComponent(ApplicationComponent component) {
    LOG.info(
        "Initializing ServiceRegistry from ApplicationComponent via @Service annotation discovery");

    List<ServiceDetails> serviceDetails = discoverServices();

    // Sort by order
    serviceDetails.sort(Comparator.comparingInt(ServiceDetails::order));

    // Register each service
    for (ServiceDetails details : serviceDetails) {
      try {
        // Get service instance from ApplicationComponent using reflection
        EntityService<?> service = getServiceFromComponent(component, details.serviceClass());

        // Register by entity type
        register(details.entityType(), service);

        LOG.info(
            "Registered service: {} for entity type: {} (order: {})",
            details.serviceClass().getSimpleName(),
            details.entityType(),
            details.order());
      } catch (Exception e) {
        LOG.error(
            "Failed to register service: {} for entity type: {}",
            details.serviceClass().getSimpleName(),
            details.entityType(),
            e);
        throw new RuntimeException(
            "Failed to initialize service: " + details.serviceClass().getSimpleName(), e);
      }
    }

    LOG.info("ServiceRegistry initialized with {} services", size());
  }

  /**
   * Discover all @Service annotated classes using ClassGraph.
   *
   * @return List of ServiceDetails containing service class and metadata
   */
  private static List<ServiceDetails> discoverServices() {
    LOG.debug("Scanning for @Service annotated classes");

    List<ServiceDetails> services = new ArrayList<>();

    try (ScanResult scanResult =
        new ClassGraph()
            .enableAnnotationInfo()
            .acceptPackages("org.openmetadata", "io.collate")
            .scan()) {

      ClassInfoList classList = scanResult.getClassesWithAnnotation(Service.class);

      for (ClassInfo classInfo : classList) {
        try {
          Class<?> serviceClass = classInfo.loadClass();
          Service annotation = serviceClass.getAnnotation(Service.class);

          if (annotation != null) {
            ServiceDetails details =
                new ServiceDetails(serviceClass, annotation.entityType(), annotation.order());
            services.add(details);
            LOG.debug(
                "Discovered service: {} for entity type: {}",
                serviceClass.getSimpleName(),
                annotation.entityType());
          }
        } catch (Exception e) {
          LOG.warn("Failed to load service class: {}", classInfo.getName(), e);
        }
      }
    }

    LOG.info("Discovered {} services", services.size());
    return services;
  }

  /**
   * Get service instance from ApplicationComponent using Dagger's service map.
   *
   * <p>This method uses the service map provided by Dagger's @IntoMap multibindings to look up
   * service instances by class. This is type-safe and doesn't rely on naming conventions.
   *
   * <p>For example: AIApplicationService.class -> component.services().get(AIApplicationService.class)
   *
   * @param component The ApplicationComponent
   * @param serviceClass The service class
   * @return The service instance
   * @throws Exception if the service cannot be retrieved
   */
  private EntityService<?> getServiceFromComponent(
      ApplicationComponent component, Class<?> serviceClass) throws Exception {

    LOG.debug("Looking up service: {} from Dagger service map", serviceClass.getSimpleName());

    // Get service from Dagger's multibinding map
    Object serviceInstance = component.services().get(serviceClass);

    if (serviceInstance == null) {
      throw new IllegalStateException(
          "Service not found in Dagger map: "
              + serviceClass.getSimpleName()
              + ". Ensure the service has @IntoMap and @ServiceClassKey annotations in ServiceModule.");
    }

    if (!(serviceInstance instanceof EntityService)) {
      throw new IllegalStateException(
          "Service " + serviceClass.getSimpleName() + " is not an EntityService instance");
    }

    return (EntityService<?>) serviceInstance;
  }

  /**
   * Internal record for holding service discovery details.
   */
  private record ServiceDetails(Class<?> serviceClass, String entityType, int order) {}
}
