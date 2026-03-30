package org.openmetadata.service.migration.utils.v1105;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.EntityUtil;

class MigrationUtilTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void updateGlossaryTermApprovalWorkflowMigratesLegacyWorkflowDefinition() throws Exception {
    WorkflowDefinitionRepository repository = mock(WorkflowDefinitionRepository.class);
    WorkflowDefinition workflow = readWorkflowDefinition(legacyWorkflowJson());

    when(repository.getByName(
            isNull(), eq("GlossaryTermApprovalWorkflow"), eq(EntityUtil.Fields.EMPTY_FIELDS)))
        .thenReturn(workflow);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION))
          .thenReturn(repository);

      MigrationUtil.updateGlossaryTermApprovalWorkflow();

      verify(repository).createOrUpdate(isNull(), eq(workflow), eq("admin"));
    }

    WorkflowNodeDefinitionInterface migratedStatusNode =
        nodeByName(workflow, "SetGlossaryTermStatusToInReview");
    JsonNode migratedStatusNodeJson = MAPPER.readTree(JsonUtils.pojoToJson(migratedStatusNode));
    assertEquals("setEntityAttributeTask", migratedStatusNode.getSubType());
    assertEquals("status", migratedStatusNodeJson.get("config").get("fieldName").asText());
    assertEquals("In Review", migratedStatusNodeJson.get("config").get("fieldValue").asText());
    assertFalse(migratedStatusNodeJson.get("config").has("glossaryTermStatus"));

    WorkflowNodeDefinitionInterface approvalNode = nodeByName(workflow, "ApproveGlossaryTerm");
    JsonNode approvalNodeJson = MAPPER.readTree(JsonUtils.pojoToJson(approvalNode));
    assertEquals(1, approvalNodeJson.get("config").get("approvalThreshold").asInt());
    assertEquals(1, approvalNodeJson.get("config").get("rejectionThreshold").asInt());
    assertEquals("updatedBy", approvalNodeJson.get("output").get(0).asText());

    JsonNode triggerJson = MAPPER.readTree(JsonUtils.pojoToJson(workflow.getTrigger()));
    assertTrue(triggerJson.get("config").has("entityTypes"));
    assertFalse(triggerJson.get("config").has("entityType"));
    assertEquals("glossaryTerm", triggerJson.get("config").get("entityTypes").get(0).asText());
    assertEquals(
        "{\"and\":[]}", triggerJson.get("config").get("filter").get("glossaryTerm").asText());
    assertEquals("{\"and\":[]}", triggerJson.get("config").get("filter").get("default").asText());

    Set<String> nodeNames =
        workflow.getNodes().stream()
            .map(WorkflowNodeDefinitionInterface::getName)
            .collect(Collectors.toSet());
    assertTrue(nodeNames.contains("CheckIfGlossaryTermIsNew"));
    assertTrue(nodeNames.contains("SetGlossaryTermStatusToInReviewForUpdate"));
    assertTrue(nodeNames.contains("ApprovalForUpdates"));
    assertTrue(nodeNames.contains("RollbackGlossaryTermChanges"));
    assertTrue(nodeNames.contains("SetGlossaryTermStatusToApprovedAfterReview"));
    assertTrue(nodeNames.contains("RollbackEnd"));
    assertTrue(nodeNames.contains("ChangeReviewEnd"));

    Set<String> edges =
        workflow.getEdges().stream()
            .map(edge -> edge.getFrom() + "->" + edge.getTo() + ":" + edge.getCondition())
            .collect(Collectors.toSet());
    assertFalse(
        edges.contains(
            "CheckGlossaryTermIsReadyToBeReviewed->SetGlossaryTermStatusToInReview:true"));
    assertTrue(
        edges.contains("CheckGlossaryTermIsReadyToBeReviewed->CheckIfGlossaryTermIsNew:true"));
    assertTrue(edges.contains("CheckIfGlossaryTermIsNew->SetGlossaryTermStatusToInReview:true"));
    assertTrue(
        edges.contains("CheckIfGlossaryTermIsNew->SetGlossaryTermStatusToInReviewForUpdate:false"));
    assertTrue(edges.contains("SetGlossaryTermStatusToInReviewForUpdate->ApprovalForUpdates:null"));
    assertTrue(edges.contains("ApprovalForUpdates->RollbackGlossaryTermChanges:false"));
    assertTrue(
        edges.contains("ApprovalForUpdates->SetGlossaryTermStatusToApprovedAfterReview:true"));
  }

  @Test
  void updateGlossaryTermApprovalWorkflowSkipsAlreadyMigratedDefinitions() {
    WorkflowDefinitionRepository repository = mock(WorkflowDefinitionRepository.class);
    WorkflowDefinition workflow = readWorkflowDefinition(migratedWorkflowJson());

    when(repository.getByName(
            isNull(), eq("GlossaryTermApprovalWorkflow"), eq(EntityUtil.Fields.EMPTY_FIELDS)))
        .thenReturn(workflow);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION))
          .thenReturn(repository);

      MigrationUtil.updateGlossaryTermApprovalWorkflow();

      verify(repository, never()).createOrUpdate(isNull(), eq(workflow), eq("admin"));
    }
  }

  @Test
  void updateGlossaryTermApprovalWorkflowHandlesMissingWorkflowDefinitions() {
    WorkflowDefinitionRepository repository = mock(WorkflowDefinitionRepository.class);
    when(repository.getByName(
            isNull(), eq("GlossaryTermApprovalWorkflow"), eq(EntityUtil.Fields.EMPTY_FIELDS)))
        .thenThrow(new IllegalArgumentException("missing"));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION))
          .thenReturn(repository);

      MigrationUtil.updateGlossaryTermApprovalWorkflow();

      verify(repository, never())
          .createOrUpdate(isNull(), org.mockito.ArgumentMatchers.any(), eq("admin"));
    }
  }

  @Test
  void updateApprovalNodeWithThresholdsAndOutputAddsMissingFields() throws Exception {
    String originalNodeJson =
        """
            {
              "type": "userTask",
              "subType": "userApprovalTask",
              "name": "ApproveGlossaryTerm",
              "displayName": "Create User Approval Task",
              "config": {
                "assignees": {
                  "addReviewers": true,
                  "addOwners": false,
                  "candidates": []
                }
              },
              "inputNamespaceMap": {
                "relatedEntity": "global"
              }
            }
            """;

    String updatedNodeJson =
        (String) invokePrivateStatic("updateApprovalNodeWithThresholdsAndOutput", originalNodeJson);
    JsonNode updatedNode = MAPPER.readTree(updatedNodeJson);

    assertEquals(1, updatedNode.get("config").get("approvalThreshold").asInt());
    assertEquals(1, updatedNode.get("config").get("rejectionThreshold").asInt());
    assertEquals("updatedBy", updatedNode.get("output").get(0).asText());
  }

  @Test
  void updateGlossaryTermApprovalWorkflowReplacesApprovalNodeWhenThresholdsAreAdded()
      throws Exception {
    WorkflowDefinitionRepository repository = mock(WorkflowDefinitionRepository.class);
    WorkflowDefinition workflow = readWorkflowDefinition(legacyWorkflowJson());
    WorkflowNodeDefinitionInterface approvalNode = nodeByName(workflow, "ApproveGlossaryTerm");
    String approvalNodeJson =
        """
            {
              "type": "userTask",
              "subType": "userApprovalTask",
              "name": "ApproveGlossaryTerm",
              "displayName": "Create User Approval Task",
              "config": {
                "assignees": {
                  "addReviewers": true,
                  "addOwners": false,
                  "candidates": []
                }
              },
              "inputNamespaceMap": {
                "relatedEntity": "global"
              }
            }
            """;

    when(repository.getByName(
            isNull(), eq("GlossaryTermApprovalWorkflow"), eq(EntityUtil.Fields.EMPTY_FIELDS)))
        .thenReturn(workflow);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<JsonUtils> jsonUtils =
            Mockito.mockStatic(JsonUtils.class, Mockito.CALLS_REAL_METHODS)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION))
          .thenReturn(repository);
      jsonUtils.when(() -> JsonUtils.pojoToJson(approvalNode)).thenReturn(approvalNodeJson);

      MigrationUtil.updateGlossaryTermApprovalWorkflow();

      verify(repository).createOrUpdate(isNull(), eq(workflow), eq("admin"));
    }

    JsonNode migratedApprovalNodeJson =
        MAPPER.readTree(JsonUtils.pojoToJson(nodeByName(workflow, "ApproveGlossaryTerm")));
    assertEquals(1, migratedApprovalNodeJson.get("config").get("approvalThreshold").asInt());
    assertEquals(1, migratedApprovalNodeJson.get("config").get("rejectionThreshold").asInt());
    assertEquals("updatedBy", migratedApprovalNodeJson.get("output").get(0).asText());
  }

  @Test
  void jsonStructurallyEqualsFallsBackToRawStringComparisonWhenParsingFails() throws Exception {
    assertTrue(
        (Boolean) invokePrivateStatic("jsonStructurallyEquals", "{broken-json", "{broken-json"));
    assertFalse(
        (Boolean)
            invokePrivateStatic("jsonStructurallyEquals", "{broken-json", "{other-broken-json"));
  }

  private static WorkflowDefinition readWorkflowDefinition(String json) {
    return JsonUtils.readValue(json, WorkflowDefinition.class);
  }

  private static WorkflowNodeDefinitionInterface nodeByName(
      WorkflowDefinition workflowDefinition, String nodeName) {
    return workflowDefinition.getNodes().stream()
        .filter(node -> nodeName.equals(node.getName()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("Missing node " + nodeName));
  }

  private static Object invokePrivateStatic(String methodName, Object... args) throws Exception {
    Class<?>[] parameterTypes =
        switch (methodName) {
          case "updateApprovalNodeWithThresholdsAndOutput" -> new Class<?>[] {String.class};
          case "jsonStructurallyEquals" -> new Class<?>[] {String.class, String.class};
          default -> new Class<?>[] {String.class};
        };
    Method method = MigrationUtil.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(null, args);
  }

  private static String legacyWorkflowJson() {
    return """
        {
          "name": "GlossaryTermApprovalWorkflow",
          "fullyQualifiedName": "GlossaryTermApprovalWorkflow",
          "displayName": "Glossary Approval Workflow",
          "trigger": {
            "type": "eventBasedEntity",
            "config": {
              "entityType": "glossaryTerm",
              "events": ["Created", "Updated"],
              "exclude": [],
              "filter": "{\\"and\\":[]}"
            },
            "output": ["relatedEntity", "updatedBy"]
          },
          "nodes": [
            {
              "type": "automatedTask",
              "subType": "checkEntityAttributesTask",
              "name": "CheckGlossaryTermIsReadyToBeReviewed",
              "displayName": "Check if Glossary Term is Ready to be Reviewed",
              "config": {
                "rules": "{\\"and\\":[{\\"!!\\":[{\\"var\\":\\"description\\"}]}]}"
              },
              "inputNamespaceMap": {
                "relatedEntity": "global"
              }
            },
            {
              "type": "automatedTask",
              "subType": "setGlossaryTermStatusTask",
              "name": "SetGlossaryTermStatusToInReview",
              "displayName": "Set Status to 'In Review'",
              "config": {
                "glossaryTermStatus": "In Review"
              },
              "inputNamespaceMap": {
                "relatedEntity": "global"
              }
            },
            {
              "type": "userTask",
              "subType": "userApprovalTask",
              "name": "ApproveGlossaryTerm",
              "displayName": "Create User Approval Task",
              "config": {
                "assignees": {
                  "addReviewers": true,
                  "addOwners": false,
                  "candidates": []
                }
              },
              "inputNamespaceMap": {
                "relatedEntity": "global"
              }
            }
          ],
          "edges": [
            {
              "from": "CheckGlossaryTermIsReadyToBeReviewed",
              "to": "SetGlossaryTermStatusToInReview",
              "condition": "true"
            }
          ]
        }
        """;
  }

  private static String migratedWorkflowJson() {
    return """
        {
          "name": "GlossaryTermApprovalWorkflow",
          "fullyQualifiedName": "GlossaryTermApprovalWorkflow",
          "displayName": "Glossary Approval Workflow",
          "trigger": {
            "type": "eventBasedEntity",
            "config": {
              "entityTypes": ["glossaryTerm"],
              "events": ["Created", "Updated"],
              "exclude": [],
              "filter": {
                "glossaryTerm": "{\\"and\\":[]}",
                "default": "{\\"and\\":[]}"
              }
            },
            "output": ["relatedEntity", "updatedBy"]
          },
          "nodes": [
            {
              "type": "automatedTask",
              "subType": "checkEntityAttributesTask",
              "name": "CheckGlossaryTermIsReadyToBeReviewed",
              "displayName": "Check if Glossary Term is Ready to be Reviewed",
              "config": {
                "rules": "{\\"and\\":[{\\"!!\\":[{\\"var\\":\\"description\\"}]}]}"
              },
              "inputNamespaceMap": {
                "relatedEntity": "global"
              }
            },
            {
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "name": "SetGlossaryTermStatusToInReview",
              "displayName": "Set Status to 'In Review'",
              "config": {
                "fieldName": "status",
                "fieldValue": "In Review"
              },
              "inputNamespaceMap": {
                "relatedEntity": "global"
              }
            },
            {
              "type": "userTask",
              "subType": "userApprovalTask",
              "name": "ApproveGlossaryTerm",
              "displayName": "Create User Approval Task",
              "config": {
                "assignees": {
                  "addReviewers": true,
                  "addOwners": false,
                  "candidates": []
                },
                "approvalThreshold": 1,
                "rejectionThreshold": 1
              },
              "inputNamespaceMap": {
                "relatedEntity": "global"
              },
              "output": ["updatedBy"]
            },
            {
              "type": "automatedTask",
              "subType": "checkEntityAttributesTask",
              "name": "CheckIfGlossaryTermIsNew",
              "displayName": "Check if Glossary Term is New",
              "config": {
                "rules": "{\\"and\\":[{\\"==\\":[{\\"var\\":\\"version\\"},0.1]}]}"
              },
              "inputNamespaceMap": {
                "relatedEntity": "global"
              }
            },
            {
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "name": "SetGlossaryTermStatusToInReviewForUpdate",
              "displayName": "Set Status to 'In Review' (Update)",
              "config": {
                "fieldName": "status",
                "fieldValue": "In Review"
              },
              "inputNamespaceMap": {
                "relatedEntity": "global",
                "updatedBy": "global"
              }
            },
            {
              "type": "userTask",
              "subType": "userApprovalTask",
              "name": "ApprovalForUpdates",
              "displayName": "Review Changes for Updates",
              "config": {
                "assignees": {
                  "addReviewers": true,
                  "candidates": []
                },
                "approvalThreshold": 1,
                "rejectionThreshold": 1
              },
              "inputNamespaceMap": {
                "relatedEntity": "global"
              },
              "output": ["updatedBy"]
            },
            {
              "type": "automatedTask",
              "subType": "rollbackEntityTask",
              "name": "RollbackGlossaryTermChanges",
              "displayName": "Rollback Glossary Term Changes",
              "config": {},
              "inputNamespaceMap": {
                "relatedEntity": "global",
                "updatedBy": "ApprovalForUpdates"
              }
            },
            {
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "name": "SetGlossaryTermStatusToApprovedAfterReview",
              "displayName": "Set Status to 'Approved' (After Review)",
              "config": {
                "fieldName": "status",
                "fieldValue": "Approved"
              },
              "inputNamespaceMap": {
                "relatedEntity": "global",
                "updatedBy": "ApprovalForUpdates"
              }
            },
            {
              "type": "endEvent",
              "subType": "endEvent",
              "name": "RollbackEnd",
              "displayName": "Changes Rolled Back"
            },
            {
              "type": "endEvent",
              "subType": "endEvent",
              "name": "ChangeReviewEnd",
              "displayName": "Approved After Change Review"
            }
          ],
          "edges": [
            {
              "from": "CheckGlossaryTermIsReadyToBeReviewed",
              "to": "CheckIfGlossaryTermIsNew",
              "condition": "true"
            },
            {
              "from": "CheckIfGlossaryTermIsNew",
              "to": "SetGlossaryTermStatusToInReview",
              "condition": "true"
            },
            {
              "from": "CheckIfGlossaryTermIsNew",
              "to": "SetGlossaryTermStatusToInReviewForUpdate",
              "condition": "false"
            },
            {
              "from": "SetGlossaryTermStatusToInReviewForUpdate",
              "to": "ApprovalForUpdates"
            },
            {
              "from": "ApprovalForUpdates",
              "to": "SetGlossaryTermStatusToApprovedAfterReview",
              "condition": "true"
            },
            {
              "from": "ApprovalForUpdates",
              "to": "RollbackGlossaryTermChanges",
              "condition": "false"
            },
            {
              "from": "RollbackGlossaryTermChanges",
              "to": "RollbackEnd"
            },
            {
              "from": "SetGlossaryTermStatusToApprovedAfterReview",
              "to": "ChangeReviewEnd"
            }
          ]
        }
        """;
  }
}
