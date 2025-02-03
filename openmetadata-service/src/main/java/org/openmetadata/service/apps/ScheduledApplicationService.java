package org.openmetadata.service.apps;

import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;

import java.util.UUID;

import static org.openmetadata.service.apps.scheduler.AbstractOmAppJobListener.SCHEDULED_APP_RUN_EXTENSION;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_NAME;

public class ScheduledApplicationService implements ApplicationService {
    private final AppRepository appRepository;

    public ScheduledApplicationService() {
        this.appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    }

    public void pushApplicationStatusUpdates(
            JobExecutionContext context, AppRunRecord runRecord, boolean update) {
        JobDataMap dataMap = context.getJobDetail().getJobDataMap();
        if (dataMap.containsKey(SCHEDULED_APP_RUN_EXTENSION)) {
            // Update the Run Record in Data Map
            dataMap.put(SCHEDULED_APP_RUN_EXTENSION, JsonUtils.pojoToJson(runRecord));

            // Push Updates to the Database
            String appName = (String) context.getJobDetail().getJobDataMap().get(APP_NAME);
            UUID appId = appRepository.findByName(appName, Include.ALL).getId();
            if (update) {
                appRepository.updateAppStatus(appId, runRecord);
            } else {
                appRepository.addAppStatus(appId, runRecord);
            }
        }
    }
}
