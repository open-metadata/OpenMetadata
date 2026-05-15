package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.policyAgent.impl;

import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;

/**
 * Finds the admin-created {@code policyAgent} IngestionPipeline for a given service.
 *
 * <p>The admin is expected to pre-create exactly one POLICY_AGENT pipeline per service. If
 * multiple exist the first one found is used; if none exist the service requires manual access
 * grant.
 */
@Slf4j
public final class PolicyAgentPipelineFinder {

  private PolicyAgentPipelineFinder() {}

  public static Optional<IngestionPipeline> find(
      IngestionPipelineRepository repository, ServiceEntityInterface service) {
    for (String pipelineJson : repository.listAllByParentFqn(service.getFullyQualifiedName())) {
      IngestionPipeline pipeline =
          JsonUtils.readOrConvertValue(pipelineJson, IngestionPipeline.class);
      if (PipelineType.POLICY_AGENT.equals(pipeline.getPipelineType())) {
        pipeline.setService(service.getEntityReference());
        LOG.debug(
            "[PolicyAgent] Found pipeline '{}' for service '{}'",
            pipeline.getDisplayName(),
            service.getName());
        return Optional.of(pipeline);
      }
    }
    LOG.info("[PolicyAgent] No POLICY_AGENT pipeline found for service '{}'", service.getName());
    return Optional.empty();
  }
}
