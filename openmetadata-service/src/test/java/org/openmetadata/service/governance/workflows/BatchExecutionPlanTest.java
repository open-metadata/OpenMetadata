package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.ServiceTask;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.BatchExecutionPlan.NodeMode;
import org.openmetadata.service.governance.workflows.flowable.MainWorkflow;

class BatchExecutionPlanTest {

  private static final String PERIODIC_TRIGGER =
      """
      {"type": "periodicBatchEntity",
       "config": {"entityTypes": ["table"], "schedule": {"scheduleTimeline": "None"},
                  "filters": {"table": "{}"}},
       "output": ["relatedEntity", "updatedBy"]}""";

  private static final String EVENT_TRIGGER =
      """
      {"type": "eventBasedEntity",
       "config": {"entityTypes": ["table"], "events": ["Created"]},
       "output": ["relatedEntity", "updatedBy"]}""";

  private static final String START = node("start", "startEvent", "startEvent", "");
  private static final String END = node("end", "endEvent", "endEvent", "");
  private static final String END_SKIPPED = node("skipped", "endEvent", "endEvent", "");
  private static final String SINK = sink("sink", true);
  private static final String CHECK =
      node(
          "checkTier",
          "automatedTask",
          "checkEntityAttributesTask",
          """
          , "config": {"rules": "{\\"==\\":[{\\"var\\":\\"description\\"},\\"gold\\"]}"},
            "inputNamespaceMap": {"relatedEntity": "global"}""");
  private static final String SET_ATTRIBUTE =
      node(
          "setDescription",
          "automatedTask",
          "setEntityAttributeTask",
          """
          , "config": {"fieldName": "description", "fieldValue": "synced"},
            "inputNamespaceMap": {"relatedEntity": "global"}""");

  @Test
  void conditionThatContinuesOnTrueNarrowsTheBatchToTrue() {
    BatchExecutionPlan plan =
        plan(
            PERIODIC_TRIGGER,
            List.of(START, CHECK, SINK, END, END_SKIPPED),
            """
            {"from": "start", "to": "checkTier"},
            {"from": "checkTier", "to": "sink", "condition": "true"},
            {"from": "checkTier", "to": "skipped", "condition": "false"},
            {"from": "sink", "to": "end"}""");

    assertTrue(plan.isActive());
    assertEquals(new NodeMode(true, "true"), plan.modeFor("checkTier"));
    assertEquals(NodeMode.PER_ENTITY, plan.modeFor("sink"));
    assertEquals(NodeMode.PER_ENTITY, plan.modeFor("start"));
  }

  @Test
  void conditionThatContinuesOnFalseNarrowsTheBatchToFalse() {
    BatchExecutionPlan plan =
        plan(
            PERIODIC_TRIGGER,
            List.of(START, CHECK, SET_ATTRIBUTE, SINK, END, END_SKIPPED),
            """
            {"from": "start", "to": "checkTier"},
            {"from": "checkTier", "to": "skipped", "condition": "true"},
            {"from": "checkTier", "to": "setDescription", "condition": "false"},
            {"from": "setDescription", "to": "sink"},
            {"from": "sink", "to": "end"}""");

    assertTrue(plan.isActive());
    assertEquals(new NodeMode(true, "false"), plan.modeFor("checkTier"));
    assertEquals(new NodeMode(true, null), plan.modeFor("setDescription"));
  }

  @Test
  void conditionWhoseBranchesAllEndHasNoContinuingOutcome() {
    BatchExecutionPlan plan =
        plan(
            PERIODIC_TRIGGER,
            List.of(START, SINK, CHECK, END, END_SKIPPED),
            """
            {"from": "start", "to": "sink"},
            {"from": "sink", "to": "checkTier"},
            {"from": "checkTier", "to": "end", "condition": "true"},
            {"from": "checkTier", "to": "skipped", "condition": "false"}""");

    assertTrue(plan.isActive());
    assertEquals(new NodeMode(true, null), plan.modeFor("checkTier"));
  }

