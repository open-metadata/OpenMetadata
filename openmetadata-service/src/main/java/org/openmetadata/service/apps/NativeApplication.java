package org.openmetadata.service.apps;

import java.util.Map;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.quartz.InterruptableJob;
import org.quartz.JobExecutionContext;

public interface NativeApplication extends InterruptableJob {
  void init(App app);

  App install(String installedBy);

  void uninstall(String uninstalledBy);

  default void triggerOnDemand() {
    triggerOnDemand(null, Map.of());
  }

  void triggerOnDemand(AppSchedule schedule, Map<String, Object> config);

  void configure();

  void raisePreviewMessage(App app);

  default void startApp(JobExecutionContext jobExecutionContext) {}
}
