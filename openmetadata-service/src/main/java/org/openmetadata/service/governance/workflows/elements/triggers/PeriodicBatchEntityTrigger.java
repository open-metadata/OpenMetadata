package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_SCHEDULE_RUN_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.CallActivity;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.ExclusiveGateway;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.IOParameter;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.TimerEventDefinition;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.governance.workflows.elements.triggers.PeriodicBatchEntityTriggerDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.governance.workflows.WorkflowScheduleRunIdSetterListener;
import org.openmetadata.service.governance.workflows.elements.TriggerInterface;
import org.openmetadata.service.governance.workflows.elements.triggers.impl.CommitChangeEventOffsetImpl;
import org.openmetadata.service.governance.workflows.elements.triggers.impl.FetchChangeEventsImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.CallActivityBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ExclusiveGatewayBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FlowableListenerBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.quartz.CronTrigger;

@Slf4j
public class PeriodicBatchEntityTrigger implements TriggerInterface {
  private final List<Process> processes = new ArrayList<>();

  @Getter private final String triggerWorkflowId;
  public static final String HAS_FINISHED_VARIABLE = "hasFinished";
  private static final String NUMBER_OF_ENTITIES_VARIABLE = "numberOfEntities";

  private record TriggerProcessContext(
      String processId,
      String mainWorkflowName,
      PeriodicBatchEntityTriggerDefinition triggerDefinition,
      String entityType,
      String workflowFqn) {}

  private record LoopElements(
      String startEventId,
      String fetchTaskId,
      String loopGatewayId,
      String workflowTriggerId,
      String commitTaskId,
      String endEventId) {}

  public PeriodicBatchEntityTrigger(
      String mainWorkflowName,
      String triggerWorkflowId,
      PeriodicBatchEntityTriggerDefinition triggerDefinition,
      String workflowFqn) {
    this.triggerWorkflowId = triggerWorkflowId;
    for (String entityType : getEntityTypesFromConfig(triggerDefinition.getConfig())) {
      String processId = String.format("%s-%s", triggerWorkflowId, entityType);
      TriggerProcessContext ctx =
          new TriggerProcessContext(
              processId, mainWorkflowName, triggerDefinition, entityType, workflowFqn);
      processes.add(buildTriggerProcess(ctx));
    }
  }

