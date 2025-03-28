package org.openmetadata.service.apps;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APPS_JOB_GROUP;

import io.dropwizard.configuration.ConfigurationException;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import javax.ws.rs.core.Response;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.apps.AppPrivateConfig;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
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
      app.setPrivateConfiguration(appPrivateConfig.getParameters().getAdditionalProperties());
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

  /* Run an application on demand. The configuration can be overridden in two optional ways:
  1. By passing a scheduleId, the app will be triggered with the configuration of the schedule.
  2. By passing a configPayload, the app will be triggered with the configuration of the schedule
         and the configPayload will override the schedule configuration.

  Maps are merged flat without deep merge.
  * */
  public void triggerApplicationOnDemand(
      App app,
      CollectionDAO daoCollection,
      SearchRepository searchRepository,
      Map<String, Object> configPayload,
      String scheduleId) {
    try {
      AppSchedule appSchedule =
          Optional.ofNullable(scheduleId)
              .map(
                  sid ->
                      listOrEmpty(app.getAppSchedules()).stream()
                          .filter(appSchedule1 -> appSchedule1.getId().equals(scheduleId))
                          .findFirst()
                          .orElseThrow(
                              () ->
                                  AppException.byMessage(
                                      app.getName(),
                                      "schedule not found",
                                      "No schedule found for: " + scheduleId)))
              .orElse(null);
      runAppInit(app, daoCollection, searchRepository).triggerOnDemand(appSchedule, configPayload);
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
      App updated = runAppInit(app, daoCollection, searchRepository).install(installedBy);
      if (!app.equals(updated)) {
        appRepository.update(null, app, updated, installedBy);
      }
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
      App app,
      CollectionDAO daoCollection,
      SearchRepository searchRepository,
      String uninstalledBy) {
    try {
      runAppInit(app, daoCollection, searchRepository).uninstall(uninstalledBy);
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
      runAppInit(app, daoCollection, searchRepository).uninstall(deletedBy);
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
    // add private runtime properties
    setAppRuntimeProperties(app);
    Class<? extends AbstractNativeApplication> clz =
        Class.forName(app.getClassName()).asSubclass(AbstractNativeApplication.class);
    AbstractNativeApplication resource =
        clz.getDeclaredConstructor(CollectionDAO.class, SearchRepository.class)
            .newInstance(daoCollection, searchRepository);
    // Raise preview message if the app is in Preview mode
    if (Boolean.TRUE.equals(app.getPreview())) {
      resource.raisePreviewMessage(app);
    }

    resource.init(app);

    return resource;
  }

  public void removeOldJobs(App app) throws SchedulerException {
    // TODO this needs to be handled at the scheduler level, not per app
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

  public void schedule(
      App app, CollectionDAO daoCollection, SearchRepository searchRepository, String updatedBy) {
    try {
      runAppInit(app, daoCollection, searchRepository).schedule(updatedBy);
    } catch (ClassNotFoundException
        | NoSuchMethodException
        | InvocationTargetException
        | InstantiationException
        | IllegalAccessException e) {
      LOG.error("Failed to configure application {}", app.getName(), e);
      throw AppException.byMessage(
          app.getName(), "schedule", e.getMessage(), Response.Status.INTERNAL_SERVER_ERROR);
    }
  }
}
