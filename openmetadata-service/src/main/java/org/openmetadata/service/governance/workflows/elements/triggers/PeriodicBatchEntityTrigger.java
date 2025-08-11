package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.List;
import java.util.Optional;
import lombok.Getter;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.CallActivity;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.IOParameter;
import org.flowable.bpmn.model.MultiInstanceLoopCharacteristics;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.TimerEventDefinition;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.governance.workflows.elements.triggers.PeriodicBatchEntityTriggerDefinition;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.governance.workflows.elements.TriggerInterface;
import org.openmetadata.service.governance.workflows.elements.triggers.impl.FetchEntitiesImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.CallActivityBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.MultiInstanceLoopCharacteristicsBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.quartz.CronTrigger;

public class PeriodicBatchEntityTrigger implements TriggerInterface {
  private final Process process;

  @Getter private final String triggerWorkflowId;
  public static String HAS_FINISHED_VARIABLE = "hasFinished";
  public static String CARDINALITY_VARIABLE = "numberOfEntities";
  public static String COLLECTION_VARIABLE = "entityList";

  public PeriodicBatchEntityTrigger(
      String mainWorkflowName,
      String triggerWorkflowId,
      PeriodicBatchEntityTriggerDefinition triggerDefinition) {
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

    ServiceTask fetchEntitiesTask = getFetchEntitiesTask(triggerWorkflowId, triggerDefinition);
    process.addFlowElement(fetchEntitiesTask);

    CallActivity workflowTrigger =
        getWorkflowTriggerCallActivity(triggerWorkflowId, mainWorkflowName);
    process.addFlowElement(workflowTrigger);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(triggerWorkflowId, "endEvent")).build();
    process.addFlowElement(endEvent);

    SequenceFlow finished = new SequenceFlow(fetchEntitiesTask.getId(), endEvent.getId());
    finished.setConditionExpression(String.format("${%s}", HAS_FINISHED_VARIABLE));

    SequenceFlow notFinished = new SequenceFlow(fetchEntitiesTask.getId(), workflowTrigger.getId());
    notFinished.setConditionExpression(String.format("${!%s}", HAS_FINISHED_VARIABLE));

    // Start -> Fetch Entities
    process.addFlowElement(new SequenceFlow(startEvent.getId(), fetchEntitiesTask.getId()));
    // Fetch Entities -> End
    process.addFlowElement(finished);
    // Fetch Entities -> WorkflowTrigger
    process.addFlowElement(notFinished);
    // WorkflowTrigger -> Fetch Entities (Loop Back to get next batch)
    process.addFlowElement(new SequenceFlow(workflowTrigger.getId(), fetchEntitiesTask.getId()));

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

  private CallActivity getWorkflowTriggerCallActivity(
      String triggerWorkflowId, String mainWorkflowName) {
    MultiInstanceLoopCharacteristics multiInstance =
        new MultiInstanceLoopCharacteristicsBuilder()
            .loopCardinality(String.format("${%s}", CARDINALITY_VARIABLE))
            .inputDataItem(COLLECTION_VARIABLE)
            .elementVariable(RELATED_ENTITY_VARIABLE)
            .build();

    CallActivity workflowTrigger =
        new CallActivityBuilder()
            .id(getFlowableElementId(triggerWorkflowId, "workflowTrigger"))
            .calledElement(mainWorkflowName)
            .inheritBusinessKey(true)
            .build();

    IOParameter inputParameter = new IOParameter();
    inputParameter.setSource(RELATED_ENTITY_VARIABLE);
    inputParameter.setTarget(getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE));

    IOParameter outputParameter = new IOParameter();
    outputParameter.setSource(getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE));
    outputParameter.setTarget(EXCEPTION_VARIABLE);

    workflowTrigger.setInParameters(List.of(inputParameter));
    workflowTrigger.setOutParameters(List.of(outputParameter));
    workflowTrigger.setLoopCharacteristics(multiInstance);

    return workflowTrigger;
  }

  private ServiceTask getFetchEntitiesTask(
      String workflowTriggerId, PeriodicBatchEntityTriggerDefinition triggerDefinition) {
    FieldExtension entityTypeExpr =
        new FieldExtensionBuilder()
            .fieldName("entityTypeExpr")
            .fieldValue(triggerDefinition.getConfig().getEntityType())
            .build();

    FieldExtension searchFilterExpr =
        new FieldExtensionBuilder(false)
            .fieldName("searchFilterExpr")
            .fieldValue(triggerDefinition.getConfig().getFilters())
            .build();

    FieldExtension batchSizeExpr =
        new FieldExtensionBuilder()
            .fieldName("batchSizeExpr")
            .fieldValue(String.valueOf(triggerDefinition.getConfig().getBatchSize()))
            .build();

    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(workflowTriggerId, "fetchEntityTask"))
            .implementation(FetchEntitiesImpl.class.getName())
            .build();

    serviceTask.getFieldExtensions().add(entityTypeExpr);
    serviceTask.getFieldExtensions().add(searchFilterExpr);
    serviceTask.getFieldExtensions().add(batchSizeExpr);

    serviceTask.setAsynchronousLeave(true);

    return serviceTask;
  }

  @Override
  public void addToWorkflow(BpmnModel model) {
    model.addProcess(process);
  }
}
