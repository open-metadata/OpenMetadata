package org.openmetadata.service.apps;

import org.openmetadata.schema.entity.app.App;
import org.quartz.Job;
import org.quartz.JobExecutionContext;

public interface NativeApplication extends Job {
  void init(App app);

  void install();

  void triggerOnDemand();

  void configure();

  void raisePreviewMessage(App app);

  default void startApp(JobExecutionContext jobExecutionContext) {}
}
