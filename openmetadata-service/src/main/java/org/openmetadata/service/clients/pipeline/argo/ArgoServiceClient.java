package org.openmetadata.service.clients.pipeline.argo;

import com.fasterxml.jackson.core.JsonProcessingException;
import io.argoproj.workflow.ApiException;
import io.argoproj.workflow.apis.CronWorkflowServiceApi;
import io.argoproj.workflow.models.IoArgoprojWorkflowV1alpha1CreateCronWorkflowRequest;
import io.argoproj.workflow.models.IoArgoprojWorkflowV1alpha1CronWorkflow;
import java.io.IOException;
import java.net.URL;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response;
import org.openmetadata.schema.api.configuration.argo.ArgoConfiguration;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.service.exception.PipelineServiceClientException;
import org.openmetadata.service.clients.pipeline.PipelineServiceClient;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientConfiguration;

public class ArgoServiceClient extends PipelineServiceClient {

  protected final URL serviceURL;
  protected final String token;
  protected final String namespace;
  protected final WorkflowClient workflowClient;
  protected final CronWorkflowServiceApi apiInstance;

  public ArgoServiceClient(
      PipelineServiceClientConfiguration pipelineServiceClientConfiguration,
      ArgoConfiguration argoConfig,
      String clusterName) {
    super(pipelineServiceClientConfiguration);

    this.serviceURL = validateServiceURL(argoConfig.getApiEndpoint());
    this.token = argoConfig.getToken();
    // k8s namespace will be the same as the cluster name to ensure uni
    this.namespace = clusterName;

    this.workflowClient =
        new WorkflowClient(this.serviceURL.toString(), this.token, this.namespace);
    this.apiInstance = new CronWorkflowServiceApi(this.workflowClient.client);
  }

  @Override
  public Response getServiceStatus() {
    return Response.status(Response.Status.OK).build();
  }

  @Override
  public HttpResponse<String> testConnection(TestServiceConnection testServiceConnection) {
    return null;
  }

  @Override
  public String deployPipeline(IngestionPipeline ingestionPipeline) {
    try {

      // https://github.com/open-metadata/OpenMetadata/issues/8587
      IoArgoprojWorkflowV1alpha1CronWorkflow cronWorkflow =
          this.workflowClient.buildCronWorkflow(ingestionPipeline);

      IoArgoprojWorkflowV1alpha1CreateCronWorkflowRequest cronWorkflowCreateRequest =
          new IoArgoprojWorkflowV1alpha1CreateCronWorkflowRequest();
      cronWorkflowCreateRequest.setCronWorkflow(cronWorkflow);
      cronWorkflowCreateRequest.setNamespace(this.workflowClient.namespace);

      IoArgoprojWorkflowV1alpha1CronWorkflow result =
          this.apiInstance.cronWorkflowServiceCreateCronWorkflow(
              this.workflowClient.namespace, cronWorkflowCreateRequest);

      return result.toString();

    } catch (JsonProcessingException e) {
      throw new PipelineServiceClientException(
          String.format(
              "%s Failed to build Ingestion Workflow due to %s",
              ingestionPipeline.getName(), e.getMessage()));
    } catch (ApiException e) {
      throw new PipelineServiceClientException(
          String.format(
              "%s Failed to deploy Ingestion Workflow due to %s",
              ingestionPipeline.getName(), e.getMessage()));
    } catch (IOException e) {
      throw new PipelineServiceClientException(
          String.format(
              "%s Failed retrieving the service %s - %s",
              ingestionPipeline.getName(),
              ingestionPipeline.getService().getName(),
              e.getMessage()));
    }
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
  public Map<String, String> getLastIngestionLogs(
      IngestionPipeline ingestionPipeline, String after) {
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
