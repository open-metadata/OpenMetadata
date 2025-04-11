package org.openmetadata.service.apps;

import org.openmetadata.schema.entity.app.App;
import org.quartz.InterruptableJob;
import org.quartz.JobExecutionContext;

public interface NativeApplication extends InterruptableJob {
  void init(App app);

  void install(String installedBy);

  void triggerOnDemand();

  void configure();

  void cleanup();

  void raisePreviewMessage(App app);

  default void startApp(JobExecutionContext jobExecutionContext) {}
}
