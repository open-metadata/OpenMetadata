package org.openmetadata.service.apps;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.apps.AppPrivateConfig;
import org.openmetadata.schema.api.configuration.apps.AppsPrivateConfiguration;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

@Slf4j
public class ApplicationHandler {

  @Getter private static ApplicationHandler instance;
  private final OpenMetadataApplicationConfig config;
  private final AppsPrivateConfiguration privateConfiguration;

  private ApplicationHandler(OpenMetadataApplicationConfig config) {
    this.config = config;
    this.privateConfiguration = config.getAppsPrivateConfiguration();
  }

  public static void initialize(OpenMetadataApplicationConfig config) {
    instance = new ApplicationHandler(config);
  }

  /**
   * Load the apps' OM configuration and private parameters
   */
  private void setAppRuntimeProperties(App app) {
    app.setOpenMetadataServerConnection(
        new OpenMetadataConnectionBuilder(config, app.getBot().getName()).build());

    if (privateConfiguration != null
        && !nullOrEmpty(privateConfiguration.getAppsPrivateConfiguration())) {
      for (AppPrivateConfig appPrivateConfig : privateConfiguration.getAppsPrivateConfiguration()) {
        if (app.getName().equals(appPrivateConfig.getName())) {
          app.setPrivateConfiguration(appPrivateConfig.getParameters());
        }
      }
    }
  }

  public void triggerApplicationOnDemand(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    runMethodFromApplication(app, daoCollection, searchRepository, "triggerOnDemand");
  }

  public void installApplication(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    runMethodFromApplication(app, daoCollection, searchRepository, "install");
  }

  public void configureApplication(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    runMethodFromApplication(app, daoCollection, searchRepository, "configure");
  }

  public Object runAppInit(App app, CollectionDAO daoCollection, SearchRepository searchRepository)
      throws ClassNotFoundException,
          NoSuchMethodException,
          InvocationTargetException,
          InstantiationException,
          IllegalAccessException {
    // add private runtime properties
    setAppRuntimeProperties(app);
    Class<?> clz = Class.forName(app.getClassName());
    Object resource =
        clz.getDeclaredConstructor(CollectionDAO.class, SearchRepository.class)
            .newInstance(daoCollection, searchRepository);

    // Call init Method
    Method initMethod = resource.getClass().getMethod("init", App.class);
    initMethod.invoke(resource, app);

    return resource;
  }

  /** Load an App from its className and call its methods dynamically */
  public void runMethodFromApplication(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository, String methodName) {
    // Native Application
    try {
      Object resource = runAppInit(app, daoCollection, searchRepository);
      // Call method on demand
      Method scheduleMethod = resource.getClass().getMethod(methodName);
      scheduleMethod.invoke(resource);

    } catch (NoSuchMethodException
        | InstantiationException
        | IllegalAccessException
        | InvocationTargetException e) {
      LOG.error("Exception encountered", e);
      throw new UnhandledServerException(e.getCause().getMessage());
    } catch (ClassNotFoundException e) {
      throw new UnhandledServerException(e.getCause().getMessage());
    }
  }
}
