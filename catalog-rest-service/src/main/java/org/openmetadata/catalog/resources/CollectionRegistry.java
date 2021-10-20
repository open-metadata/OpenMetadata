/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources;

import io.dropwizard.setup.Environment;
import io.swagger.annotations.Api;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.jdbi3.TableRepository3;
import org.openmetadata.catalog.jdbi3.TableRepositoryHelper;
import org.openmetadata.catalog.resources.databases.TableResource;
import org.openmetadata.catalog.type.CollectionDescriptor;
import org.openmetadata.catalog.type.CollectionInfo;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.reflections.Reflections;
import org.skife.jdbi.v2.DBI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.Path;
import javax.ws.rs.core.UriInfo;
import java.io.File;
import java.lang.annotation.Annotation;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Collection registry is a registry of all the REST collections in the catalog.
 * It is used for building REST endpoints that anchor all the collections as follows:
 * - .../api/v1  Provides information about all the collections in the catalog
 * - .../api/v1/collection-name provides sub collections or resources in that collection
 */
public final class CollectionRegistry {
  private static final Logger LOG = LoggerFactory.getLogger(CollectionRegistry.class);
  private static CollectionRegistry instance = null;

  public static class CollectionDetails {
    private final String resourceClass;
    private final String repoClass;
    private final CollectionDescriptor cd;
    private final List<CollectionDescriptor> childCollections = new ArrayList<>();

    CollectionDetails(CollectionDescriptor cd, String resourceClass, String repoClass) {
      this.cd = cd;
      this.resourceClass = resourceClass;
      this.repoClass = repoClass;
    }

    public void addChildCollection(CollectionDetails child) {
      CollectionInfo collectionInfo = child.cd.getCollection();
      LOG.info("Adding child collection {} to parent collection {}", collectionInfo.getName(),
              cd.getCollection().getName());
      childCollections.add(child.cd);
    }

    public CollectionDescriptor[] getChildCollections() {
      return childCollections.toArray(new CollectionDescriptor[0]);
    }
  }

  /**
   * Map of collection endpoint path to collection details
   */
  private final Map<String, CollectionDetails> collectionMap = new HashMap<>();

  private CollectionRegistry() { }

  public static CollectionRegistry getInstance() {
    if (instance == null) {
      instance = new CollectionRegistry();
      instance.initialize();
    }
    return instance;
  }

  private void initialize() {
    loadCollectionDescriptors();
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

  Map<String, CollectionDetails> getCollectionMap() {
    return Collections.unmodifiableMap(collectionMap);
  }

  /**
   * REST collections are described using *CollectionDescriptor.json
   * Load all CollectionDescriptors from these files in the classpath
   */
  private void loadCollectionDescriptors() {
    // Load collection classes marked with @Collection annotation
    List<CollectionDetails> collections = getCollections();
    for (CollectionDetails collection : collections) {
      CollectionInfo collectionInfo = collection.cd.getCollection();
      collectionMap.put(collectionInfo.getHref().getPath(), collection);
      LOG.info("Initialized collection name {} href {} details {}",
              collectionInfo.getName(), collectionInfo.getHref(), collection);
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
   * Register resources from CollectionRegistry
   */
  public void registerResources(DBI jdbi, Environment environment, CatalogAuthorizer authorizer) {
    // Build list of ResourceDescriptors
    for (Map.Entry<String, CollectionDetails> e : collectionMap.entrySet()) {
      CollectionDetails details = e.getValue();
      String resourceClass = details.resourceClass;
      String repositoryClass = details.repoClass;
      try {
        Object resource = createResource(jdbi, resourceClass, repositoryClass, authorizer);
        environment.jersey().register(resource);
        LOG.info("Registering {}", resourceClass);
      } catch (Exception ex) {
        LOG.warn("Failed to create resource for class {} {}", resourceClass, ex);
      }
    }
  }

  /**
   * Register resources from CollectionRegistry
   */
  public void registerResources3(Jdbi jdbi, Environment environment, CatalogAuthorizer authorizer) {
    LOG.info("Initializing jdbi3");
    Class<?> repositoryClz = TableRepository3.class;
      final TableRepository3 daoObject = (TableRepository3) jdbi.onDemand(repositoryClz);
      TableRepositoryHelper helper = new TableRepositoryHelper(daoObject);
      TableResource resource = new TableResource(helper, authorizer);
    environment.jersey().register(resource);
    LOG.info("Registering {}", resource);
    LOG.info("Initialized jdbi3");
  }

  /** Get collection details based on annotations in Resource classes */
  private static CollectionDetails getCollection(Class<?> cl) {
    String href, doc, name, repoClass;
    href = null;
    doc = null;
    name = null;
    repoClass = null;
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
        repoClass = ((Collection) a).repositoryClass();
        repoClass = repoClass.isEmpty() ? null : repoClass;
      }
    }
    CollectionDescriptor cd = new CollectionDescriptor();
    cd.setCollection(new CollectionInfo().withName(name).withDocumentation(doc).withHref(URI.create(href)));
    return new CollectionDetails(cd, cl.getCanonicalName(), repoClass);
  }

  /** Compile a list of REST collection based on Resource classes marked with {@code Collection} annotation */
  private static List<CollectionDetails> getCollections() {
    Reflections reflections = new Reflections("org.openmetadata.catalog.resources");

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
  private static Object createResource(DBI jdbi, String resourceClass, String repositoryClass,
                                       CatalogAuthorizer authorizer) throws
          ClassNotFoundException, NoSuchMethodException, IllegalAccessException, InvocationTargetException,
          InstantiationException {
    Object resource;
    Class<?> clz = Class.forName(resourceClass);

    // Create the resource identified by resourceClass
    if (repositoryClass != null) {
      Class<?> repositoryClz = Class.forName(repositoryClass);
      final Object daoObject = jdbi.onDemand(repositoryClz);
      LOG.info("Creating resource {} with repository {}", resourceClass, repositoryClass);
      resource = clz.getDeclaredConstructor(repositoryClz, CatalogAuthorizer.class).newInstance(daoObject, authorizer);
    } else {
      LOG.info("Creating resource {} without repository", resourceClass);
      resource = Class.forName(resourceClass).getConstructor().newInstance();
    }

    // Call initialize method, if it exists
    try {
      Method initializeMethod = resource.getClass().getMethod("initialize");
      LOG.info("Initializing resource {}", resourceClass);
      initializeMethod.invoke(resource);
    } catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException ignored) {
      // Method does not exist and initialize is not called
    }
    return resource;
  }
}
