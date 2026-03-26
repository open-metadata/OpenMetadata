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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
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
import org.openmetadata.service.Entity;
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
import org.openmetadata.service.util.AppBoundConfigurationUtil;
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
    instance.cleanupStaleJobs();
  }

  /**
   * Load the apps' OM configuration and private parameters
   */
  public void setAppRuntimeProperties(App app) {
    app.setOpenMetadataServerConnection(
        new OpenMetadataConnectionBuilder(config, app.getBot().getName()).build());
    try {
      AppPrivateConfig appPrivateConfig = configReader.readConfigFromResource(app.getName());
      app.setEnabled(appPrivateConfig.getEnabled());

      if (appPrivateConfig.getParameters() != null
          && appPrivateConfig.getParameters().getAdditionalProperties() != null) {
        app.setPrivateConfiguration(appPrivateConfig.getParameters().getAdditionalProperties());
      }
    } catch (IOException e) {
      LOG.debug("Config file for app {} not found: ", app.getName(), e);
    } catch (ConfigurationException e) {
      LOG.error("Error reading config file for app {}", app.getName(), e);
    }
  }

  public Boolean isEnabled(String appName) {
    try {
      AppPrivateConfig appPrivateConfig = configReader.readConfigFromResource(appName);
      return appPrivateConfig.getEnabled();
    } catch (IOException e) {
      LOG.debug("Config file for app {} not found: ", appName, e);
      return true;
    } catch (ConfigurationException e) {
      LOG.error("Error reading config file for app {}", appName, e);
      return true;
    }
  }

  public void cleanupStaleJobs() {
    try {
      LOG.info("Cleaning up stale application jobs from previous server runs");
      CollectionDAO.AppExtensionTimeSeries dao =
          Entity.getCollectionDAO().appExtensionTimeSeriesDao();
      dao.markAllStaleEntriesFailedExcludingApp("SearchIndexingApplication");
      LOG.info("Stale application jobs cleanup completed successfully");
    } catch (Exception e) {
      LOG.error("Failed to cleanup stale application jobs", e);
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

  public void triggerApplicationForService(
      App app,
      UUID serviceId,
      CollectionDAO daoCollection,
      SearchRepository searchRepository,
      Map<String, Object> configPayload) {
    try {
      AbstractNativeApplicationBase appInstance = runAppInit(app, daoCollection, searchRepository);
      if (appInstance instanceof AbstractServiceNativeApplication) {
        ((AbstractServiceNativeApplication) appInstance)
            .triggerForService(serviceId, configPayload);
      } else {
        throw new IllegalArgumentException(
            "Application " + app.getName() + " is not a service-bound application");
      }
    } catch (ClassNotFoundException
        | NoSuchMethodException
        | InvocationTargetException
        | InstantiationException
        | IllegalAccessException e) {
      LOG.error("Failed to trigger service-bound application {}", app.getName(), e);
      throw AppException.byMessage(
          app.getName(),
          "triggerForService",
          e.getMessage(),
          Response.Status.INTERNAL_SERVER_ERROR);
    }
  }

  public List<UUID> getConfiguredServices(App app) {
    if (!AppBoundConfigurationUtil.isServiceBoundApp(app)) {
      return List.of();
    }
    return AppBoundConfigurationUtil.getAllServiceConfigurations(app).stream()
        .filter(sc -> sc.getServiceRef() != null && sc.getServiceRef().getId() != null)
        .map(sc -> sc.getServiceRef().getId())
        .collect(Collectors.toList());
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

  public App appWithDecryptedAppConfiguration(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    try {
      Map<String, Object> decryptedAppConfig =
          runAppInit(app, daoCollection, searchRepository, true)
              .decryptConfiguration(
                  JsonUtils.getMap(AppBoundConfigurationUtil.getAppConfiguration(app)));
      AppBoundConfigurationUtil.setAppConfiguration(app, decryptedAppConfig);
      return app;
    } catch (ClassNotFoundException
        | NoSuchMethodException
        | InvocationTargetException
        | InstantiationException
        | IllegalAccessException e) {
      LOG.error("Failed to decrypt application configuration for {}", app.getName(), e);
      throw AppException.byMessage(
          app.getName(),
          "decryptAppConfiguration",
          e.getMessage(),
          Response.Status.INTERNAL_SERVER_ERROR);
    }
  }

  public App appWithEncryptedAppConfiguration(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository) {
    try {
      Map<String, Object> encryptedAppConfig =
          runAppInit(app, daoCollection, searchRepository, true)
              .encryptConfiguration(
                  JsonUtils.getMap(AppBoundConfigurationUtil.getAppConfiguration(app)));
      AppBoundConfigurationUtil.setAppConfiguration(app, encryptedAppConfig);
      return app;
    } catch (ClassNotFoundException
        | NoSuchMethodException
        | InvocationTargetException
        | InstantiationException
        | IllegalAccessException e) {
      LOG.error("Failed to encrypt application configuration for {}", app.getName(), e);
      throw AppException.byMessage(
          app.getName(),
          "encryptAppConfiguration",
          e.getMessage(),
          Response.Status.INTERNAL_SERVER_ERROR);
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
      App app,
      CollectionDAO daoCollection,
      SearchRepository searchRepository,
      boolean skipEnabledCheck)
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
    if (!skipEnabledCheck && Boolean.FALSE.equals(app.getEnabled())) {
      resource.raiseNotEnabledMessage(app);
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
    org.openmetadata.schema.entity.app.AppSchedule schedule =
        AppBoundConfigurationUtil.getAppSchedule(currentApp);
    if (schedule != null) {
      AppBoundConfigurationUtil.setSchedule(updatedApp, schedule);
    }
    updatedApp.setUpdatedBy(currentApp.getUpdatedBy());
    updatedApp.setFullyQualifiedName(currentApp.getFullyQualifiedName());
    EntityRepository<App>.EntityUpdater updater =
        appRepository.getUpdater(currentApp, updatedApp, EntityRepository.Operation.PATCH, null);
    updater.update();
    AppScheduler.getInstance().deleteScheduledApplication(updatedApp);
    LOG.info(
        "migrated app configuration for {}, will be rescheduled by install()",
        application.getName());
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
      LOG.info(
          "corrupt entry for app {}, deleting corrupt job. Will be rescheduled by install()",
          application.getName());
      App app = appRepository.getDao().findEntityByName(application.getName());
      AppScheduler.getInstance().deleteScheduledApplication(app);
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
            JobDetail jobDetail = AppScheduler.getInstance().getScheduler().getJobDetail(jobKey);
            if (jobDetail == null) {
              // Job doesn't exist, skip
              return;
            }
            Class<?> clz = jobDetail.getJobClass();
            if (!AppScheduler.isJobForApp(jobKey.getName(), app.getName())
                && clz.getName().equals(app.getClassName())) {
              LOG.info("deleting old job {}", jobKey.getName());
              AppScheduler.getInstance().getScheduler().deleteJob(jobKey);
            }
          } catch (org.quartz.JobPersistenceException e) {
            // Job class no longer exists, delete the stale job entry
            if (e.getCause() instanceof ClassNotFoundException) {
              LOG.warn("Found stale job with missing class: {}. Deleting.", jobKey.getName());
              try {
                AppScheduler.getInstance().getScheduler().deleteJob(jobKey);
              } catch (SchedulerException ex) {
                LOG.error("Failed to delete stale job {}", jobKey.getName(), ex);
              }
            } else {
              LOG.error("Error retrieving job {}", jobKey.getName(), e);
            }
          } catch (SchedulerException e) {
            LOG.error("Error deleting job {}", jobKey.getName(), e);
          }
        });
  }
}
