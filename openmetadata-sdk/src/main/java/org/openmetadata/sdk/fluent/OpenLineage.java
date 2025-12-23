package org.openmetadata.sdk.fluent;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Fluent API for OpenLineage operations.
 *
 * <p>OpenLineage is a standard for capturing lineage events from data pipelines. This API allows
 * posting lineage events from Spark, Airflow, and other tools.
 *
 * <p>Usage:
 *
 * <pre>
 * // Post a single run event
 * String response = OpenLineage.event()
 *     .withEventType("COMPLETE")
 *     .withEventTime("2023-01-01T12:00:00Z")
 *     .withJob("my-job", "my-namespace")
 *     .withRun("run-id-123")
 *     .withInputs(inputs)
 *     .withOutputs(outputs)
 *     .send();
 *
 * // Post batch events
 * String response = OpenLineage.batch()
 *     .addEvent(event1)
 *     .addEvent(event2)
 *     .send();
 * </pre>
 */
public final class OpenLineage {
  private static OpenMetadataClient defaultClient;
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String BASE_PATH = "/v1/openlineage";

  private OpenLineage() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call OpenLineage.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Event Builders ====================

  /**
   * Start building a single OpenLineage run event.
   */
  public static RunEventBuilder event() {
    return new RunEventBuilder(getClient());
  }

  /**
   * Start building a batch of OpenLineage events.
   */
  public static BatchEventBuilder batch() {
    return new BatchEventBuilder(getClient());
  }

  /**
   * Post a raw OpenLineage event directly.
   */
  public static String postEvent(Map<String, Object> event) throws OpenMetadataException {
    return getClient()
        .getHttpClient()
        .executeForString(HttpMethod.POST, BASE_PATH, event, RequestOptions.builder().build());
  }

  /**
   * Post a batch of raw OpenLineage events.
   */
  public static String postBatch(List<Map<String, Object>> events) throws OpenMetadataException {
    Map<String, Object> batchRequest = new HashMap<>();
    batchRequest.put("events", events);
    return getClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.POST, BASE_PATH + "/batch", batchRequest, RequestOptions.builder().build());
  }

  // ==================== Run Event Builder ====================

  public static class RunEventBuilder {
    private final OpenMetadataClient client;
    private final Map<String, Object> event = new HashMap<>();
    private final Map<String, Object> job = new HashMap<>();
    private final Map<String, Object> run = new HashMap<>();
    private final List<Map<String, Object>> inputs = new ArrayList<>();
    private final List<Map<String, Object>> outputs = new ArrayList<>();

    RunEventBuilder(OpenMetadataClient client) {
      this.client = client;
    }

    /**
     * Set the event type (START, RUNNING, COMPLETE, FAIL, ABORT).
     */
    public RunEventBuilder withEventType(String eventType) {
      event.put("eventType", eventType);
      return this;
    }

    /**
     * Set the event time in ISO-8601 format.
     */
    public RunEventBuilder withEventTime(String eventTime) {
      event.put("eventTime", eventTime);
      return this;
    }

    /**
     * Set the producer URL.
     */
    public RunEventBuilder withProducer(String producer) {
      event.put("producer", producer);
      return this;
    }

    /**
     * Set the schema URL.
     */
    public RunEventBuilder withSchemaURL(String schemaURL) {
      event.put("schemaURL", schemaURL);
      return this;
    }

    /**
     * Set the job name and namespace.
     */
    public RunEventBuilder withJob(String name, String namespace) {
      job.put("name", name);
      job.put("namespace", namespace);
      return this;
    }

    /**
     * Set the job with full details.
     */
    public RunEventBuilder withJob(Map<String, Object> jobDetails) {
      job.putAll(jobDetails);
      return this;
    }

    /**
     * Set the run ID.
     */
    public RunEventBuilder withRun(String runId) {
      run.put("runId", runId);
      return this;
    }

    /**
     * Set the run with full details.
     */
    public RunEventBuilder withRun(Map<String, Object> runDetails) {
      run.putAll(runDetails);
      return this;
    }

    /**
     * Add an input dataset.
     */
    public RunEventBuilder addInput(String name, String namespace) {
      Map<String, Object> input = new HashMap<>();
      input.put("name", name);
      input.put("namespace", namespace);
      inputs.add(input);
      return this;
    }

    /**
     * Add an input dataset with full details.
     */
    public RunEventBuilder addInput(Map<String, Object> inputDataset) {
      inputs.add(inputDataset);
      return this;
    }

    /**
     * Set all input datasets.
     */
    public RunEventBuilder withInputs(List<Map<String, Object>> inputDatasets) {
      inputs.clear();
      inputs.addAll(inputDatasets);
      return this;
    }

    /**
     * Add an output dataset.
     */
    public RunEventBuilder addOutput(String name, String namespace) {
      Map<String, Object> output = new HashMap<>();
      output.put("name", name);
      output.put("namespace", namespace);
      outputs.add(output);
      return this;
    }

    /**
     * Add an output dataset with full details.
     */
    public RunEventBuilder addOutput(Map<String, Object> outputDataset) {
      outputs.add(outputDataset);
      return this;
    }

    /**
     * Set all output datasets.
     */
    public RunEventBuilder withOutputs(List<Map<String, Object>> outputDatasets) {
      outputs.clear();
      outputs.addAll(outputDatasets);
      return this;
    }

    /**
     * Build the event map.
     */
    public Map<String, Object> build() {
      Map<String, Object> result = new HashMap<>(event);
      if (!job.isEmpty()) {
        result.put("job", job);
      }
      if (!run.isEmpty()) {
        result.put("run", run);
      }
      if (!inputs.isEmpty()) {
        result.put("inputs", inputs);
      }
      if (!outputs.isEmpty()) {
        result.put("outputs", outputs);
      }
      return result;
    }

    /**
     * Send the event to OpenMetadata.
     */
    public String send() throws OpenMetadataException {
      return client
          .getHttpClient()
          .executeForString(HttpMethod.POST, BASE_PATH, build(), RequestOptions.builder().build());
    }
  }

  // ==================== Batch Event Builder ====================

  public static class BatchEventBuilder {
    private final OpenMetadataClient client;
    private final List<Map<String, Object>> events = new ArrayList<>();

    BatchEventBuilder(OpenMetadataClient client) {
      this.client = client;
    }

    /**
     * Add a run event to the batch.
     */
    public BatchEventBuilder addEvent(RunEventBuilder eventBuilder) {
      events.add(eventBuilder.build());
      return this;
    }

    /**
     * Add a raw event map to the batch.
     */
    public BatchEventBuilder addEvent(Map<String, Object> event) {
      events.add(event);
      return this;
    }

    /**
     * Add multiple events to the batch.
     */
    public BatchEventBuilder addEvents(List<Map<String, Object>> eventList) {
      events.addAll(eventList);
      return this;
    }

    /**
     * Build the batch request.
     */
    public Map<String, Object> build() {
      Map<String, Object> batchRequest = new HashMap<>();
      batchRequest.put("events", events);
      return batchRequest;
    }

    /**
     * Send the batch to OpenMetadata.
     */
    public String send() throws OpenMetadataException {
      return client
          .getHttpClient()
          .executeForString(
              HttpMethod.POST, BASE_PATH + "/batch", build(), RequestOptions.builder().build());
    }

    /**
     * Get the number of events in the batch.
     */
    public int size() {
      return events.size();
    }
  }
}
