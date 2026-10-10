package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.core.JsonPointer;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkConfig;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.GitSinkConfig;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.SigningKey;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.WebhookSinkConfig;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;

class WorkflowDefinitionMaskerTest {
  static final String GIT_TOKEN = "ghp_rawGitToken123";
  private static final String SIGNING_KEY =
      "-----BEGIN PGP PRIVATE KEY BLOCK-----\nrawKeyMaterial\n-----END PGP PRIVATE KEY BLOCK-----";
  static final String SIGNING_PASSPHRASE = "rawSigningPassphrase";
  private static final String WEBHOOK_TOKEN = "rawBearerToken456";
  private static final String WEBHOOK_PASSWORD = "rawBasicPassword789";
  static final String GIT_NODE = "gitSink";
  private static final String WEBHOOK_NODE = "webhookSink";
  static final String STORED_CIPHERTEXT = "fernet:storedForThisNode";
  private static final String EDGES_JSON = "[{\"from\":\"start\",\"to\":\"gitSink\"}]";

  @Test
  void passwordPointersAreDerivedFromTheSinkConfigSchemas() {
    assertEquals(
        pointers("/credentials/token", "/signingKey/privateKey", "/signingKey/passphrase"),
        Set.copyOf(WorkflowDefinitionMasker.GIT_SECRET_POINTERS));
    assertEquals(
        pointers("/authentication/token", "/authentication/password", "/authentication/apiKey"),
        Set.copyOf(WorkflowDefinitionMasker.WEBHOOK_SECRET_POINTERS));
  }

  @Test
  void hasSinkSecretsReportsANonEmptySecretAtTheSecretFieldsOfTheNodesSinkType() {
    WorkflowDefinition emptyToken = gitSinkOnly("");
    sinkNode(emptyToken, GIT_NODE)
        .getConfig()
        .getSinkConfig()
        .setAdditionalProperty("authentication", Map.of("token", WEBHOOK_TOKEN));

    assertTrue(WorkflowDefinitionMasker.hasSinkSecrets(gitSinkOnly(GIT_TOKEN)));
    assertTrue(WorkflowDefinitionMasker.hasSinkSecrets(definitionWithSinks("")));
    assertFalse(WorkflowDefinitionMasker.hasSinkSecrets(gitSinkOnly("")));
    assertFalse(
        WorkflowDefinitionMasker.hasSinkSecrets(emptyToken),
        "a value at another sink type's secret field is not a secret of this node");
    assertFalse(WorkflowDefinitionMasker.hasSinkSecrets(new WorkflowDefinition()));
  }

  /** The definition with its webhook sink left without a config, so only the Git sink holds one. */
  private static WorkflowDefinition gitSinkOnly(String gitToken) {
    WorkflowDefinition definition = definitionWithSinks(gitToken);
    sinkNode(definition, WEBHOOK_NODE).getConfig().setSinkConfig(null);
    return definition;
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
  void signingKeyAndPassphraseAreMaskedAndTheStoredOnesKeptWhenTheMaskIsSentBack() {
    WorkflowDefinition stored = definitionWithSigningKey(SIGNING_KEY, SIGNING_PASSPHRASE);

    WorkflowDefinition masked = WorkflowDefinitionMasker.mask(stored);
    String maskedJson = JsonUtils.pojoToJson(masked);

    assertFalse(maskedJson.contains("rawKeyMaterial"));
    assertFalse(maskedJson.contains(SIGNING_PASSPHRASE));
    assertEquals(PASSWORD_MASK, gitConfig(masked).getSigningKey().getPrivateKey());
    assertEquals(PASSWORD_MASK, gitConfig(masked).getSigningKey().getPassphrase());
    assertEquals(Boolean.TRUE, gitConfig(masked).getAllowUnsignedFastPush());

    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, masked);

    assertDoesNotThrow(() -> WorkflowDefinitionSecretGuards.requireNoMaskedSecrets(masked));
    assertEquals(SIGNING_KEY, gitConfig(masked).getSigningKey().getPrivateKey());
    assertEquals(SIGNING_PASSPHRASE, gitConfig(masked).getSigningKey().getPassphrase());
    assertEquals(GIT_TOKEN, gitToken(masked));
  }

  @Test
  void aDeployedSinkConfigWithAPlaintextSecretIsReported() {
    WorkflowDefinition definition = definitionWithSinks(STORED_CIPHERTEXT);
    String plaintextConfig = deployedGitConfig(GIT_TOKEN);

    assertTrue(
        WorkflowDefinitionMasker.hasPlaintextDeployedSecret(
            definition, deployedConfigs(Map.of(GIT_NODE, plaintextConfig))));
  }

  @Test
  void aDeployedSinkConfigWithoutAPlaintextSecretIsNotReported() {
    WorkflowDefinition definition = definitionWithSinks(STORED_CIPHERTEXT);
    Map<String, String> deployed =
        Map.of(
            GIT_NODE,
            deployedGitConfig(STORED_CIPHERTEXT),
            WEBHOOK_NODE,
            "{\"authentication\": {\"token\": \"secret:/hooks/token\", \"password\": \"\"}}");

    assertFalse(
        WorkflowDefinitionMasker.hasPlaintextDeployedSecret(definition, deployedConfigs(deployed)));
    assertFalse(
        WorkflowDefinitionMasker.hasPlaintextDeployedSecret(
            definition, deployedConfigs(Map.of(GIT_NODE, "{}", WEBHOOK_NODE, ""))));
    assertFalse(
        WorkflowDefinitionMasker.hasPlaintextDeployedSecret(
            definition, nodeName -> Optional.empty()),
        "a definition that is not deployed holds no deployed secret");
  }

  @Test
  void aValueAtAnotherSinkTypesSecretFieldIsNotReportedAsAPlaintextSecret() {
    WorkflowDefinition definition = definitionWithSinks(STORED_CIPHERTEXT);
    String gitConfigWithWebhookField =
        "{\"credentials\": {\"token\": \"%s\"}, \"authentication\": {\"token\": \"notASecret\"}}"
            .formatted(STORED_CIPHERTEXT);

    assertFalse(
        WorkflowDefinitionMasker.hasPlaintextDeployedSecret(
            definition, deployedConfigs(Map.of(GIT_NODE, gitConfigWithWebhookField))));
  }

  private static String deployedGitConfig(String token) {
    return "{\"repositoryUrl\": \"https://github.com/org/repo.git\", \"credentials\": {\"type\": \"token\", \"token\": \"%s\"}}"
        .formatted(token);
  }

  private static Function<String, Optional<String>> deployedConfigs(Map<String, String> configs) {
    return nodeName -> Optional.ofNullable(configs.get(nodeName));
  }

  static WorkflowDefinition definitionWithSigningKey(String privateKey, String passphrase) {
    WorkflowDefinition definition = definitionWithSinks(GIT_TOKEN);
    GitSinkConfig config =
        gitConfig(definition)
            .withAllowUnsignedFastPush(true)
            .withSigningKey(new SigningKey().withPrivateKey(privateKey).withPassphrase(passphrase));
    sinkNode(definition, GIT_NODE)
        .getConfig()
        .setSinkConfig(JsonUtils.convertValue(config, SinkConfig.class));
    return definition;
  }

  static WorkflowDefinition definitionWithSinks(String gitToken) {
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

  static SinkTaskDefinition sinkNode(WorkflowDefinition definition, String name) {
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

  static String gitToken(WorkflowDefinition definition) {
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
