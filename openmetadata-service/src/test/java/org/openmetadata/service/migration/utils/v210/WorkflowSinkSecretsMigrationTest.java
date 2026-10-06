package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.IntStream;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.SinkTask;
import org.openmetadata.service.migration.utils.v210.WorkflowSinkSecretsMigration.StoredRow;
import org.openmetadata.service.secrets.masker.WorkflowDefinitionMasker;
import org.slf4j.LoggerFactory;

class WorkflowSinkSecretsMigrationTest {
  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String GIT_TOKEN = "ghp_storedPlaintextToken";
  private static final String PASSPHRASE = "storedPlaintextPassphrase";
  private static final String ROW_ID = "3f1c2a4e-0000-4000-8000-000000000001";
  private static final String VERSION_EXTENSION = "workflowDefinition.version.0.2";
  private static final String GIT_SINK_CONFIG = "/nodes/0/config/sinkConfig";
  private static final String STORED_DEFINITION =
      """
      {
        "id": "%s",
        "name": "gitSinkWorkflow",
        "fullyQualifiedName": "gitSinkWorkflow",
        "nodes": [
          {
            "type": "automatedTask",
            "subType": "sinkTask",
            "name": "gitSink",
            "config": {
              "sinkType": "git",
              "sinkConfig": {
                "repositoryUrl": "https://github.com/org/repo.git",
                "credentials": {"type": "token", "token": "%s"},
                "signingKey": {"privateKey": "secret:/git/key", "passphrase": "%s"}
              }
            }
          }
        ]
      }
      """
          .formatted(ROW_ID, GIT_TOKEN, PASSPHRASE);

  private static final String WITHOUT_SINK =
      """
      {"id": "%s", "name": "%s", "nodes": [
        {"type": "startEvent", "subType": "startEvent", "name": "start"}]}
      """;

  private static final Predicate<WorkflowDefinition> DEPLOYED_WITH_PLAINTEXT = definition -> true;

