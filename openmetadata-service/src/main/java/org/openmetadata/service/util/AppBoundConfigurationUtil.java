package org.openmetadata.service.util;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppBoundConfiguration;
import org.openmetadata.schema.entity.app.AppBoundType;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.GlobalAppConfiguration;
import org.openmetadata.schema.entity.app.ServiceAppConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.apps.AppException;

@Slf4j
public class AppBoundConfigurationUtil {

  public static boolean isGlobalApp(App app) {
    return app.getBoundType() == AppBoundType.Global;
  }

  public static boolean isServiceBoundApp(App app) {
    return app.getBoundType() == AppBoundType.Service;
  }

  public static boolean isExternalApp(App app) {
    return app.getAppType() == AppType.External;
  }

  public static Object getAppConfiguration(App app) {
    // External apps use flat format; fall back to nested for migration transition
    if (isExternalApp(app)) {
      Object flat = app.getAppConfiguration();
      return flat != null
          ? flat
          : getGlobalConfiguration(app).map(GlobalAppConfiguration::getConfig).orElse(null);
    }
    if (isGlobalApp(app)) {
      Object nested =
          getGlobalConfiguration(app).map(GlobalAppConfiguration::getConfig).orElse(null);
      return nested != null ? nested : app.getAppConfiguration();
    } else if (isServiceBoundApp(app)) {
      LOG.warn(
          "getAppConfiguration called on service-bound app {}. Consider using getServiceAppConfiguration with serviceId",
          app.getName());
      return null;
    }
    return null;
  }

  public static Object getAppConfiguration(App app, UUID serviceId) {
    if (isServiceBoundApp(app)) {
      return getServiceConfiguration(app, serviceId)
          .map(ServiceAppConfiguration::getConfig)
          .orElse(null);
    }
    return getAppConfiguration(app);
  }

  public static Object getPrivateConfiguration(App app) {
    if (isExternalApp(app)) {
      Object flat = app.getPrivateConfiguration();
      return flat != null
          ? flat
          : getGlobalConfiguration(app).map(GlobalAppConfiguration::getPrivateConfig).orElse(null);
    }
    if (isGlobalApp(app)) {
      Object nested =
          getGlobalConfiguration(app).map(GlobalAppConfiguration::getPrivateConfig).orElse(null);
      return nested != null ? nested : app.getPrivateConfiguration();
    }
    return null;
  }

  public static Object getPrivateConfiguration(App app, UUID serviceId) {
    if (isServiceBoundApp(app)) {
      return getServiceConfiguration(app, serviceId)
          .map(ServiceAppConfiguration::getPrivateConfig)
          .orElse(null);
    }
    return getPrivateConfiguration(app);
  }

  public static AppSchedule getAppSchedule(App app) {
    if (isExternalApp(app)) {
      AppSchedule flat = app.getAppSchedule();
      return flat != null
          ? flat
          : getGlobalConfiguration(app).map(GlobalAppConfiguration::getSchedule).orElse(null);
    }
    if (isGlobalApp(app)) {
      AppSchedule nested =
          getGlobalConfiguration(app).map(GlobalAppConfiguration::getSchedule).orElse(null);
      return nested != null ? nested : app.getAppSchedule();
    } else if (isServiceBoundApp(app)) {
      LOG.warn(
          "getAppSchedule called on service-bound app {}. Consider using getAppSchedule with serviceId",
          app.getName());
      return null;
    }
    return null;
  }

  public static AppSchedule getAppSchedule(App app, UUID serviceId) {
    if (isServiceBoundApp(app)) {
      return getServiceConfiguration(app, serviceId)
          .map(ServiceAppConfiguration::getSchedule)
          .orElse(null);
    }
    return getAppSchedule(app);
  }

  public static List<EntityReference> getEventSubscriptions(App app) {
    if (isGlobalApp(app)) {
      return getGlobalConfiguration(app)
          .map(GlobalAppConfiguration::getEventSubscriptions)
          .orElse(List.of());
    } else if (isServiceBoundApp(app)) {
      return getEventSubscriptionsForServiceApp(app);
    }
    return List.of();
  }

  public static List<EntityReference> getEventSubscriptionsForServiceApp(App app) {
    if (isServiceBoundApp(app)) {
      return Optional.ofNullable(app.getConfiguration())
          .map(AppBoundConfiguration::getServiceAppConfig)
          .orElse(List.of())
          .stream()
          .flatMap(
              config -> {
                List<EntityReference> subs = config.getEventSubscriptions();
                return subs != null ? subs.stream() : java.util.stream.Stream.empty();
              })
          .collect(Collectors.toList());
    }
    return List.of();
  }

  public static List<EntityReference> getEventSubscriptions(App app, UUID serviceId) {
    if (isServiceBoundApp(app)) {
      return getServiceConfiguration(app, serviceId)
          .map(ServiceAppConfiguration::getEventSubscriptions)
          .orElse(List.of());
    }
    return getEventSubscriptions(app);
  }

