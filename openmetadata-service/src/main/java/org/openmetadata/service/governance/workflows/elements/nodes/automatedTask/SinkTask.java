/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import java.util.HashMap;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink.SinkTaskDelegate;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;

/**
 * Workflow node that pushes entity data to external sink destinations.
 *
 * <p>This node integrates with the sink provider registry to support multiple sink types such as
 * Git repositories, webhooks, and HTTP endpoints.
 */
public class SinkTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;

  public SinkTask(SinkTaskDefinition nodeDefinition, WorkflowConfiguration config) {
    String subProcessId = nodeDefinition.getName();

    SubProcess subProcess =
        new SubProcessBuilder().id(subProcessId).setAsync(true).exclusive(true).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask sinkTask = getSinkServiceTask(subProcessId, nodeDefinition);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(sinkTask);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), sinkTask.getId()));
    subProcess.addFlowElement(new SequenceFlow(sinkTask.getId(), endEvent.getId()));

    if (config.getStoreStageStatus()) {
      attachWorkflowInstanceStageListeners(subProcess);
    }

    this.runtimeExceptionBoundaryEvent =
        getRuntimeExceptionBoundaryEvent(subProcess, config.getStoreStageStatus());
    this.subProcess = subProcess;
  }

  @Override
  public BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return runtimeExceptionBoundaryEvent;
  }

  private ServiceTask getSinkServiceTask(String subProcessId, SinkTaskDefinition nodeDefinition) {
    var taskConfig = nodeDefinition.getConfig();

    FieldExtension sinkTypeExpr =
        new FieldExtensionBuilder()
            .fieldName("sinkTypeExpr")
            .fieldValue(taskConfig.getSinkType() != null ? taskConfig.getSinkType().value() : "")
            .build();

    FieldExtension sinkConfigExpr =
        new FieldExtensionBuilder()
            .fieldName("sinkConfigExpr")
            .fieldValue(
                taskConfig.getSinkConfig() != null
                    ? JsonUtils.pojoToJson(taskConfig.getSinkConfig())
                    : "{}")
            .build();

    FieldExtension syncModeExpr =
        new FieldExtensionBuilder()
            .fieldName("syncModeExpr")
            .fieldValue(
                taskConfig.getSyncMode() != null ? taskConfig.getSyncMode().value() : "overwrite")
            .build();

    FieldExtension outputFormatExpr =
        new FieldExtensionBuilder()
            .fieldName("outputFormatExpr")
            .fieldValue(
                taskConfig.getOutputFormat() != null
                    ? taskConfig.getOutputFormat().value()
                    : "yaml")
            .build();

    FieldExtension hierarchyConfigExpr =
        new FieldExtensionBuilder()
            .fieldName("hierarchyConfigExpr")
            .fieldValue(
                taskConfig.getHierarchyConfig() != null
                    ? JsonUtils.pojoToJson(taskConfig.getHierarchyConfig())
                    : "{}")
            .build();

    FieldExtension entityFilterExpr =
        new FieldExtensionBuilder()
            .fieldName("entityFilterExpr")
            .fieldValue(
                taskConfig.getEntityFilter() != null
                    ? JsonUtils.pojoToJson(taskConfig.getEntityFilter())
                    : "{}")
            .build();

    FieldExtension batchModeExpr =
        new FieldExtensionBuilder()
            .fieldName("batchModeExpr")
            .fieldValue(
                String.valueOf(
                    taskConfig.getBatchMode() != null ? taskConfig.getBatchMode() : true))
            .build();

    FieldExtension timeoutSecondsExpr =
        new FieldExtensionBuilder()
            .fieldName("timeoutSecondsExpr")
            .fieldValue(
                String.valueOf(
                    taskConfig.getTimeoutSeconds() != null ? taskConfig.getTimeoutSeconds() : 300))
            .build();

    FieldExtension inputNamespaceMapExpr =
        new FieldExtensionBuilder()
            .fieldName("inputNamespaceMapExpr")
            .fieldValue(
                JsonUtils.pojoToJson(
                    nodeDefinition.getInputNamespaceMap() != null
                        ? nodeDefinition.getInputNamespaceMap()
                        : new HashMap<>()))
            .build();

    return new ServiceTaskBuilder()
        .id(getFlowableElementId(subProcessId, "executeSink"))
        .implementation(SinkTaskDelegate.class.getName())
        .addFieldExtension(sinkTypeExpr)
        .addFieldExtension(sinkConfigExpr)
        .addFieldExtension(syncModeExpr)
        .addFieldExtension(outputFormatExpr)
        .addFieldExtension(hierarchyConfigExpr)
        .addFieldExtension(entityFilterExpr)
        .addFieldExtension(batchModeExpr)
        .addFieldExtension(timeoutSecondsExpr)
        .addFieldExtension(inputNamespaceMapExpr)
        .setAsync(true)
        .exclusive(true)
        .build();
  }

  @Override
  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
  }
}
