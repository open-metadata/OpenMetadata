package org.openmetadata.service.apps;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.HashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
public class ApplicationHandler {

  private static HashMap<String, Object> instances = new HashMap<>();

  public static Object getAppInstance(String className) {
    return instances.get(className);
  }

  private ApplicationHandler() {
    /*Helper*/
  }

  public static void triggerApplicationOnDemand(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    runMethodFromApplication(app, daoCollection, searchRepository, "triggerOnDemand");
  }

  public static void installApplication(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    runMethodFromApplication(app, daoCollection, searchRepository, "install");
  }

  public static void configureApplication(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    runMethodFromApplication(app, daoCollection, searchRepository, "configure");
  }

  public static Object runAppInit(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository)
      throws ClassNotFoundException,
          NoSuchMethodException,
          InvocationTargetException,
          InstantiationException,
          IllegalAccessException {
    Class<?> clz = Class.forName(app.getClassName());
    Object resource =
        clz.getDeclaredConstructor(CollectionDAO.class, SearchRepository.class)
            .newInstance(daoCollection, searchRepository);

    // Call init Method
    Method initMethod = resource.getClass().getMethod("init", App.class);
    initMethod.invoke(resource, app);

    instances.put(app.getClassName(), resource);

    return resource;
  }

  /** Load an App from its className and call its methods dynamically */
  public static void runMethodFromApplication(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository, String methodName) {
    // Native Application
    try {
      Object resource = getAppInstance(app.getClassName());
      if (resource == null) {
        resource = runAppInit(app, daoCollection, searchRepository);
      }

      // Call method on demand
      Method scheduleMethod = resource.getClass().getMethod(methodName);
      scheduleMethod.invoke(resource);

    } catch (NoSuchMethodException
        | InstantiationException
        | IllegalAccessException
        | InvocationTargetException e) {
      LOG.error("Exception encountered", e);
      throw new UnhandledServerException("Exception encountered", e);
    } catch (ClassNotFoundException e) {
      throw new UnhandledServerException("Exception encountered", e);
    }
  }

  public static void removeUninstalledApp(String className) {
    instances.remove(className);
  }
}
