package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.CallActivity;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.ErrorEventDefinition;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.IOParameter;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.Signal;
import org.flowable.bpmn.model.SignalEventDefinition;
import org.flowable.bpmn.model.StartEvent;
import org.openmetadata.schema.governance.workflows.elements.triggers.Config;
import org.openmetadata.schema.governance.workflows.elements.triggers.Event;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.TriggerInterface;
import org.openmetadata.service.governance.workflows.elements.triggers.impl.FilterEntityImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.CallActivityBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SignalBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;

@Slf4j
public class EventBasedEntityTrigger implements TriggerInterface {
  private final Process process;
  @Getter private final String triggerWorkflowId;
  private final List<StartEvent> startEvents = new ArrayList<>();
  private final List<Signal> signals = new ArrayList<>();

  public static String PASSES_FILTER_VARIABLE = "passesFilter";

  private final EventBasedEntityTriggerDefinition triggerDefinition;

  public EventBasedEntityTrigger(
      String mainWorkflowName,
      String triggerWorkflowId,
      EventBasedEntityTriggerDefinition triggerDefinition) {
    this.triggerDefinition = triggerDefinition;
    Process process = new Process();
    process.setId(triggerWorkflowId);
    process.setName(triggerWorkflowId);
    attachWorkflowInstanceListeners(process);

    setStartEvents(triggerWorkflowId, triggerDefinition);

    ServiceTask filterTask = getFilterTask(triggerWorkflowId, triggerDefinition);
    process.addFlowElement(filterTask);

    CallActivity workflowTrigger =
        getWorkflowTrigger(triggerWorkflowId, mainWorkflowName, triggerDefinition.getOutput());
    process.addFlowElement(workflowTrigger);

    ErrorEventDefinition runtimeExceptionDefinition = new ErrorEventDefinition();
    runtimeExceptionDefinition.setErrorCode(WORKFLOW_RUNTIME_EXCEPTION);

    BoundaryEvent runtimeExceptionBoundaryEvent = new BoundaryEvent();
    runtimeExceptionBoundaryEvent.setId(
        getFlowableElementId(workflowTrigger.getId(), "runtimeExceptionBoundaryEvent"));
    runtimeExceptionBoundaryEvent.addEventDefinition(runtimeExceptionDefinition);

    runtimeExceptionBoundaryEvent.setAttachedToRef(workflowTrigger);
    for (FlowableListener listener : getWorkflowInstanceListeners(List.of("end"))) {
      runtimeExceptionBoundaryEvent.getExecutionListeners().add(listener);
    }
    process.addFlowElement(runtimeExceptionBoundaryEvent);

    EndEvent errorEndEvent =
        new EndEventBuilder().id(getFlowableElementId(triggerWorkflowId, "errorEndEvent")).build();
    process.addFlowElement(errorEndEvent);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(triggerWorkflowId, "endEvent")).build();
    process.addFlowElement(endEvent);

    // Start Events -> FilterTask
    for (StartEvent startEvent : startEvents) {
      process.addFlowElement(startEvent);
      process.addFlowElement(new SequenceFlow(startEvent.getId(), filterTask.getId()));
    }

    SequenceFlow filterPassed = new SequenceFlow(filterTask.getId(), workflowTrigger.getId());
    filterPassed.setConditionExpression(String.format("${%s}", PASSES_FILTER_VARIABLE));

    SequenceFlow filterNotPassed = new SequenceFlow(filterTask.getId(), endEvent.getId());
    filterNotPassed.setConditionExpression(String.format("${!%s}", PASSES_FILTER_VARIABLE));

    // FilterTask -> WorkflowTrigger (if passes filter)
    process.addFlowElement(filterPassed);
    // FilterTask -> End (if not passes filter)
    process.addFlowElement(filterNotPassed);
    // WorkflowTrigger -> End
    process.addFlowElement(new SequenceFlow(workflowTrigger.getId(), endEvent.getId()));
    process.addFlowElement(
        new SequenceFlow(runtimeExceptionBoundaryEvent.getId(), errorEndEvent.getId()));

