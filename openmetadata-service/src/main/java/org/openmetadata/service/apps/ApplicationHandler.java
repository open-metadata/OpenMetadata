package org.openmetadata.service.apps;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APPS_JOB_GROUP;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_INFO_KEY;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_NAME;

import io.dropwizard.configuration.ConfigurationException;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.apps.AppPrivateConfig;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionMapper;
import org.openmetadata.service.search.SearchRepository;
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
  private final AppMarketPlaceRepository appMarketPlaceRepository;
  private final EventSubscriptionRepository eventSubscriptionRepository;
  private final ConfigurationReader configReader = new ConfigurationReader();

  private ApplicationHandler(OpenMetadataApplicationConfig config) {
    this.config = config;
    this.appRepository = new AppRepository();
    this.appMarketPlaceRepository = new AppMarketPlaceRepository();
    this.eventSubscriptionRepository = new EventSubscriptionRepository();
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
      if (appPrivateConfig.getParameters() != null) {
        app.setPrivateConfiguration(appPrivateConfig.getParameters().getAdditionalProperties());
      }
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
      installEventSubscriptions(app, installedBy);
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

  private void installEventSubscriptions(App app, String installedBy) {
    AppMarketPlaceDefinition definition = appMarketPlaceRepository.getDefinition(app);
    Map<String, EntityReference> eventSubscriptionsReferences =
        listOrEmpty(app.getEventSubscriptions()).stream()
            .collect(Collectors.toMap(EntityReference::getName, e -> e));
    definition.getEventSubscriptions().stream()
        .map(
            request ->
                Optional.ofNullable(eventSubscriptionsReferences.get(request.getName()))
                    .flatMap(
                        sub ->
                            Optional.ofNullable(
                                eventSubscriptionRepository.findByNameOrNull(
                                    sub.getName(), Include.ALL)))
                    .orElseGet(
                        () -> {
                          EventSubscription createdEventSub =
                              eventSubscriptionRepository.create(
                                  null,
                                  // TODO need to get the actual user
                                  new EventSubscriptionMapper()
                                      .createToEntity(request, installedBy));
                          appRepository.addEventSubscription(app, createdEventSub);
                          return createdEventSub;
                        }))
        .forEach(
            eventSub -> {
              try {
                EventSubscriptionScheduler.getInstance().addSubscriptionPublisher(eventSub, true);
              } catch (Exception e) {
                throw new RuntimeException(e);
              }
            });
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
    deleteEventSubscriptions(app, deletedBy);
  }

  private void deleteEventSubscriptions(App app, String deletedBy) {
    listOrEmpty(app.getEventSubscriptions())
        .forEach(
            eventSubscriptionReference -> {
              try {
                EventSubscription eventSub =
                    eventSubscriptionRepository.find(
                        eventSubscriptionReference.getId(), Include.ALL);
                EventSubscriptionScheduler.getInstance().deleteEventSubscriptionPublisher(eventSub);
                eventSubscriptionRepository.delete(deletedBy, eventSub.getId(), false, true);

              } catch (EntityNotFoundException e) {
                LOG.debug("Event subscription {} not found", eventSubscriptionReference.getId());
              } catch (SchedulerException e) {
                throw new RuntimeException(e);
              }
            });
  }

  public AbstractNativeApplication runAppInit(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository)
      throws ClassNotFoundException,
          NoSuchMethodException,
          InvocationTargetException,
          InstantiationException,
          IllegalAccessException {
    return runAppInit(app, daoCollection, searchRepository, false);
  }

  public AbstractNativeApplication runAppInit(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository, boolean forDelete)
      throws ClassNotFoundException,
          NoSuchMethodException,
          InvocationTargetException,
          InstantiationException,
          IllegalAccessException {
    // add private runtime properties
    setAppRuntimeProperties(app);
    Class<? extends AbstractNativeApplication> clz =
        Class.forName(app.getClassName()).asSubclass(AbstractNativeApplication.class);
    AbstractNativeApplication resource =
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
        appRepository.getUpdater(currentApp, updatedApp, EntityRepository.Operation.PATCH, null);
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
