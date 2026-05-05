package org.openmetadata.service.governance.workflows.flowable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import org.flowable.bpmn.model.FlowElement;
import org.flowable.bpmn.model.InclusiveGateway;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CheckEntityAttributesTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.Config__2;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.Config__4;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.DataCompletenessTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.QualityBand;
import org.openmetadata.schema.governance.workflows.elements.nodes.endEvent.EndEventDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.startEvent.StartEventDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.NoOpTriggerDefinition;

class MainWorkflowInclusiveGatewayTest {

  @Test
  void testSplitGatewayInserted_WhenCheckNodeHasTwoConditionalOutgoingEdges() {
    // Workflow: start → check → certEnd(true) / notifyEnd(false) — independent ends
    WorkflowDefinition workflow =
        createWorkflow(
            "SplitOnlyWorkflow",
            List.of(
                startEvent("start"),
                checkAttributesNode("check"),
                endEvent("certEnd"),
                endEvent("notifyEnd")),
            List.of(
                edge("start", "check", null),
                edge("check", "certEnd", "true"),
                edge("check", "notifyEnd", "false")));

    MainWorkflow mainWorkflow = new MainWorkflow(workflow);
    Process process = mainWorkflow.getModel().getProcesses().get(0);

    // Split gateway should be injected after "check"
    FlowElement splitGateway = process.getFlowElement("check_inclusiveSplit");
    assertNotNull(splitGateway, "Split gateway should exist after check node");
    assertInstanceOf(InclusiveGateway.class, splitGateway);

    // No join gateway needed — branches lead to separate end events
    assertNull(process.getFlowElement("certEnd_inclusiveJoin"), "No join when branches diverge");
    assertNull(process.getFlowElement("notifyEnd_inclusiveJoin"), "No join when branches diverge");

    // Verify two conditional flows from split gateway
    List<String> conditions =
        process.getFlowElements().stream()
            .filter(e -> e instanceof SequenceFlow)
            .map(e -> (SequenceFlow) e)
            .filter(f -> "check_inclusiveSplit".equals(f.getSourceRef()))
            .map(SequenceFlow::getConditionExpression)
            .toList();

    assertEquals(2, conditions.size());
    assertTrue(
        conditions.contains("${check_hasTrueEntities == true}"),
        "True branch uses hasTrueEntities");
    assertTrue(
        conditions.contains("${check_hasFalseEntities == true}"),
        "False branch uses hasFalseEntities");
  }

  @Test
  void testJoinGatewayInserted_WhenBranchesConverge() {
    // Workflow: check → end(true) / end(false) — both branches converge on same end node
    WorkflowDefinition workflow =
        createWorkflow(
            "SplitJoinWorkflow",
            List.of(startEvent("start"), checkAttributesNode("check"), endEvent("end")),
            List.of(
                edge("start", "check", null),
                edge("check", "end", "true"),
                edge("check", "end", "false")));

    MainWorkflow mainWorkflow = new MainWorkflow(workflow);
    Process process = mainWorkflow.getModel().getProcesses().get(0);

    FlowElement splitElement = process.getFlowElement("check_inclusiveSplit");
    assertNotNull(splitElement, "Split gateway should be present");
    InclusiveGateway splitGateway = (InclusiveGateway) splitElement;
    assertNotNull(
        splitGateway.getDefaultFlow(),
        "Split gateway must have a defaultFlow for the empty-condition case");

    FlowElement joinGateway = process.getFlowElement("end_inclusiveJoin");
    assertNotNull(joinGateway, "Join gateway should exist before end");
    assertInstanceOf(InclusiveGateway.class, joinGateway);

    long flowsToJoin =
        process.getFlowElements().stream()
            .filter(e -> e instanceof SequenceFlow)
            .map(e -> (SequenceFlow) e)
            .filter(f -> "end_inclusiveJoin".equals(f.getTargetRef()))
            .count();
    // 2 conditional branches + 1 defaultFlow (skip-path when all conditions false)
    assertEquals(
        3,
        flowsToJoin,
        "Both conditional branches and defaultFlow should flow into the join gateway");

    long flowsFromJoin =
        process.getFlowElements().stream()
            .filter(e -> e instanceof SequenceFlow)
            .map(e -> (SequenceFlow) e)
            .filter(f -> "end_inclusiveJoin".equals(f.getSourceRef()))
            .count();
    assertEquals(1, flowsFromJoin, "Join gateway has exactly one outgoing flow");
  }

