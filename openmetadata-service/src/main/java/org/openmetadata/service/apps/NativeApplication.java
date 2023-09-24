package org.openmetadata.service.apps;

import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.Application;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.quartz.Job;
import org.quartz.JobExecutionContext;

public interface NativeApplication extends Job {
  void init(Application app, CollectionDAO dao);

  void triggerOnDemand(Object requestObj);

  void schedule(AppSchedule appSchedule);

  default void doExecute(JobExecutionContext jobExecutionContext) {}
}
