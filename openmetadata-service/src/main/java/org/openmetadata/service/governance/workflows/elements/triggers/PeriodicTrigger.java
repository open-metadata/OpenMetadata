package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.Getter;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.CallActivity;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.IOParameter;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.TimerEventDefinition;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.governance.workflows.elements.nodes.trigger.PeriodicTriggerDefinition;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.governance.workflows.elements.TriggerInterface;
import org.openmetadata.service.governance.workflows.elements.triggers.impl.SetProcessVariableImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.CallActivityBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.CronTrigger;

public class PeriodicTrigger implements TriggerInterface {
  private final Process process;
  @Getter private final String triggerWorkflowId;

  public PeriodicTrigger(
      String mainWorkflowName,
      String triggerWorkflowId,
      PeriodicTriggerDefinition triggerDefinition) {
    Process process = new Process();
    process.setId(triggerWorkflowId);
    process.setName(triggerWorkflowId);
    attachWorkflowInstanceListeners(process);

    Optional<TimerEventDefinition> oTimerDefinition =
        Optional.ofNullable(getTimerEventDefinition(triggerDefinition.getConfig().getSchedule()));

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(triggerWorkflowId, "startEvent")).build();
    startEvent.setAsynchronousLeave(true);
    oTimerDefinition.ifPresent(startEvent::addEventDefinition);
    process.addFlowElement(startEvent);

    ServiceTask setVariables =
        getSetVariablesTask(triggerWorkflowId, triggerDefinition.getConfig().getVariables());
    process.addFlowElement(setVariables);

    CallActivity workflowTrigger =
        getWorkflowTriggerCallActivity(triggerWorkflowId, mainWorkflowName);
    process.addFlowElement(workflowTrigger);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(triggerWorkflowId, "endEvent")).build();
    process.addFlowElement(endEvent);

    process.addFlowElement(new SequenceFlow(startEvent.getId(), setVariables.getId()));
    process.addFlowElement(new SequenceFlow(setVariables.getId(), workflowTrigger.getId()));
    process.addFlowElement(new SequenceFlow(workflowTrigger.getId(), endEvent.getId()));

    this.process = process;
    this.triggerWorkflowId = triggerWorkflowId;
  }

  private TimerEventDefinition getTimerEventDefinition(AppSchedule schedule) {
    if (schedule.getScheduleTimeline().equals(ScheduleTimeline.NONE)) {
      return null;
    }

    // TODO: Using the AppScheduler logic to craft a Flowable compatible Cron Expression. Eventually
    // we should probably avoid this to be dependent that code.
    CronTrigger cronTrigger = (CronTrigger) AppScheduler.getCronSchedule(schedule).build();

    TimerEventDefinition timerDefinition = new TimerEventDefinition();
    timerDefinition.setTimeCycle(cronTrigger.getCronExpression());
    return timerDefinition;
  }

  private ServiceTask getSetVariablesTask(String triggerWorkflowId, Map<String, Object> variables) {
    FieldExtension varNameExpr =
        new FieldExtensionBuilder().fieldName("varNameExpr").fieldValue("variables").build();

    FieldExtension varValueExpr =
        new FieldExtensionBuilder()
            .fieldName("varValueExpr")
            .fieldValue(JsonUtils.pojoToJson(variables))
            .build();

    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(triggerWorkflowId, "setVariables"))
            .implementation(SetProcessVariableImpl.class.getName())
            .build();
    serviceTask.getFieldExtensions().add(varNameExpr);
    serviceTask.getFieldExtensions().add(varValueExpr);
    return serviceTask;
  }

  private CallActivity getWorkflowTriggerCallActivity(
      String triggerWorkflowId, String mainWorkflowName) {
    CallActivity workflowTrigger =
        new CallActivityBuilder()
            .id(getFlowableElementId(triggerWorkflowId, "workflowTrigger"))
            .calledElement(mainWorkflowName)
            .inheritBusinessKey(true)
            .build();

    IOParameter inputParameter = new IOParameter();
    inputParameter.setSource("variables");
    inputParameter.setTarget("variables");

    IOParameter outputParameter = new IOParameter();
    outputParameter.setSource(EXCEPTION_VARIABLE);
    outputParameter.setTarget(EXCEPTION_VARIABLE);

    workflowTrigger.setInParameters(List.of(inputParameter));
    workflowTrigger.setOutParameters(List.of(outputParameter));

    return workflowTrigger;
  }

  @Override
  public void addToWorkflow(BpmnModel model) {
    model.addProcess(process);
  }
}
