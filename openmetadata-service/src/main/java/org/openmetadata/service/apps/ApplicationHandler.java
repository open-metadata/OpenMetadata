package org.openmetadata.service.apps;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.Application;
import org.openmetadata.schema.entity.app.RuntimeContext;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public class ApplicationHandler {

  private ApplicationHandler() {
    /*Helper*/
  }

  public static void triggerApplicationOnDemand(Application app, CollectionDAO daoCollection) {
    // Native Application
    RuntimeContext runtimeContext = app.getExecutionContext().getOnDemand();
    if (runtimeContext != null) {
      try {
        Class<?> clz = Class.forName(runtimeContext.getClassName());
        Object resource = clz.getConstructor().newInstance();

        // Call init Method
        Method initMethod = resource.getClass().getMethod("init", Application.class, CollectionDAO.class);
        initMethod.invoke(resource, app, daoCollection);

        // Call Trigger On Demand Method
        Method triggerOnDemandMethod = resource.getClass().getMethod("triggerOnDemand", Object.class);
        triggerOnDemandMethod.invoke(resource, app.getConfiguration());
      } catch (NoSuchMethodException | InstantiationException | IllegalAccessException | InvocationTargetException e) {
        LOG.warn("Exception encountered", e);
      } catch (ClassNotFoundException e) {
        throw new RuntimeException(e);
      }
    } else {
      throw new IllegalArgumentException("Schedule Configuration is null");
    }
  }

  public static void scheduleApplication(Application app, AppSchedule appSchedule, CollectionDAO daoCollection) {
    // Native Application
    RuntimeContext context = app.getExecutionContext().getScheduled();
    if (context != null) {
      try {
        Class<?> clz = Class.forName(context.getClassName());
        Object resource = clz.getConstructor().newInstance();

        // Call init Method
        Method initMethod = resource.getClass().getMethod("init", Application.class, CollectionDAO.class);
        initMethod.invoke(resource, app, daoCollection);

        // Call Trigger On Demand Method
        Method scheduleMethod = resource.getClass().getMethod("schedule", AppSchedule.class);
        scheduleMethod.invoke(resource, appSchedule);
      } catch (NoSuchMethodException | InstantiationException | IllegalAccessException | InvocationTargetException e) {
        LOG.warn("Exception encountered", e);
      } catch (ClassNotFoundException e) {
        throw new RuntimeException(e);
      }
    } else {
      throw new IllegalArgumentException("Schedule Configuration is null");
    }
  }
}