  @Test
  void testNoGatewaysInserted_WhenNoConditionalEdges() {
    WorkflowDefinition workflow =
        createWorkflow(
            "LinearWorkflow",
            List.of(startEvent("start"), endEvent("end")),
            List.of(edge("start", "task", null), edge("task", "end", null)));

    MainWorkflow mainWorkflow = new MainWorkflow(workflow);
    Process process = mainWorkflow.getModel().getProcesses().get(0);

    long gatewayCount =
        process.getFlowElements().stream().filter(e -> e instanceof InclusiveGateway).count();
    assertEquals(0, gatewayCount, "No gateways for linear workflows");
  }

  @Test
  void testNoGatewayInserted_ForNonCheckNodeWithConditionalEdges() {
    // UserApproval (not a check node) has "true"/"false" edges — should NOT get inclusive gateway
    WorkflowDefinition workflow =
        createWorkflow(
            "UserApprovalWorkflow",
            List.of(startEvent("start"), endEvent("endTrue"), endEvent("endFalse")),
            List.of(
                edge("start", "UserApproval", null),
                edge("UserApproval", "endTrue", "true"),
                edge("UserApproval", "endFalse", "false")));

    MainWorkflow mainWorkflow = new MainWorkflow(workflow);
    Process process = mainWorkflow.getModel().getProcesses().get(0);

    // UserApproval is not in the nodes list → nodeInstanceMap has no entry → no gateway
    assertNull(
        process.getFlowElement("UserApproval_inclusiveSplit"),
        "Non-check node should not get an inclusive gateway");
  }

  @Test
  void testDataCompleteness_BandConditionsGenerateCorrectFlags() {
    WorkflowDefinition workflow =
        createWorkflow(
            "DataQualityWorkflow",
            List.of(
                startEvent("start"),
                dataCompletenessNode("dataQuality", "gold", "silver"),
                endEvent("goldEnd"),
                endEvent("silverEnd")),
            List.of(
                edge("start", "dataQuality", null),
                edge("dataQuality", "goldEnd", "gold"),
                edge("dataQuality", "silverEnd", "silver")));

    MainWorkflow mainWorkflow = new MainWorkflow(workflow);
    Process process = mainWorkflow.getModel().getProcesses().get(0);

    assertNotNull(
        process.getFlowElement("dataQuality_inclusiveSplit"),
        "Split gateway for data quality node");

    List<String> conditions =
        process.getFlowElements().stream()
            .filter(e -> e instanceof SequenceFlow)
            .map(e -> (SequenceFlow) e)
            .filter(f -> "dataQuality_inclusiveSplit".equals(f.getSourceRef()))
            .map(SequenceFlow::getConditionExpression)
            .toList();

    assertTrue(
        conditions.contains("${dataQuality_has_gold_entities == true}"), "Gold band condition");
    assertTrue(
        conditions.contains("${dataQuality_has_silver_entities == true}"), "Silver band condition");
  }

  // --- Helpers ---

  private WorkflowDefinition createWorkflow(
      String name, List<WorkflowNodeDefinitionInterface> nodes, List<EdgeDefinition> edges) {
    WorkflowDefinition workflow = new WorkflowDefinition();
    workflow.setName(name);
    workflow.setFullyQualifiedName(name);
    workflow.setConfig(new WorkflowConfiguration());
    workflow.setTrigger(new NoOpTriggerDefinition());
    workflow.setNodes(nodes);
    workflow.setEdges(edges);
    return workflow;
  }

  private StartEventDefinition startEvent(String name) {
    StartEventDefinition def = new StartEventDefinition();
    def.setName(name);
    return def;
  }

  private EndEventDefinition endEvent(String name) {
    EndEventDefinition def = new EndEventDefinition();
    def.setName(name);
    return def;
  }

  private CheckEntityAttributesTaskDefinition checkAttributesNode(String name) {
    Config__2 config = new Config__2();
    config.setRules("[]");
    CheckEntityAttributesTaskDefinition def = new CheckEntityAttributesTaskDefinition();
    def.setName(name);
    def.setConfig(config);
    return def;
  }

  private DataCompletenessTaskDefinition dataCompletenessNode(String name, String... bandNames) {
    List<QualityBand> bands =
        Arrays.stream(bandNames)
            .map(
                n -> {
                  QualityBand b = new QualityBand();
                  b.setName(n);
                  b.setMinimumScore(0.0);
                  return b;
                })
            .toList();
    Config__4 config = new Config__4();
    config.setQualityBands(bands);
    DataCompletenessTaskDefinition def = new DataCompletenessTaskDefinition();
    def.setName(name);
    def.setConfig(config);
    return def;
  }

  private EdgeDefinition edge(String from, String to, String condition) {
    EdgeDefinition def = new EdgeDefinition();
    def.setFrom(from);
    def.setTo(to);
    def.setCondition(condition);
    return def;
  }
}
