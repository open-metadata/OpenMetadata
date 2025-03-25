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

package org.openmetadata.service.resources;

import com.google.common.annotations.VisibleForTesting;
import io.dropwizard.core.setup.Environment;
import io.github.classgraph.ClassGraph;
import io.github.classgraph.ClassInfo;
import io.github.classgraph.ClassInfoList;
import io.github.classgraph.ScanResult;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.Path;
import java.lang.annotation.Annotation;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.Getter;
import lombok.Setter;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.Function;
import org.openmetadata.schema.type.CollectionDescriptor;
import org.openmetadata.schema.type.CollectionInfo;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.util.ReflectionUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Collection registry is a registry of all the REST collections in the catalog. It is used for building REST endpoints
 * that anchor all the collections as follows: - .../api/v1 Provides information about all the collections in the
 * catalog - .../api/v1/collection-name provides sub collections or resources in that collection
 */
public final class CollectionRegistry {
  public static final List<String> PACKAGES = List.of("org.openmetadata", "io.collate");
  private static CollectionRegistry instance = null;
  private static volatile boolean initialized = false;
  private static final Logger LOG = LoggerFactory.getLogger(CollectionRegistry.class);

  /** Map of collection endpoint path to collection details */
  private final Map<String, CollectionDetails> collectionMap = new LinkedHashMap<>();

  /** Map of class name to list of functions exposed for writing conditions */
  private final Map<Class<?>, List<org.openmetadata.schema.type.Function>> functionMap =
      new ConcurrentHashMap<>();

  /** Resources used only for testing */
  @VisibleForTesting private final List<Object> testResources = new ArrayList<>();

  private CollectionRegistry() {}

  public static CollectionRegistry getInstance() {
    if (!initialized) {
      initialize();
    }
    return instance;
  }

  public List<org.openmetadata.schema.type.Function> getFunctions(Class<?> clz) {
    return functionMap.get(clz);
  }

  public static void initialize() {
    if (!initialized) {
      instance = new CollectionRegistry();
      initialized = true;
      instance.loadCollectionDescriptors();
      instance.loadConditionFunctions();
    } else {
      LOG.info("[Collection Registry] is already initialized.");
    }
  }

  /**
   * REST collections are described using *CollectionDescriptor.json Load all CollectionDescriptors from these files in
   * the classpath
   */
  private void loadCollectionDescriptors() {
    // Load collection classes marked with @Collection annotation
    List<CollectionDetails> collections = getCollections();
    for (int i = 0; i < 10; i++) { // Ordering @Collection order 0 to 9
      for (CollectionDetails collection : collections) {
        if (collection.order == i) {
          CollectionInfo collectionInfo = collection.cd.getCollection();
          collectionMap.put(collectionInfo.getHref().getPath(), collection);
        }
      }
    }
  }

  /**
   * Resource such as Policy provide a set of functions for authoring SpEL based conditions. The registry loads all
   * those conditions and makes it available for listing them over API to author expressions in Rules.
   */
  private void loadConditionFunctions() {
    try (ScanResult scanResult =
        new ClassGraph().enableAllInfo().acceptPackages(PACKAGES.toArray(new String[0])).scan()) {
      for (ClassInfo classInfo : scanResult.getClassesWithMethodAnnotation(Function.class)) {
        List<Method> methods =
            ReflectionUtil.getMethodsAnnotatedWith(classInfo.loadClass(), Function.class);
        for (Method method : methods) {
          Function annotation = method.getAnnotation(Function.class);
          List<org.openmetadata.schema.type.Function> functionList =
              functionMap.computeIfAbsent(method.getDeclaringClass(), k -> new ArrayList<>());

          org.openmetadata.schema.type.Function function =
              new org.openmetadata.schema.type.Function()
                  .withName(annotation.name())
                  .withInput(annotation.input())
                  .withDescription(annotation.description())
                  .withExamples(List.of(annotation.examples()))
                  .withParameterInputType(annotation.paramInputType());
          functionList.add(function);
          functionList.sort(Comparator.comparing(org.openmetadata.schema.type.Function::getName));
          LOG.info(
              "Initialized for {} function {}\n",
              method.getDeclaringClass().getSimpleName(),
              function);
        }
      }
    }
  }

  @VisibleForTesting
  public static void addTestResource(Object testResource) {
    getInstance().testResources.add(testResource);
  }

  /** Register resources from CollectionRegistry */
  public void registerResources(
      Jdbi jdbi,
      Environment environment,
      OpenMetadataApplicationConfig config,
      Authorizer authorizer,
      AuthenticatorHandler authenticatorHandler,
      Limits limits) {
    // Build list of ResourceDescriptors
    for (Map.Entry<String, CollectionDetails> e : collectionMap.entrySet()) {
      CollectionDetails details = e.getValue();
      String resourceClass = details.resourceClass;
      try {
        Object resource =
            createResource(jdbi, resourceClass, config, authorizer, authenticatorHandler, limits);
        details.setResource(resource);
        environment.jersey().register(resource);
        LOG.info("Registering {} with order {}", resourceClass, details.order);
      } catch (Exception ex) {
        LOG.warn("Failed to create resource for class {} {}", resourceClass, ex.getMessage());
      }
    }

    // Now add test resources
    testResources.forEach(
        object -> {
          LOG.info("Registering test resource {}", object);
          environment.jersey().register(object);
        });
  }

