package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
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
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.FlowableListener;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.governance.workflows.WorkflowScheduleRunIdSetterListener;
import org.openmetadata.service.governance.workflows.elements.TriggerInterface;
import org.openmetadata.service.governance.workflows.elements.triggers.impl.CommitChangeEventOffsetImpl;
import org.openmetadata.service.governance.workflows.elements.triggers.impl.FetchChangeEventsImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.CallActivityBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FlowableListenerBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.MultiInstanceLoopCharacteristicsBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.quartz.CronTrigger;

@Slf4j
public class PeriodicBatchEntityTrigger implements TriggerInterface {
  private final List<Process> processes = new ArrayList<>();

  @Getter private final String triggerWorkflowId;
  private final boolean singleExecutionMode;
  private final String resolvedWorkflowFqn;
  public static final String HAS_FINISHED_VARIABLE = "hasFinished";

  // Number of MainWorkflow CallActivities to run concurrently per fetch iteration.
  // Governance workflows run during live traffic, so this is kept at 2 to avoid saturating
  // the DB connection pool (each parallel batch uses ~2 connections: getEntitiesByLinks +
  // bulkUpdate). To increase throughput further, raise this value alongside the DB pool size.
  // This is intentionally a code-level constant rather than a config field to prevent
  // accidental over-provisioning by end users.
  static final int BATCH_PARALLELISM = 2;

  public PeriodicBatchEntityTrigger(
      String mainWorkflowName,
      String triggerWorkflowId,
      PeriodicBatchEntityTriggerDefinition triggerDefinition,
      boolean singleExecutionMode,
      String workflowFqn) {
    this.triggerWorkflowId = triggerWorkflowId;
    this.singleExecutionMode = singleExecutionMode;
    this.resolvedWorkflowFqn =
        (workflowFqn != null && !workflowFqn.isBlank()) ? workflowFqn : mainWorkflowName;
    List<String> entityTypes = getEntityTypesFromConfig(triggerDefinition.getConfig());

    for (String entityType : entityTypes) {
      String processId = String.format("%s-%s", triggerWorkflowId, entityType);
      Process process = new Process();
      process.setId(processId);
      process.setName(processId);
      attachScheduleRunIdListener(process);

      Optional<TimerEventDefinition> oTimerDefinition =
          Optional.ofNullable(getTimerEventDefinition(triggerDefinition.getConfig().getSchedule()));

      StartEvent startEvent =
          new StartEventBuilder().id(getFlowableElementId(processId, "startEvent")).build();
      startEvent.setAsynchronousLeave(true);
      oTimerDefinition.ifPresent(startEvent::addEventDefinition);
      process.addFlowElement(startEvent);

      CallActivity workflowTrigger =
          getWorkflowTriggerCallActivity(processId, mainWorkflowName, singleExecutionMode);
      process.addFlowElement(workflowTrigger);

      EndEvent endEvent =
          new EndEventBuilder().id(getFlowableElementId(processId, "endEvent")).build();
      process.addFlowElement(endEvent);

      ServiceTask fetchTask =
          getFetchChangeEventsTask(
              processId, entityType, triggerDefinition, resolvedWorkflowFqn, singleExecutionMode);
      process.addFlowElement(fetchTask);

      ServiceTask commitTask = getCommitOffsetTask(processId, entityType, resolvedWorkflowFqn);
      process.addFlowElement(commitTask);

      SequenceFlow finished = new SequenceFlow(fetchTask.getId(), commitTask.getId());
      finished.setConditionExpression(String.format("${%s}", HAS_FINISHED_VARIABLE));

      SequenceFlow notFinished = new SequenceFlow(fetchTask.getId(), workflowTrigger.getId());
      notFinished.setConditionExpression(String.format("${!%s}", HAS_FINISHED_VARIABLE));

      process.addFlowElement(new SequenceFlow(startEvent.getId(), fetchTask.getId()));
      process.addFlowElement(finished);
      process.addFlowElement(notFinished);
      process.addFlowElement(new SequenceFlow(workflowTrigger.getId(), fetchTask.getId()));
      process.addFlowElement(new SequenceFlow(commitTask.getId(), endEvent.getId()));

      processes.add(process);
    }
  }