    this.process = process;
    this.triggerWorkflowId = triggerWorkflowId;
  }

  private void setStartEvents(
      String workflowTriggerId, EventBasedEntityTriggerDefinition triggerDefinition) {

    List<String> entityTypes = getEntityTypesFromConfig(triggerDefinition.getConfig());
    Set<Event> events = triggerDefinition.getConfig().getEvents();

    for (String entityType : entityTypes) {
      for (Event event : events) {

        String eventId = event.toString(); // or event.getName()
        String signalId = getEntitySignalId(entityType, eventId);

        Signal signal = new SignalBuilder().id(signalId).build();

        SignalEventDefinition signalEventDefinition = new SignalEventDefinition();
        signalEventDefinition.setSignalRef(signal.getId());

        // Create start event with proper ID
        String startEventId =
            getFlowableElementId(
                workflowTriggerId, String.format("%s-%s-%s", entityType, eventId, "start"));

        StartEvent startEvent = new StartEventBuilder().id(startEventId).build();

        startEvent.getEventDefinitions().add(signalEventDefinition);

        this.startEvents.add(startEvent);
        this.signals.add(signal);
      }
    }
  }

  /**
   * Helper method to get entity types from trigger configuration.
   * Supports both legacy single entityType and new multiple entityTypes.
   *
   * Uses JsonUtils to convert config Object to Map for safe field access
   * instead of risky reflection-based approach.
   *
   * @param configObj The trigger configuration object
   * @return List of entity types to monitor
   */
  private List<String> getEntityTypesFromConfig(Object configObj) {
    // Convert config object to Map for safe field access - NO REFLECTION!
    Map<String, Object> configMap = JsonUtils.getMap(configObj);

    // Try new entityTypes array first (preferred approach)
    @SuppressWarnings("unchecked")
    List<String> entityTypes = (List<String>) configMap.get("entityTypes");
    if (entityTypes != null && !entityTypes.isEmpty()) {
      return entityTypes;
    }

    // Fall back to legacy single entityType (backward compatibility)
    String entityType = (String) configMap.get("entityType");
    if (entityType != null && !entityType.isEmpty()) {
      return List.of(entityType);
    }

    // Should not happen due to schema validation, but defensive programming
    throw new IllegalArgumentException(
        "Neither 'entityType' nor 'entityTypes' found in workflow trigger configuration. "
            + "At least one must be specified.");
  }

  private CallActivity getWorkflowTrigger(
      String triggerWorkflowId, String mainWorkflowName, Set<String> triggerOutputs) {
    CallActivity workflowTrigger =
        new CallActivityBuilder()
            .id(getFlowableElementId(triggerWorkflowId, "workflowTrigger"))
            .calledElement(mainWorkflowName)
            .inheritBusinessKey(true)
            .build();

    List<IOParameter> inputParameters = new ArrayList<>();

    // ALWAYS pass relatedEntity for backward compatibility
    IOParameter relatedEntityParam = new IOParameter();
    relatedEntityParam.setSource(
        getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE));
    relatedEntityParam.setTarget(
        getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE));
    inputParameters.add(relatedEntityParam);

    // Dynamically add any additional outputs declared in trigger - Eg updatedBy in
    // GlossaryTermApprovalWorkflow
    for (String triggerOutput : triggerOutputs) {
      if (!RELATED_ENTITY_VARIABLE.equals(
          triggerOutput)) { // Skip relatedEntity (already added above)
        IOParameter inputParameter = new IOParameter();
        inputParameter.setSource(getNamespacedVariableName(GLOBAL_NAMESPACE, triggerOutput));
        inputParameter.setTarget(getNamespacedVariableName(GLOBAL_NAMESPACE, triggerOutput));
        inputParameters.add(inputParameter);
      }
    }

    IOParameter outputParameter = new IOParameter();
    outputParameter.setSource(getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE));
    outputParameter.setTarget(getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE));

    workflowTrigger.setInParameters(inputParameters);
    workflowTrigger.setOutParameters(List.of(outputParameter));

    return workflowTrigger;
  }

  private ServiceTask getFilterTask(
      String workflowTriggerId, EventBasedEntityTriggerDefinition triggerDefinition) {

    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(workflowTriggerId, "filterTask"))
            .implementation(FilterEntityImpl.class.getName())
            .build();

    Config triggerConfig = triggerDefinition.getConfig();

    if (triggerConfig != null) {
      if (triggerConfig.getExclude() != null && !triggerConfig.getExclude().isEmpty()) {
        FieldExtension excludedFilterExpr =
            new FieldExtensionBuilder()
                .fieldName("excludedFieldsExpr")
                .fieldValue(JsonUtils.pojoToJson(triggerDefinition.getConfig().getExclude()))
                .build();
        serviceTask.getFieldExtensions().add(excludedFilterExpr);
      }
      if (triggerConfig.getFilter() != null && !triggerConfig.getFilter().trim().isEmpty()) {
        // Use JSON Logic path
        FieldExtension filterExpr =
            new FieldExtensionBuilder()
                .fieldName("filterExpr")
                .fieldValue(JsonUtils.pojoToJson(triggerConfig.getFilter()))
                .build();
        serviceTask.getFieldExtensions().add(filterExpr);
      }
    }

    return serviceTask;
  }

  private String getEntitySignalId(String entityType, String event) {
    return String.format("%s-entity%s", entityType, event);
  }

  @Override
  public void addToWorkflow(BpmnModel model) {
    model.addProcess(process);
    for (Signal signal : signals) {
      model.addSignal(signal);
    }
  }
}
