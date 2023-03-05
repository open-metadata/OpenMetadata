package org.openmetadata.service.pipelineService;

import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.operations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.operations.Workflow;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.sdk.PipelineServiceClient;

public class MockPipelineServiceClient extends PipelineServiceClient {

  public MockPipelineServiceClient(PipelineServiceClientConfiguration pipelineServiceClientConfiguration) {
    super(pipelineServiceClientConfiguration);
  }

  @Override
  public Response getServiceStatus() {
    return null;
  }

  @Override
  public Response testConnection(TestServiceConnectionRequest testServiceConnection) {
    return null;
  }

  @Override
  public Response runOperationsWorkflow(Workflow workflow) {
    return null;
  }

  @Override
  public String deployPipeline(IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    return null;
  }

  @Override
  public String runPipeline(IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    return null;
  }

  @Override
  public String deletePipeline(IngestionPipeline ingestionPipeline) {
    return null;
  }

  @Override
  public List<PipelineStatus> getQueuedPipelineStatus(IngestionPipeline ingestionPipeline) {
    return null;
  }

  @Override
  public IngestionPipeline toggleIngestion(IngestionPipeline ingestionPipeline) {
    return null;
  }

  @Override
  public Map<String, String> getLastIngestionLogs(IngestionPipeline ingestionPipeline, String after) {
    return null;
  }

  @Override
  public Response killIngestion(IngestionPipeline ingestionPipeline) {
    return null;
  }

  @Override
  public Map<String, String> requestGetHostIp() {
    return null;
  }
}
