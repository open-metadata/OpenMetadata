# Service-Scoped Progress Stream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single per-service SSE stream that multiplexes progress for every live ingestion-pipeline run under a service, so the per-service "Agents" UI opens one connection instead of N.

**Architecture:** A new `ServiceProgressEvent` envelope (`{pipelineFqn, runId, event}`) wraps each per-run `ProgressUpdate`. `IngestionProgressTracker` gains a `serviceFqn → {runKey → latest event}` index and a service-listener registry; it resolves `serviceFqn` from a pipeline FQN with the pure `FullyQualifiedName.getParentFQN`. A new repository method `streamServiceProgress` replays active-run snapshots on connect then multiplexes deltas, and a new `IngestionPipelineResource` endpoint exposes it with service-level authorization. The Python side is untouched.

**Tech Stack:** Java 21, Dropwizard/JAX-RS SSE (`jakarta.ws.rs.sse`), Guava, Micrometer, JUnit 5, JSON Schema (jsonschema2pojo codegen).

## Global Constraints

- Java 21; no wildcard imports; run `mvn spotless:apply -pl openmetadata-service` before finishing any task touching `.java`.
- One statement per line; no FQNs in code (import instead); methods small, single trailing return where practical (per repo CLAUDE.md).
- Reuse existing seams: `ProgressSseManager` (heartbeat/cap), `isTerminalProgressUpdate` (`PIPELINE_COMPLETE`/`ERROR`), `JsonUtils.pojoToJson`, `FullyQualifiedName.getParentFQN`.
- The existing 3-arg `IngestionProgressTracker.updateProgress(pipelineFqn, runId, update)` signature MUST stay unchanged (existing callers/tests depend on it).
- Stream keying uses `serviceFqn` only; `serviceType` is used solely for authorization.
- `serviceFqn = FullyQualifiedName.getParentFQN(pipelineFqn)`; skip service routing when it is null/empty.
- Per-run endpoint and `streamProgress` remain for back-compat.

---

### Task 1: `ServiceProgressEvent` envelope schema + codegen

**Files:**
- Create: `openmetadata-spec/src/main/resources/json/schema/entity/services/ingestionPipelines/serviceProgressEvent.json`

**Interfaces:**
- Produces: generated Java class `org.openmetadata.schema.entity.services.ingestionPipelines.ServiceProgressEvent` with fluent setters `withPipelineFqn(String)`, `withRunId(String)`, `withEvent(ProgressUpdate)` and getters `getPipelineFqn()`, `getRunId()`, `getEvent()`.

- [ ] **Step 1: Create the schema file**

```json
{
  "$id": "https://open-metadata.org/schema/entity/services/ingestionPipelines/serviceProgressEvent.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ServiceProgressEvent",
  "description": "One pipeline's progress update multiplexed onto a service-scoped SSE stream.",
  "type": "object",
  "javaType": "org.openmetadata.schema.entity.services.ingestionPipelines.ServiceProgressEvent",
  "properties": {
    "pipelineFqn": {
      "description": "Fully qualified name of the ingestion pipeline this event belongs to",
      "type": "string"
    },
    "runId": {
      "description": "Pipeline run ID",
      "type": "string"
    },
    "event": {
      "description": "The per-run progress update",
      "$ref": "progressUpdate.json"
    }
  },
  "required": ["pipelineFqn", "runId", "event"],
  "additionalProperties": false
}
```

- [ ] **Step 2: Regenerate Java POJOs from the spec module**

Run: `mvn -q -pl openmetadata-spec install -DskipTests`
Expected: BUILD SUCCESS, and the generated class exists.

- [ ] **Step 3: Verify the generated class**

Run: `ls openmetadata-spec/target/generated-sources/jsonschema2pojo/org/openmetadata/schema/entity/services/ingestionPipelines/ServiceProgressEvent.java`
Expected: the file path prints (exists).

- [ ] **Step 4: Commit**

```bash
git add openmetadata-spec/src/main/resources/json/schema/entity/services/ingestionPipelines/serviceProgressEvent.json
git commit -m "feat(progress): ServiceProgressEvent envelope schema for service-scoped SSE"
```

---

