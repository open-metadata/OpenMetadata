package org.openmetadata.service.pipelineServiceClient.argo;

import java.net.URL;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response;

import io.argoproj.workflow.ApiClient;
import org.openmetadata.schema.api.configuration.argo.ArgoConfiguration;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.service.pipelineServiceClient.PipelineServiceClient;
import org.openmetadata.service.pipelineServiceClient.PipelineServiceClientConfiguration;

public class ArgoServiceClient extends PipelineServiceClient {

  protected final URL serviceURL;
  protected final String token;
  protected final String namespace;
  protected final WorkflowClient workflowClient;

  public ArgoServiceClient(
      PipelineServiceClientConfiguration pipelineServiceClientConfiguration, ArgoConfiguration argoConfig, String clusterName) {
    super(pipelineServiceClientConfiguration);

    this.serviceURL = validateServiceURL(argoConfig.getApiEndpoint());
    this.token = argoConfig.getToken();
    // k8s namespace will be the same as the cluster name to ensure uni
    this.namespace = clusterName;

    this.workflowClient = new WorkflowClient(this.serviceURL.toString(), this.token, this.namespace);
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
