package org.openmetadata.service.apps.managers;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.ServiceAppConfiguration;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.util.AppBoundConfigurationUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class JobAppConfigUpdater {

  private static final String SERVICE_NAME = "OpenMetadata";

  public Map<String, Object> getAppConfiguration(App app) {
    return JsonUtils.getMap(AppBoundConfigurationUtil.getAppConfiguration(app));
  }

  public Map<String, Object> getServiceAppConfiguration(ServiceAppConfiguration serviceConfig) {
    return JsonUtils.getMap(serviceConfig.getAppConfiguration());
  }

  public void updateAppConfig(App app, Map<String, Object> appConfiguration, String updatedBy) {
    IngestionPipelineRepository repository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    String fqn = FullyQualifiedName.add(SERVICE_NAME, app.getName());
    IngestionPipeline updated = repository.findByName(fqn, Include.NON_DELETED);
    ApplicationPipeline appPipeline =
        JsonUtils.convertValue(updated.getSourceConfig().getConfig(), ApplicationPipeline.class);
    IngestionPipeline original = JsonUtils.deepCopy(updated, IngestionPipeline.class);
    updated.setSourceConfig(
        updated.getSourceConfig().withConfig(appPipeline.withAppConfig(appConfiguration)));
    repository.update(null, original, updated, updatedBy);
  }

  public void updateServiceAppConfig(
      String pipelineName, Map<String, Object> appConfiguration, String updatedBy) {
    IngestionPipelineRepository repository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    String fqn = FullyQualifiedName.add(SERVICE_NAME, pipelineName);
    IngestionPipeline updated = repository.findByName(fqn, Include.NON_DELETED);
    ApplicationPipeline appPipeline =
        JsonUtils.convertValue(updated.getSourceConfig().getConfig(), ApplicationPipeline.class);
    IngestionPipeline original = JsonUtils.deepCopy(updated, IngestionPipeline.class);
    updated.setSourceConfig(
        updated.getSourceConfig().withConfig(appPipeline.withAppConfig(appConfiguration)));
    repository.update(null, original, updated, updatedBy);
  }
}
