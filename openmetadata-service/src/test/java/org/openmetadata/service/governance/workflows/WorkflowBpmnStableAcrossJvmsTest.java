package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import org.flowable.bpmn.converter.BpmnXMLConverter;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CollectMetadataTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler.WorkflowBpmn;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.CollectMetadataTask;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * The server compares the BPMN it builds with the deployed one byte for byte on every start
 * (ADR:2026-11-23-a-changed-workflow-is-deployed-when-the-server-starts), so a workflow must build
 * the same BPMN in every JVM. One JVM cannot show a difference: {@code Set.of} and {@code Map.of}
 * keep one iteration order for the life of a JVM and pick another in the next. Each seeded
 * workflow, and a collect-metadata task, is built here and in two child JVMs.
 */
class WorkflowBpmnStableAcrossJvmsTest {
  private static final String DIGEST_LINE = "BPMN-DIGEST ";
  private static final String SEEDED_WORKFLOWS = ".*json/data/governance/workflows/.*\\.json$";
  private static final String COLLECT_METADATA =
      """
      {"type":"automatedTask","subType":"collectMetadataTask","name":"collectDescription",
       "config":{"stage":"Draft","targetStage":"In Review","taskAssignees":"owners",
                 "fields":[{"field":"description","rules":"{\\"!!\\":[{\\"var\\":\\"description\\"}]}"}]},
       "inputNamespaceMap":{"relatedEntity":"global"}}
      """;

  @Test
  void everySeededWorkflowBuildsTheSameBpmnInAnotherJvm() throws Exception {
    final List<String> digests = digests();

    assertEquals(digests, digestsInChildJvm());
    assertEquals(digests, digestsInChildJvm());
  }

  /** Run in a child JVM by the test: prints one digest line per workflow. */
  public static void main(String[] args) throws Exception {
    digests().forEach(digest -> System.out.println(DIGEST_LINE + digest));
  }

  private static List<String> digests() throws IOException, NoSuchAlgorithmException {
    final List<String> digests = new ArrayList<>();
    for (final WorkflowDefinition workflow :
        EntityRepository.getEntitiesFromSeedData(
            Entity.WORKFLOW_DEFINITION, SEEDED_WORKFLOWS, WorkflowDefinition.class)) {
      workflow.setFullyQualifiedName(workflow.getName());
      final WorkflowBpmn bpmn = WorkflowHandler.toBpmn(new Workflow(workflow));
      digests.add(workflow.getName() + " " + digest(bpmn.main()) + " " + digest(bpmn.trigger()));
    }
    digests.add("collectMetadataTask " + digest(collectMetadataBpmn()));
    return digests.stream().sorted().toList();
  }

  private static byte[] collectMetadataBpmn() {
    final BpmnModel model = new BpmnModel();
    final Process process = new Process();
    process.setId("collectMetadataWorkflow");
    model.addProcess(process);
    new CollectMetadataTask(
            JsonUtils.readValue(COLLECT_METADATA, CollectMetadataTaskDefinition.class),
            new WorkflowConfiguration().withStoreStageStatus(false),
            "collectMetadataWorkflow")
        .addToWorkflow(model, process);
    return new BpmnXMLConverter().convertToXML(model);
  }

  private static String digest(byte[] bytes) throws NoSuchAlgorithmException {
    return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
  }

  private static List<String> digestsInChildJvm() throws IOException, InterruptedException {
    final var child =
        new ProcessBuilder(
                Path.of(System.getProperty("java.home"), "bin", "java").toString(),
                "-cp",
                System.getProperty("java.class.path"),
                WorkflowBpmnStableAcrossJvmsTest.class.getName())
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .start();
    final String output = new String(child.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    assertEquals(0, child.waitFor(), "the child JVM failed to build the workflows");
    return output
        .lines()
        .filter(line -> line.startsWith(DIGEST_LINE))
        .map(line -> line.substring(DIGEST_LINE.length()))
        .toList();
  }
}
