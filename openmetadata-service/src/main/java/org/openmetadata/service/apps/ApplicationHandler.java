package org.openmetadata.service.apps;

import static org.openmetadata.service.apps.scheduler.AppScheduler.APPS_JOB_GROUP;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_INFO_KEY;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_NAME;

import io.dropwizard.configuration.ConfigurationException;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Collection;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.apps.AppPrivateConfig;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.SchedulerException;
import org.quartz.impl.matchers.GroupMatcher;

@Slf4j
public class ApplicationHandler {

  @Getter private static ApplicationHandler instance;
  private final OpenMetadataApplicationConfig config;
  private final AppRepository appRepository;
  private final ConfigurationReader configReader = new ConfigurationReader();

  private ApplicationHandler(OpenMetadataApplicationConfig config) {
    this.config = config;
    this.appRepository = new AppRepository();
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
    try {
      AppPrivateConfig appPrivateConfig = configReader.readConfigFromResource(app.getName());
      app.setPreview(appPrivateConfig.getPreview());
      app.setPrivateConfiguration(appPrivateConfig.getParameters());
    } catch (IOException e) {
      LOG.debug("Config file for app {} not found: ", app.getName(), e);
    } catch (ConfigurationException e) {
      LOG.error("Error reading config file for app {}", app.getName(), e);
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
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    runMethodFromApplication(app, daoCollection, searchRepository, "triggerOnDemand");
  }

  public void installApplication(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository, String installedBy) {
    // Native Application
    setAppRuntimeProperties(app);
    try {
      Object resource = runAppInit(app, daoCollection, searchRepository);
      // Call method on demand
      Method scheduleMethod = resource.getClass().getMethod("install", String.class);
      scheduleMethod.invoke(resource, installedBy);

    } catch (NoSuchMethodException | InstantiationException | IllegalAccessException e) {
      LOG.error("Exception encountered", e);
      throw new UnhandledServerException(e.getMessage());
    } catch (ClassNotFoundException e) {
      throw new UnhandledServerException(e.getMessage());
    } catch (InvocationTargetException e) {
      throw AppException.byMessage(app.getName(), "install", e.getTargetException().getMessage());
    }
  }

  public void configureApplication(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    runMethodFromApplication(app, daoCollection, searchRepository, "configure");
  }

  public void performCleanup(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    runMethodFromApplication(app, daoCollection, searchRepository, "cleanup");
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

    // Raise preview message if the app is in Preview mode
    if (Boolean.TRUE.equals(app.getPreview())) {
      Method preview = resource.getClass().getMethod("raisePreviewMessage", App.class);
      preview.invoke(resource, app);
    }

    // Call init Method
    Method initMethod = resource.getClass().getMethod("init", App.class);
    initMethod.invoke(resource, app);

    return resource;
  }

  /**
   * Load an App from its className and call its methods dynamically
   */
  public void runMethodFromApplication(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository, String methodName) {
    // Native Application
    setAppRuntimeProperties(app);
    try {
      Object resource = runAppInit(app, daoCollection, searchRepository);
      // Call method on demand
      Method scheduleMethod = resource.getClass().getMethod(methodName);
      scheduleMethod.invoke(resource);

    } catch (NoSuchMethodException | InstantiationException | IllegalAccessException e) {
      LOG.error("Exception encountered", e);
      throw new UnhandledServerException(e.getMessage());
    } catch (ClassNotFoundException e) {
      throw new UnhandledServerException(e.getMessage());
    } catch (InvocationTargetException e) {
      throw AppException.byMessage(app.getName(), methodName, e.getTargetException().getMessage());
    }
  }

  public void migrateQuartzConfig(App application) throws SchedulerException {
    JobDetail jobDetails =
        AppScheduler.getInstance()
            .getScheduler()
            .getJobDetail(new JobKey(application.getName(), APPS_JOB_GROUP));
    if (jobDetails == null) {
      return;
    }
    JobDataMap jobDataMap = jobDetails.getJobDataMap();
    if (jobDataMap == null) {
      return;
    }
    String appInfo = jobDataMap.getString(APP_INFO_KEY);
    if (appInfo == null) {
      return;
    }
    LOG.info("migrating app quartz configuration for {}", application.getName());
    App updatedApp = JsonUtils.readOrConvertValue(appInfo, App.class);
    App currentApp = appRepository.getDao().findEntityById(application.getId());
    updatedApp.setOpenMetadataServerConnection(null);
    updatedApp.setPrivateConfiguration(null);
    updatedApp.setScheduleType(currentApp.getScheduleType());
    updatedApp.setAppSchedule(currentApp.getAppSchedule());
    updatedApp.setUpdatedBy(currentApp.getUpdatedBy());
    updatedApp.setFullyQualifiedName(currentApp.getFullyQualifiedName());
    EntityRepository<App>.EntityUpdater updater =
        appRepository.getUpdater(currentApp, updatedApp, EntityRepository.Operation.PATCH);
    updater.update();
    AppScheduler.getInstance().deleteScheduledApplication(updatedApp);
    AppScheduler.getInstance().scheduleApplication(updatedApp);
    LOG.info("migrated app configuration for {}", application.getName());
  }

  public void fixCorruptedInstallation(App application) throws SchedulerException {
    JobDetail jobDetails =
        AppScheduler.getInstance()
            .getScheduler()
            .getJobDetail(new JobKey(application.getName(), APPS_JOB_GROUP));
    if (jobDetails == null) {
      return;
    }
    JobDataMap jobDataMap = jobDetails.getJobDataMap();
    if (jobDataMap == null) {
      return;
    }
    String appName = jobDataMap.getString(APP_NAME);
    if (appName == null) {
      LOG.info("corrupt entry for app {}, reinstalling", application.getName());
      App app = appRepository.getDao().findEntityByName(application.getName());
      AppScheduler.getInstance().deleteScheduledApplication(app);
      AppScheduler.getInstance().scheduleApplication(app);
    }
  }

  public void removeOldJobs(App app) throws SchedulerException {
    Collection<JobKey> jobKeys =
        AppScheduler.getInstance()
            .getScheduler()
            .getJobKeys(GroupMatcher.groupContains(APPS_JOB_GROUP));
    jobKeys.forEach(
        jobKey -> {
          try {
            Class<?> clz =
                AppScheduler.getInstance().getScheduler().getJobDetail(jobKey).getJobClass();
            if (!jobKey.getName().equals(app.getName())
                && clz.getName().equals(app.getClassName())) {
              LOG.info("deleting old job {}", jobKey.getName());
              AppScheduler.getInstance().getScheduler().deleteJob(jobKey);
            }
          } catch (SchedulerException e) {
            LOG.error("Error deleting job {}", jobKey.getName(), e);
          }
        });
  }
}
