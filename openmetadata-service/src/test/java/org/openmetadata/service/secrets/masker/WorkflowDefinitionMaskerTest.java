package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.core.JsonPointer;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.GitSinkConfig;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.WebhookSinkConfig;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;

class WorkflowDefinitionMaskerTest {
  private static final String GIT_TOKEN = "ghp_rawGitToken123";
  private static final String WEBHOOK_TOKEN = "rawBearerToken456";
  private static final String WEBHOOK_PASSWORD = "rawBasicPassword789";
  private static final String GIT_NODE = "gitSink";
  private static final String WEBHOOK_NODE = "webhookSink";
  private static final String EDGES_JSON = "[{\"from\":\"start\",\"to\":\"gitSink\"}]";

  @Test
  void passwordPointersAreDerivedFromTheSinkConfigSchemas() {
    assertEquals(
        pointers("/credentials/token"), Set.copyOf(WorkflowDefinitionMasker.GIT_SECRET_POINTERS));
    assertEquals(
        pointers("/authentication/token", "/authentication/password", "/authentication/apiKey"),
        Set.copyOf(WorkflowDefinitionMasker.WEBHOOK_SECRET_POINTERS));
  }

  @Test
  void maskHidesSinkSecretsInNodesAndChangeDescriptions() {
    WorkflowDefinition definition = definitionWithSinks(GIT_TOKEN);
    String nodesJson = JsonUtils.pojoToJson(definition.getNodes());
    definition.setChangeDescription(nodesChange(nodesJson));
    definition.setIncrementalChangeDescription(nodesChange(nodesJson));

    String maskedJson = JsonUtils.pojoToJson(WorkflowDefinitionMasker.mask(definition));

    assertFalse(maskedJson.contains(GIT_TOKEN));
    assertFalse(maskedJson.contains(WEBHOOK_TOKEN));
    assertFalse(maskedJson.contains(WEBHOOK_PASSWORD));
    assertTrue(maskedJson.contains(PASSWORD_MASK));
    assertTrue(maskedJson.contains("https://github.com/org/repo.git"));
    assertTrue(maskedJson.contains("webhookUser"));
    assertEquals(GIT_TOKEN, gitToken(definition), "mask must not mutate the stored definition");
  }

  @Test
  void maskToleratesEdgeObjectsRecordedUnderTheNodesField() {
    WorkflowDefinition definition = definitionWithSinks(GIT_TOKEN);
    definition.setChangeDescription(
        new ChangeDescription()
            .withFieldsAdded(List.of(new FieldChange().withName("nodes").withNewValue(EDGES_JSON)))
            .withFieldsUpdated(List.of())
            .withFieldsDeleted(List.of()));

    WorkflowDefinition masked = assertDoesNotThrow(() -> WorkflowDefinitionMasker.mask(definition));

    assertEquals(
        JsonUtils.readTree(EDGES_JSON),
        JsonUtils.readTree(
            (String) masked.getChangeDescription().getFieldsAdded().getFirst().getNewValue()));
  }

  @Test
  void maskHidesSinkSecretsInEveryHistoryVersion() {
    EntityHistory history =
        new EntityHistory()
            .withEntityType("workflowDefinition")
            .withVersions(
                List.of(
                    JsonUtils.pojoToJson(definitionWithSinks(GIT_TOKEN)),
                    JsonUtils.pojoToJson(definitionWithSinks("olderRawToken"))));

    String maskedJson = JsonUtils.pojoToJson(WorkflowDefinitionMasker.mask(history));

    assertFalse(maskedJson.contains(GIT_TOKEN));
    assertFalse(maskedJson.contains("olderRawToken"));
    assertFalse(maskedJson.contains(WEBHOOK_PASSWORD));
  }

