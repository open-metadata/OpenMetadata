package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.repository.ProcessDefinition;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;

/**
 * End-to-end (HTTP + DB + Flowable) guard for the workflow "Tier" Check Condition. The governance
 * query builder exports a Tier rule against the entity {@code tags} list (a {@code Tier.*} entry),
 * since a serialized entity has no {@code tier} property — a rule keyed on {@code {"var":"tier"}}
 * resolves to {@code null} under {@link
 * org.openmetadata.service.rules.RuleEngine#apply(String, java.util.Map)} and silently never
 * matches. This test deploys a workflow whose Check Condition is the exported Tier rule and asserts
 * the rule the deployed Flowable process actually carries is the server-evaluable {@code tags} shape
 * (regression coverage for the export pipeline in {@code jsonLogicTierVar.ts}). The engine-level
 * pass/fail against a real tagged/untagged entity is covered by {@link
 * org.openmetadata.service.rules.RuleEngineTierRuleTest}.
 */
@ExtendWith(TestNamespaceExtension.class)
class TierCheckConditionWorkflowIT {
  private static final String CHECK_NODE = "checkTier";
  private static final ObjectMapper MAPPER = new ObjectMapper();

  // The exact wire shape the workflow query builder now exports after the fix.
  private static final String TIER_CONTAINS_TIER1 =
      "{\"some\":[{\"var\":\"tags\"},{\"contains\":[{\"var\":\"tagFQN\"},[\"Tier.Tier1\"]]}]}";

  @Test
  void workflowCheckConditionCarriesTheServerEvaluableTierRule(TestNamespace ns) throws Exception {
    String name = ns.prefix("tierCheckWorkflow");
    WorkflowDefinition created =
        SdkClients.adminClient()
            .workflowDefinitions()
            .create(MAPPER.readValue(workflowJson(name), CreateWorkflowDefinition.class));
    try {
      WorkflowDefinitionRepository repository =
          (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
      WorkflowDefinition stored = repository.findByName(name, Include.NON_DELETED, false);

      // The persisted workflow definition keeps the rule the UI exported.
      assertEquals(TIER_CONTAINS_TIER1, checkNodeRules(stored));
      // ...and the deployed Flowable process carries that same rule on its check task, so the rule
      // the engine evaluates at run time points at the entity `tags` list, not a `tier` variable.
      assertEquals(TIER_CONTAINS_TIER1, deployedRules(stored.getFullyQualifiedName()));
    } finally {
      SdkClients.adminClient()
          .workflowDefinitions()
          .delete(created.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
    }
  }

  private static String checkNodeRules(WorkflowDefinition workflow) {
    for (JsonNode node : JsonUtils.valueToTree(workflow).path("nodes")) {
      if (CHECK_NODE.equals(node.path("name").asText())) {
        return node.path("config").path("rules").asText();
      }
    }
    throw new AssertionError("check node " + CHECK_NODE + " not found");
  }

  private static String deployedRules(String workflowFqn) {
    RepositoryService repositoryService = WorkflowHandler.getInstance().getRepositoryService();
    ProcessDefinition processDefinition =
        repositoryService
            .createProcessDefinitionQuery()
            .processDefinitionKey(workflowFqn)
            .latestVersion()
            .singleResult();
    ServiceTask check =
        (ServiceTask)
            repositoryService
                .getBpmnModel(processDefinition.getId())
                .getFlowElement(Workflow.getFlowableElementId(CHECK_NODE, "checkEntityAttributes"));
    return check.getFieldExtensions().stream()
        .filter(field -> "rulesExpr".equals(field.getFieldName()))
        .map(FieldExtension::getStringValue)
        .findFirst()
        .orElseThrow();
  }

  /** A periodic batch that is never scheduled, so the check never runs against other suites. */
  private static String workflowJson(String name) throws Exception {
    return """
        {"name": "%s", "description": "tier check condition",
         "config": {"storeStageStatus": false},
         "trigger": {"type": "periodicBatchEntity",
                     "config": {"entityTypes": ["table"], "schedule": {"scheduleTimeline": "None"},
                                "batchSize": 10, "filters": "{}"},
                     "output": ["relatedEntity", "updatedBy"]},
         "nodes": [
           {"name": "start", "type": "startEvent", "subType": "startEvent"},
           {"name": "%s", "type": "automatedTask", "subType": "checkEntityAttributesTask",
            "config": {"rules": %s}, "inputNamespaceMap": {"relatedEntity": "global"}},
           {"name": "matched", "type": "endEvent", "subType": "endEvent"},
           {"name": "unmatched", "type": "endEvent", "subType": "endEvent"}
         ],
         "edges": [
           {"from": "start", "to": "%s"},
           {"from": "%s", "to": "matched", "condition": "true"},
           {"from": "%s", "to": "unmatched", "condition": "false"}
         ]}
        """
        .formatted(
            name,
            CHECK_NODE,
            MAPPER.writeValueAsString(TIER_CONTAINS_TIER1),
            CHECK_NODE,
            CHECK_NODE,
            CHECK_NODE);
  }
}
