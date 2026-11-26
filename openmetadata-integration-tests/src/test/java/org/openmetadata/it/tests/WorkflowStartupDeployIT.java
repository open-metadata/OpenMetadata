package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.flowable.engine.RepositoryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
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
import org.openmetadata.service.governance.workflows.WorkflowHandler.WorkflowBpmn;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * The deploy the server runs on start (ADR:2026-11-23-a-changed-workflow-is-deployed-when-the-server-starts),
 * against the real database and Flowable. Each test passes only its own workflows: deploying every
 * stored one would redeploy other suites' workflows mid-test.
 */
@ExtendWith(TestNamespaceExtension.class)
class WorkflowStartupDeployIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String MATCH_ANY = "{\"and\":[{\"!!\":{\"var\":\"name\"}}]}";
  private static final String MATCH_NONE = "{\"and\":[{\"!\":{\"var\":\"name\"}}]}";

  @Test
  void aWorkflowStoredAsItWasDeployedIsLeftAlone(TestNamespace ns) throws Exception {
    final WorkflowDefinition created = create(ns.prefix("unchangedWorkflow"));
    try {
      final int version = deployedVersion(created);

      assertEquals(List.of(), handler().deployChanged(List.of(stored(created))));
      assertEquals(version, deployedVersion(created));
    } finally {
      delete(created);
    }
  }

  @Test
  void aWorkflowWhoseRowChangedIsDeployedOnce(TestNamespace ns) throws Exception {
    final WorkflowDefinition created = create(ns.prefix("changedWorkflow"));
    try {
      final int version = deployedVersion(created);
      updateRow(created);

      assertEquals(List.of(created.getName()), handler().deployChanged(List.of(stored(created))));
      assertEquals(version + 1, deployedVersion(created));
      assertEquals(List.of(), handler().deployChanged(List.of(stored(created))));
    } finally {
      delete(created);
    }
  }

  @Test
  void aWorkflowThatCannotBeBuiltDoesNotStopTheOthers(TestNamespace ns) throws Exception {
    final WorkflowDefinition created = create(ns.prefix("deployedWorkflow"));
    try {
      updateRow(created);
      final String brokenName = ns.prefix("brokenWorkflow");
      final WorkflowDefinition broken =
          JsonUtils.deepCopy(stored(created), WorkflowDefinition.class)
              .withName(brokenName)
              .withFullyQualifiedName(brokenName)
              .withTrigger(null);

      assertEquals(
          List.of(created.getName()), handler().deployChanged(List.of(broken, stored(created))));
    } finally {
      delete(created);
    }
  }

  /**
   * A seeded workflow is deployed from its resource file and compared on start from its stored
   * row, which the database stores with its keys reordered.
   */
  @Test
  void everySeededWorkflowBuildsTheSameBpmnFromItsStoredRow() throws Exception {
    final List<WorkflowDefinition> seeded = repository().getEntitiesFromSeedData();
    assertFalse(seeded.isEmpty());
    for (final WorkflowDefinition seed : seeded) {
      final WorkflowBpmn fromSeed = WorkflowHandler.toBpmn(new Workflow(seed));
      final WorkflowBpmn fromRow = WorkflowHandler.toBpmn(new Workflow(asStored(seed)));
      assertArrayEquals(fromSeed.main(), fromRow.main(), seed.getName() + " main workflow");
      assertArrayEquals(fromSeed.trigger(), fromRow.trigger(), seed.getName() + " trigger");
    }
  }

  private static WorkflowHandler handler() {
    return WorkflowHandler.getInstance();
  }

  private static WorkflowDefinitionRepository repository() {
    return (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
  }

  private static WorkflowDefinition stored(WorkflowDefinition workflow) {
    return repository().findByName(workflow.getName(), Include.NON_DELETED, false);
  }

  private static int deployedVersion(WorkflowDefinition workflow) {
    final RepositoryService repositoryService = handler().getRepositoryService();
    return repositoryService
        .createProcessDefinitionQuery()
        .processDefinitionKey(workflow.getFullyQualifiedName())
        .latestVersion()
        .singleResult()
        .getVersion();
  }

  /** The definition as the database hands it back: stored as JSON, keys in its own order. */
  private static WorkflowDefinition asStored(WorkflowDefinition workflow) {
    final String sql =
        TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL
            ? "SELECT CAST(:json AS JSON)"
            : "SELECT CAST(:json AS jsonb)::text";
    final String json =
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery(sql)
                        .bind("json", JsonUtils.pojoToJson(workflow))
                        .mapTo(String.class)
                        .one());
    return JsonUtils.readValue(json, WorkflowDefinition.class);
  }

  /** Changes the stored rule the way a migration step changes a row: in SQL, with no deploy. */
  private static void updateRow(WorkflowDefinition workflow) {
    final String json =
        JsonUtils.pojoToJson(stored(workflow))
            .replace(
                MAPPER.valueToTree(MATCH_ANY).toString(),
                MAPPER.valueToTree(MATCH_NONE).toString());
    final String sql =
        TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL
            ? "UPDATE workflow_definition_entity SET json = :json WHERE id = :id"
            : "UPDATE workflow_definition_entity SET json = CAST(:json AS jsonb) WHERE id = :id";
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(sql)
                    .bind("json", json)
                    .bind("id", workflow.getId().toString())
                    .execute());
  }

  private static WorkflowDefinition create(String name) throws Exception {
    return SdkClients.adminClient()
        .workflowDefinitions()
        .create(MAPPER.readValue(workflowJson(name), CreateWorkflowDefinition.class));
  }

  private static void delete(WorkflowDefinition workflow) throws Exception {
    SdkClients.adminClient()
        .workflowDefinitions()
        .delete(workflow.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
  }

  /** A periodic batch that is never scheduled, so it never runs against other suites. */
  private static String workflowJson(String name) throws Exception {
    return """
        {"name": "%s", "description": "startup deploy",
         "config": {"storeStageStatus": false},
         "trigger": {"type": "periodicBatchEntity",
                     "config": {"entityTypes": ["table"], "schedule": {"scheduleTimeline": "None"},
                                "batchSize": 10, "filters": "{}"},
                     "output": ["relatedEntity", "updatedBy"]},
         "nodes": [
           {"name": "start", "type": "startEvent", "subType": "startEvent"},
           {"name": "check", "type": "automatedTask", "subType": "checkEntityAttributesTask",
            "config": {"rules": %s}, "inputNamespaceMap": {"relatedEntity": "global"}},
           {"name": "matched", "type": "endEvent", "subType": "endEvent"},
           {"name": "unmatched", "type": "endEvent", "subType": "endEvent"}
         ],
         "edges": [
           {"from": "start", "to": "check"},
           {"from": "check", "to": "matched", "condition": "true"},
           {"from": "check", "to": "unmatched", "condition": "false"}
         ]}
        """
        .formatted(name, MAPPER.writeValueAsString(MATCH_ANY));
  }
}
