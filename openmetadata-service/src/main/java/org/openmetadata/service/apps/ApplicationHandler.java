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
    // Native Application
    try {
      Class<?> clz = Class.forName(app.getClassName());
      Object resource = clz.getConstructor().newInstance();

      // Call init Method
      Method initMethod =
          resource
              .getClass()
              .getMethod("init", App.class, CollectionDAO.class, SearchRepository.class);
      initMethod.invoke(resource, app, daoCollection, searchRepository);

      // Call Trigger On Demand Method
      Method triggerOnDemandMethod = resource.getClass().getMethod("triggerOnDemand");
      triggerOnDemandMethod.invoke(resource);
    } catch (NoSuchMethodException
        | InstantiationException
        | IllegalAccessException
        | InvocationTargetException e) {
      LOG.error("Exception encountered", e);
      throw new RuntimeException(e);
    } catch (ClassNotFoundException e) {
      throw new RuntimeException(e);
    }
  }

  public static void scheduleApplication(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    // Native Application
    try {
      Class<?> clz = Class.forName(app.getClassName());
      Object resource = clz.getConstructor().newInstance();

      // Call init Method
      Method initMethod =
          resource
              .getClass()
              .getMethod("init", App.class, CollectionDAO.class, SearchRepository.class);
      initMethod.invoke(resource, app, daoCollection, searchRepository);

      // Call Trigger On Demand Method
      if (app.getAppType() == AppType.Internal) {
        Method scheduleMethod = resource.getClass().getMethod("scheduleInternal");
        scheduleMethod.invoke(resource);
      } else if (app.getAppType() == AppType.External) {
        Method scheduleMethod = resource.getClass().getMethod("initializeExternalApp");
        scheduleMethod.invoke(resource);
      }
    } catch (NoSuchMethodException
        | InstantiationException
        | IllegalAccessException
        | InvocationTargetException e) {
      LOG.error("Exception encountered", e);
      throw new RuntimeException(e);
    } catch (ClassNotFoundException e) {
      throw new RuntimeException(e);
    }
  }
}