  public static EntityReference getPipeline(App app) {
    if (isGlobalApp(app)) {
      return getGlobalConfiguration(app).map(GlobalAppConfiguration::getPipeline).orElse(null);
    }
    return null;
  }

  public static EntityReference getPipeline(App app, UUID serviceId) {
    if (isServiceBoundApp(app)) {
      return getServiceConfiguration(app, serviceId)
          .map(ServiceAppConfiguration::getPipeline)
          .orElse(null);
    }
    return getPipeline(app);
  }

  //  public static OpenMetadataConnection getOpenMetadataServerConnection(App app) {
  //    if (isGlobalApp(app)) {
  //      return getGlobalConfiguration(app)
  //          .map(GlobalAppConfiguration::getOpenMetadataServerConnection)
  //          .orElse(null);
  //    }
  //    return null;
  //  }
  //
  //  public static OpenMetadataConnection getOpenMetadataServerConnection(App app, UUID serviceId)
  // {
  //    if (isServiceBoundApp(app)) {
  //      return getServiceConfiguration(app, serviceId)
  //          .map(ServiceAppConfiguration::getOpenMetadataServerConnection)
  //          .orElse(null);
  //    }
  //    return getOpenMetadataServerConnection(app);
  //  }
  //
  public static void setAppConfiguration(App app, Object appConfiguration) {
    if (isExternalApp(app)) {
      app.setAppConfiguration(appConfiguration);
      return;
    }
    if (isGlobalApp(app)) {
      getOrCreateGlobalConfiguration(app).setConfig(appConfiguration);
    } else if (isServiceBoundApp(app)) {
      LOG.warn(
          "setAppConfiguration called on service-bound app {}. Consider using setAppConfiguration with serviceId",
          app.getName());
    }
  }

  public static void unsetPrivateConfiguration(App app) {
    if (isExternalApp(app)) {
      app.setPrivateConfiguration(null);
      return;
    }
    if (isGlobalApp(app)) {
      if (app.getConfiguration() != null && app.getConfiguration().getGlobalAppConfig() != null) {
        app.getConfiguration().getGlobalAppConfig().setPrivateConfig(null);
      }
    } else if (isServiceBoundApp(app)) {
      if (app.getConfiguration() != null && app.getConfiguration().getServiceAppConfig() != null) {
        app.getConfiguration().getServiceAppConfig().forEach(c -> c.setPrivateConfig(null));
      }
    }
  }

  public static void setAppConfiguration(App app, UUID serviceId, Object appConfiguration) {
    if (isServiceBoundApp(app)) {
      getOrCreateServiceConfiguration(app, serviceId).setConfig(appConfiguration);
    } else {
      setAppConfiguration(app, appConfiguration);
    }
  }

  public static void setSchedule(App app, AppSchedule appSchedule) {
    if (isExternalApp(app)) {
      app.setAppSchedule(appSchedule);
      return;
    }
    if (isGlobalApp(app)) {
      getOrCreateGlobalConfiguration(app).setSchedule(appSchedule);
    } else if (isServiceBoundApp(app)) {
      LOG.warn(
          "setSchedule called on service-bound app {}. Consider using setSchedule with serviceId",
          app.getName());
    }
  }

  public static void setSchedule(App app, UUID serviceId, AppSchedule appSchedule) {
    if (isServiceBoundApp(app)) {
      getOrCreateServiceConfiguration(app, serviceId).setSchedule(appSchedule);
    } else {
      setSchedule(app, appSchedule);
    }
  }

  public static void setEventSubscriptions(App app, List<EntityReference> eventSubscriptions) {
    if (isGlobalApp(app)) {
      getOrCreateGlobalConfiguration(app).setEventSubscriptions(eventSubscriptions);
    } else if (isServiceBoundApp(app)) {
      LOG.warn(
          "setEventSubscriptions called on service-bound app {}. Consider using setEventSubscriptions with serviceId",
          app.getName());
    }
  }

  public static void setEventSubscriptions(
      App app, UUID serviceId, List<EntityReference> eventSubscriptions) {
    if (isServiceBoundApp(app)) {
      getOrCreateServiceConfiguration(app, serviceId).setEventSubscriptions(eventSubscriptions);
    } else {
      setEventSubscriptions(app, eventSubscriptions);
    }
  }

  public static void setPipeline(App app, EntityReference pipeline) {
    if (isGlobalApp(app)) {
      getOrCreateGlobalConfiguration(app).setPipeline(pipeline);
    }
  }

  public static void setPipeline(App app, UUID serviceId, EntityReference pipeline) {
    if (isServiceBoundApp(app)) {
      getOrCreateServiceConfiguration(app, serviceId).setPipeline(pipeline);
    } else {
      setPipeline(app, pipeline);
    }
  }

  public static Optional<ServiceAppConfiguration> getServiceConfiguration(App app, UUID serviceId) {
    if (!isServiceBoundApp(app)) {
      return Optional.empty();
    }

    return Optional.ofNullable(app.getConfiguration())
        .map(AppBoundConfiguration::getServiceAppConfig)
        .orElse(List.of())
        .stream()
        .filter(
            config ->
                config.getServiceRef() != null
                    && Objects.equals(config.getServiceRef().getId(), serviceId))
        .findFirst();
  }

