package org.openmetadata.service.apps.managers;

import static org.openmetadata.service.apps.scheduler.AppScheduler.APPS_JOB_GROUP;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_INFO_KEY;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_NAME;

import java.util.Collection;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.SchedulerException;
import org.quartz.impl.matchers.GroupMatcher;

@Slf4j
public class InternalJobSchedulerManager {

  private final AppRepository appRepository;

  public InternalJobSchedulerManager() {
    this.appRepository = new AppRepository();
  }

  public void scheduleApplication(App app) {
    AppScheduler.getInstance().scheduleApplication(app);
  }

  public void scheduleServiceBoundApplication(App app, String serviceId) {
    try {
      AppScheduler.getInstance().scheduleServiceBoundApplication(app, serviceId);
      LOG.info("Scheduled service-bound internal app {} for service {}", app.getName(), serviceId);
    } catch (Exception e) {
      LOG.error(
          "Failed to schedule service-bound application {} for service {}",
          app.getName(),
          serviceId,
          e);
      throw new RuntimeException(
          "Error while scheduling service-bound application: " + app.getName(), e);
    }
  }

  public void triggerOnDemandApplication(App app, Map<String, Object> config) {
    AppScheduler.getInstance().triggerOnDemandApplication(app, config);
  }

  public void triggerOnDemandServiceApplication(
      App app, String serviceId, Map<String, Object> config) {
    AppScheduler.getInstance().triggerOnDemandServiceApplication(app, serviceId, config);
  }

  public void deleteScheduledApplication(App app) {
    try {
      AppScheduler.getInstance().deleteScheduledApplication(app);
    } catch (SchedulerException e) {
      LOG.error("Failed to delete scheduled application {}", app.getName(), e);
      throw new RuntimeException("Error while deleting scheduled application: " + app.getName(), e);
    }
  }

  public void deleteAllServiceBoundApplicationJobs(App app) {
    try {
      AppScheduler.getInstance().deleteAllServiceBoundApplicationJobs(app);
      LOG.info("Cleaned up all service-bound jobs for app {}", app.getName());
    } catch (SchedulerException e) {
      LOG.error("Failed to clean up service-bound jobs for app {}", app.getName(), e);
      throw new RuntimeException("Error while cleaning up service-bound jobs: " + app.getName(), e);
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
    // Private configuration is now handled through AppBoundConfiguration
    updatedApp.setScheduleType(currentApp.getScheduleType());
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
