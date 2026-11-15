package org.openmetadata.service.apps;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.app.App;
import org.quartz.InterruptableJob;
import org.quartz.JobExecutionContext;

public interface NativeApplication extends InterruptableJob {
  void init(App app);

  void install(String installedBy);

  void uninstall();

  void triggerOnDemand();

  void triggerOnDemand(Map<String, Object> config);

  default Set<String> getRuntimeTriggerParameters() {
    return Set.of();
  }

  default AppTrigger prepareTrigger(Map<String, Object> config) {
    return new AppTrigger(List.of(), () -> triggerOnDemand(config));
  }

  void configure();

  void cleanup();

  void raiseNotEnabledMessage(App app);

  default void startApp(JobExecutionContext jobExecutionContext) {}
}
