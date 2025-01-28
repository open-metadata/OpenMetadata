package org.openmetadata.service.events.scheduled;

import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;

public interface ConsumerService {
  PipelineServiceClientResponse runAutomationWorkflow(Workflow wf);
}
