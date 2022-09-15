package org.openmetadata.service.pipelineService;

import java.net.http.HttpResponse;
import java.util.Map;
import javax.ws.rs.core.Response;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.service.util.PipelineServiceClient;

public class MockPipelineServiceClient extends PipelineServiceClient {

  public MockPipelineServiceClient(
      String userName, String password, String apiEndpoint, String hostIp, int apiTimeout) {
    super(userName, password, apiEndpoint, hostIp, apiTimeout);
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
  public String runPipeline(String pipelineName) {
    return null;
  }

  @Override
  public String deletePipeline(String pipelineName) {
    return null;
  }

  @Override
  public IngestionPipeline getPipelineStatus(IngestionPipeline ingestionPipeline) {
    return null;
  }

  @Override
  public IngestionPipeline toggleIngestion(IngestionPipeline ingestionPipeline) {
    return null;
  }

  @Override
  public Map<String, String> getLastIngestionLogs(IngestionPipeline ingestionPipeline) {
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
