package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.policyAgent;

import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

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
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.PolicyAgentTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.policyAgent.impl.RunAllPolicyAgentsDelegate;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;

public class PolicyAgentTask implements NodeInterface {

  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;

  public PolicyAgentTask(PolicyAgentTaskDefinition nodeDefinition, WorkflowConfiguration config) {
    String subProcessId = nodeDefinition.getName();

    SubProcess subProcess =
        new SubProcessBuilder().id(subProcessId).setAsync(true).exclusive(true).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask runAllTask =
        buildRunAllPolicyAgentsTask(
            subProcessId,
            nodeDefinition.getConfig().getWaitForCompletion(),
            nodeDefinition.getConfig().getTimeoutSeconds(),
            JsonUtils.pojoToJson(nodeDefinition.getInputNamespaceMap()));

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(runAllTask);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), runAllTask.getId()));
    subProcess.addFlowElement(new SequenceFlow(runAllTask.getId(), endEvent.getId()));

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

  @Override
  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
  }

  private ServiceTask buildRunAllPolicyAgentsTask(
      String subProcessId,
      boolean waitForCompletion,
      long timeoutSeconds,
      String inputNamespaceMap) {
    FieldExtension inputNamespaceMapExpr =
        new FieldExtensionBuilder()
            .fieldName("inputNamespaceMapExpr")
            .fieldValue(inputNamespaceMap)
            .build();

    FieldExtension pipelineServiceClientExpr =
        new FieldExtensionBuilder()
            .fieldName("pipelineServiceClientExpr")
            .expression("${PipelineServiceClient}")
            .build();

    FieldExtension waitExpr =
        new FieldExtensionBuilder()
            .fieldName("waitForCompletionExpr")
            .fieldValue(String.valueOf(waitForCompletion))
            .build();

    FieldExtension timeoutExpr =
        new FieldExtensionBuilder()
            .fieldName("timeoutSecondsExpr")
            .fieldValue(String.valueOf(timeoutSeconds))
            .build();

    return new ServiceTaskBuilder()
        .id(getFlowableElementId(subProcessId, "runAllPolicyAgents"))
        .implementation(RunAllPolicyAgentsDelegate.class.getName())
        .addFieldExtension(inputNamespaceMapExpr)
        .addFieldExtension(pipelineServiceClientExpr)
        .addFieldExtension(waitExpr)
        .addFieldExtension(timeoutExpr)
        .setAsync(true)
        .exclusive(true)
        .build();
  }
}
