package org.openmetadata.service.events.scheduled;

import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.util.DIContainer;

public class ConsumerServiceImpl implements ConsumerService {
  private final DIContainer di;

  public ConsumerServiceImpl(DIContainer diContainer) {
    di = diContainer;
  }

  @Override
  public PipelineServiceClientResponse runAutomationWorkflow(Workflow wf) {
    return di.getResource(PipelineServiceClientInterface.class).runAutomationsWorkflow(wf);
  }
}
