package org.openmetadata.service.governance.workflows.elements;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.flowable.bpmn.model.BaseElement;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.validation.ProcessValidatorFactory;
import org.flowable.validation.ValidationError;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;

/** A Git-sink workflow's trigger is deployed without the query entity type. */
class TriggerQueryExclusionTest {

  private static final String WORKFLOW =
      """
      {"name": "syncWorkflow", "fullyQualifiedName": "syncWorkflow",
       "trigger": %s,
       "nodes": [
         {"name": "start", "displayName": "start", "type": "startEvent", "subType": "startEvent"},
         {"name": "sink", "displayName": "sink", "type": "automatedTask", "subType": "sinkTask",
          "config": {"sinkType": "%s", "sinkConfig": {"repositoryUrl": "https://github.com/o/r.git"}}},
         {"name": "end", "displayName": "end", "type": "endEvent", "subType": "endEvent"}
       ],
       "edges": [{"from": "start", "to": "sink"}, {"from": "sink", "to": "end"}]}""";

  private static final String PERIODIC_TRIGGER =
      """
      {"type": "periodicBatchEntity",
       "config": {"entityTypes": ["table", "query"], "schedule": {"scheduleTimeline": "None"},
                  "filters": "{}"}}""";

  private static final String EVENT_TRIGGER =
      """
      {"type": "eventBasedEntity",
       "config": {"entityTypes": ["table", "query"], "events": ["Created", "Updated"]}}""";

  @Test
  void periodicTriggerOfAGitSinkHasNoQueryProcess() {
    assertEquals(
        List.of("syncWorkflowTrigger-table"), processIds(triggerModel(PERIODIC_TRIGGER, "git")));
  }

  @Test
  void periodicTriggerOfAWebhookSinkKeepsItsQueryProcess() {
    assertEquals(
        List.of("syncWorkflowTrigger-table", "syncWorkflowTrigger-query"),
        processIds(triggerModel(PERIODIC_TRIGGER, "webhook")));
  }

  @Test
  void eventTriggerOfAGitSinkHasNoQuerySignal() {
    assertEquals(
        Set.of("table-entityCreated", "table-entityUpdated"),
        signalIds(triggerModel(EVENT_TRIGGER, "git")));
  }

  @Test
  void eventTriggerOfAWebhookSinkKeepsItsQuerySignals() {
    assertEquals(
        Set.of(
            "table-entityCreated",
            "table-entityUpdated",
            "query-entityCreated",
            "query-entityUpdated"),
        signalIds(triggerModel(EVENT_TRIGGER, "webhook")));
  }

  @Test
  void aGitSinkTriggerListingOnlyQueriesStillDeploys() {
    String periodicQueriesOnly = PERIODIC_TRIGGER.replace("\"table\", ", "");
    String eventQueriesOnly = EVENT_TRIGGER.replace("\"table\", ", "");

    BpmnModel periodic = triggerModel(periodicQueriesOnly, "git");
    BpmnModel eventBased = triggerModel(eventQueriesOnly, "git");

    assertEquals(List.of(), deployErrors(periodic));
    assertEquals(List.of("syncWorkflowTrigger"), processIds(periodic));
    assertEquals(List.of(), deployErrors(eventBased));
    assertEquals(Set.of(), signalIds(eventBased));
  }

  private static List<String> deployErrors(BpmnModel model) {
    return new ProcessValidatorFactory()
        .createDefaultProcessValidator().validate(model).stream()
            .filter(error -> !error.isWarning())
            .map(ValidationError::toString)
            .toList();
  }

  private static BpmnModel triggerModel(String trigger, String sinkType) {
    WorkflowDefinition workflow =
        JsonUtils.readValue(WORKFLOW.formatted(trigger, sinkType), WorkflowDefinition.class);
    BpmnModel model = new BpmnModel();
    TriggerFactory.createTrigger(workflow).addToWorkflow(model);
    return model;
  }

  private static List<String> processIds(BpmnModel model) {
    return model.getProcesses().stream().map(BaseElement::getId).toList();
  }

  private static Set<String> signalIds(BpmnModel model) {
    return model.getSignals().stream().map(BaseElement::getId).collect(Collectors.toSet());
  }
}
