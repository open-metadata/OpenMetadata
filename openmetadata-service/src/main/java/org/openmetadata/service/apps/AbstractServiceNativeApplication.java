package org.openmetadata.service.apps;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.apps.AppService.SCHEDULED_TYPES;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ServiceAppConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
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
      LOG.debug("Service-bound app {} does not support scheduling.", getApp().getName());
      return;
    }

    List<ServiceAppConfiguration> serviceConfigs =
        AppBoundConfigurationUtil.getAllServiceConfigurations(getApp());

    if (listOrEmpty(serviceConfigs).isEmpty()) {
      LOG.warn(
          "Service-bound app {} has no service configurations. Skipping installation.",
          getApp().getName());
      return;
    }

    if (getApp().getAppType().equals(AppType.Internal)
        && SCHEDULED_TYPES.contains(getApp().getScheduleType())) {
      try {
        ApplicationHandler.getInstance().removeOldJobs(getApp());
        ApplicationHandler.getInstance().migrateQuartzConfig(getApp());
        ApplicationHandler.getInstance().fixCorruptedInstallation(getApp());
      } catch (SchedulerException e) {
        throw AppException.byMessage(
            "ApplicationHandler",
            "SchedulerError",
            "Error while migrating service-bound application configuration: " + getApp().getName());
      }

      for (ServiceAppConfiguration serviceConfig : serviceConfigs) {
        scheduleInternalForService(serviceConfig);
      }
    } else if (getApp().getAppType() == AppType.External
        && SCHEDULED_TYPES.contains(getApp().getScheduleType())) {
      for (ServiceAppConfiguration serviceConfig : serviceConfigs) {
        scheduleExternalForService(serviceConfig, installedBy);
      }
    }
  }

  protected void scheduleInternalForService(ServiceAppConfiguration serviceConfig) {
    if (serviceConfig.getServiceRef() == null || serviceConfig.getServiceRef().getId() == null) {
      LOG.warn(
          "Service configuration missing serviceRef for app {}. Skipping scheduling.",
          getApp().getName());
      return;
    }

    UUID serviceId = serviceConfig.getServiceRef().getId();

    if (serviceConfig.getSchedule() == null) {
      LOG.debug(
          "Service-bound app {} for service {} does not have scheduling configured.",
          getApp().getName(),
          serviceId);
      return;
    }

    validateServerExecutableApp(getAppRuntime(getApp()));
    AppScheduler.getInstance().scheduleApplicationForService(getApp(), serviceId);
    LOG.info("Scheduled service-bound app {} for service {}", getApp().getName(), serviceId);
  }

  protected void scheduleExternalForService(
      ServiceAppConfiguration serviceConfig, String installedBy) {
    throw new UnsupportedOperationException(
        String.format(
            "External service-bound app scheduling is not supported for app %s. "
                + "Only internal service-bound apps can be scheduled.",
            getApp().getName()));
  }

  @Override
  public void uninstall() {
    super.uninstall();

    List<ServiceAppConfiguration> serviceConfigs =
        AppBoundConfigurationUtil.getAllServiceConfigurations(getApp());

    if (listOrEmpty(serviceConfigs).isEmpty()) {
      LOG.debug("No service configurations to clean up for app {}", getApp().getName());
      return;
    }

    for (ServiceAppConfiguration serviceConfig : serviceConfigs) {
      if (serviceConfig.getServiceRef() != null && serviceConfig.getServiceRef().getId() != null) {
        try {
          UUID serviceId = serviceConfig.getServiceRef().getId();
          AppScheduler.getInstance().deleteScheduledApplicationForService(getApp(), serviceId);
          LOG.info(
              "Deleted scheduled jobs for service-bound app {} and service {}",
              getApp().getName(),
              serviceId);
        } catch (SchedulerException e) {
          LOG.error(
              "Failed to delete scheduled jobs for service {}",
              serviceConfig.getServiceRef().getId(),
              e);
        }
      }
    }
  }

  @Override
  protected void triggerApplication(Map<String, Object> config) {
    throw new IllegalArgumentException(
        "Service-bound applications require serviceId for on-demand execution. "
            + "Use triggerForService(UUID serviceId, Map<String, Object> config) instead.");
  }

  public void triggerForService(UUID serviceId, Map<String, Object> config) {
    if (serviceId == null) {
      throw new IllegalArgumentException("serviceId cannot be null for service-bound apps");
    }

    ServiceAppConfiguration serviceConfig = findServiceConfiguration(serviceId);
    if (serviceConfig == null) {
      throw new IllegalArgumentException(
          "No configuration found for service " + serviceId + " in app " + getApp().getName());
    }

    validateServerExecutableApp(getAppRuntime(getApp()));

    Map<String, Object> serviceAppConfig =
        JsonUtils.getMap(AppBoundConfigurationUtil.getAppConfiguration(getApp(), serviceId));
    if (config != null) {
      serviceAppConfig.putAll(config);
    }

    validateConfig(serviceAppConfig);
    AppScheduler.getInstance().triggerOnDemandApplicationForService(getApp(), serviceId, config);
  }

  protected Map<String, Object> getServiceAppConfiguration(UUID serviceId) {
    Object config = AppBoundConfigurationUtil.getAppConfiguration(getApp(), serviceId);
    return config != null ? (Map<String, Object>) config : Map.of();
  }

  private ServiceAppConfiguration findServiceConfiguration(UUID serviceId) {
    List<ServiceAppConfiguration> serviceConfigs =
        AppBoundConfigurationUtil.getAllServiceConfigurations(getApp());

    return listOrEmpty(serviceConfigs).stream()
        .filter(
            sc ->
                sc.getServiceRef() != null
                    && sc.getServiceRef().getId() != null
                    && sc.getServiceRef().getId().equals(serviceId))
        .findFirst()
        .orElse(null);
  }
}
