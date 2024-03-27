package org.openmetadata.service.apps;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APPS_JOB_GROUP;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_INFO_KEY;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.apps.AppPrivateConfig;
import org.openmetadata.schema.api.configuration.apps.AppsPrivateConfiguration;
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

@Slf4j
public class ApplicationHandler {

  @Getter private static ApplicationHandler instance;
  private final OpenMetadataApplicationConfig config;
  private final AppsPrivateConfiguration privateConfiguration;
  private final AppRepository appRepository;

  private ApplicationHandler(OpenMetadataApplicationConfig config) {
    this.config = config;
    this.privateConfiguration = config.getAppsPrivateConfiguration();
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

    if (privateConfiguration != null
        && !nullOrEmpty(privateConfiguration.getAppsPrivateConfiguration())) {
      for (AppPrivateConfig appPrivateConfig : privateConfiguration.getAppsPrivateConfiguration()) {
        if (app.getName().equals(appPrivateConfig.getName())) {
          app.setPreview(appPrivateConfig.getPreview());
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
    @SuppressWarnings("unchecked")
    Map<String, Object> map = JsonUtils.readValue(appInfo, Map.class);
    if (map.containsKey("appSchedule")) {
      @SuppressWarnings("unchecked")
      Map<String, Object> appScheduleMap = (Map<String, Object>) map.get("appSchedule");
      appScheduleMap.put("scheduleTimeline", appScheduleMap.get("scheduleType"));
      appScheduleMap.remove("scheduleType");
      map.put("appSchedule", appScheduleMap);
      appInfo = JsonUtils.pojoToJson(map);
    }
    App updatedApp = JsonUtils.readOrConvertValue(appInfo, App.class);
    updatedApp.setOpenMetadataServerConnection(null);
    updatedApp.setPrivateConfiguration(null);
    App currentApp = appRepository.getDao().findEntityById(application.getId());
    EntityRepository<App>.EntityUpdater updater =
        appRepository.getUpdater(currentApp, updatedApp, EntityRepository.Operation.PATCH);
    updater.update();
    AppScheduler.getInstance().deleteScheduledApplication(updatedApp);
    AppScheduler.getInstance().addApplicationSchedule(updatedApp);
    LOG.info("migrated app configuration for {}", application.getName());
  }
}