  private Process buildTriggerProcess(TriggerProcessContext ctx) {
    Process process = buildProcessShell(ctx.processId());
    StartEvent startEvent = buildStartEvent(ctx);
    ExclusiveGateway loopGateway = buildLoopGateway(ctx.processId());
    CallActivity workflowTrigger = buildCallActivity(ctx.processId(), ctx.mainWorkflowName());
    ServiceTask fetchTask = buildFetchTask(ctx);
    ServiceTask commitTask = buildCommitTask(ctx.processId(), ctx.entityType(), ctx.workflowFqn());
    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(ctx.processId(), "endEvent")).build();
    for (org.flowable.bpmn.model.FlowElement element :
        List.of(startEvent, loopGateway, workflowTrigger, fetchTask, commitTask, endEvent)) {
      process.addFlowElement(element);
    }
    wireSequenceFlows(
        process,
        new LoopElements(
            startEvent.getId(),
            fetchTask.getId(),
            loopGateway.getId(),
            workflowTrigger.getId(),
            commitTask.getId(),
            endEvent.getId()));
    return process;
  }

  private Process buildProcessShell(String processId) {
    Process process = new Process();
    process.setId(processId);
    process.setName(processId);
    attachScheduleRunIdListener(process);
    return process;
  }

  private void attachScheduleRunIdListener(Process process) {
    FlowableListener listener =
        new FlowableListenerBuilder()
            .event("start")
            .implementation(WorkflowScheduleRunIdSetterListener.class.getName())
            .build();
    process.getExecutionListeners().add(listener);
  }

  private StartEvent buildStartEvent(TriggerProcessContext ctx) {
    Optional<TimerEventDefinition> oTimer =
        Optional.ofNullable(
            getTimerEventDefinition(ctx.triggerDefinition().getConfig().getSchedule()));
    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(ctx.processId(), "startEvent")).build();
    startEvent.setAsynchronousLeave(true);
    oTimer.ifPresent(startEvent::addEventDefinition);
    return startEvent;
  }

  private ExclusiveGateway buildLoopGateway(String processId) {
    return new ExclusiveGatewayBuilder().id(getFlowableElementId(processId, "loopGateway")).build();
  }

  private void wireSequenceFlows(Process process, LoopElements ids) {
    process.addFlowElement(new SequenceFlow(ids.startEventId(), ids.fetchTaskId()));
    process.addFlowElement(new SequenceFlow(ids.fetchTaskId(), ids.loopGatewayId()));
    SequenceFlow toCommit = new SequenceFlow(ids.loopGatewayId(), ids.commitTaskId());
    toCommit.setConditionExpression(String.format("${%s}", HAS_FINISHED_VARIABLE));
    SequenceFlow toTrigger = new SequenceFlow(ids.loopGatewayId(), ids.workflowTriggerId());
    toTrigger.setConditionExpression(
        String.format("${!%s && %s > 0}", HAS_FINISHED_VARIABLE, NUMBER_OF_ENTITIES_VARIABLE));
    SequenceFlow loopBack = new SequenceFlow(ids.loopGatewayId(), ids.fetchTaskId());
    loopBack.setConditionExpression(
        String.format("${!%s && %s == 0}", HAS_FINISHED_VARIABLE, NUMBER_OF_ENTITIES_VARIABLE));
    process.addFlowElement(toCommit);
    process.addFlowElement(toTrigger);
    process.addFlowElement(loopBack);
    process.addFlowElement(new SequenceFlow(ids.workflowTriggerId(), ids.fetchTaskId()));
    process.addFlowElement(new SequenceFlow(ids.commitTaskId(), ids.endEventId()));
  }

  private CallActivity buildCallActivity(String triggerWorkflowId, String mainWorkflowName) {
    CallActivity workflowTrigger =
        new CallActivityBuilder()
            .id(getFlowableElementId(triggerWorkflowId, "workflowTrigger"))
            .calledElement(mainWorkflowName)
            .inheritBusinessKey(true)
            .build();
    workflowTrigger.setInParameters(buildInParameters());
    workflowTrigger.setOutParameters(buildOutParameters());
    return workflowTrigger;
  }

  private List<IOParameter> buildInParameters() {
    IOParameter entityListParameter = new IOParameter();
    entityListParameter.setSource(ENTITY_LIST_VARIABLE);
    entityListParameter.setTarget(
        getNamespacedVariableName(GLOBAL_NAMESPACE, ENTITY_LIST_VARIABLE));

    IOParameter scheduleRunIdParameter = new IOParameter();
    scheduleRunIdParameter.setSource(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE);
    scheduleRunIdParameter.setTarget(
        getNamespacedVariableName(GLOBAL_NAMESPACE, WORKFLOW_SCHEDULE_RUN_ID_VARIABLE));

    IOParameter updatedByParameter = new IOParameter();
    updatedByParameter.setSource(getNamespacedVariableName(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE));
    updatedByParameter.setTarget(getNamespacedVariableName(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE));

    return List.of(entityListParameter, scheduleRunIdParameter, updatedByParameter);
  }

  private List<IOParameter> buildOutParameters() {
    IOParameter outputParameter = new IOParameter();
    outputParameter.setSource(getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE));
    outputParameter.setTarget(EXCEPTION_VARIABLE);
    return List.of(outputParameter);
  }

  private ServiceTask buildFetchTask(TriggerProcessContext ctx) {
    FieldExtension entityTypesExpr =
        new FieldExtensionBuilder()
            .fieldName("entityTypesExpr")
            .fieldValue(ctx.entityType())
            .build();
    FieldExtension batchSizeExpr =
        new FieldExtensionBuilder()
            .fieldName("batchSizeExpr")
            .fieldValue(String.valueOf(ctx.triggerDefinition().getConfig().getBatchSize()))
            .build();
    FieldExtension workflowFqnExpr =
        new FieldExtensionBuilder()
            .fieldName("workflowFqnExpr")
            .fieldValue(ctx.workflowFqn() != null ? ctx.workflowFqn() : "")
            .build();
    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(ctx.processId(), "fetchChangeEventsTask"))
            .implementation(FetchChangeEventsImpl.class.getName())
            .build();
    serviceTask.getFieldExtensions().add(entityTypesExpr);
    serviceTask.getFieldExtensions().add(batchSizeExpr);
    serviceTask.getFieldExtensions().add(workflowFqnExpr);
    addSearchFilterIfPresent(serviceTask, ctx.triggerDefinition());
    serviceTask.setAsynchronousLeave(true);
    return serviceTask;
  }

  private void addSearchFilterIfPresent(
      ServiceTask serviceTask, PeriodicBatchEntityTriggerDefinition triggerDefinition) {
    Object filters = triggerDefinition.getConfig().getFilters();
    if (filters == null) {
      return;
    }
    String filtersJson =
        filters instanceof String ? (String) filters : JsonUtils.pojoToJson(filters);
    FieldExtension searchFilterExpr =
        new FieldExtensionBuilder().fieldName("searchFilterExpr").fieldValue(filtersJson).build();
    serviceTask.getFieldExtensions().add(searchFilterExpr);
  }

  private ServiceTask buildCommitTask(
      String workflowTriggerId, String entityType, String workflowFqn) {
    FieldExtension workflowFqnExpr =
        new FieldExtensionBuilder()
            .fieldName("workflowFqnExpr")
            .fieldValue(workflowFqn != null ? workflowFqn : "")
            .build();
    FieldExtension entityTypeExpr =
        new FieldExtensionBuilder().fieldName("entityTypeExpr").fieldValue(entityType).build();
    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(workflowTriggerId, "commitOffsetTask"))
            .implementation(CommitChangeEventOffsetImpl.class.getName())
            .build();
    serviceTask.getFieldExtensions().add(workflowFqnExpr);
    serviceTask.getFieldExtensions().add(entityTypeExpr);
    return serviceTask;
  }

  private TimerEventDefinition getTimerEventDefinition(AppSchedule schedule) {
    if (schedule.getScheduleTimeline().equals(ScheduleTimeline.NONE)) {
      return null;
    }
    CronTrigger cronTrigger = (CronTrigger) AppScheduler.getCronSchedule(schedule).build();
    TimerEventDefinition timerDefinition = new TimerEventDefinition();
    timerDefinition.setTimeCycle(cronTrigger.getCronExpression());
    return timerDefinition;
  }

  private List<String> getEntityTypesFromConfig(Object configObj) {
    Map<String, Object> configMap = JsonUtils.getMap(configObj);
    @SuppressWarnings("unchecked")
    List<String> entityTypes = (List<String>) configMap.get("entityTypes");
    if (entityTypes != null && !entityTypes.isEmpty()) {
      return entityTypes;
    }
    LOG.debug("No entityTypes found in workflow trigger configuration, returning empty list");
    return new ArrayList<>();
  }

  @Override
  public void addToWorkflow(BpmnModel model) {
    for (Process process : processes) {
      model.addProcess(process);
    }
  }
}
