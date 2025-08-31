package org.openmetadata.service.apps;

import static org.openmetadata.service.apps.AppService.SCHEDULED_TYPES;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.AppBoundConfigurationUtil;
import org.quartz.SchedulerException;

@Slf4j
public abstract class AbstractGlobalNativeApplication extends AbstractNativeApplicationBase {

  protected AbstractGlobalNativeApplication(
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

    if (AppBoundConfigurationUtil.getAppSchedule(getApp()) == null) {
      LOG.debug("Global app {} does not have scheduling configured.", getApp().getName());
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
            "Error while migrating global application configuration: " + getApp().getName());
      }
      scheduleInternal();
    } else if (getApp().getAppType() == AppType.External
        && SCHEDULED_TYPES.contains(getApp().getScheduleType())) {
      scheduleExternal(installedBy);
    }
  }

  protected void scheduleInternal() {
    validateServerExecutableApp(getAppRuntime(getApp()));
    AppScheduler.getInstance().scheduleApplication(getApp());
  }

  protected void scheduleExternal(String installedBy) {
    LOG.info("Scheduling external global application: {}", getApp().getName());
    ApplicationHandler.getInstance()
        .getExternalSchedulerManager()
        .scheduleExternalApp(getApp(), installedBy);
  }

  @Override
  protected void triggerApplication(Map<String, Object> config) {
    AppScheduler.getInstance().triggerOnDemandApplication(getApp(), config);
  }

  @Override
  public void triggerForService(UUID serviceId, Map<String, Object> config) {
    LOG.debug("Global App Type cannot trigger Service Type: {}", serviceId);
    throw new AppException("Global App Type cannot trigger Service Type: " + serviceId);
  }
}
