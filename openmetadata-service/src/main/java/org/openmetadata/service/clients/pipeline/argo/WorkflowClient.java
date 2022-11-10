package org.openmetadata.service.clients.pipeline.argo;

import static org.openmetadata.service.clients.pipeline.PipelineServiceClient.SERVER_VERSION;
import static org.openmetadata.service.clients.pipeline.WorkflowConfigBuilder.buildOMWorkflowConfig;
import static org.openmetadata.service.clients.pipeline.WorkflowConfigBuilder.stringifiedOMWorkflowConfig;

import io.argoproj.workflow.ApiClient;
import io.argoproj.workflow.Configuration;
import io.argoproj.workflow.auth.ApiKeyAuth;
import io.argoproj.workflow.models.IoArgoprojWorkflowV1alpha1CronWorkflow;
import io.argoproj.workflow.models.IoArgoprojWorkflowV1alpha1CronWorkflowSpec;
import io.argoproj.workflow.models.IoArgoprojWorkflowV1alpha1Template;
import io.argoproj.workflow.models.IoArgoprojWorkflowV1alpha1WorkflowSpec;
import io.kubernetes.client.openapi.models.V1Container;
import io.kubernetes.client.openapi.models.V1EnvVar;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import java.io.IOException;
import java.util.List;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;

public class WorkflowClient {

  public final ApiClient client;
  public final String host;
  public final String namespace;

  public static final String INGESTION_ENTRYPOINT = "openmetadata-ingestion";
  public static final String INGESTION_IMAGE = "openmetadata/ingestion-base:" + SERVER_VERSION;

  public WorkflowClient(String host, String token, String namespace) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();

    defaultClient.setBasePath(host);
    // https://github.com/open-metadata/OpenMetadata/issues/8588
    defaultClient.setVerifyingSsl(false); // we don't have any local SSL. Tune it accordingly

    // Configure API key authorization: BearerToken
    ApiKeyAuth BearerToken = (ApiKeyAuth) defaultClient.getAuthentication("BearerToken");

    // Store the token as an env var or change it here
    BearerToken.setApiKey(token);
    BearerToken.setApiKeyPrefix("Bearer");

    this.client = defaultClient;
    this.host = host;
    this.namespace = namespace;
  }

  /*
  The CRON Workflow is the Argo Entity that will be deployed. It's the object that we will interact
  in any operation from the PipelineServiceClient.
   */
  public IoArgoprojWorkflowV1alpha1CronWorkflow buildCronWorkflow(IngestionPipeline ingestionPipeline)
      throws IOException {

    String lowerCaseName = ingestionPipeline.getName().toLowerCase().replace("_", "-");

    IoArgoprojWorkflowV1alpha1CronWorkflow cronWorkflow = new IoArgoprojWorkflowV1alpha1CronWorkflow();
    cronWorkflow.setKind("CronWorkflow");
    cronWorkflow.setApiVersion("argoproj.io/v1alpha1");
    cronWorkflow.setMetadata(new V1ObjectMeta().generateName(lowerCaseName + "-").name(lowerCaseName));

    cronWorkflow.setSpec(
        new IoArgoprojWorkflowV1alpha1CronWorkflowSpec()
            .schedule(ingestionPipeline.getAirflowConfig().getScheduleInterval())
            .workflowSpec(buildWorkflowSpec(ingestionPipeline)));

    return cronWorkflow;
  }

  /*
  In the Spec is where we set all the important information:
      - Image
      - Command
      - Arguments
  Then a Workflow is just a wrapper on the Spec, and a CronWorkflow just a wrapper on the Workflow.

  Here we'll put all the logic on how to build the right arguments.
  This is the place where we set the affinity as well.
  TODO: pick up affinity from ArgoConfig. No Affinity by default.
   */
  public IoArgoprojWorkflowV1alpha1WorkflowSpec buildWorkflowSpec(IngestionPipeline ingestionPipeline)
      throws IOException {
    return new IoArgoprojWorkflowV1alpha1WorkflowSpec()
        .entrypoint(INGESTION_ENTRYPOINT) // just a name pointer to the template
        .templates(
            List.of(
                new IoArgoprojWorkflowV1alpha1Template()
                    .name(INGESTION_ENTRYPOINT)
                    .container(
                        new V1Container()
                            .image(INGESTION_IMAGE)
                            .command(List.of("python", "main.py"))
                            .args(List.of())
                            .env(setIngestionEnv(ingestionPipeline)))));
  }

  /*
  Main logic transforming an IngestionPipeline to its YAML representation
   */
  public List<V1EnvVar> setIngestionEnv(IngestionPipeline ingestionPipeline) throws IOException {
    V1EnvVar pipelineTypeEnv = new V1EnvVar().name("pipelineType").value(ingestionPipeline.getPipelineType().value());
    V1EnvVar config =
        new V1EnvVar().name("config").value(stringifiedOMWorkflowConfig(buildOMWorkflowConfig(ingestionPipeline)));
    return List.of(pipelineTypeEnv, config);
  }
}
