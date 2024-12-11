package org.openmetadata.service.apps.bundles.retentionPolicyApp;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.applications.configuration.internal.RetentionPolicyConfiguration;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.SchedulerException;

@Slf4j
public class RetentionPolicyApp extends AbstractNativeApplication {
  public RetentionPolicyApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void install() {
    super.install();
    App app = getApp();
    RetentionPolicyScheduler instance = RetentionPolicyScheduler.getInstance();
    RetentionPolicyConfiguration retentionPolicyConfiguration =
        JsonUtils.convertValue(app.getAppConfiguration(), RetentionPolicyConfiguration.class);
    instance.scheduleCleanupJob(retentionPolicyConfiguration);
  }

  @Override
  public void cleanup() {
    try {
      RetentionPolicyScheduler.getInstance().deleteAllRetentionPolicyJobs();
    } catch (SchedulerException e) {
      throw new RuntimeException(e);
    }
  }
}