  private void attachScheduleRunIdListener(Process process) {
    FlowableListener listener =
        new FlowableListenerBuilder()
            .event("start")
            .implementation(WorkflowScheduleRunIdSetterListener.class.getName())
            .build();
    process.getExecutionListeners().add(listener);
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

  private CallActivity getWorkflowTriggerCallActivity(
      String triggerWorkflowId, String mainWorkflowName, boolean singleExecution) {
    CallActivity workflowTrigger =
        new CallActivityBuilder()
            .id(getFlowableElementId(triggerWorkflowId, "workflowTrigger"))
            .calledElement(mainWorkflowName)
            .inheritBusinessKey(true)
            .build();

    IOParameter entityListParameter = new IOParameter();
    entityListParameter.setSource(ENTITY_LIST_VARIABLE);
    entityListParameter.setTarget(
        getNamespacedVariableName(GLOBAL_NAMESPACE, ENTITY_LIST_VARIABLE));

    IOParameter outputParameter = new IOParameter();
    outputParameter.setSource(getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE));
    outputParameter.setTarget(EXCEPTION_VARIABLE);

    IOParameter updatedByParameter = new IOParameter();
    updatedByParameter.setSource(getNamespacedVariableName(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE));
    updatedByParameter.setTarget(getNamespacedVariableName(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE));

    IOParameter scheduleRunIdParameter = new IOParameter();
    scheduleRunIdParameter.setSource(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE);
    scheduleRunIdParameter.setTarget(
        getNamespacedVariableName(GLOBAL_NAMESPACE, WORKFLOW_SCHEDULE_RUN_ID_VARIABLE));

    List<IOParameter> inParameters;
    if (singleExecution) {
      IOParameter relatedEntityParameter = new IOParameter();
      relatedEntityParameter.setSource(RELATED_ENTITY_VARIABLE);
      relatedEntityParameter.setTarget(
          getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE));

      MultiInstanceLoopCharacteristics multiInstance =
          new MultiInstanceLoopCharacteristicsBuilder()
              .loopCardinality("1")
              .inputDataItem(ENTITY_LIST_VARIABLE)
              .elementVariable(RELATED_ENTITY_VARIABLE)
              .build();
      workflowTrigger.setLoopCharacteristics(multiInstance);

      inParameters =
          List.of(
              relatedEntityParameter,
              entityListParameter,
              updatedByParameter,
              scheduleRunIdParameter);
    } else {
      // Parallel batch mode: FetchChangeEventsImpl produces a "batches" list of sub-lists,
      // one per BATCH_PARALLELISM slot. MultiInstance iterates over that collection, running
      // BATCH_PARALLELISM CallActivities concurrently. Each instance receives one sub-batch
      // as its entityList via the elementVariable → IOParameter mapping below.
      // All dedup and offset logic stays in the single-threaded fetch step, so there are
      // no races on processedFqns or the offset cursor across parallel instances.
      MultiInstanceLoopCharacteristics multiInstance =
          new MultiInstanceLoopCharacteristicsBuilder()
              .inputDataItem(FetchChangeEventsImpl.BATCHES_VARIABLE)
              .elementVariable(ENTITY_LIST_VARIABLE)
              .build();
      // sequential=false means all instances run in parallel via Flowable's job executor,
      // which already manages its own thread pool. We don't create additional thread pools
      // here to avoid the thread-count explosion seen in early SearchIndexingApplication designs.
      multiInstance.setSequential(false);
      workflowTrigger.setLoopCharacteristics(multiInstance);
      // Release the engine thread between parallel instances so other workflows and API
      // requests are not blocked during the batch processing window.
      workflowTrigger.setAsynchronousLeave(true);

      inParameters = List.of(entityListParameter, updatedByParameter, scheduleRunIdParameter);
    }

    workflowTrigger.setInParameters(inParameters);
    workflowTrigger.setOutParameters(List.of(outputParameter));

    return workflowTrigger;
  }

  private ServiceTask getFetchChangeEventsTask(
      String workflowTriggerId,
      String entityType,
      PeriodicBatchEntityTriggerDefinition triggerDefinition,
      String workflowFqn,
      boolean singleExecution) {
    FieldExtension entityTypesExpr =
        new FieldExtensionBuilder().fieldName("entityTypesExpr").fieldValue(entityType).build();

    FieldExtension batchSizeExpr =
        new FieldExtensionBuilder()
            .fieldName("batchSizeExpr")
            .fieldValue(String.valueOf(triggerDefinition.getConfig().getBatchSize()))
            .build();

    FieldExtension workflowFqnExpr =
        new FieldExtensionBuilder().fieldName("workflowFqnExpr").fieldValue(workflowFqn).build();

    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(workflowTriggerId, "fetchChangeEventsTask"))
            .implementation(FetchChangeEventsImpl.class.getName())
            .addFieldExtension(entityTypesExpr)
            .addFieldExtension(batchSizeExpr)
            .addFieldExtension(workflowFqnExpr)
            .build();

    Object filters = triggerDefinition.getConfig().getFilters();
    if (filters != null) {
      String filtersJson =
          filters instanceof String ? (String) filters : JsonUtils.pojoToJson(filters);
      FieldExtension searchFilterExpr =
          new FieldExtensionBuilder().fieldName("searchFilterExpr").fieldValue(filtersJson).build();
      serviceTask.getFieldExtensions().add(searchFilterExpr);
    }

    if (!singleExecution) {
      // Tell FetchChangeEventsImpl to fetch BATCH_PARALLELISM * batchSize records and split
      // them into sub-batches. Not injected for singleExecution mode because that path uses
      // per-entity MultiInstance (one entity per CallActivity) and has no concept of sub-batches.
      FieldExtension parallelismExpr =
          new FieldExtensionBuilder()
              .fieldName("parallelismExpr")
              .fieldValue(String.valueOf(BATCH_PARALLELISM))
              .build();
      serviceTask.getFieldExtensions().add(parallelismExpr);
    }

    serviceTask.setAsynchronousLeave(true);

    return serviceTask;
  }

  private ServiceTask getCommitOffsetTask(
      String workflowTriggerId, String entityType, String workflowFqn) {
    FieldExtension workflowFqnExpr =
        new FieldExtensionBuilder().fieldName("workflowFqnExpr").fieldValue(workflowFqn).build();

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
