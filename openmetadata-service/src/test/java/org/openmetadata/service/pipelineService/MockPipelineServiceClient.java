package org.openmetadata.service.pipelineService;

import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
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
  public HttpResponse<String> testConnection(TestServiceConnection testServiceConnection) {
    return null;
  }

  @Override
  public String deployPipeline(IngestionPipeline ingestionPipeline) {
    return null;
  }

  @Override
  public String runPipeline(IngestionPipeline ingestionPipeline) {
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
  public HttpResponse<String> killIngestion(IngestionPipeline ingestionPipeline) {
    return null;
  }

  @Override
  public Map<String, String> requestGetHostIp() {
    return null;
  }
}
