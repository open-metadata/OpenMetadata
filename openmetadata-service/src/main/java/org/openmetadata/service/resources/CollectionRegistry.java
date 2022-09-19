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
import io.dropwizard.setup.Environment;
import io.swagger.annotations.Api;
import java.io.File;
import java.lang.annotation.Annotation;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import javax.ws.rs.Path;
import javax.ws.rs.core.UriInfo;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.Function;
import org.openmetadata.schema.type.CollectionDescriptor;
import org.openmetadata.schema.type.CollectionInfo;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil;
import org.reflections.Reflections;
import org.reflections.scanners.MethodAnnotationsScanner;
import org.reflections.util.ClasspathHelper;
import org.reflections.util.ConfigurationBuilder;

/**
 * Collection registry is a registry of all the REST collections in the catalog. It is used for building REST endpoints
 * that anchor all the collections as follows: - .../api/v1 Provides information about all the collections in the
 * catalog - .../api/v1/collection-name provides sub collections or resources in that collection
 */
@Slf4j
public final class CollectionRegistry {
  private static CollectionRegistry instance = null;

  /** Map of collection endpoint path to collection details */
  private final Map<String, CollectionDetails> collectionMap = new LinkedHashMap<>();

  /** Map of class name to list of functions exposed for writing conditions */
  private final Map<Class<?>, List<org.openmetadata.schema.type.Function>> functionMap = new ConcurrentHashMap<>();

  /**
   * Some functions are used for capturing resource based rules where policies are applied based on resource being
   * accessed and team hierarchy the resource belongs to instead of the subject.
   */
  @Getter private final List<String> resourceBasedFunctions = new ArrayList<>();

  /** Resources used only for testing */
  @VisibleForTesting private final List<Object> testResources = new ArrayList<>();

  private CollectionRegistry() {}

  public static CollectionRegistry getInstance() {
    if (instance == null) {
      instance = new CollectionRegistry();
      instance.initialize();
    }
    return instance;
  }

  public List<org.openmetadata.schema.type.Function> getFunctions(Class<?> clz) {
    return functionMap.get(clz);
  }

  private void initialize() {
    loadCollectionDescriptors();
    loadConditionFunctions();
  }

  /** For a collection at {@code collectionPath} returns JSON document that describes it and it's children */
  public CollectionDescriptor[] getCollectionForPath(String collectionPath, UriInfo uriInfo) {
    CollectionDetails parent = collectionMap.get(collectionPath);
    CollectionDescriptor[] children = parent.getChildCollections();
    for (CollectionDescriptor child : children) {
      URI href = child.getCollection().getHref();
      child.getCollection().setHref(RestUtil.getHref(uriInfo, href.getPath()));
    }
    return children;
  }

  public Map<String, CollectionDetails> getCollectionMap() {
    return Collections.unmodifiableMap(collectionMap);
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

    // Now add collections to their parents
    // Example add to /v1 collections services databases etc.
    for (CollectionDetails details : collectionMap.values()) {
      CollectionInfo collectionInfo = details.cd.getCollection();
      if (collectionInfo.getName().equals("root")) {
        // Collection root does not have any parent
        continue;
      }
      String parent = new File(collectionInfo.getHref().getPath()).getParent();
      CollectionDetails parentCollection = collectionMap.get(parent);
      if (parentCollection != null) {
        collectionMap.get(parent).addChildCollection(details);
      }
    }
  }