  @Test
  void workflowThatRunsOncePerEntityKeepsEveryNodePerEntity() {
    String falseBranchToAction =
        """
        {"from": "start", "to": "checkTier"},
        {"from": "checkTier", "to": "sink", "condition": "true"},
        {"from": "checkTier", "to": "setDescription", "condition": "false"},
        {"from": "setDescription", "to": "end"},
        {"from": "sink", "to": "end"}""";
    List<String> nodes = List.of(START, CHECK, SET_ATTRIBUTE, SINK, END);

    BatchExecutionPlan eventBased = plan(EVENT_TRIGGER, nodes, falseBranchToAction);
    BatchExecutionPlan perEntitySink =
        plan(
            PERIODIC_TRIGGER,
            List.of(START, CHECK, SET_ATTRIBUTE, sink("sink", false), END),
            falseBranchToAction);

    for (BatchExecutionPlan plan : List.of(eventBased, perEntitySink)) {
      assertFalse(plan.runsOncePerBatch());
      assertFalse(plan.isActive());
      assertTrue(plan.violations().isEmpty());
      assertEquals(NodeMode.PER_ENTITY, plan.modeFor("checkTier"));
      assertEquals(NodeMode.PER_ENTITY, plan.modeFor("setDescription"));
    }
  }

  @Test
  void nodesThatCannotHandleABatchAreViolations() {
    String approval =
        node(
            "approve",
            "userTask",
            "userApprovalTask",
            """
            , "config": {"assignees": {"addReviewers": true}, "approvalThreshold": 1,
                         "rejectionThreshold": 1},
              "inputNamespaceMap": {"relatedEntity": "global"}""");
    String completeness =
        node(
            "completeness",
            "automatedTask",
            "dataCompletenessTask",
            """
            , "config": {"fieldsToCheck": ["description"],
                         "qualityBands": [{"name": "gold", "minimumScore": 90}]},
              "inputNamespaceMap": {"relatedEntity": "global"}""");

    BatchExecutionPlan plan =
        plan(
            PERIODIC_TRIGGER,
            List.of(START, approval, completeness, SINK, END, END_SKIPPED),
            """
            {"from": "start", "to": "approve"},
            {"from": "approve", "to": "completeness", "condition": "approve"},
            {"from": "approve", "to": "skipped", "condition": "reject"},
            {"from": "completeness", "to": "sink", "condition": "gold"},
            {"from": "sink", "to": "end"}""");

    assertTrue(plan.runsOncePerBatch());
    assertFalse(plan.isActive());
    assertEquals(
        List.of(
            "node 'approve' (userApprovalTask) waits for a person to decide on one entity",
            "node 'completeness' (dataCompletenessTask) routes each entity to one of several quality bands, while a batch continues on one branch"),
        plan.violations());
    assertEquals(NodeMode.PER_ENTITY, plan.modeFor("approve"));
  }

  @Test
  void branchesThatBothContinueOrMergeAreViolations() {
    BatchExecutionPlan plan =
        plan(
            PERIODIC_TRIGGER,
            List.of(START, CHECK, SET_ATTRIBUTE, SINK, END),
            """
            {"from": "start", "to": "checkTier"},
            {"from": "checkTier", "to": "sink", "condition": "true"},
            {"from": "checkTier", "to": "setDescription", "condition": "false"},
            {"from": "setDescription", "to": "sink"},
            {"from": "sink", "to": "end"}""");

    assertFalse(plan.isActive());
    assertEquals(2, plan.violations().size(), plan.violations()::toString);
    assertTrue(
        plan.violations()
            .get(0)
            .startsWith("node 'checkTier' continues to [sink, setDescription]"));
    assertEquals(
        "node 'sink' is reached by 2 edges, while the branches of a batch cannot merge",
        plan.violations().get(1));
    assertEquals(NodeMode.PER_ENTITY, plan.modeFor("checkTier"));
    assertTrue(plan.violationMessage().contains("set batchMode to false on the sink"));
  }

  @Test
  void perEntitySinkNextToABatchSinkIsAViolation() {
    BatchExecutionPlan plan =
        plan(
            PERIODIC_TRIGGER,
            List.of(START, SINK, sink("perEntitySink", false), END),
            """
            {"from": "start", "to": "sink"},
            {"from": "sink", "to": "perEntitySink"},
            {"from": "perEntitySink", "to": "end"}""");

    assertEquals(
        List.of(
            "sink 'perEntitySink' has batchMode set to false and would write only the first entity of each batch"),
        plan.violations());
  }

  @Test
  void batchFieldsAreAddedOnlyToBatchNodes() {
    ServiceTask perEntity = new ServiceTask();
    NodeMode.PER_ENTITY.addTo(perEntity);
    ServiceTask unconditional = new ServiceTask();
    new NodeMode(true, null).addTo(unconditional);
    ServiceTask continuing = new ServiceTask();
    new NodeMode(true, "false").addTo(continuing);

    assertTrue(perEntity.getFieldExtensions().isEmpty());
    assertEquals(List.of("batchExecutionExpr=true"), fields(unconditional));
    assertEquals(
        List.of("batchExecutionExpr=true", "batchContinuingOutcomeExpr=false"), fields(continuing));
  }