### Task 2: Tracker service-multiplex index + routing

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/monitoring/IngestionProgressTracker.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/monitoring/IngestionProgressTrackerTest.java`

**Interfaces:**
- Consumes: `ServiceProgressEvent` (Task 1); existing `updateProgress(String,UUID,ProgressUpdate)`, `buildKey`, `isTerminal` semantics.
- Produces:
  - `void registerServiceListener(String serviceFqn, Consumer<ServiceProgressEvent> listener)`
  - `void unregisterServiceListener(String serviceFqn, Consumer<ServiceProgressEvent> listener)`
  - `List<ServiceProgressEvent> getActiveRunSnapshots(String serviceFqn)`
  - unchanged `updateProgress(String pipelineFqn, UUID runId, ProgressUpdate update)` now also routes to service listeners.

- [ ] **Step 1: Write failing tests for service routing, isolation, terminal-drop, and replay**

Add to `IngestionProgressTrackerTest.java` (new imports: `java.util.function.Consumer`, `org.openmetadata.schema.entity.services.ingestionPipelines.ServiceProgressEvent`):

```java
  @Test
  void testServiceListenerReceivesAllPipelinesOfService() {
    UUID run1 = UUID.randomUUID();
    UUID run2 = UUID.randomUUID();
    List<ServiceProgressEvent> received = new ArrayList<>();
    tracker.registerServiceListener("svc", received::add);

    tracker.updateProgress("svc.metadata", run1, processing(run1, "m"));
    tracker.updateProgress("svc.lineage", run2, processing(run2, "l"));

    assertEquals(2, received.size());
    assertEquals("svc.metadata", received.get(0).getPipelineFqn());
    assertEquals("svc.lineage", received.get(1).getPipelineFqn());
    assertEquals(run1.toString(), received.get(0).getRunId());
  }

  @Test
  void testServiceListenerIsolation() {
    UUID run = UUID.randomUUID();
    List<ServiceProgressEvent> svcA = new ArrayList<>();
    tracker.registerServiceListener("svcA", svcA::add);

    tracker.updateProgress("svcB.metadata", run, processing(run, "b"));

    assertTrue(svcA.isEmpty());
  }

  @Test
  void testActiveRunSnapshotsReflectLatestAndDropOnTerminal() {
    UUID run1 = UUID.randomUUID();
    UUID run2 = UUID.randomUUID();
    tracker.updateProgress("svc.metadata", run1, processing(run1, "m1"));
    tracker.updateProgress("svc.metadata", run1, processing(run1, "m2"));
    tracker.updateProgress("svc.lineage", run2, processing(run2, "l1"));

    List<ServiceProgressEvent> snaps = tracker.getActiveRunSnapshots("svc");
    assertEquals(2, snaps.size());

    tracker.updateProgress("svc.metadata", run1, terminal(run1));

    List<ServiceProgressEvent> after = tracker.getActiveRunSnapshots("svc");
    assertEquals(1, after.size());
    assertEquals("svc.lineage", after.get(0).getPipelineFqn());
  }

  @Test
  void testTerminalEventIsForwardedBeforeDrop() {
    UUID run = UUID.randomUUID();
    List<ServiceProgressEvent> received = new ArrayList<>();
    tracker.registerServiceListener("svc", received::add);

    tracker.updateProgress("svc.metadata", run, processing(run, "p"));
    tracker.updateProgress("svc.metadata", run, terminal(run));

    assertEquals(2, received.size());
    assertEquals(ProgressUpdateType.PIPELINE_COMPLETE, received.get(1).getEvent().getUpdateType());
    assertTrue(tracker.getActiveRunSnapshots("svc").isEmpty());
  }

  @Test
  void testUnregisterServiceListenerStopsDelivery() {
    UUID run = UUID.randomUUID();
    List<ServiceProgressEvent> received = new ArrayList<>();
    Consumer<ServiceProgressEvent> listener = received::add;
    tracker.registerServiceListener("svc", listener);
    tracker.updateProgress("svc.metadata", run, processing(run, "a"));
    tracker.unregisterServiceListener("svc", listener);
    tracker.updateProgress("svc.metadata", run, processing(run, "b"));
    assertEquals(1, received.size());
  }

  private static ProgressUpdate processing(UUID runId, String msg) {
    return new ProgressUpdate()
        .withRunId(runId.toString())
        .withTimestamp(System.currentTimeMillis())
        .withUpdateType(ProgressUpdateType.PROCESSING)
        .withMessage(msg);
  }

  private static ProgressUpdate terminal(UUID runId) {
    return new ProgressUpdate()
        .withRunId(runId.toString())
        .withTimestamp(System.currentTimeMillis())
        .withUpdateType(ProgressUpdateType.PIPELINE_COMPLETE);
  }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `mvn -q -pl openmetadata-service test -Dtest=IngestionProgressTrackerTest`
