package org.openmetadata.service.apps;

import java.util.Map;
import org.openmetadata.schema.entity.app.App;
import org.quartz.InterruptableJob;
import org.quartz.JobExecutionContext;

public interface NativeApplication extends InterruptableJob {
  void init(App app);

  void install(String installedBy);

  void uninstall();

  void triggerOnDemand();

  void triggerOnDemand(Map<String, Object> config);

  void configure();

  void cleanup();

  void raisePreviewMessage(App app);

  default void startApp(JobExecutionContext jobExecutionContext) {}
}