  private final Logger migrationLogger =
      (Logger) LoggerFactory.getLogger(WorkflowSinkSecretsMigration.class);
  private final ListAppender<ILoggingEvent> logged = new ListAppender<>();
  private final List<String> deployed = new ArrayList<>();
  private final AtomicInteger initializations = new AtomicInteger();

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    logged.start();
    migrationLogger.addAppender(logged);
  }

  @AfterEach
  void tearDown() {
    migrationLogger.detachAppender(logged);
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void aPlaintextRowIsEncryptedAndASecondRunLeavesItAlone() {
    JsonNode encrypted =
        WorkflowSinkSecretsMigration.encryptedOrNull(
            new StoredRow(ROW_ID, VERSION_EXTENSION, STORED_DEFINITION));

    assertNotNull(encrypted);
    String encryptedJson = encrypted.toString();
    assertFalse(encryptedJson.contains(GIT_TOKEN));
    assertFalse(encryptedJson.contains(PASSPHRASE));
    JsonNode sinkConfig = encrypted.at(GIT_SINK_CONFIG);
    assertEquals(
        GIT_TOKEN, Fernet.getInstance().decrypt(sinkConfig.at("/credentials/token").asText()));
    assertEquals(
        "secret:/git/key",
        Fernet.getInstance().decrypt(sinkConfig.at("/signingKey/privateKey").asText()));
    assertEquals("https://github.com/org/repo.git", sinkConfig.at("/repositoryUrl").asText());

    assertNull(
        WorkflowSinkSecretsMigration.encryptedOrNull(
            new StoredRow(ROW_ID, VERSION_EXTENSION, encryptedJson)),
        "a row that only holds ciphertext needs no update");
  }

  @Test
  void aRowWithoutSinkSecretsIsNotUpdated() {
    String withoutSink = WITHOUT_SINK.formatted(ROW_ID, "plain");

    assertNull(
        WorkflowSinkSecretsMigration.encryptedOrNull(new StoredRow(ROW_ID, null, withoutSink)));
  }

  @Test
  void anUnreadableRowIsSkipped() {
    assertNull(
        WorkflowSinkSecretsMigration.encryptedOrNull(
            new StoredRow(ROW_ID, VERSION_EXTENSION, "{not json")));
  }

  @Test
  void withoutAFernetKeyRowsAreLeftAsStored() {
    Fernet.getInstance().setFernetKey((String) null);

    assertNull(
        WorkflowSinkSecretsMigration.encryptedOrNull(
            new StoredRow(ROW_ID, null, STORED_DEFINITION)));
    assertTrue(STORED_DEFINITION.contains(GIT_TOKEN));
  }

  @Test
  void anActiveDefinitionDeployedWithPlaintextIsRedeployedButDeletedAndSinklessOnesAreNot() {
    StoredRow encrypted = encryptedDefinition(ROW_ID, "gitSinkWorkflow", false);
    StoredRow deleted =
        encryptedDefinition("3f1c2a4e-0000-4000-8000-000000000002", "deletedSink", true);
    StoredRow withoutSink =
        new StoredRow(
            "3f1c2a4e-0000-4000-8000-000000000003",
            null,
            WITHOUT_SINK.formatted("3f1c2a4e-0000-4000-8000-000000000003", "plain"));
    assertNull(
        WorkflowSinkSecretsMigration.encryptedOrNull(encrypted),
        "this run has nothing to encrypt in the row");

    List<String> failed =
        WorkflowSinkSecretsMigration.redeploySinkWorkflows(
            singlePage(List.of(encrypted, deleted, withoutSink)),
            initializations::incrementAndGet,
            secrets(DEPLOYED_WITH_PLAINTEXT),
            recordDeploy());

    assertEquals(List.of("gitSinkWorkflow"), deployed);
    assertEquals(1, initializations.get());
    assertTrue(failed.isEmpty());
  }

  @Test
  void aFailedRedeployIsLoggedWithTheRedeployEndpointAndTheOthersStillRun() {
    String brokenName = "brokenSink";
    StoredRow broken = encryptedDefinition(ROW_ID, brokenName, false);
    StoredRow healthy =
        encryptedDefinition("3f1c2a4e-0000-4000-8000-000000000002", "healthySink", false);
    Consumer<WorkflowDefinition> deployer =
        definition -> {
          if (brokenName.equals(definition.getName())) {
            throw new IllegalStateException("flowable unavailable");
          }
          deployed.add(definition.getName());
        };

    List<String> failed =
        WorkflowSinkSecretsMigration.redeploySinkWorkflows(
            singlePage(List.of(broken, healthy)),
            initializations::incrementAndGet,
            secrets(DEPLOYED_WITH_PLAINTEXT),
            deployer);

    assertEquals(List.of("healthySink"), deployed);
    assertEquals(List.of("brokenSink (%s): flowable unavailable".formatted(ROW_ID)), failed);
    ILoggingEvent warning = onlyEventAt(Level.WARN);
    assertTrue(warning.getFormattedMessage().contains(failed.getFirst()));
    assertTrue(
        warning.getFormattedMessage().contains(WorkflowSinkSecretsMigration.REDEPLOY_ENDPOINT));
  }

  @Test
  void aWorkflowHandlerThatFailsToInitializeIsLoggedAndDoesNotFailTheMigration() {
    StoredRow encrypted = encryptedDefinition(ROW_ID, "gitSinkWorkflow", false);
    Runnable failingInitialization =
        () -> {
          throw new IllegalStateException("flowable tables missing");
        };

    List<String> failed =
        WorkflowSinkSecretsMigration.redeploySinkWorkflows(
            singlePage(List.of(encrypted)),
            failingInitialization,
            secrets(DEPLOYED_WITH_PLAINTEXT),
            recordDeploy());

    assertTrue(deployed.isEmpty());
    assertTrue(failed.isEmpty());
    ILoggingEvent error = onlyEventAt(Level.ERROR);
    assertTrue(
        error.getFormattedMessage().contains(WorkflowSinkSecretsMigration.REDEPLOY_ENDPOINT));
    assertNotNull(error.getThrowableProxy());
  }

  @Test
  void withoutADefinitionToRedeployTheWorkflowHandlerIsNotInitialized() {
    StoredRow withoutSink = new StoredRow(ROW_ID, null, WITHOUT_SINK.formatted(ROW_ID, "plain"));

    WorkflowSinkSecretsMigration.redeploySinkWorkflows(
        singlePage(List.of(withoutSink)),
        initializations::incrementAndGet,
        secrets(DEPLOYED_WITH_PLAINTEXT),
        recordDeploy());

    assertEquals(0, initializations.get());
    assertTrue(deployed.isEmpty());
  }

  @Test
  void definitionsAreRedeployedPageByPageAndTheHandlerIsInitializedOnce() {
    List<StoredRow> rows =
        IntStream.range(0, WorkflowSinkSecretsMigration.PAGE_SIZE + 1)
            .mapToObj(
                i ->
                    encryptedDefinition(UUID.randomUUID().toString(), "sink%d".formatted(i), false))
            .toList();
    List<StoredRow> cursors = new ArrayList<>();
    Function<StoredRow, List<StoredRow>> pageAfter =
        cursor -> {
          cursors.add(cursor);
          int from = cursors.size() == 1 ? 0 : WorkflowSinkSecretsMigration.PAGE_SIZE;
          int to = Math.min(from + WorkflowSinkSecretsMigration.PAGE_SIZE, rows.size());
          return rows.subList(from, to);
        };

    WorkflowSinkSecretsMigration.redeploySinkWorkflows(
        pageAfter,
        initializations::incrementAndGet,
        secrets(DEPLOYED_WITH_PLAINTEXT),
        recordDeploy());

    assertEquals(rows.size(), deployed.size());
    assertEquals(1, initializations.get());
    assertEquals(2, cursors.size(), "a short page is the last one read");
    assertEquals(rows.get(WorkflowSinkSecretsMigration.PAGE_SIZE - 1), cursors.getLast());
  }

  @Test
  void aDefinitionWhoseDeploymentHoldsNoPlaintextSecretIsNotRedeployed() {
    StoredRow encrypted = encryptedDefinition(ROW_ID, "gitSinkWorkflow", false);
    StoredRow stillPlaintext =
        encryptedDefinition("3f1c2a4e-0000-4000-8000-000000000002", "plaintextDeployed", false);
    List<String> checked = new ArrayList<>();
    Predicate<WorkflowDefinition> isDeployedWithPlaintext =
        definition -> {
          checked.add(definition.getName());
          return "plaintextDeployed".equals(definition.getName());
        };

    List<String> failed =
        WorkflowSinkSecretsMigration.redeploySinkWorkflows(
            singlePage(List.of(encrypted, stillPlaintext)),
            initializations::incrementAndGet,
            secrets(isDeployedWithPlaintext),
            recordDeploy());

    assertEquals(List.of("gitSinkWorkflow", "plaintextDeployed"), checked);
    assertEquals(List.of("plaintextDeployed"), deployed);
    assertEquals(1, initializations.get(), "the deployments are read through the handler");
    assertTrue(failed.isEmpty());
  }

  @Test
  void aDeploymentThatCannotBeReadIsLoggedAndTheOthersStillRun() {
    StoredRow unreadable = encryptedDefinition(ROW_ID, "unreadableSink", false);
    StoredRow healthy =
        encryptedDefinition("3f1c2a4e-0000-4000-8000-000000000002", "healthySink", false);
    Predicate<WorkflowDefinition> isDeployedWithPlaintext =
        definition -> {
          if ("unreadableSink".equals(definition.getName())) {
            throw new IllegalStateException("bpmn unavailable");
          }
          return true;
        };

    List<String> failed =
        WorkflowSinkSecretsMigration.redeploySinkWorkflows(
            singlePage(List.of(unreadable, healthy)),
            initializations::incrementAndGet,
            secrets(isDeployedWithPlaintext),
            recordDeploy());

    assertEquals(List.of("healthySink"), deployed);
    assertEquals(List.of("unreadableSink (%s): bpmn unavailable".formatted(ROW_ID)), failed);
    assertTrue(onlyEventAt(Level.WARN).getFormattedMessage().contains(failed.getFirst()));
  }

  @Test
  void theDeployedSinkConfigIsReadFromTheSinkTaskOfTheBpmn() {
    WorkflowDefinition plaintext = JsonUtils.readValue(STORED_DEFINITION, WorkflowDefinition.class);
    WorkflowDefinition encrypted =
        JsonUtils.readValue(
            encryptedDefinition(ROW_ID, "gitSinkWorkflow", false).json(), WorkflowDefinition.class);
    BpmnModel plaintextModel = sinkTaskModel(plaintext);
    BpmnModel encryptedModel = sinkTaskModel(encrypted);

    String deployed =
        WorkflowSinkSecretsMigration.deployedSinkConfig(plaintextModel, "gitSink").orElseThrow();

    assertEquals(GIT_TOKEN, JsonUtils.readTree(deployed).at("/credentials/token").asText());
    assertTrue(WorkflowSinkSecretsMigration.deployedSinkConfig(plaintextModel, "absent").isEmpty());
    assertTrue(
        WorkflowDefinitionMasker.hasPlaintextDeployedSecret(
            encrypted,
            nodeName -> WorkflowSinkSecretsMigration.deployedSinkConfig(plaintextModel, nodeName)));
    assertFalse(
        WorkflowDefinitionMasker.hasPlaintextDeployedSecret(
            encrypted,
            nodeName -> WorkflowSinkSecretsMigration.deployedSinkConfig(encryptedModel, nodeName)));
  }

  /** A BPMN model holding the sink tasks of {@code definition}, as the main workflow builds them. */
  private static BpmnModel sinkTaskModel(WorkflowDefinition definition) {
    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId(definition.getName());
    model.addProcess(process);
    definition.getNodes().stream()
        .map(SinkTaskDefinition.class::cast)
        .map(node -> new SinkTask(node, new WorkflowConfiguration()))
        .forEach(sinkTask -> sinkTask.addToWorkflow(model, process));
    return model;
  }

  private static List<RedeployReason> secrets(
      Predicate<WorkflowDefinition> isDeployedWithPlaintext) {
    return List.of(WorkflowSinkSecretsMigration.plaintextSecrets(isDeployedWithPlaintext));
  }

  private Consumer<WorkflowDefinition> recordDeploy() {
    return definition -> deployed.add(definition.getName());
  }

  private ILoggingEvent onlyEventAt(Level level) {
    List<ILoggingEvent> events =
        logged.list.stream().filter(event -> event.getLevel() == level).toList();
    assertEquals(1, events.size(), () -> "expected one %s event: %s".formatted(level, events));
    return events.getFirst();
  }

  private static Function<StoredRow, List<StoredRow>> singlePage(List<StoredRow> rows) {
    return cursor -> rows;
  }

  /** A stored definition row whose sink secrets an earlier run already encrypted. */
  private static StoredRow encryptedDefinition(String id, String name, boolean deleted) {
    JsonNode definition =
        WorkflowSinkSecretsMigration.encryptedOrNull(new StoredRow(id, null, STORED_DEFINITION));
    assertNotNull(definition);
    WorkflowDefinition stored = JsonUtils.treeToValue(definition, WorkflowDefinition.class);
    stored.withId(UUID.fromString(id)).withName(name).withDeleted(deleted);
    return new StoredRow(id, null, JsonUtils.pojoToJson(stored));
  }
}