  /**
   * Resource such as Policy provide a set of functions for authoring SpEL based conditions. The registry loads all
   * those conditions and makes it available listing them.
   */
  private void loadConditionFunctions() {
    Reflections reflections =
        new Reflections(
            new ConfigurationBuilder()
                .setUrls(ClasspathHelper.forPackage("org.openmetadata.service"))
                .setScanners(new MethodAnnotationsScanner()));

    // Get classes marked with @Collection annotation
    Set<Method> methods = reflections.getMethodsAnnotatedWith(Function.class);
    for (Method method : methods) {
      Function annotation = method.getAnnotation(Function.class);
      List<org.openmetadata.schema.type.Function> functionList =
          functionMap.computeIfAbsent(method.getDeclaringClass(), k -> new ArrayList<>());

      org.openmetadata.schema.type.Function function =
          new org.openmetadata.schema.type.Function()
              .withName(annotation.name())
              .withInput(annotation.input())
              .withDescription(annotation.description())
              .withExamples(List.of(annotation.examples()));
      functionList.add(function);
      functionList.sort(Comparator.comparing(org.openmetadata.schema.type.Function::getName));

      if (annotation.resourceBased()) {
        resourceBasedFunctions.add(annotation.name());
      }
      LOG.info("Initialized for {} function {}\n", method.getDeclaringClass().getSimpleName(), function);
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
      SecretsManager secretsManager) {
    // Build list of ResourceDescriptors
    for (Map.Entry<String, CollectionDetails> e : collectionMap.entrySet()) {
      CollectionDetails details = e.getValue();
      String resourceClass = details.resourceClass;
      try {
        CollectionDAO daoObject = jdbi.onDemand(CollectionDAO.class);
        Objects.requireNonNull(daoObject, "CollectionDAO must not be null");
        Object resource = createResource(daoObject, resourceClass, config, authorizer, secretsManager);
        details.setResource(resource);
        environment.jersey().register(resource);
        LOG.info("Registering {} with order {}", resourceClass, details.order);
      } catch (Exception ex) {
        LOG.warn("Failed to create resource for class {} {}", resourceClass, ex);
      }
    }

    // Now add test resources
    testResources.forEach(
        object -> {
          LOG.info("Registering test resource {}", object);
          environment.jersey().register(object);
        });
  }

  /** Get collection details based on annotations in Resource classes */
  private static CollectionDetails getCollection(Class<?> cl) {
    String href;
    String doc;
    String name;
    int order = 0;
    href = null;
    doc = null;
    name = null;
    for (Annotation a : cl.getAnnotations()) {
      if (a instanceof Path) {
        // Use @Path annotation to compile href
        href = ((Path) a).value();
      } else if (a instanceof Api) {
        // Use @Api annotation to get documentation about the collection
        doc = ((Api) a).value();
      } else if (a instanceof Collection) {
        // Use @Collection annotation to get initialization information for the class
        name = ((Collection) a).name();
        order = ((Collection) a).order();
      }
    }
    CollectionDescriptor cd = new CollectionDescriptor();
    cd.setCollection(new CollectionInfo().withName(name).withDocumentation(doc).withHref(URI.create(href)));
    return new CollectionDetails(cd, cl.getCanonicalName(), order);
  }

  /** Compile a list of REST collection based on Resource classes marked with {@code Collection} annotation */
  private static List<CollectionDetails> getCollections() {
    Reflections reflections = new Reflections("org.openmetadata.service.resources");

    // Get classes marked with @Collection annotation
    Set<Class<?>> collectionClasses = reflections.getTypesAnnotatedWith(Collection.class);
    List<CollectionDetails> collections = new ArrayList<>();
    for (Class<?> cl : collectionClasses) {
      CollectionDetails cd = getCollection(cl);
      collections.add(cd);
    }
    return collections;
  }

  /** Create a resource class based on dependencies declared in @Collection annotation */
  private static Object createResource(
      CollectionDAO daoObject,
      String resourceClass,
      OpenMetadataApplicationConfig config,
      Authorizer authorizer,
      SecretsManager secretsManager)
      throws ClassNotFoundException, NoSuchMethodException, IllegalAccessException, InvocationTargetException,
          InstantiationException {
    Object resource;
    Class<?> clz = Class.forName(resourceClass);

    // Create the resource identified by resourceClass
    try {
      resource = clz.getDeclaredConstructor(CollectionDAO.class, Authorizer.class).newInstance(daoObject, authorizer);
    } catch (NoSuchMethodException e) {
      try {
        resource =
            clz.getDeclaredConstructor(CollectionDAO.class, Authorizer.class, SecretsManager.class)
                .newInstance(daoObject, authorizer, secretsManager);
      } catch (NoSuchMethodException ex) {
        try {
          resource = clz.getDeclaredConstructor(OpenMetadataApplicationConfig.class).newInstance(config);
        } catch (NoSuchMethodException exc) {
          resource = Class.forName(resourceClass).getConstructor().newInstance();
        }
      }
    }

    // Call initialize method, if it exists
    try {
      Method initializeMethod = resource.getClass().getMethod("initialize", OpenMetadataApplicationConfig.class);
      initializeMethod.invoke(resource, config);
    } catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException ignored) {
      // Method does not exist and initialize is not called
    }
    return resource;
  }

  public static class CollectionDetails {
    private final int order;

    @Getter private final String resourceClass;
    private final CollectionDescriptor cd;
    private final List<CollectionDescriptor> childCollections = new ArrayList<>();

    @Getter @Setter private Object resource;

    CollectionDetails(CollectionDescriptor cd, String resourceClass, int order) {
      this.cd = cd;
      this.resourceClass = resourceClass;
      this.order = order;
    }

    public void addChildCollection(CollectionDetails child) {
      CollectionInfo collectionInfo = child.cd.getCollection();
      LOG.info(
          "Adding child collection {} to parent collection {}", collectionInfo.getName(), cd.getCollection().getName());
      childCollections.add(child.cd);
    }

    public CollectionDescriptor[] getChildCollections() {
      return childCollections.toArray(new CollectionDescriptor[0]);
    }
  }
}
