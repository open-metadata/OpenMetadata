package org.openmetadata.service.apps;

import static org.openmetadata.service.apps.AppService.SCHEDULED_TYPES;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ServiceAppConfiguration;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.AppBoundConfigurationUtil;
import org.quartz.SchedulerException;

@Slf4j
public abstract class AbstractServiceNativeApplication extends AbstractNativeApplicationBase {

  public AbstractServiceNativeApplication(
      CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void install(String installedBy) {
    if (Boolean.TRUE.equals(getApp().getDeleted())
        || Set.of(ScheduleType.NoSchedule, ScheduleType.OnlyManual)
            .contains(getApp().getScheduleType())) {
      LOG.debug("App {} does not support scheduling.", getApp().getName());
      return;
    }

    List<ServiceAppConfiguration> serviceConfigs =
        AppBoundConfigurationUtil.getAllServiceConfigurations(getApp());

    if (serviceConfigs.isEmpty()) {
      LOG.debug("Service-bound app {} has no service configurations.", getApp().getName());
      return;
    }

    for (ServiceAppConfiguration serviceConfig : serviceConfigs) {
      if (serviceConfig.getSchedule() == null) {
        LOG.debug(
            "Service configuration for {} in app {} has no schedule.",
            serviceConfig.getServiceRef().getId(),
            getApp().getName());
        continue;
      }

      String serviceId = serviceConfig.getServiceRef().getId().toString();

      if (getApp().getAppType().equals(AppType.Internal)
          && SCHEDULED_TYPES.contains(getApp().getScheduleType())) {
        try {
          AppScheduler.getInstance().scheduleServiceBoundApplication(getApp(), serviceId);
          LOG.info(
              "Scheduled service-bound internal app {} for service {}",
              getApp().getName(),
              serviceId);
        } catch (Exception e) {
          LOG.error(
              "Failed to schedule service-bound application {} for service {}",
              getApp().getName(),
              serviceId,
              e);
          throw AppException.byMessage(
              "ApplicationHandler",
              "SchedulerError",
              "Error while scheduling service-bound application: " + getApp().getName());
        }
      } else if (getApp().getAppType() == AppType.External
          && SCHEDULED_TYPES.contains(getApp().getScheduleType())) {
        scheduleExternalForService(serviceConfig, installedBy);
      }
    }
  }

  @Override
  public void uninstall() {
    super.uninstall();

    if (getApp().getAppType().equals(AppType.Internal)) {
      try {
        AppScheduler.getInstance().deleteAllServiceBoundApplicationJobs(getApp());
        LOG.info("Cleaned up all service-bound jobs for app {}", getApp().getName());
      } catch (SchedulerException e) {
        LOG.error("Failed to clean up service-bound jobs for app {}", getApp().getName(), e);
      }
    }
  }

  @Override
  protected void triggerApplication(Map<String, Object> config) {
    LOG.warn("Service-bound applications should specify serviceId for on-demand execution");
    // Could implement default behavior to trigger for all services or throw exception
    throw new IllegalArgumentException(
        "Service-bound applications require serviceId for on-demand execution");
  }

  public void triggerForService(UUID serviceId, Map<String, Object> config) {
    if (Set.of(ScheduleType.ScheduledOrManual, ScheduleType.OnlyManual)
        .contains(getApp().getScheduleType())) {
      validateServerExecutableApp(getAppRuntime(getApp()));

      Map<String, Object> appConfig = getServiceAppConfiguration(serviceId);
      if (config != null) {
        appConfig.putAll(config);
      }
      validateConfig(appConfig);
      AppScheduler.getInstance()
          .triggerOnDemandServiceApplication(getApp(), serviceId.toString(), config);
    } else {
      throw new IllegalArgumentException("Application does not support manual triggering");
    }
  }

  private Map<String, Object> getServiceAppConfiguration(UUID serviceId) {
    Object config = AppBoundConfigurationUtil.getAppConfiguration(getApp(), serviceId);
    return config != null ? (Map<String, Object>) config : Map.of();
  }

  protected void scheduleExternalForService(
      ServiceAppConfiguration serviceConfig, String installedBy) {
    LOG.info(
        "Scheduling external service-bound application {} for service {}",
        getApp().getName(),
        serviceConfig.getServiceRef().getId());
    ApplicationHandler.getInstance()
        .getExternalSchedulerManager()
        .scheduleExternalServiceApp(getApp(), serviceConfig, installedBy);
  }
}
