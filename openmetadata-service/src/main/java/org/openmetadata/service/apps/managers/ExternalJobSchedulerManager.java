package org.openmetadata.service.apps.managers;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.ServiceAppConfiguration;
import org.openmetadata.service.exception.EntityNotFoundException;

@Slf4j
public class ExternalJobSchedulerManager {

  private final InstallManager installManager;
  private final JobAppConfigUpdater configUpdater;

  public ExternalJobSchedulerManager(
      InstallManager installManager, JobAppConfigUpdater configUpdater) {
    this.installManager = installManager;
    this.configUpdater = configUpdater;
  }

  public void scheduleExternalApp(App app, String installedBy) {
    Map<String, Object> config = configUpdater.getAppConfiguration(app);

    try {
      installManager.bindExistingIngestionToApplication(app);
      configUpdater.updateAppConfig(app, config, installedBy);
    } catch (EntityNotFoundException ex) {
      installManager.createAndBindIngestionPipeline(app, config);
    }
  }

  public void scheduleExternalServiceApp(
      App app, ServiceAppConfiguration serviceConfig, String installedBy) {
    String serviceId = serviceConfig.getServiceRef().getId().toString();
    String pipelineName = String.format("%s_%s", app.getName(), serviceId);
    Map<String, Object> config = configUpdater.getServiceAppConfiguration(serviceConfig);

    try {
      installManager.bindExistingServiceIngestionToApplication(app, pipelineName);
      configUpdater.updateServiceAppConfig(pipelineName, config, installedBy);
    } catch (EntityNotFoundException ex) {
      installManager.createAndBindServiceIngestionPipeline(app, serviceConfig, config);
    }
  }
}
