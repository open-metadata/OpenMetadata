package org.openmetadata.service.apps;

import io.dropwizard.configuration.ConfigurationException;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.apps.AppPrivateConfig;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.managers.ExternalJobSchedulerManager;
import org.openmetadata.service.apps.managers.InstallManager;
import org.openmetadata.service.apps.managers.InternalJobSchedulerManager;
import org.openmetadata.service.apps.managers.JobAppConfigUpdater;
import org.openmetadata.service.apps.managers.UninstallManager;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.AppBoundConfigurationUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.quartz.SchedulerException;

@Slf4j
public class ApplicationHandler {

  @Getter private static ApplicationHandler instance;
  private final OpenMetadataApplicationConfig config;
  private final AppRepository appRepository;
  private final ConfigurationReader configReader = new ConfigurationReader();

  private final InstallManager installManager;
  private final UninstallManager uninstallManager;
  private final InternalJobSchedulerManager internalSchedulerManager;
  @Getter private final ExternalJobSchedulerManager externalSchedulerManager;
  private final JobAppConfigUpdater jobAppConfigUpdater;

  private ApplicationHandler(OpenMetadataApplicationConfig config) {
    this.config = config;
    this.appRepository = new AppRepository();

    // Initialize managers with dependencies
    CollectionDAO collectionDAO = Entity.getCollectionDAO();
    this.installManager = new InstallManager(collectionDAO);
    this.uninstallManager = new UninstallManager();
    this.internalSchedulerManager = new InternalJobSchedulerManager();
    this.jobAppConfigUpdater = new JobAppConfigUpdater();
    this.externalSchedulerManager =
        new ExternalJobSchedulerManager(installManager, jobAppConfigUpdater);
  }

  public static void initialize(OpenMetadataApplicationConfig config) {
    if (instance != null) {
      return;
    }
    instance = new ApplicationHandler(config);
  }

  /**
   * Load the apps' OM configuration and private parameters
   */
  public void setAppRuntimeProperties(App app) {
    app.setOpenMetadataServerConnection(
        new OpenMetadataConnectionBuilder(config, app.getBot().getName()).build());
    if (AppBoundConfigurationUtil.isGlobalApp(app)) {
      try {
        AppPrivateConfig appPrivateConfig = configReader.readConfigFromResource(app.getName());
        app.setPreview(appPrivateConfig.getPreview());

        if (appPrivateConfig.getParameters() != null
            && appPrivateConfig.getParameters().getAdditionalProperties() != null) {
          // Private configuration is now handled through AppBoundConfigurationUtil
          app.getConfiguration()
              .getGlobalAppConfig()
              .setPrivateConfig(appPrivateConfig.getParameters().getAdditionalProperties());
        }
      } catch (IOException e) {
        LOG.debug("Config file for app {} not found: ", app.getName(), e);
      } catch (ConfigurationException e) {
        LOG.error("Error reading config file for app {}", app.getName(), e);
      }
    } else {
      LOG.debug(
          "App {} is not a global app, skipping loading private configuration", app.getName());
    }
  }

  public Boolean isPreview(String appName) {
    try {
      AppPrivateConfig appPrivateConfig = configReader.readConfigFromResource(appName);
      return appPrivateConfig.getPreview();
    } catch (IOException e) {
      LOG.debug("Config file for app {} not found: ", appName, e);
      return false;
    } catch (ConfigurationException e) {
      LOG.error("Error reading config file for app {}", appName, e);
      return false;
    }
  }

  public void triggerApplicationOnDemand(
      App app,
      CollectionDAO daoCollection,
      SearchRepository searchRepository,
      Map<String, Object> configPayload) {
    try {
      runAppInit(app, daoCollection, searchRepository).triggerOnDemand(configPayload);
    } catch (ClassNotFoundException
        | NoSuchMethodException
        | InvocationTargetException
        | InstantiationException
        | IllegalAccessException e) {
      LOG.error("Failed to install application {}", app.getName(), e);
      throw AppException.byMessage(
          app.getName(), "triggerOnDemand", e.getMessage(), Response.Status.INTERNAL_SERVER_ERROR);
    }
  }

  public void installApplication(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository, String installedBy) {
    try {
      runAppInit(app, daoCollection, searchRepository).install(installedBy);
      installManager.installEventSubscriptions(app, installedBy);
    } catch (ClassNotFoundException
        | NoSuchMethodException
        | InvocationTargetException
        | InstantiationException
        | IllegalAccessException e) {
      LOG.error("Failed to install application {}", app.getName(), e);
      throw AppException.byMessage(
          app.getName(), "install", e.getMessage(), Response.Status.INTERNAL_SERVER_ERROR);
    }
  }

  public void uninstallApplication(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    try {
      runAppInit(app, daoCollection, searchRepository, true).uninstall();
    } catch (ClassNotFoundException
        | NoSuchMethodException
        | InvocationTargetException
        | InstantiationException
        | IllegalAccessException e) {
      LOG.error("Failed to uninstall application {}", app.getName(), e);
      throw AppException.byMessage(
          app.getName(), "install", e.getMessage(), Response.Status.INTERNAL_SERVER_ERROR);
    }
  }

  public void configureApplication(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    try {
      runAppInit(app, daoCollection, searchRepository).configure();
    } catch (ClassNotFoundException
        | NoSuchMethodException
        | InvocationTargetException
        | InstantiationException
        | IllegalAccessException e) {
      LOG.error("Failed to configure application {}", app.getName(), e);
      throw AppException.byMessage(
          app.getName(), "configure", e.getMessage(), Response.Status.INTERNAL_SERVER_ERROR);
    }
  }

  public void performCleanup(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository, String deletedBy) {
    try {
      runAppInit(app, daoCollection, searchRepository, true).cleanup();
    } catch (ClassNotFoundException
        | NoSuchMethodException
        | InvocationTargetException
        | InstantiationException
        | IllegalAccessException e) {
      throw new RuntimeException(e);
    }
    uninstallManager.deleteEventSubscriptions(app, deletedBy);
  }

  public AbstractNativeApplicationBase runAppInit(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository)
      throws ClassNotFoundException,
          NoSuchMethodException,
          InvocationTargetException,
          InstantiationException,
          IllegalAccessException {
    return runAppInit(app, daoCollection, searchRepository, false);
  }

  public AbstractNativeApplicationBase runAppInit(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository, boolean forDelete)
      throws ClassNotFoundException,
          NoSuchMethodException,
          InvocationTargetException,
          InstantiationException,
          IllegalAccessException {
    // add private runtime properties
    setAppRuntimeProperties(app);
    Class<? extends AbstractNativeApplicationBase> clz =
        Class.forName(app.getClassName()).asSubclass(AbstractNativeApplicationBase.class);
    AbstractNativeApplicationBase resource =
        clz.getDeclaredConstructor(CollectionDAO.class, SearchRepository.class)
            .newInstance(daoCollection, searchRepository);
    // Raise preview message if the app is in Preview mode
    if (!forDelete && Boolean.TRUE.equals(app.getPreview())) {
      resource.raisePreviewMessage(app);
    }

    resource.init(app);

    return resource;
  }

  public void migrateQuartzConfig(App application) throws SchedulerException {
    internalSchedulerManager.migrateQuartzConfig(application);
  }

  public void fixCorruptedInstallation(App application) throws SchedulerException {
    internalSchedulerManager.fixCorruptedInstallation(application);
  }

  public void removeOldJobs(App app) throws SchedulerException {
    internalSchedulerManager.removeOldJobs(app);
  }

  public JobAppConfigUpdater getJobAppConfigUpdater() {
    return jobAppConfigUpdater;
  }
}