Expected: FAIL — `registerServiceListener`/`getActiveRunSnapshots`/`unregisterServiceListener` do not exist (compile error).

- [ ] **Step 3: Implement the service index and routing in the tracker**

Add imports near the existing ones: `org.openmetadata.schema.entity.services.ingestionPipelines.ServiceProgressEvent`, `org.openmetadata.service.util.FullyQualifiedName`, `org.openmetadata.common.utils.CommonUtil.nullOrEmpty` (static). Add fields:

```java
  private final Map<String, Map<String, ServiceProgressEvent>> serviceActiveRuns =
      new ConcurrentHashMap<>();
  private final Map<String, List<Consumer<ServiceProgressEvent>>> serviceListeners =
      new ConcurrentHashMap<>();
```

At the end of `updateProgress(pipelineFqn, runId, update)` (after `notifyListeners(key, update)`), add:

```java
    routeToService(pipelineFqn, runId, update);
```

Add the helpers:

```java
  private void routeToService(String pipelineFqn, UUID runId, ProgressUpdate update) {
    String serviceFqn = FullyQualifiedName.getParentFQN(pipelineFqn);
    if (!nullOrEmpty(serviceFqn)) {
      String runKey = buildKey(pipelineFqn, runId);
      ServiceProgressEvent event =
          new ServiceProgressEvent()
              .withPipelineFqn(pipelineFqn)
              .withRunId(runId.toString())
              .withEvent(update);
      recordActiveRun(serviceFqn, runKey, event);
      notifyServiceListeners(serviceFqn, event);
      dropRunIfTerminal(serviceFqn, runKey, update);
    }
  }

  private void recordActiveRun(String serviceFqn, String runKey, ServiceProgressEvent event) {
    serviceActiveRuns.computeIfAbsent(serviceFqn, k -> new ConcurrentHashMap<>()).put(runKey, event);
  }

  private void dropRunIfTerminal(String serviceFqn, String runKey, ProgressUpdate update) {
    if (isTerminal(update)) {
      Map<String, ServiceProgressEvent> runs = serviceActiveRuns.get(serviceFqn);
      if (runs != null) {
        runs.remove(runKey);
        serviceActiveRuns.remove(serviceFqn, Map.of());
      }
    }
  }

  private boolean isTerminal(ProgressUpdate update) {
    return update.getUpdateType() == ProgressUpdateType.PIPELINE_COMPLETE
        || update.getUpdateType() == ProgressUpdateType.ERROR;
  }

  private void notifyServiceListeners(String serviceFqn, ServiceProgressEvent event) {
    List<Consumer<ServiceProgressEvent>> listeners = serviceListeners.get(serviceFqn);
    if (listeners != null) {
      for (Consumer<ServiceProgressEvent> listener : listeners) {
        try {
          listener.accept(event);
        } catch (Exception e) {
          LOG.warn("Error notifying service progress listener: {}", e.getMessage());
        }
      }
    }
  }

  public void registerServiceListener(String serviceFqn, Consumer<ServiceProgressEvent> listener) {
    serviceListeners.computeIfAbsent(serviceFqn, k -> new CopyOnWriteArrayList<>()).add(listener);
    activeProgressStreams.incrementAndGet();
  }

  public void unregisterServiceListener(
      String serviceFqn, Consumer<ServiceProgressEvent> listener) {
    List<Consumer<ServiceProgressEvent>> listeners = serviceListeners.get(serviceFqn);
    if (listeners != null) {
      listeners.remove(listener);
      activeProgressStreams.decrementAndGet();
      if (listeners.isEmpty()) {
        serviceListeners.remove(serviceFqn);
      }
    }
  }

  public List<ServiceProgressEvent> getActiveRunSnapshots(String serviceFqn) {
    Map<String, ServiceProgressEvent> runs = serviceActiveRuns.get(serviceFqn);
    if (runs == null) {
      return List.of();
    }
    return List.copyOf(runs.values());
  }
```

