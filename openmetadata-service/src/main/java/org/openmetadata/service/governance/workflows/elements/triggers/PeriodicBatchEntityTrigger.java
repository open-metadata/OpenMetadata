package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import lombok.Getter;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.EventSubProcess;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.IntermediateCatchEvent;
import org.flowable.bpmn.model.Message;
import org.flowable.bpmn.model.MessageEventDefinition;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.TimerEventDefinition;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.governance.workflows.elements.nodes.trigger.PeriodicBatchEntityTriggerDefinition;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.governance.workflows.elements.TriggerInterface;
import org.openmetadata.service.governance.workflows.elements.triggers.impl.TriggerBatchEntityWorkflowImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.quartz.CronTrigger;

import java.util.ArrayList;
import java.util.List;

public class PeriodicBatchEntityTrigger implements TriggerInterface {
  private final Process process;

  @Getter private final String triggerWorkflowId;

  public PeriodicBatchEntityTrigger(
      String mainWorkflowName,
      String triggerWorkflowId,
      PeriodicBatchEntityTriggerDefinition triggerDefinition) {
    Process process = new Process();
    process.setId(triggerWorkflowId);
    process.setName(triggerWorkflowId);
    attachWorkflowInstanceListeners(process);

    TimerEventDefinition timerDefinition =
        getTimerEventDefinition(triggerDefinition.getConfig().getSchedule());

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(triggerWorkflowId, "startEvent")).build();
    startEvent.addEventDefinition(timerDefinition);
    process.addFlowElement(startEvent);

    ServiceTask workflowTriggerTask =
        getWorkflowTriggerTask(triggerWorkflowId, mainWorkflowName, triggerDefinition);
    process.addFlowElement(workflowTriggerTask);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(triggerWorkflowId, "endEvent")).build();
    process.addFlowElement(endEvent);

    process.addFlowElement(new SequenceFlow(startEvent.getId(), workflowTriggerTask.getId()));
    process.addFlowElement(new SequenceFlow(workflowTriggerTask.getId(), endEvent.getId()));

    this.process = process;
    this.triggerWorkflowId = triggerWorkflowId;
  }

  private TimerEventDefinition getTimerEventDefinition(AppSchedule schedule) {
    // TODO: Using the AppScheduler logic to craft a Flowable compatible Cron Expression. Eventually
    // we should probably avoid this to be dependent that code.
    CronTrigger cronTrigger = (CronTrigger) AppScheduler.getCronSchedule(schedule).build();

    TimerEventDefinition timerDefinition = new TimerEventDefinition();
    timerDefinition.setTimeCycle(cronTrigger.getCronExpression());
    return timerDefinition;
  }

  private ServiceTask getWorkflowTriggerTask(
      String workflowTriggerId,
      String mainWorkflowName,
      PeriodicBatchEntityTriggerDefinition triggerDefinition) {
    FieldExtension entityTypeExpr =
        new FieldExtensionBuilder()
            .fieldName("entityTypeExpr")
            .fieldValue(triggerDefinition.getConfig().getEntityType())
            .build();

    FieldExtension searchFilterExpr =
        new FieldExtensionBuilder()
            .fieldName("searchFilterExpr")
            .fieldValue(triggerDefinition.getConfig().getFilters())
            .build();

    FieldExtension workflowNameExpr =
        new FieldExtensionBuilder()
            .fieldName("workflowNameExpr")
            .fieldValue(mainWorkflowName)
            .build();

    FieldExtension batchSizeExpr =
        new FieldExtensionBuilder()
            .fieldName("batchSizeExpr")
            .fieldValue(String.valueOf(triggerDefinition.getConfig().getBatchSize()))
            .build();

    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(workflowTriggerId, "workflowTrigger"))
            .implementation(TriggerBatchEntityWorkflowImpl.class.getName())
            .build();

    serviceTask.getFieldExtensions().add(entityTypeExpr);
    serviceTask.getFieldExtensions().add(searchFilterExpr);
    serviceTask.getFieldExtensions().add(workflowNameExpr);
    serviceTask.getFieldExtensions().add(batchSizeExpr);

    return serviceTask;
  }

  @Override
  public void addToWorkflow(BpmnModel model) {
    model.addProcess(process);
  }
}
