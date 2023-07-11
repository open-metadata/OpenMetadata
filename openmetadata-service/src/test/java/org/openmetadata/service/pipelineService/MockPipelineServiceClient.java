package org.openmetadata.service.pipelineService;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.Status;
import org.openmetadata.sdk.PipelineServiceClient;

public class MockPipelineServiceClient extends PipelineServiceClient {

  public MockPipelineServiceClient(PipelineServiceClientConfiguration pipelineServiceClientConfiguration) {
    super(pipelineServiceClientConfiguration);
  }

  @Override
  public Status getServiceStatus() {
    return null;
  }

  @Override
  public Status runAutomationsWorkflow(Workflow workflow) {
    return null;
  }

  @Override
  public Status deployPipeline(IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    return null;
  }

  @Override
  public Status runPipeline(IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    return null;
  }

  @Override
  public Status deletePipeline(IngestionPipeline ingestionPipeline) {
    return null;
  }

  @Override
  public List<PipelineStatus> getQueuedPipelineStatus(IngestionPipeline ingestionPipeline) {
    return null;
  }

  @Override
  public Status toggleIngestion(IngestionPipeline ingestionPipeline) {
    return null;
  }

  @Override
  public Map<String, String> getLastIngestionLogs(IngestionPipeline ingestionPipeline, String after) {
    return null;
  }

  @Override
  public Status killIngestion(IngestionPipeline ingestionPipeline) {
    return null;
  }

  @Override
  public Map<String, String> requestGetHostIp() {
    return null;
  }
}
