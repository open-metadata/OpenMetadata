/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.Signal;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.repository.ProcessDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.Event;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.BatchExecutionPlan;
import org.openmetadata.service.governance.workflows.GitSinkEntityTypeRule;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.elements.TriggerFactory;
import org.openmetadata.service.governance.workflows.elements.triggers.EventBasedEntityTrigger;
import org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger;

/**
 * The deployment changes of v2.1.0 a stored sink workflow receives only once it is redeployed, as
 * {@link RedeployReason}s: batch execution of the nodes of a workflow run once per batch, and a
 * Git-sink trigger deployed without query entities.
 */
final class SinkWorkflowDeployments {
  private static final Set<String> QUERY_SIGNAL_IDS =
      Arrays.stream(Event.values())
          .map(event -> EventBasedEntityTrigger.getEntitySignalId(Entity.QUERY, event.toString()))
          .collect(Collectors.toUnmodifiableSet());

  private SinkWorkflowDeployments() {}

  /**
   * A workflow run once per batch whose deployed nodes do not handle the whole batch yet, read from
   * the Flowable deployments.
   */
  static RedeployReason batchExecution() {
    return batchExecution(SinkWorkflowDeployments::latestDeployedModel);
  }

  /**
   * A workflow run once per batch whose deployed main process, as {@code deployedModel} returns it
   * by workflow name, has no batch fields. An undeployed workflow is left to its next deployment.
   */
  static RedeployReason batchExecution(Function<String, Optional<BpmnModel>> deployedModel) {
    return new RedeployReason(
        SinkWorkflowDeployments::expectsBatchExecutionFields,
        definition ->
            deployedModel
                .apply(definition.getName())
                .filter(model -> !hasBatchExecutionFields(model))
                .isPresent());
  }

  /**
   * A Git-sink workflow listing query whose deployed trigger still fetches or receives queries,
   * read from the Flowable deployments.
   */
  static RedeployReason queryTrigger() {
    return queryTrigger(SinkWorkflowDeployments::latestTriggerProcesses);
  }

  /**
   * A Git-sink workflow listing query one of whose trigger processes, as {@code deployedProcesses}
   * returns them by trigger workflow id, starts for query entities.
   */
  static RedeployReason queryTrigger(Function<String, List<DeployedProcess>> deployedProcesses) {
    return new RedeployReason(
        GitSinkEntityTypeRule::syncsQueriesToGit,
        definition -> {
          String triggerWorkflowId =
              TriggerFactory.getTriggerWorkflowId(definition.getFullyQualifiedName());
          return deployedProcesses.apply(triggerWorkflowId).stream()
              .anyMatch(deployed -> triggersQueries(triggerWorkflowId, deployed));
        });
  }

  /**
   * Whether a deployment of {@code definition} carries batch fields: it runs once per batch and has
   * nodes that handle the whole batch. A definition without such nodes deploys as it did before.
   */
  static boolean expectsBatchExecutionFields(WorkflowDefinition definition) {
    BatchExecutionPlan plan = BatchExecutionPlan.of(definition);
    return plan.isActive()
        && listOrEmpty(definition.getNodes()).stream()
            .anyMatch(node -> plan.modeFor(node.getName()).batch());
  }

  /** Whether any service task of the model, in a subprocess or not, runs on the whole batch. */
  static boolean hasBatchExecutionFields(BpmnModel model) {
    return model.getProcesses().stream()
        .flatMap(process -> process.findFlowElementsOfType(ServiceTask.class, true).stream())
        .flatMap(serviceTask -> serviceTask.getFieldExtensions().stream())
        .anyMatch(field -> BatchExecutionPlan.BATCH_EXECUTION_FIELD.equals(field.getFieldName()));
  }

  /**
   * Whether a deployed trigger process starts for query entities: the periodic-batch process that
   * fetches them, or an event-based process with a start signal for a query event.
   */
  static boolean triggersQueries(String triggerWorkflowId, DeployedProcess deployed) {
    return PeriodicBatchEntityTrigger.getTriggerProcessKey(triggerWorkflowId, Entity.QUERY)
            .equals(deployed.key())
        || deployed.model().get().getSignals().stream()
            .map(Signal::getId)
            .anyMatch(QUERY_SIGNAL_IDS::contains);
  }

  /** The latest deployed model of the process {@code processKey}, if it is deployed. */
  static Optional<BpmnModel> latestDeployedModel(String processKey) {
    RepositoryService repositoryService = WorkflowHandler.getInstance().getRepositoryService();
    return Optional.ofNullable(
            repositoryService
                .createProcessDefinitionQuery()
                .processDefinitionKey(processKey)
                .latestVersion()
                .singleResult())
        .map(deployed -> repositoryService.getBpmnModel(deployed.getId()));
  }

  /**
   * The processes of the latest trigger deployment only: a periodic-batch process an earlier
   * deployment made for an entity type stays in Flowable after a redeploy that drops the type.
   */
  private static List<DeployedProcess> latestTriggerProcesses(String triggerWorkflowId) {
    RepositoryService repositoryService = WorkflowHandler.getInstance().getRepositoryService();
    return repositoryService
        .createDeploymentQuery()
        .deploymentName(triggerWorkflowId)
        .orderByDeploymentTime()
        .desc()
        .listPage(0, 1)
        .stream()
        .flatMap(
            deployment ->
                repositoryService
                    .createProcessDefinitionQuery()
                    .deploymentId(deployment.getId())
                    .list()
                    .stream())
        .map(deployed -> DeployedProcess.of(repositoryService, deployed))
        .toList();
  }

  /** A deployed process by key; its model is read only when the key alone does not decide. */
  record DeployedProcess(String key, Supplier<BpmnModel> model) {
    private static DeployedProcess of(
        RepositoryService repositoryService, ProcessDefinition processDefinition) {
      return new DeployedProcess(
          processDefinition.getKey(),
          () -> repositoryService.getBpmnModel(processDefinition.getId()));
    }
  }
}