  public void loadSeedData(
      Jdbi jdbi,
      OpenMetadataApplicationConfig config,
      Authorizer authorizer,
      AuthenticatorHandler authenticatorHandler,
      Limits limits,
      boolean isOperations) {
    // Build list of ResourceDescriptors
    for (Map.Entry<String, CollectionDetails> e : collectionMap.entrySet()) {
      CollectionDetails details = e.getValue();
      if (!isOperations || details.requiredForOps) {
        String resourceClass = details.resourceClass;
        try {
          createResource(jdbi, resourceClass, config, authorizer, authenticatorHandler, limits);
        } catch (Exception ex) {
          LOG.warn("Failed to create resource for class {} {}", resourceClass, ex);
        }
      }
    }
  }

  /** Get collection details based on annotations in Resource classes */
  private static CollectionDetails getCollection(Class<?> cl) {
    int order = 0;
    boolean requiredForOps = false;
    CollectionInfo collectionInfo = new CollectionInfo();
    for (Annotation a : cl.getAnnotations()) {
      if (a instanceof Path path) {
        // Use @Path annotation to compile href
        collectionInfo.withHref(URI.create(path.value()));
      } else if (a instanceof Tag tag) {
        // Use @Tag annotation to get documentation about the collection
        collectionInfo.withDocumentation(tag.description());
      } else if (a instanceof Collection collection) {
        // Use @Collection annotation to get initialization information for the class
        collectionInfo.withName(collection.name());
        order = collection.order();
        requiredForOps = collection.requiredForOps();
      }
    }
    CollectionDescriptor cd = new CollectionDescriptor();
    cd.setCollection(collectionInfo);
    return new CollectionDetails(cd, cl.getCanonicalName(), order, requiredForOps);
  }

  /** Compile a list of REST collections based on Resource classes marked with {@code Collection} annotation */
  private static List<CollectionDetails> getCollections() {
    try (ScanResult scanResult =
        new ClassGraph()
            .enableAnnotationInfo()
            .acceptPackages(PACKAGES.toArray(new String[0]))
            .scan()) {
      ClassInfoList classList = scanResult.getClassesWithAnnotation(Collection.class);
      List<Class<?>> collectionClasses = classList.loadClasses();
      List<CollectionDetails> collections = new ArrayList<>();
      for (Class<?> cl : collectionClasses) {
        CollectionDetails cd = getCollection(cl);
        collections.add(cd);
      }
      return collections;
    }
  }

  /** Create a resource class based on dependencies declared in @Collection annotation */
  private static Object createResource(
      Jdbi jdbi,
      String resourceClass,
      OpenMetadataApplicationConfig config,
      Authorizer authorizer,
      AuthenticatorHandler authHandler,
      Limits limits)
      throws ClassNotFoundException,
          NoSuchMethodException,
          IllegalAccessException,
          InvocationTargetException,
          InstantiationException {

    Object resource = null;
    Class<?> clz = Class.forName(resourceClass);

    // Create the resource identified by resourceClass
    try {
      resource =
          clz.getDeclaredConstructor(OpenMetadataApplicationConfig.class, Limits.class)
              .newInstance(config, limits);
    } catch (NoSuchMethodException e) {
      try {
        resource =
            clz.getDeclaredConstructor(Authorizer.class, Limits.class)
                .newInstance(authorizer, limits);
      } catch (NoSuchMethodException ex) {
        try {
          resource = clz.getDeclaredConstructor(Authorizer.class).newInstance(authorizer);
        } catch (NoSuchMethodException exe) {
          try {
            resource =
                clz.getDeclaredConstructor(
                        Authorizer.class, Limits.class, AuthenticatorHandler.class)
                    .newInstance(authorizer, limits, authHandler);
          } catch (NoSuchMethodException exec) {
            try {
              resource =
                  clz.getDeclaredConstructor(Jdbi.class, Authorizer.class)
                      .newInstance(jdbi, authorizer);
            } catch (NoSuchMethodException except) {
              try {
                resource = clz.getDeclaredConstructor(Limits.class).newInstance(limits);
              } catch (NoSuchMethodException exception) {
                resource = Class.forName(resourceClass).getConstructor().newInstance();
              }
            }
          }
        }
      }
    } catch (Exception ex) {
      LOG.warn("Exception encountered while creating resource for {}", clz, ex);
    }

    // Call initialize method, if it exists
    try {
      Method initializeMethod =
          resource.getClass().getMethod("initialize", OpenMetadataApplicationConfig.class);
      initializeMethod.invoke(resource, config);
    } catch (NoSuchMethodException ignored) {
      // Method does not exist and initialize is not called
    } catch (Exception ex) {
      LOG.warn("Encountered exception while initializing resource for {}", clz, ex);
    }

    // Call upgrade method, if it exists
    try {
      Method upgradeMethod = resource.getClass().getMethod("upgrade");
      upgradeMethod.invoke(resource);
    } catch (NoSuchMethodException ignored) {
      // Method does not exist and initialize is not called
    } catch (Exception ex) {
      LOG.warn("Encountered exception ", ex);
    }
    return resource;
  }

  public static class CollectionDetails {
    @Getter private final String resourceClass;
    @Getter @Setter private Object resource;
    private final CollectionDescriptor cd;
    private final int order;
    private final boolean requiredForOps;

    CollectionDetails(
        CollectionDescriptor cd, String resourceClass, int order, boolean requiredForOps) {
      this.cd = cd;
      this.resourceClass = resourceClass;
      this.order = order;
      this.requiredForOps = requiredForOps;
    }
  }
}