  @Test
  void restoreKeepsStoredSecretsWhenTheMaskIsSentBack() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowDefinition incoming = WorkflowDefinitionMasker.mask(stored);

    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, incoming);

    assertEquals(stored.getNodes(), incoming.getNodes());
  }

  @Test
  void restoreKeepsANewSecretValue() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowDefinition incoming = WorkflowDefinitionMasker.mask(stored);
    setGitToken(incoming, "ghp_rotatedToken");

    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, incoming);

    assertEquals("ghp_rotatedToken", gitToken(incoming));
    assertEquals(WEBHOOK_PASSWORD, webhookConfig(incoming).getAuthentication().getPassword());
  }

  @Test
  void secretReferencesSurviveAMaskedRoundTrip() {
    WorkflowDefinition stored = definitionWithSinks("secret:/workflows/git/token");
    WorkflowDefinition incoming = WorkflowDefinitionMasker.mask(stored);

    assertEquals(PASSWORD_MASK, gitToken(incoming));
    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, incoming);
    assertEquals("secret:/workflows/git/token", gitToken(incoming));
  }

  @Test
  void aNewDefinitionSentWithTheMaskIsRejected() {
    WorkflowDefinition created = definitionWithSinks(PASSWORD_MASK);

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionMasker.requireNoMaskedSecrets(created));

    assertEquals(400, rejected.getResponse().getStatus());
    assertTrue(rejected.getMessage().contains("'%s'".formatted(GIT_NODE)), rejected.getMessage());
    assertTrue(rejected.getMessage().contains("/credentials/token"), rejected.getMessage());
  }

  @Test
  void aMaskOnARenamedNodeCannotBeRestoredAndIsRejected() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowDefinition incoming = WorkflowDefinitionMasker.mask(stored);
    sinkNode(incoming, GIT_NODE).setName("renamedGitSink");

    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, incoming);

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionMasker.requireNoMaskedSecrets(incoming));
    assertTrue(rejected.getMessage().contains("'renamedGitSink'"), rejected.getMessage());
  }

  @Test
  void aMaskRestoredFromTheStoredNodeIsAccepted() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowDefinition incoming = WorkflowDefinitionMasker.mask(stored);

    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, incoming);

    assertDoesNotThrow(() -> WorkflowDefinitionMasker.requireNoMaskedSecrets(incoming));
    assertEquals(GIT_TOKEN, gitToken(incoming));
  }

  private static WorkflowDefinition definitionWithSinks(String gitToken) {
    String json =
        """
        {
          "name": "sinkWorkflow",
          "fullyQualifiedName": "sinkWorkflow",
          "nodes": [
            {"type": "startEvent", "subType": "startEvent", "name": "start"},
            {
              "type": "automatedTask",
              "subType": "sinkTask",
              "name": "%s",
              "config": {
                "sinkType": "git",
                "sinkConfig": {
                  "repositoryUrl": "https://github.com/org/repo.git",
                  "credentials": {"type": "token", "token": "%s"}
                }
              }
            },
            {
              "type": "automatedTask",
              "subType": "sinkTask",
              "name": "%s",
              "config": {
                "sinkType": "webhook",
                "sinkConfig": {
                  "endpoint": "https://hooks.example.com/sink",
                  "authentication": {
                    "type": "basic",
                    "token": "%s",
                    "username": "webhookUser",
                    "password": "%s"
                  }
                }
              }
            },
            {"type": "endEvent", "subType": "endEvent", "name": "end"}
          ]
        }
        """
            .formatted(GIT_NODE, gitToken, WEBHOOK_NODE, WEBHOOK_TOKEN, WEBHOOK_PASSWORD);
    return JsonUtils.readValue(json, WorkflowDefinition.class);
  }

  private static ChangeDescription nodesChange(String nodesJson) {
    return new ChangeDescription()
        .withFieldsAdded(List.of(new FieldChange().withName("nodes").withNewValue(nodesJson)))
        .withFieldsUpdated(
            List.of(
                new FieldChange()
                    .withName("nodes")
                    .withOldValue(nodesJson)
                    .withNewValue(nodesJson)))
        .withFieldsDeleted(List.of(new FieldChange().withName("nodes").withOldValue(nodesJson)));
  }

  private static SinkTaskDefinition sinkNode(WorkflowDefinition definition, String name) {
    return definition.getNodes().stream()
        .filter(node -> name.equals(node.getName()))
        .map(SinkTaskDefinition.class::cast)
        .findFirst()
        .orElseThrow();
  }

  private static GitSinkConfig gitConfig(WorkflowDefinition definition) {
    return JsonUtils.convertValue(
        sinkNode(definition, GIT_NODE).getConfig().getSinkConfig(), GitSinkConfig.class);
  }

  private static WebhookSinkConfig webhookConfig(WorkflowDefinition definition) {
    return JsonUtils.convertValue(
        sinkNode(definition, WEBHOOK_NODE).getConfig().getSinkConfig(), WebhookSinkConfig.class);
  }

  private static String gitToken(WorkflowDefinition definition) {
    return gitConfig(definition).getCredentials().getToken();
  }

  @SuppressWarnings("unchecked")
  private static void setGitToken(WorkflowDefinition definition, String token) {
    // SinkConfig is schema-less, so the generated class exposes its content only as a raw map.
    var credentials =
        (Map<String, Object>)
            sinkNode(definition, GIT_NODE)
                .getConfig()
                .getSinkConfig()
                .getAdditionalProperties()
                .get("credentials");
    credentials.put("token", token);
  }

  private static Set<JsonPointer> pointers(String... pointers) {
    return Stream.of(pointers).map(JsonPointer::compile).collect(Collectors.toSet());
  }
}