  @Test
  void noSeedWorkflowRunsOncePerBatch() throws IOException, URISyntaxException {
    URL seeds = getClass().getClassLoader().getResource("json/data/governance/workflows");
    assertTrue(seeds != null, "seed workflows not on the classpath");
    try (Stream<Path> files = Files.list(Path.of(seeds.toURI()))) {
      List<Path> seedFiles = files.filter(file -> file.toString().endsWith(".json")).toList();
      assertFalse(seedFiles.isEmpty());
      for (Path seed : seedFiles) {
        BatchExecutionPlan plan = BatchExecutionPlan.of(readSeed(seed));
        assertFalse(plan.runsOncePerBatch(), seed::toString);
        assertTrue(plan.violations().isEmpty(), seed::toString);
      }
    }
  }

  @Test
  void mainWorkflowDeploysBatchFieldsOnlyForAValidBatchWorkflow() {
    String trueToSink =
        """
        {"from": "start", "to": "checkTier"},
        {"from": "checkTier", "to": "sink", "condition": "true"},
        {"from": "checkTier", "to": "skipped", "condition": "false"},
        {"from": "sink", "to": "end"}""";
    String falseToAction =
        """
        {"from": "start", "to": "checkTier"},
        {"from": "checkTier", "to": "sink", "condition": "true"},
        {"from": "checkTier", "to": "setDescription", "condition": "false"},
        {"from": "setDescription", "to": "end"},
        {"from": "sink", "to": "end"}""";
    List<String> nodes = List.of(START, CHECK, SET_ATTRIBUTE, SINK, END, END_SKIPPED);

    assertEquals(
        List.of("batchExecutionExpr=true", "batchContinuingOutcomeExpr=true"),
        deployedBatchFields(definition(PERIODIC_TRIGGER, nodes, trueToSink)));
    assertEquals(
        List.of(), deployedBatchFields(definition(PERIODIC_TRIGGER, nodes, falseToAction)));
    assertEquals(List.of(), deployedBatchFields(definition(EVENT_TRIGGER, nodes, trueToSink)));
  }

  private static List<String> deployedBatchFields(WorkflowDefinition workflow) {
    ServiceTask check =
        new MainWorkflow(workflow)
            .getModel().getMainProcess().findFlowElementsOfType(ServiceTask.class, true).stream()
                .filter(task -> "checkTier.checkEntityAttributes".equals(task.getId()))
                .findFirst()
                .orElseThrow();
    return fields(check).stream().filter(field -> field.startsWith("batch")).toList();
  }

  private static WorkflowDefinition readSeed(Path seed) throws IOException {
    try (InputStream in = Files.newInputStream(seed)) {
      return JsonUtils.readValue(
          new String(in.readAllBytes(), StandardCharsets.UTF_8), WorkflowDefinition.class);
    }
  }

  private static List<String> fields(ServiceTask task) {
    return task.getFieldExtensions().stream()
        .map(FieldExtension.class::cast)
        .map(field -> "%s=%s".formatted(field.getFieldName(), field.getStringValue()))
        .toList();
  }

  static BatchExecutionPlan plan(String trigger, List<String> nodes, String edges) {
    return BatchExecutionPlan.of(definition(trigger, nodes, edges));
  }

  static WorkflowDefinition definition(String trigger, List<String> nodes, String edges) {
    String json =
        """
        {"name": "batchWorkflow", "fullyQualifiedName": "batchWorkflow",
         "config": {"storeStageStatus": false},
         "trigger": %s, "nodes": [%s], "edges": [%s]}"""
            .formatted(trigger, String.join(",", nodes), edges);
    return JsonUtils.readValue(json, WorkflowDefinition.class);
  }

  static String node(String name, String type, String subType, String rest) {
    return """
        {"name": "%s", "displayName": "%s", "type": "%s", "subType": "%s"%s}"""
        .formatted(name, name, type, subType, rest);
  }

  static String sink(String name, boolean batchMode) {
    return node(
        name,
        "automatedTask",
        "sinkTask",
        """
        , "config": {"sinkType": "webhook", "sinkConfig": {"endpoint": "http://127.0.0.1:9/x"},
                     "batchMode": %s}"""
            .formatted(batchMode));
  }
}
