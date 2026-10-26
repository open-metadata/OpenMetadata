package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.repository.ProcessDefinition;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.migration.utils.v207.MigrationUtil;

/**
 * Runs the 2.0.7 rewrite of negated list rules on one stored contract and one stored workflow, so
 * a rule saved as "has a tag other than X" runs as the "Is Not X" its row shows, against the real
 * database, rule engine and Flowable. The migration's full scans are not run here: they would
 * rewrite and redeploy other suites' workflows mid-test.
 */
@ExtendWith(TestNamespaceExtension.class)
class NegatedListRuleMigrationIT {
  private static final String LEGACY_IS_NOT =
      "{\"and\":[{\"some\":[{\"var\":\"tags\"},{\"!=\":[{\"var\":\"tagFQN\"},\"PII.Sensitive\"]}]}]}";
  private static final String IS_NOT =
      "{\"and\":[{\"!\":{\"some\":[{\"var\":\"tags\"},{\"==\":[{\"var\":\"tagFQN\"},\"PII.Sensitive\"]}]}}]}";
  private static final String CHECK_NODE = "checkTags";
  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void contractRuleSavedAsIsNotRunsAsIsNotOnceRewritten(TestNamespace ns) throws Exception {
    Table untagged = createTable(ns, "negated-list");
    DataContract contract =
        SdkClients.adminClient()
            .dataContracts()
            .create(
                new CreateDataContract()
                    .withName(ns.prefix("negated-list-contract"))
                    .withEntity(untagged.getEntityReference())
                    .withEntityStatus(EntityStatus.APPROVED)
                    .withSemantics(
                        List.of(
                            new SemanticsRule()
                                .withName("notSensitive")
                                .withDescription("Not tagged PII.Sensitive")
                                .withRule(LEGACY_IS_NOT))));
    assertEquals(1, failedSemantics(contract), "the old shape fails an untagged table");

    MigrationUtil.rewriteAndStore(
        Entity.getCollectionDAO().dataContractDAO(), storedJson(contract.getId()));
    EntityRepository.invalidateCacheForEntity(
        Entity.DATA_CONTRACT, contract.getId(), contract.getFullyQualifiedName());

    assertEquals(0, failedSemantics(contract), "an untagged table is not tagged PII.Sensitive");
    assertEquals(
        IS_NOT,
        SdkClients.adminClient()
            .dataContracts()
            .get(contract.getId().toString())
            .getSemantics()
            .getFirst()
            .getRule());
  }

  @Test
  void workflowRuleIsRewrittenAndRedeployed(TestNamespace ns) throws Exception {
    String name = ns.prefix("negatedListWorkflow");
    WorkflowDefinition created =
        SdkClients.adminClient()
            .workflowDefinitions()
            .create(MAPPER.readValue(workflowJson(name), CreateWorkflowDefinition.class));
    try {
      WorkflowDefinitionRepository repository =
          (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

      MigrationUtil.rewriteAndRedeploy(
          repository, repository.findByName(name, Include.NON_DELETED));

      WorkflowDefinition stored = repository.findByName(name, Include.NON_DELETED, false);
      assertEquals(IS_NOT, checkNodeRules(stored));
      assertEquals(IS_NOT, deployedRules(stored.getFullyQualifiedName()));
    } finally {
      SdkClients.adminClient()
          .workflowDefinitions()
          .delete(created.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
    }
  }

  private static int failedSemantics(DataContract contract) throws Exception {
    DataContractResult result = SdkClients.adminClient().dataContracts().validate(contract.getId());
    return result.getSemanticsValidation().getFailed();
  }

  private static String storedJson(UUID id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT json FROM data_contract_entity WHERE id = :id")
                    .bind("id", id.toString())
                    .mapTo(String.class)
                    .one());
  }

  private static String checkNodeRules(WorkflowDefinition workflow) {
    String rules = null;
    for (JsonNode node : JsonUtils.valueToTree(workflow).path("nodes")) {
      if (CHECK_NODE.equals(node.path("name").asText())) {
        rules = node.path("config").path("rules").asText();
      }
    }
    return rules;
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
        {"name": "%s", "description": "negated list rule migration",
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
            MAPPER.writeValueAsString(LEGACY_IS_NOT),
            CHECK_NODE,
            CHECK_NODE,
            CHECK_NODE);
  }

  private static Table createTable(TestNamespace ns, String prefix) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create()
            .name(ns.prefix(prefix + "-db"))
            .in(service.getFullyQualifiedName())
            .execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix(prefix + "-schema"))
            .in(database.getFullyQualifiedName())
            .execute();
    return TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
  }
}
