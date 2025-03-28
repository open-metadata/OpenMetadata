package org.openmetadata.service.migration.utils.v180;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APPS_JOB_GROUP;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.impl.matchers.GroupMatcher;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  public static void associateQuartzJobs() {
//    AppRepository repository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
//
//    AppScheduler scheduler = AppScheduler.getInstance();
//    List<App> apps = repository.listAll(repository.getFields("*"), new ListFilter(Include.ALL));
//    clearExistingTriggers(scheduler);
//    clearExistingJobs(scheduler);
//    apps.forEach(
//        app -> {
//          QuartzJob quartzJob = scheduler.scheduleApplication(app, null);
//          App updated = JsonUtils.deepCopy(app, App.class).withQuartzJob(quartzJob);
//          repository.update(null, app, updated, ADMIN_USER_NAME);
//        });
  }

  private static void clearExistingJobs(AppScheduler scheduler) {
//    try {
//      scheduler
//          .getScheduler()
//          .getJobKeys(GroupMatcher.groupEquals(APPS_JOB_GROUP))
//          .forEach(
//              jobKey -> {
//                try {
//                  scheduler.getScheduler().deleteJob(jobKey);
//                } catch (Exception e) {
//                  LOG.error("Failed to delete existing job: {}", jobKey, e);
//                }
//              });
//    } catch (Exception e) {
//      LOG.error("Failed to retrieve job keys", e);
//    }
  }

  private static void clearExistingTriggers(AppScheduler scheduler) {
//    try {
//      scheduler
//          .getScheduler()
//          .getTriggerKeys(GroupMatcher.groupEquals(APPS_JOB_GROUP))
//          .forEach(
//              triggerKey -> {
//                try {
//                  scheduler.getScheduler().unscheduleJob(triggerKey);
//                } catch (Exception e) {
//                  LOG.error("Failed to unschedule existing trigger: {}", triggerKey, e);
//                }
//              });
//    } catch (Exception e) {
//      LOG.error("Failed to clear existing triggers", e);
//    }
  }
}