  public static Optional<ServiceAppConfiguration> getServiceConfiguration(
      App app, String serviceName, String serviceType) {
    if (!isServiceBoundApp(app)) {
      return Optional.empty();
    }

    return Optional.ofNullable(app.getConfiguration())
        .map(AppBoundConfiguration::getServiceAppConfig)
        .orElse(List.of())
        .stream()
        .filter(
            config ->
                config.getServiceRef() != null
                    && Objects.equals(config.getServiceRef().getName(), serviceName)
                    && Objects.equals(config.getServiceRef().getType(), serviceType))
        .findFirst();
  }

  public static List<ServiceAppConfiguration> getAllServiceConfigurations(App app) {
    if (!isServiceBoundApp(app)) {
      throw new AppException("Cannot get service configurations for global app " + app.getName());
    }

    return Optional.ofNullable(app.getConfiguration())
        .map(AppBoundConfiguration::getServiceAppConfig)
        .orElse(List.of());
  }

  public static ServiceAppConfiguration addServiceConfiguration(
      App app, EntityReference serviceRef) {
    if (!isServiceBoundApp(app)) {
      throw new IllegalArgumentException("Cannot add service configuration to global app");
    }

    // Check if a configuration already exists for this service — return it for update (upsert)
    Optional<ServiceAppConfiguration> existing = getServiceConfiguration(app, serviceRef.getId());
    if (existing.isPresent()) {
      return existing.get();
    }

    ServiceAppConfiguration serviceConfig =
        new ServiceAppConfiguration().withServiceRef(serviceRef);
    getOrCreateAppBoundConfiguration(app).getServiceAppConfig().add(serviceConfig);
    return serviceConfig;
  }

  public static boolean removeServiceConfiguration(App app, UUID serviceId) {
    if (!isServiceBoundApp(app)) {
      return false;
    }

    List<ServiceAppConfiguration> serviceConfigs =
        Optional.ofNullable(app.getConfiguration())
            .map(AppBoundConfiguration::getServiceAppConfig)
            .orElse(null);

    if (serviceConfigs == null || serviceConfigs.isEmpty()) {
      return false;
    }

    return serviceConfigs.removeIf(
        config ->
            config.getServiceRef() != null
                && Objects.equals(config.getServiceRef().getId(), serviceId));
  }

  private static Optional<GlobalAppConfiguration> getGlobalConfiguration(App app) {
    return Optional.ofNullable(app.getConfiguration())
        .map(AppBoundConfiguration::getGlobalAppConfig);
  }

  private static GlobalAppConfiguration getOrCreateGlobalConfiguration(App app) {
    AppBoundConfiguration boundConfig = getOrCreateAppBoundConfiguration(app);
    if (boundConfig.getGlobalAppConfig() == null) {
      boundConfig.setGlobalAppConfig(new GlobalAppConfiguration());
    }
    return boundConfig.getGlobalAppConfig();
  }

  private static ServiceAppConfiguration getOrCreateServiceConfiguration(App app, UUID serviceId) {
    AppBoundConfiguration boundConfig = getOrCreateAppBoundConfiguration(app);

    Optional<ServiceAppConfiguration> existingConfig =
        boundConfig.getServiceAppConfig().stream()
            .filter(
                config ->
                    config.getServiceRef() != null
                        && Objects.equals(config.getServiceRef().getId(), serviceId))
            .findFirst();

    if (existingConfig.isPresent()) {
      return existingConfig.get();
    }

    EntityReference serviceRef = new EntityReference().withId(serviceId);
    ServiceAppConfiguration serviceConfig =
        new ServiceAppConfiguration().withServiceRef(serviceRef);
    boundConfig.getServiceAppConfig().add(serviceConfig);
    return serviceConfig;
  }

  private static AppBoundConfiguration getOrCreateAppBoundConfiguration(App app) {
    if (app.getConfiguration() == null) {
      app.setConfiguration(new AppBoundConfiguration());
    }
    return app.getConfiguration();
  }

  public static void migrateFromLegacyConfiguration(App app) {
    if (app.getBoundType() == null) {
      app.setBoundType(AppBoundType.Global);
    }

    // External apps keep flat format — no migration to nested structure
    if (isExternalApp(app)) {
      return;
    }

    if (!isGlobalApp(app)) {
      return;
    }

    // Ensure configuration structure exists
    GlobalAppConfiguration globalConfig = getOrCreateGlobalConfiguration(app);

    // Fill in any missing fields from legacy top-level properties
    if (globalConfig.getConfig() == null && app.getAppConfiguration() != null) {
      globalConfig.setConfig(app.getAppConfiguration());
    }
    if (globalConfig.getPrivateConfig() == null && app.getPrivateConfiguration() != null) {
      globalConfig.setPrivateConfig(app.getPrivateConfiguration());
    }
    if (globalConfig.getSchedule() == null && app.getAppSchedule() != null) {
      globalConfig.setSchedule(app.getAppSchedule());
    }
  }
}