Note: `serviceActiveRuns.remove(serviceFqn, Map.of())` is a no-op guard placeholder — replace with an explicit empty check:

```java
        if (runs.isEmpty()) {
          serviceActiveRuns.remove(serviceFqn);
        }
```
(Put that inside `dropRunIfTerminal` after `runs.remove(runKey);` and delete the `Map.of()` line.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `mvn -q -pl openmetadata-service test -Dtest=IngestionProgressTrackerTest`
Expected: PASS (all existing + 5 new tests).

- [ ] **Step 5: Format and commit**

```bash
mvn -q spotless:apply -pl openmetadata-service
git add openmetadata-service/src/main/java/org/openmetadata/service/monitoring/IngestionProgressTracker.java \
        openmetadata-service/src/test/java/org/openmetadata/service/monitoring/IngestionProgressTrackerTest.java
git commit -m "feat(progress): tracker multiplexes runs onto a per-service listener index"
```

---

### Task 3: Extract `ServiceProgressStreamer` + repository delegate

**Files:**
- Create: `openmetadata-service/src/main/java/org/openmetadata/service/monitoring/ServiceProgressStreamer.java`
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/IngestionPipelineRepository.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/monitoring/ServiceProgressStreamerTest.java` (create)

**Why an extracted class:** `IngestionPipelineRepository`'s only constructor is `IngestionPipelineRepository(OpenMetadataApplicationConfig)` and does heavy DB/collection wiring, so it cannot be built in a plain unit test. The streaming logic needs only the tracker + `ProgressSseManager`, not DB state — so it lives in a small, DB-free `ServiceProgressStreamer` that the repository delegates to. This makes the multiplex behavior unit-testable with a real tracker and a fake sink.

**Interfaces:**
- Consumes: `IngestionProgressTracker.getActiveRunSnapshots`, `registerServiceListener`, `unregisterServiceListener` (Task 2); `ProgressSseManager`; `ServiceProgressEvent`; `JsonUtils.pojoToJson`.
- Produces:
  - `ServiceProgressStreamer.stream(String serviceFqn, SseEventSink eventSink, Sse sse, IngestionProgressTracker tracker)` (static).
  - `IngestionPipelineRepository.streamServiceProgress(String serviceFqn, SseEventSink eventSink, Sse sse)` delegating to it.

- [ ] **Step 1: Write a failing streamer test with a fake SSE sink**

Create `openmetadata-service/src/test/java/org/openmetadata/service/monitoring/ServiceProgressStreamerTest.java`:

```java
package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseBroadcaster;
import jakarta.ws.rs.sse.SseEventSink;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdate;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdateType;

class ServiceProgressStreamerTest {

  @Test
  void testReplayThenLiveMultiplexAcrossPipelines() {
    IngestionProgressTracker tracker = new IngestionProgressTracker(new SimpleMeterRegistry());
    UUID run1 = UUID.randomUUID();
    UUID run2 = UUID.randomUUID();
    tracker.updateProgress("svc.metadata", run1, processing(run1));

    CapturingSink sink = new CapturingSink();
    ServiceProgressStreamer.stream("svc", sink, new StubSse(), tracker);

    assertEquals(1, sink.data.size());

    tracker.updateProgress("svc.lineage", run2, processing(run2));
    assertEquals(2, sink.data.size());
    assertTrue(sink.data.get(1).contains("svc.lineage"));
    assertTrue(sink.data.get(1).contains(run2.toString()));
  }

  @Test
  void testStreamStaysOpenAfterOneRunTerminal() {
    IngestionProgressTracker tracker = new IngestionProgressTracker(new SimpleMeterRegistry());
    UUID run1 = UUID.randomUUID();
    UUID run2 = UUID.randomUUID();

    CapturingSink sink = new CapturingSink();
    ServiceProgressStreamer.stream("svc", sink, new StubSse(), tracker);

    tracker.updateProgress("svc.metadata", run1, terminal(run1));
    tracker.updateProgress("svc.lineage", run2, processing(run2));

    assertTrue(sink.data.stream().anyMatch(d -> d.contains(run2.toString())));
    assertEquals(false, sink.isClosed());
  }

  private static ProgressUpdate processing(UUID runId) {
    return new ProgressUpdate()
        .withRunId(runId.toString())
        .withTimestamp(System.currentTimeMillis())
        .withUpdateType(ProgressUpdateType.PROCESSING);
  }

  private static ProgressUpdate terminal(UUID runId) {
    return new ProgressUpdate()
        .withRunId(runId.toString())
        .withTimestamp(System.currentTimeMillis())
        .withUpdateType(ProgressUpdateType.PIPELINE_COMPLETE);
  }

  static class CapturingSink implements SseEventSink {
    final List<String> data = new ArrayList<>();
    private boolean closed = false;

    @Override
    public boolean isClosed() {
      return closed;
    }

    @Override
    public CompletionStage<?> send(OutboundSseEvent event) {
      data.add((String) event.getData());
      return CompletableFuture.completedFuture(null);
    }

    @Override
    public void close() {
      closed = true;
    }
  }

  static class StubSse implements Sse {
    @Override
    public OutboundSseEvent newEvent(String data) {
      return new StubEvent(data);
    }

    @Override
    public OutboundSseEvent newEvent(String name, String data) {
      return new StubEvent(data);
    }

    @Override
    public OutboundSseEvent.Builder newEventBuilder() {
      throw new UnsupportedOperationException();
    }

    @Override
    public SseBroadcaster newBroadcaster() {
      throw new UnsupportedOperationException();
    }
  }

  record StubEvent(String payload) implements OutboundSseEvent {
    @Override
    public Class<?> getType() {
      return String.class;
    }

    @Override
    public Type getGenericType() {
      return String.class;
    }

    @Override
    public jakarta.ws.rs.core.MediaType getMediaType() {
      return jakarta.ws.rs.core.MediaType.TEXT_PLAIN_TYPE;
    }

    @Override
    public String getComment() {
      return null;
    }

    @Override
    public String getId() {
      return null;
    }

    @Override
    public String getName() {
      return null;
    }

    @Override
    public long getReconnectDelay() {
      return -1;
    }

    @Override
    public boolean isReconnectDelaySet() {
      return false;
    }

    @Override
    public Object getData() {
      return payload;
    }
  }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `mvn -q -pl openmetadata-service test -Dtest=ServiceProgressStreamerTest`
Expected: FAIL — `ServiceProgressStreamer` does not exist (compile error).

- [ ] **Step 3: Implement `ServiceProgressStreamer`**

Create `openmetadata-service/src/main/java/org/openmetadata/service/monitoring/ServiceProgressStreamer.java`:

```java
/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.monitoring;

import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.util.function.Consumer;
import org.openmetadata.schema.entity.services.ingestionPipelines.ServiceProgressEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.resources.services.ingestionpipelines.ProgressSseManager;

/**
 * Multiplexes progress for every live run of a service onto one SSE connection. Replays the current
 * snapshot of each active run on connect, then streams subsequent updates. Unlike the per-run
 * stream, a single run's terminal event does not close the sink — the connection stays open for the
 * whole page session and is closed only on client disconnect or the {@link ProgressSseManager} cap.
 */
public final class ServiceProgressStreamer {

  private ServiceProgressStreamer() {}

  public static void stream(
      String serviceFqn, SseEventSink eventSink, Sse sse, IngestionProgressTracker tracker) {
    for (ServiceProgressEvent snapshot : tracker.getActiveRunSnapshots(serviceFqn)) {
      send(eventSink, sse, snapshot);
    }
    Consumer<ServiceProgressEvent> listener = event -> send(eventSink, sse, event);
    tracker.registerServiceListener(serviceFqn, listener);
    Runnable onClose = () -> tracker.unregisterServiceListener(serviceFqn, listener);
    if (!ProgressSseManager.getInstance().register(eventSink, sse, onClose)) {
      onClose.run();
      eventSink.close();
    }
  }

  private static void send(SseEventSink eventSink, Sse sse, ServiceProgressEvent event) {
    if (!eventSink.isClosed()) {
      eventSink.send(sse.newEvent(JsonUtils.pojoToJson(event)));
    }
  }
}
```

- [ ] **Step 4: Add the thin repository delegate**

In `IngestionPipelineRepository.java` add the import `org.openmetadata.service.monitoring.ServiceProgressStreamer` and the method next to `streamProgress`:

```java
  public void streamServiceProgress(String serviceFqn, SseEventSink eventSink, Sse sse) {
    ServiceProgressStreamer.stream(serviceFqn, eventSink, sse, progressTracker);
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `mvn -q -pl openmetadata-service test -Dtest=ServiceProgressStreamerTest`
Expected: PASS (both tests).

- [ ] **Step 6: Format and commit**

```bash
mvn -q spotless:apply -pl openmetadata-service
git add openmetadata-service/src/main/java/org/openmetadata/service/monitoring/ServiceProgressStreamer.java \
        openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/IngestionPipelineRepository.java \
        openmetadata-service/src/test/java/org/openmetadata/service/monitoring/ServiceProgressStreamerTest.java
git commit -m "feat(progress): ServiceProgressStreamer multiplexes runs; repository delegates"
```

---
### Task 4: Resource endpoint with service-level authorization

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/resources/services/ingestionpipelines/IngestionPipelineResource.java`

**Interfaces:**
- Consumes: `repository.streamServiceProgress` (Task 3); `repository.isProgressTrackingEnabled`; `authorizer`; `ResourceContext`, `OperationContext`.
- Produces: `GET /v1/services/ingestionPipelines/progress/service/{serviceType}/{serviceFqn}/stream`.

- [ ] **Step 1: Add the endpoint method**

Below `streamPipelineProgress` (around line 1719) add (imports already present in the file: `Sse`, `SseEventSink`, `ServiceUnavailableException`, `MetadataOperation`, `OperationContext`; add `import org.openmetadata.service.security.policyevaluator.ResourceContext;` if not already imported):

```java
  @GET
  @Path("/progress/service/{serviceType}/{serviceFqn}/stream")
  @Produces(MediaType.SERVER_SENT_EVENTS)
  @Operation(
      operationId = "streamServiceProgress",
      summary = "Stream progress for all pipelines of a service",
      description =
          "Stream real-time progress for every live ingestion pipeline run under a service on a "
              + "single Server-Sent Events connection",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Service progress stream",
            content = @Content(mediaType = MediaType.SERVER_SENT_EVENTS)),
        @ApiResponse(responseCode = "503", description = "Progress tracking is not configured")
      })
  public void streamServiceProgress(
      @Context SseEventSink eventSink,
      @Context Sse sse,
      @Context SecurityContext securityContext,
      @Parameter(description = "Service entity type", schema = @Schema(type = "string"))
          @PathParam("serviceType")
          String serviceType,
      @Parameter(description = "Fully qualified name of the service", schema = @Schema(type = "string"))
          @PathParam("serviceFqn")
          String serviceFqn) {
    OperationContext operationContext =
        new OperationContext(serviceType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(
        securityContext, operationContext, new ResourceContext<>(serviceType, null, serviceFqn));
    if (!repository.isProgressTrackingEnabled()) {
      throw new ServiceUnavailableException("Progress tracking is not configured");
    }
    repository.streamServiceProgress(serviceFqn, eventSink, sse);
  }
```

- [ ] **Step 2: Compile to verify signatures resolve**

Run: `mvn -q -pl openmetadata-service compile`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Add a resource authorization/registration test**

In the existing `IngestionPipelineResourceTest` (find it under `openmetadata-service/src/test/java/.../resources/services/ingestion*`), add a test asserting the new path is reachable and returns 503 when progress tracking is disabled (mirror the pattern used by the existing `streamPipelineProgress` test if present; otherwise assert the JAX-RS resource exposes the method via reflection on the annotation `@Path("/progress/service/{serviceType}/{serviceFqn}/stream")`). Minimal reflection assertion:

```java
  @Test
  void serviceProgressStreamEndpointIsRegistered() throws Exception {
    boolean present =
        java.util.Arrays.stream(IngestionPipelineResource.class.getMethods())
            .anyMatch(m -> "streamServiceProgress".equals(m.getName()));
    org.junit.jupiter.api.Assertions.assertTrue(present);
  }
```

- [ ] **Step 4: Run the resource test**

Run: `mvn -q -pl openmetadata-service test -Dtest=IngestionPipelineResourceTest#serviceProgressStreamEndpointIsRegistered`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
mvn -q spotless:apply -pl openmetadata-service
git add openmetadata-service/src/main/java/org/openmetadata/service/resources/services/ingestionpipelines/IngestionPipelineResource.java \
        openmetadata-service/src/test/java/org/openmetadata/service/resources/services/ingestionpipelines/IngestionPipelineResourceTest.java
git commit -m "feat(progress): service-scoped progress SSE endpoint with service-level auth"
```

---

### Task 5: Full build + verification sweep

**Files:** none (verification only).

- [ ] **Step 1: Build the service module with tests**

Run: `mvn -q -pl openmetadata-service -am test -Dtest=IngestionProgressTrackerTest,IngestionPipelineServiceStreamTest`
Expected: PASS.

- [ ] **Step 2: Confirm spotless is clean**

Run: `mvn -q spotless:check -pl openmetadata-service`
Expected: BUILD SUCCESS (no formatting diffs).

- [ ] **Step 3: Confirm back-compat — the per-run endpoint and 3-arg updateProgress are untouched**

Run: `git diff --stat main -- openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/IngestionPipelineRepository.java`
Expected: only one added method (`streamServiceProgress` delegating to `ServiceProgressStreamer`) plus one import; `updateProgress(fqn, runId, update)` and `streamProgress` bodies unchanged.

- [ ] **Step 4: No commit needed**

Verification only — do not commit. If Step 2 reported spotless diffs, re-stage ONLY the specific `.java` files this feature touched (the tracker, streamer, repository, resource, and their tests) and commit `chore(progress): spotless formatting`. NEVER `git add -A` — pre-existing unrelated changes (`ingestion/Dockerfile.ci`, `2026-07-01-ingestion-eta-design.md`, untracked `CLAUDE.md` files) must stay unstaged.

---

## Self-Review

**Spec coverage:**
- Envelope schema (spec Piece 1) → Task 1. ✔
- Tracker service index, routing, terminal-drop, replay, register/unregister, pure `getParentFQN` resolution (Piece 2) → Task 2. ✔
- Repository `streamServiceProgress`, replay-then-multiplex, no-close-on-terminal (Piece 3) → Task 3. ✔
- Endpoint with `serviceType`+`serviceFqn` path and service-level `VIEW_ALL` auth, 503 gate (Piece 3) → Task 4. ✔
- At-connect replay + lifecycle (Piece 4) → covered by Task 3 replay + Task 2 terminal-drop. ✔
- Testing (multiplex, terminal-drop isolation, cross-service leakage, replay) → Task 2 + Task 3. ✔
- Back-compat (per-run endpoint retained) → Task 5 Step 3 guard. ✔
- UI consumption (Piece 5) → intentionally out of scope (design-level only).

**Type consistency:** `ServiceProgressEvent` getters/setters (`getPipelineFqn`/`getRunId`/`getEvent`) used consistently across Tasks 1–4. Tracker methods `registerServiceListener`/`unregisterServiceListener`/`getActiveRunSnapshots` named identically in Tasks 2 and 3. `ServiceProgressStreamer.stream(String, SseEventSink, Sse, IngestionProgressTracker)` and `streamServiceProgress(String, SseEventSink, Sse)` identical in Tasks 3 and 4.

**Testability note:** the multiplex logic lives in `ServiceProgressStreamer` (DB-free) so Task 3's tests use a real tracker + fake sink with no `IngestionPipelineRepository` construction — the repository's heavy `OpenMetadataApplicationConfig` constructor is never invoked in a unit test. Task 4's resource test only asserts endpoint registration; full HTTP SSE behavior is exercised by the streamer tests, not a live server (avoids SSE-over-HTTP flakiness).
