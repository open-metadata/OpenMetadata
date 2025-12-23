package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.sdk.fluent.OpenLineage;

/**
 * Integration tests for OpenLineage API operations.
 *
 * <p>Tests OpenLineage event submission using the fluent API, including: - Single run events with
 * different event types (START, COMPLETE, FAIL) - Batch event submission - Events with input and
 * output datasets - Events with job and run metadata - Producer and schema URL configuration
 *
 * <p>Test isolation: Uses TestNamespaceExtension for unique entity names Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OpenLineageResourceIT {

  @BeforeAll
  static void setup() {
    OpenLineage.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void testSendSimpleRunEvent(TestNamespace ns) throws Exception {
    String jobName = ns.prefix("simple_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    String response =
        OpenLineage.event()
            .withEventType("START")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .send();

    assertNotNull(response, "Response should not be null");
  }

  @Test
  void testSendCompleteEvent(TestNamespace ns) throws Exception {
    String jobName = ns.prefix("complete_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .withProducer("https://github.com/OpenLineage/OpenLineage/test")
            .send();

    assertNotNull(response);
  }

  @Test
  void testSendFailEvent(TestNamespace ns) throws Exception {
    String jobName = ns.prefix("fail_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    String response =
        OpenLineage.event()
            .withEventType("FAIL")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .send();

    assertNotNull(response);
  }

  @Test
  void testSendEventWithInputsOutputs(TestNamespace ns) throws Exception {
    String jobName = ns.prefix("transform_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .addInput("input_dataset_1", ns.prefix("input_ns"))
            .addInput("input_dataset_2", ns.prefix("input_ns"))
            .addOutput("output_dataset", ns.prefix("output_ns"))
            .send();

    assertNotNull(response);
  }

  @Test
  void testSendEventWithProducerAndSchema(TestNamespace ns) throws Exception {
    String jobName = ns.prefix("producer_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    String response =
        OpenLineage.event()
            .withEventType("START")
            .withEventTime(Instant.now().toString())
            .withProducer("https://github.com/OpenLineage/OpenLineage/test")
            .withSchemaURL("https://openlineage.io/spec/1-0-5/OpenLineage.json")
            .withJob(jobName, namespace)
            .withRun(runId)
            .send();

    assertNotNull(response);
  }

  @Test
  void testSendEventWithDetailedDatasets(TestNamespace ns) throws Exception {
    String jobName = ns.prefix("detailed_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    Map<String, Object> inputDataset = new HashMap<>();
    inputDataset.put("name", "detailed_input");
    inputDataset.put("namespace", ns.prefix("detailed_ns"));
    Map<String, Object> facets = new HashMap<>();
    facets.put("schema", createSchemaFacet());
    inputDataset.put("facets", facets);

    Map<String, Object> outputDataset = new HashMap<>();
    outputDataset.put("name", "detailed_output");
    outputDataset.put("namespace", ns.prefix("detailed_ns"));

    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .addInput(inputDataset)
            .addOutput(outputDataset)
            .send();

    assertNotNull(response);
  }

  @Test
  void testSendEventWithFullJobDetails(TestNamespace ns) throws Exception {
    String jobName = ns.prefix("full_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    Map<String, Object> jobDetails = new HashMap<>();
    jobDetails.put("name", jobName);
    jobDetails.put("namespace", namespace);
    Map<String, Object> jobFacets = new HashMap<>();
    jobFacets.put("documentation", createDocumentationFacet("Job documentation"));
    jobDetails.put("facets", jobFacets);

    String response =
        OpenLineage.event()
            .withEventType("START")
            .withEventTime(Instant.now().toString())
            .withJob(jobDetails)
            .withRun(runId)
            .send();

    assertNotNull(response);
  }

  @Test
  void testSendEventWithFullRunDetails(TestNamespace ns) throws Exception {
    String jobName = ns.prefix("run_details_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    Map<String, Object> runDetails = new HashMap<>();
    runDetails.put("runId", runId);
    Map<String, Object> runFacets = new HashMap<>();
    runFacets.put("nominalTime", createNominalTimeFacet());
    runDetails.put("facets", runFacets);

    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runDetails)
            .send();

    assertNotNull(response);
  }

  @Test
  void testSendBatchEvents(TestNamespace ns) throws Exception {
    String namespace = ns.prefix("batch_namespace");

    Map<String, Object> event1 =
        OpenLineage.event()
            .withEventType("START")
            .withEventTime(Instant.now().toString())
            .withJob(ns.prefix("batch_job_1"), namespace)
            .withRun(UUID.randomUUID().toString())
            .build();

    Map<String, Object> event2 =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(ns.prefix("batch_job_2"), namespace)
            .withRun(UUID.randomUUID().toString())
            .build();

    String response = OpenLineage.batch().addEvent(event1).addEvent(event2).send();

    assertNotNull(response);
  }

  @Test
  void testSendBatchWithBuilder(TestNamespace ns) throws Exception {
    String namespace = ns.prefix("builder_namespace");

    OpenLineage.RunEventBuilder event1 =
        OpenLineage.event()
            .withEventType("START")
            .withEventTime(Instant.now().toString())
            .withJob(ns.prefix("builder_job_1"), namespace)
            .withRun(UUID.randomUUID().toString());

    OpenLineage.RunEventBuilder event2 =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(ns.prefix("builder_job_2"), namespace)
            .withRun(UUID.randomUUID().toString());

    String response = OpenLineage.batch().addEvent(event1).addEvent(event2).send();

    assertNotNull(response);
  }

  @Test
  void testSendLargeBatch(TestNamespace ns) throws Exception {
    String namespace = ns.prefix("large_batch_ns");

    OpenLineage.BatchEventBuilder batch = OpenLineage.batch();

    for (int i = 0; i < 10; i++) {
      OpenLineage.RunEventBuilder event =
          OpenLineage.event()
              .withEventType(i % 2 == 0 ? "START" : "COMPLETE")
              .withEventTime(Instant.now().toString())
              .withJob(ns.prefix("large_batch_job_" + i), namespace)
              .withRun(UUID.randomUUID().toString());
      batch.addEvent(event);
    }

    assertEquals(10, batch.size());
    String response = batch.send();
    assertNotNull(response);
  }

  @Test
  void testPostRawEvent(TestNamespace ns) throws Exception {
    Map<String, Object> event = new HashMap<>();
    event.put("eventType", "START");
    event.put("eventTime", Instant.now().toString());

    Map<String, Object> job = new HashMap<>();
    job.put("name", ns.prefix("raw_job"));
    job.put("namespace", ns.prefix("raw_namespace"));
    event.put("job", job);

    Map<String, Object> run = new HashMap<>();
    run.put("runId", UUID.randomUUID().toString());
    event.put("run", run);

    String response = OpenLineage.postEvent(event);
    assertNotNull(response);
  }

  @Test
  void testPostRawBatch(TestNamespace ns) throws Exception {
    List<Map<String, Object>> events = new ArrayList<>();

    for (int i = 0; i < 3; i++) {
      Map<String, Object> event = new HashMap<>();
      event.put("eventType", "COMPLETE");
      event.put("eventTime", Instant.now().toString());

      Map<String, Object> job = new HashMap<>();
      job.put("name", ns.prefix("raw_batch_job_" + i));
      job.put("namespace", ns.prefix("raw_batch_ns"));
      event.put("job", job);

      Map<String, Object> run = new HashMap<>();
      run.put("runId", UUID.randomUUID().toString());
      event.put("run", run);

      events.add(event);
    }

    String response = OpenLineage.postBatch(events);
    assertNotNull(response);
  }

  @Test
  void testEventWithMultipleInputs(TestNamespace ns) throws Exception {
    String jobName = ns.prefix("multi_input_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .addInput("input_1", ns.prefix("input_ns"))
            .addInput("input_2", ns.prefix("input_ns"))
            .addInput("input_3", ns.prefix("input_ns"))
            .addOutput("output", ns.prefix("output_ns"))
            .send();

    assertNotNull(response);
  }

  @Test
  void testEventWithMultipleOutputs(TestNamespace ns) throws Exception {
    String jobName = ns.prefix("multi_output_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .addInput("input", ns.prefix("input_ns"))
            .addOutput("output_1", ns.prefix("output_ns"))
            .addOutput("output_2", ns.prefix("output_ns"))
            .addOutput("output_3", ns.prefix("output_ns"))
            .send();

    assertNotNull(response);
  }

  @Test
  void testEventWithInputsOutputsList(TestNamespace ns) throws Exception {
    String jobName = ns.prefix("list_io_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    List<Map<String, Object>> inputs = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      Map<String, Object> input = new HashMap<>();
      input.put("name", "input_" + i);
      input.put("namespace", ns.prefix("input_ns"));
      inputs.add(input);
    }

    List<Map<String, Object>> outputs = new ArrayList<>();
    for (int i = 0; i < 2; i++) {
      Map<String, Object> output = new HashMap<>();
      output.put("name", "output_" + i);
      output.put("namespace", ns.prefix("output_ns"));
      outputs.add(output);
    }

    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .withInputs(inputs)
            .withOutputs(outputs)
            .send();

    assertNotNull(response);
  }

  @Test
  void testRunEventSequence(TestNamespace ns) throws Exception {
    String jobName = ns.prefix("sequence_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    String startResponse =
        OpenLineage.event()
            .withEventType("START")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .send();
    assertNotNull(startResponse);

    String runningResponse =
        OpenLineage.event()
            .withEventType("RUNNING")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .send();
    assertNotNull(runningResponse);

    String completeResponse =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .send();
    assertNotNull(completeResponse);
  }

  @Test
  void testAbortEvent(TestNamespace ns) throws Exception {
    String jobName = ns.prefix("abort_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    String startResponse =
        OpenLineage.event()
            .withEventType("START")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .send();
    assertNotNull(startResponse);

    String abortResponse =
        OpenLineage.event()
            .withEventType("ABORT")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .send();
    assertNotNull(abortResponse);
  }

  @Test
  void testBuildEventWithoutSending(TestNamespace ns) {
    String jobName = ns.prefix("build_only_job");
    String namespace = ns.prefix("namespace");
    String runId = UUID.randomUUID().toString();

    Map<String, Object> event =
        OpenLineage.event()
            .withEventType("START")
            .withEventTime(Instant.now().toString())
            .withJob(jobName, namespace)
            .withRun(runId)
            .build();

    assertNotNull(event);
    assertEquals("START", event.get("eventType"));
    assertTrue(event.containsKey("job"));
    assertTrue(event.containsKey("run"));
  }

  @Test
  void testBuildBatchWithoutSending(TestNamespace ns) {
    String namespace = ns.prefix("build_batch_ns");

    Map<String, Object> batch =
        OpenLineage.batch()
            .addEvent(
                OpenLineage.event()
                    .withEventType("START")
                    .withEventTime(Instant.now().toString())
                    .withJob(ns.prefix("batch_build_1"), namespace)
                    .withRun(UUID.randomUUID().toString()))
            .addEvent(
                OpenLineage.event()
                    .withEventType("COMPLETE")
                    .withEventTime(Instant.now().toString())
                    .withJob(ns.prefix("batch_build_2"), namespace)
                    .withRun(UUID.randomUUID().toString()))
            .build();

    assertNotNull(batch);
    assertTrue(batch.containsKey("events"));
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> events = (List<Map<String, Object>>) batch.get("events");
    assertEquals(2, events.size());
  }

  @Test
  void testEventWithAllEventTypes(TestNamespace ns) throws Exception {
    String namespace = ns.prefix("all_types_ns");
    String[] eventTypes = {"START", "RUNNING", "COMPLETE", "FAIL", "ABORT"};

    for (String eventType : eventTypes) {
      String jobName = ns.prefix("all_types_" + eventType.toLowerCase());
      String runId = UUID.randomUUID().toString();

      String response =
          OpenLineage.event()
              .withEventType(eventType)
              .withEventTime(Instant.now().toString())
              .withJob(jobName, namespace)
              .withRun(runId)
              .send();

      assertNotNull(response, "Response for event type " + eventType + " should not be null");
    }
  }

  private Map<String, Object> createSchemaFacet() {
    Map<String, Object> facet = new HashMap<>();
    facet.put("_producer", "https://github.com/OpenLineage/OpenLineage/test");
    facet.put("_schemaURL", "https://openlineage.io/spec/facets/1-0-0/SchemaDatasetFacet.json");

    List<Map<String, Object>> fields = new ArrayList<>();
    Map<String, Object> field1 = new HashMap<>();
    field1.put("name", "id");
    field1.put("type", "INTEGER");
    fields.add(field1);

    Map<String, Object> field2 = new HashMap<>();
    field2.put("name", "name");
    field2.put("type", "VARCHAR");
    fields.add(field2);

    facet.put("fields", fields);
    return facet;
  }

  private Map<String, Object> createDocumentationFacet(String description) {
    Map<String, Object> facet = new HashMap<>();
    facet.put("_producer", "https://github.com/OpenLineage/OpenLineage/test");
    facet.put("_schemaURL", "https://openlineage.io/spec/facets/1-0-0/DocumentationJobFacet.json");
    facet.put("description", description);
    return facet;
  }

  private Map<String, Object> createNominalTimeFacet() {
    Map<String, Object> facet = new HashMap<>();
    facet.put("_producer", "https://github.com/OpenLineage/OpenLineage/test");
    facet.put("_schemaURL", "https://openlineage.io/spec/facets/1-0-0/NominalTimeRunFacet.json");
    facet.put("nominalStartTime", Instant.now().toString());
    facet.put("nominalEndTime", Instant.now().plusSeconds(3600).toString());
    return facet;
  }
}
