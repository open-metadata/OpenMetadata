package org.openmetadata.service.apps;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
public class ApplicationHandler {

  private ApplicationHandler() {
    /*Helper*/
  }

  public static void triggerApplicationOnDemand(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    runMethodFromApplication(app, daoCollection, searchRepository, "triggerOnDemand", "triggerOnDemand");
  }

  public static void scheduleApplication(App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    runMethodFromApplication(app, daoCollection, searchRepository, "scheduleInternal", "initializeExternalApp");
  }

  public static void configureApplication(App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    runMethodFromApplication(app, daoCollection, searchRepository, "configure", "configure");
  }

  /** Load an App from its className and call its methods dynamically */
  public static void runMethodFromApplication(
      App app,
      CollectionDAO daoCollection,
      SearchRepository searchRepository,
      String internalMethodName,
      String externalMethodName) {
    // Native Application
    try {
      Class<?> clz = Class.forName(app.getClassName());
      Object resource = clz.getConstructor().newInstance();

      // Call init Method
      Method initMethod = resource.getClass().getMethod("init", App.class, CollectionDAO.class, SearchRepository.class);
      initMethod.invoke(resource, app, daoCollection, searchRepository);

      // Call Trigger On Demand Method
      if (app.getAppType() == AppType.Internal) {
        Method scheduleMethod = resource.getClass().getMethod(internalMethodName);
        scheduleMethod.invoke(resource);
      } else if (app.getAppType() == AppType.External) {
        Method scheduleMethod = resource.getClass().getMethod(externalMethodName);
        scheduleMethod.invoke(resource);
      }
    } catch (NoSuchMethodException | InstantiationException | IllegalAccessException | InvocationTargetException e) {
      LOG.error("Exception encountered", e);
      throw new RuntimeException(e);
    } catch (ClassNotFoundException e) {
      throw new RuntimeException(e);
    }
  }
}
