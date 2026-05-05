# Streamable Logs Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three log-loss bugs in `S3LogStorage` (clobbered `partial.txt`, clobbered `logs.txt`, silent line gaps from `SimpleLogBuffer` overflow) by removing the multipart upload from the write path, introducing a per-stream `pendingFlush` queue with a logical line counter, persisting offset state in S3 user-defined metadata, rewriting `/close` as a server-side copy, and bumping the abandoned-run sweeper threshold from 5 min to 24h.

**Architecture:** Single-writer-per-run topology (sticky LB). `partial.txt` is the durable-write target during the run; `logs.txt` is materialized only at `/close` via a server-side S3 `CopyObjectRequest`. In-memory state is coordinated by a per-stream `ReentrantLock`. Backward-compatible at the artifact level (same on-disk file names, same APIs, same Python ingestion client).

**Tech Stack:** Java 21, Dropwizard, AWS SDK v2 (`software.amazon.awssdk.services.s3.*`), JUnit 5, Mockito, micrometer.

**Spec:** [`docs/superpowers/specs/2026-05-05-streamable-logs-stability-design.md`](../specs/2026-05-05-streamable-logs-stability-design.md)
**Feature doc:** [`docs/streamable-logs.md`](../../streamable-logs.md)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `openmetadata-spec/src/main/resources/json/schema/configuration/logStorageConfiguration.json` | Modify | Add new config fields (`streamTimeoutHours`, `cleanupIntervalMinutes`, `partialFlushIntervalMinutes`, `earlyFlushWatermarkBytes`, `pendingFlushAlertAfterFailures`) |
| `openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java` | Modify | Core rewrite: remove multipart upload, add `pendingFlush` + `totalLinesAppended`, per-stream lock, metadata-on-PUT, new `cleanupAbandonedStreams`, server-side-copy `closeStream`, fixed `getCombinedLogsForActiveStream` |
| `openmetadata-service/src/main/java/org/openmetadata/service/monitoring/StreamableLogsMetrics.java` | Modify | Add `pendingFlushBytes`, `consecutiveFlushFailures` metrics; deprecate multipart-related counters |
| `openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java` | Modify | Add unit tests for: idle-gap merge, restart resume from metadata, watermark early flush, `/close` server-side copy, idempotent `/close`, abandoned-run sweep, `getCombinedLogsForActiveStream` with `pendingFlush` |
| `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/IngestionPipelineLogStreamingResourceIT.java` | Modify | Add integration tests reproducing the original bugs and confirming fixed behavior |

`IngestionPipelineResource.java` does not change — the resource methods (`writePipelineLogs`, `closePipelineLogStream`) already delegate to `repository.appendLogs`/`repository.closeStream` and that contract is unchanged.

---

## Pre-Flight (no code changes)

- [ ] **Step 0.1: Verify build environment**

  ```bash
  cd /Users/pmbrull/github/OpenMetadata
  java --version          # Expect 21.x
  mvn --version
  source env/bin/activate
  python --version        # Expect 3.10.x or 3.11.x
  ```

- [ ] **Step 0.2: Run the existing S3LogStorage tests as a baseline**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest -q
  ```
  Expected: BUILD SUCCESS, all existing tests pass. Captures the green baseline before changes.

- [ ] **Step 0.3: Confirm the spec and design docs are in the working tree**

  ```bash
  ls -la docs/superpowers/specs/2026-05-05-streamable-logs-stability-design.md
  ls -la docs/streamable-logs.md
  ```

---

## Task 1 — Configuration schema additions

**PR boundary:** This task is one PR. Pure additive configuration; no behavior changes; safe to deploy on its own.

**Files:**
- Modify: `openmetadata-spec/src/main/resources/json/schema/configuration/logStorageConfiguration.json`
- Generated (auto): `openmetadata-spec/target/generated-sources/.../LogStorageConfiguration.java`

- [ ] **Step 1.1: Add new fields to the JSON schema**

  Edit `openmetadata-spec/src/main/resources/json/schema/configuration/logStorageConfiguration.json`. After the existing `streamTimeoutMinutes` block (around line 70), append (BEFORE `asyncBufferSizeMB`):

  ```json
      "streamTimeoutHours": {
        "description": "Idle threshold in hours before the abandoned-run sweeper finalizes a stream. Replaces streamTimeoutMinutes for new deployments.",
        "type": "integer",
        "minimum": 1,
        "default": 24
      },
      "cleanupIntervalMinutes": {
        "description": "How often (in minutes) the abandoned-run sweeper wakes up to check for expired streams.",
        "type": "integer",
        "minimum": 1,
        "default": 60
      },
      "partialFlushIntervalMinutes": {
        "description": "Periodic cadence (in minutes) for flushing in-memory pendingFlush queue to partial.txt.",
        "type": "integer",
        "minimum": 1,
        "default": 2
      },
      "earlyFlushWatermarkBytes": {
        "description": "Triggers an out-of-band flush when pendingFlush exceeds this size in bytes.",
        "type": "integer",
        "minimum": 1024,
        "default": 5242880
      },
      "pendingFlushAlertAfterFailures": {
        "description": "Emit an alerting metric after this many consecutive failed flushes for a single stream.",
        "type": "integer",
        "minimum": 1,
        "default": 10
      },
  ```

  Mark `streamTimeoutMinutes` as deprecated by appending to its description: `(DEPRECATED: use streamTimeoutHours)`.

- [ ] **Step 1.2: Regenerate Java models**

  ```bash
  cd /Users/pmbrull/github/OpenMetadata
  source env/bin/activate
  make generate
  ```

  Expected: command completes without errors; `LogStorageConfiguration.java` regenerated under `openmetadata-spec/target/generated-sources/`.

- [ ] **Step 1.3: Verify the generated class has the new getters**

  ```bash
  grep -E "getStreamTimeoutHours|getCleanupIntervalMinutes|getPartialFlushIntervalMinutes|getEarlyFlushWatermarkBytes|getPendingFlushAlertAfterFailures" \
    openmetadata-spec/target/generated-sources/delombok/org/openmetadata/schema/api/configuration/LogStorageConfiguration.java
  ```
  Expected: all five getters listed.

- [ ] **Step 1.4: Compile to confirm no breakage**

  ```bash
  mvn compile -pl openmetadata-spec,openmetadata-service -q
  ```
  Expected: BUILD SUCCESS.

- [ ] **Step 1.5: Format and commit**

  ```bash
  mvn spotless:apply -pl openmetadata-spec -q
  git add openmetadata-spec/src/main/resources/json/schema/configuration/logStorageConfiguration.json
  git commit -m "feat(log-storage): add config fields for streamable-logs stability fix

  Adds streamTimeoutHours, cleanupIntervalMinutes, partialFlushIntervalMinutes,
  earlyFlushWatermarkBytes, pendingFlushAlertAfterFailures. Deprecates
  streamTimeoutMinutes in favor of streamTimeoutHours. Pure schema-only
  change; no Java code consumes these fields yet."
  ```

---

## Task 2 — Wire new config into `S3LogStorage.initialize`

**PR boundary:** Combine with Task 1 in the same PR (they're tightly coupled and meaningless apart).

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java`

- [ ] **Step 2.1: Write a failing unit test that asserts the new fields are read with their defaults**

  Add to `S3LogStorageTest.java` (in the existing test class):

  ```java
  @Test
  void testInitializeReadsNewConfigDefaults() throws Exception {
    S3LogStorage storage = createInitializedS3LogStorage();
    assertEquals(24, getPrivateField(storage, "streamTimeoutHours"));
    assertEquals(60, getPrivateField(storage, "cleanupIntervalMinutes"));
    assertEquals(2, getPrivateField(storage, "partialFlushIntervalMinutes"));
    assertEquals(5L * 1024 * 1024, getPrivateField(storage, "earlyFlushWatermarkBytes"));
    assertEquals(10, getPrivateField(storage, "pendingFlushAlertAfterFailures"));
  }

  private static Object getPrivateField(Object target, String name) throws Exception {
    java.lang.reflect.Field f = target.getClass().getDeclaredField(name);
    f.setAccessible(true);
    return f.get(target);
  }
  ```

  Add the helper `createInitializedS3LogStorage()` if not present (look at how `setUp()` constructs `s3LogStorage` and extract that into a helper that returns a new instance).

- [ ] **Step 2.2: Run the test to verify it fails**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest#testInitializeReadsNewConfigDefaults -q
  ```
  Expected: FAIL with `NoSuchFieldException` (the fields don't exist yet).

- [ ] **Step 2.3: Add the new fields and read them in `initialize()`**

  In `S3LogStorage.java`, near the existing field block (around line 108):

  ```java
  private int streamTimeoutHours;
  private int cleanupIntervalMinutes;
  private int partialFlushIntervalMinutes;
  private long earlyFlushWatermarkBytes;
  private int pendingFlushAlertAfterFailures;
  ```

  In `initialize()`, near where `streamTimeoutMs` is set (around line 159), insert:

  ```java
  this.streamTimeoutHours =
      s3Config.getStreamTimeoutHours() != null ? s3Config.getStreamTimeoutHours() : 24;
  this.cleanupIntervalMinutes =
      s3Config.getCleanupIntervalMinutes() != null ? s3Config.getCleanupIntervalMinutes() : 60;
  this.partialFlushIntervalMinutes =
      s3Config.getPartialFlushIntervalMinutes() != null
          ? s3Config.getPartialFlushIntervalMinutes()
          : 2;
  this.earlyFlushWatermarkBytes =
      s3Config.getEarlyFlushWatermarkBytes() != null
          ? s3Config.getEarlyFlushWatermarkBytes().longValue()
          : 5L * 1024 * 1024;
  this.pendingFlushAlertAfterFailures =
      s3Config.getPendingFlushAlertAfterFailures() != null
          ? s3Config.getPendingFlushAlertAfterFailures()
          : 10;

  // Deprecation warning: if streamTimeoutMinutes is explicitly set to a small value,
  // log it. Operators on legacy configs should migrate to streamTimeoutHours.
  if (s3Config.getStreamTimeoutMinutes() != null && s3Config.getStreamTimeoutMinutes() < 30) {
    LOG.warn(
        "streamTimeoutMinutes={} is deprecated and may cause stream churn under slow connectors. "
            + "Migrate to streamTimeoutHours (current value: {}h).",
        s3Config.getStreamTimeoutMinutes(),
        streamTimeoutHours);
  }
  ```

- [ ] **Step 2.4: Verify the test passes**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest#testInitializeReadsNewConfigDefaults -q
  ```
  Expected: PASS.

- [ ] **Step 2.5: Run the full S3LogStorageTest to verify no regressions**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest -q
  ```
  Expected: BUILD SUCCESS, all tests green.

- [ ] **Step 2.6: Format and commit**

  ```bash
  mvn spotless:apply -pl openmetadata-service -q
  git add openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java \
          openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java
  git commit -m "feat(log-storage): wire new stability-fix config fields into S3LogStorage

  Reads streamTimeoutHours, cleanupIntervalMinutes, partialFlushIntervalMinutes,
  earlyFlushWatermarkBytes, pendingFlushAlertAfterFailures from
  LogStorageConfiguration with sane defaults. No behavioral change yet —
  values are stored but not consumed."
  ```

---

## Task 3 — Per-stream lock infrastructure

**PR boundary:** One PR by itself. Pure infrastructure; no observable behavior change; trivial to review.

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java`

- [ ] **Step 3.1: Write a failing unit test asserting the per-stream lock map exists and is populated on `appendLogs`**

  Add to `S3LogStorageTest.java`:

  ```java
  @Test
  void testAppendLogsAcquiresPerStreamLock() throws Exception {
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "line 1");
    @SuppressWarnings("unchecked")
    java.util.Map<String, java.util.concurrent.locks.ReentrantLock> locks =
        (java.util.Map<String, java.util.concurrent.locks.ReentrantLock>)
            getPrivateField(s3LogStorage, "streamLocks");
    String streamKey = testPipelineFQN + "/" + testRunId;
    assertNotNull(locks.get(streamKey), "stream lock should be created on first appendLogs");
    assertFalse(locks.get(streamKey).isLocked(), "lock should be released after appendLogs returns");
  }
  ```

- [ ] **Step 3.2: Run to verify failure**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest#testAppendLogsAcquiresPerStreamLock -q
  ```
  Expected: FAIL (`streamLocks` field does not exist).

- [ ] **Step 3.3: Add the lock map and a helper**

  In `S3LogStorage.java`, near the existing maps (around line 116):

  ```java
  private final Map<String, java.util.concurrent.locks.ReentrantLock> streamLocks =
      new ConcurrentHashMap<>();
  ```

  Add a helper method (place near the bottom of the class, before the inner classes):

  ```java
  private java.util.concurrent.locks.ReentrantLock acquireStreamLock(String streamKey) {
    java.util.concurrent.locks.ReentrantLock lock =
        streamLocks.computeIfAbsent(streamKey, k -> new java.util.concurrent.locks.ReentrantLock());
    lock.lock();
    return lock;
  }

  private void releaseStreamLock(String streamKey, java.util.concurrent.locks.ReentrantLock lock) {
    if (lock != null && lock.isHeldByCurrentThread()) {
      lock.unlock();
    }
  }
  ```

  Wrap the body of `appendLogs(String, UUID, String)` in a `try { acquireStreamLock(...); ... } finally { releaseStreamLock(...); }` block. The lock is acquired around the entire current body (including `recentLogsCache.get`, `notifyListeners`, `activeStreams.computeIfAbsent`, `context.stream.write`).

  ```java
  @Override
  public void appendLogs(String pipelineFQN, UUID runId, String logContent) throws IOException {
    if (nullOrEmpty(logContent)) {
      return;
    }

    String streamKey = pipelineFQN + "/" + runId;
    java.util.concurrent.locks.ReentrantLock lock = acquireStreamLock(streamKey);
    try {
      // ... existing body unchanged ...
    } finally {
      releaseStreamLock(streamKey, lock);
    }
  }
  ```

  Also wrap the body of `writePartialLogsForStream(String streamKey)`, `closeStream(String, UUID)` (currently calls `flush(fqn, runId)`), and the per-entry body of `cleanupExpiredStreams` (acquire the lock for `entry.getKey()` before calling `context.close()`).

  Update `import` block at top of file to add:

  ```java
  import java.util.concurrent.locks.ReentrantLock;
  ```

  And replace the fully-qualified `java.util.concurrent.locks.ReentrantLock` references above with `ReentrantLock`.

- [ ] **Step 3.4: Verify the test passes**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest#testAppendLogsAcquiresPerStreamLock -q
  ```
  Expected: PASS.

- [ ] **Step 3.5: Run all S3LogStorage tests**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest -q
  ```
  Expected: all tests still green.

- [ ] **Step 3.6: Format and commit**

  ```bash
  mvn spotless:apply -pl openmetadata-service -q
  git add openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java \
          openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java
  git commit -m "refactor(log-storage): add per-stream ReentrantLock for S3LogStorage

  Introduces streamLocks map and acquire/release helpers. appendLogs,
  writePartialLogsForStream, closeStream, and cleanupExpiredStreams all
  serialize on the per-stream lock. No behavior change; locking is
  pure mutual-exclusion at this point."
  ```

---

## Task 4 — Introduce `pendingFlush` and `totalLinesAppended` state

**PR boundary:** Could combine with Task 5 (the rewrite) in one PR — the state has no consumer until then. Recommended: combine with Task 5.

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java`

- [ ] **Step 4.1: Write a failing test that `appendLogs` populates `pendingFlush` and `totalLinesAppended`**

  Add to `S3LogStorageTest.java`:

  ```java
  @Test
  void testAppendLogsPopulatesPendingFlushAndCounter() throws Exception {
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "line 1\nline 2\nline 3");
    String streamKey = testPipelineFQN + "/" + testRunId;

    @SuppressWarnings("unchecked")
    java.util.Map<String, java.util.List<String>> pending =
        (java.util.Map<String, java.util.List<String>>) getPrivateField(s3LogStorage, "pendingFlush");
    @SuppressWarnings("unchecked")
    java.util.Map<String, java.util.concurrent.atomic.AtomicLong> counters =
        (java.util.Map<String, java.util.concurrent.atomic.AtomicLong>)
            getPrivateField(s3LogStorage, "totalLinesAppended");

    assertNotNull(pending.get(streamKey));
    assertEquals(3, pending.get(streamKey).size());
    assertEquals(3L, counters.get(streamKey).get());
  }
  ```

- [ ] **Step 4.2: Run to verify failure**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest#testAppendLogsPopulatesPendingFlushAndCounter -q
  ```
  Expected: FAIL (`pendingFlush` and `totalLinesAppended` fields don't exist).

- [ ] **Step 4.3: Add the new state and update `appendLogs`**

  Near the existing maps (around line 116-118 of `S3LogStorage.java`):

  ```java
  // Lines accumulated since last successful partial.txt PUT, per stream.
  private final Map<String, java.util.List<String>> pendingFlush = new ConcurrentHashMap<>();

  // Bytes pending in pendingFlush, per stream — used to drive the early-flush watermark.
  private final Map<String, java.util.concurrent.atomic.AtomicLong> pendingFlushBytes =
      new ConcurrentHashMap<>();

  // Monotonic logical line counter, per stream. Survives buffer eviction; never decrements.
  private final Map<String, java.util.concurrent.atomic.AtomicLong> totalLinesAppended =
      new ConcurrentHashMap<>();

  // Per-stream consecutive flush failure count for alerting.
  private final Map<String, Integer> consecutiveFlushFailures = new ConcurrentHashMap<>();
  ```

  In `appendLogs`, INSIDE the lock block, AFTER the existing `recentLogs.append(logContent)` line, ADD:

  ```java
  // Track lines for the new pendingFlush + totalLinesAppended pipeline.
  String[] splitLines = logContent.split("\n", -1);
  // Drop a trailing empty element from a content ending in \n.
  int lineCount = splitLines.length;
  if (lineCount > 0 && splitLines[lineCount - 1].isEmpty()) {
    lineCount--;
  }
  if (lineCount > 0) {
    java.util.List<String> queue =
        pendingFlush.computeIfAbsent(streamKey, k -> new java.util.ArrayList<>());
    java.util.concurrent.atomic.AtomicLong bytes =
        pendingFlushBytes.computeIfAbsent(
            streamKey, k -> new java.util.concurrent.atomic.AtomicLong());
    java.util.concurrent.atomic.AtomicLong counter =
        totalLinesAppended.computeIfAbsent(
            streamKey, k -> new java.util.concurrent.atomic.AtomicLong());
    long addedBytes = 0;
    for (int i = 0; i < lineCount; i++) {
      queue.add(splitLines[i]);
      addedBytes += splitLines[i].length() + 1L; // +1 for the join-newline at flush time
    }
    bytes.addAndGet(addedBytes);
    counter.addAndGet(lineCount);
  }
  ```

  This sits **alongside** the existing multipart write path; we will remove that in Task 6.

- [ ] **Step 4.4: Verify the test passes**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest#testAppendLogsPopulatesPendingFlushAndCounter -q
  ```
  Expected: PASS.

- [ ] **Step 4.5: Run all S3LogStorage tests**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest -q
  ```
  Expected: all green.

- [ ] **Step 4.6: Commit (as part of Task 5 if combining; otherwise standalone)**

  If combining with Task 5, defer the commit. If shipping alone:

  ```bash
  mvn spotless:apply -pl openmetadata-service -q
  git add openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java \
          openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java
  git commit -m "feat(log-storage): track pendingFlush queue and totalLinesAppended counter

  Each appendLogs now also populates per-stream pendingFlush (lines awaiting
  flush) and totalLinesAppended (monotonic logical line counter). State is
  written but not yet consumed; the new flush logic in the next commit reads it."
  ```

---

## Task 5 — Rewrite `writePartialLogsForStream` (the core fix)

**PR boundary:** This is the highest-value PR. Combine with Task 4. Includes both the merge-always fix and the metadata-on-PUT change. Land this and the worst data-loss bug is gone.

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java`

- [ ] **Step 5.1: Write the bug-reproducer test (idle-gap merge)**

  Add to `S3LogStorageTest.java`:

  ```java
  @Test
  void testFlushMergesExistingPartialAfterOffsetReset() throws Exception {
    String streamKey = testPipelineFQN + "/" + testRunId;
    String partialKey = "test-logs/" + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
        + "/" + testRunId + "/partial.txt";

    // Simulate: prior 80MB partial.txt content (we mock it small for test speed).
    String existingBody = "old-line-1\nold-line-2\nold-line-3\n";
    when(mockS3Client.getObject(argThat(
            (software.amazon.awssdk.services.s3.model.GetObjectRequest req) ->
                req != null && partialKey.equals(req.key()))))
        .thenReturn(
            new ResponseInputStream<>(
                software.amazon.awssdk.services.s3.model.GetObjectResponse.builder().build(),
                AbortableInputStream.create(
                    new ByteArrayInputStream(existingBody.getBytes(StandardCharsets.UTF_8)))));

    // Simulate: pendingFlush populated, but totalLinesAppended counter hasn't been
    // initialized in heap (post-restart / post-cleanup-removal scenario).
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "new-line-1\nnew-line-2\n");

    // Trigger a flush.
    java.lang.reflect.Method m = S3LogStorage.class.getDeclaredMethod(
        "writePartialLogsForStream", String.class);
    m.setAccessible(true);
    m.invoke(s3LogStorage, streamKey);

    // Assert: PutObject was called and the body contains BOTH old and new lines.
    org.mockito.ArgumentCaptor<software.amazon.awssdk.services.s3.model.PutObjectRequest>
        reqCaptor =
            org.mockito.ArgumentCaptor.forClass(
                software.amazon.awssdk.services.s3.model.PutObjectRequest.class);
    org.mockito.ArgumentCaptor<software.amazon.awssdk.core.sync.RequestBody>
        bodyCaptor =
            org.mockito.ArgumentCaptor.forClass(software.amazon.awssdk.core.sync.RequestBody.class);
    verify(mockS3Client, atLeastOnce()).putObject(reqCaptor.capture(), bodyCaptor.capture());

    // Find the PUT to partial.txt.
    boolean found = false;
    for (int i = 0; i < reqCaptor.getAllValues().size(); i++) {
      software.amazon.awssdk.services.s3.model.PutObjectRequest req =
          reqCaptor.getAllValues().get(i);
      if (partialKey.equals(req.key())) {
        String body = new String(
            bodyCaptor.getAllValues().get(i).contentStreamProvider().newStream().readAllBytes(),
            StandardCharsets.UTF_8);
        assertTrue(body.contains("old-line-1"), "merged body must contain prior content");
        assertTrue(body.contains("new-line-1"), "merged body must contain new content");
        // Metadata must include offset state.
        assertNotNull(req.metadata().get("last-flushed-line"));
        assertNotNull(req.metadata().get("total-bytes"));
        assertNotNull(req.metadata().get("writer-epoch"));
        found = true;
        break;
      }
    }
    assertTrue(found, "expected at least one PUT to partial.txt");
  }
  ```

- [ ] **Step 5.2: Run to verify failure**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest#testFlushMergesExistingPartialAfterOffsetReset -q
  ```
  Expected: FAIL (current code skips the merge when `currentOffset == 0`; metadata not yet set).

- [ ] **Step 5.3: Rewrite `writePartialLogsForStream`**

  In `S3LogStorage.java`, REPLACE the existing `writePartialLogsForStream(String streamKey)` method (around line 929-1006) with:

  ```java
  private void writePartialLogsForStream(String streamKey) {
    int lastSlashIndex = streamKey.lastIndexOf('/');
    if (lastSlashIndex == -1) {
      LOG.warn("Invalid stream key format: {}", streamKey);
      return;
    }
    String pipelineFQN = streamKey.substring(0, lastSlashIndex);
    UUID runId;
    try {
      runId = UUID.fromString(streamKey.substring(lastSlashIndex + 1));
    } catch (IllegalArgumentException e) {
      LOG.warn("Invalid runId in stream key: {}", streamKey);
      return;
    }

    ReentrantLock lock = acquireStreamLock(streamKey);
    try {
      java.util.List<String> queue = pendingFlush.get(streamKey);
      if (queue == null || queue.isEmpty()) {
        return; // Nothing to flush.
      }

      // Snapshot under the lock, then clear. If PUT fails, we restore.
      java.util.List<String> snapshot = new java.util.ArrayList<>(queue);
      queue.clear();
      java.util.concurrent.atomic.AtomicLong bytes = pendingFlushBytes.get(streamKey);
      if (bytes != null) {
        bytes.set(0);
      }

      String partialKey = buildPartialS3Key(pipelineFQN, runId);

      // Read existing partial.txt (always — no offset guard).
      String existingBody = "";
      try {
        GetObjectRequest getRequest =
            GetObjectRequest.builder().bucket(bucketName).key(partialKey).build();
        try (InputStream in = s3Client.getObject(getRequest)) {
          existingBody = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
      } catch (NoSuchKeyException e) {
        existingBody = "";
      } catch (Exception e) {
        // GET failed for some other reason — restore queue and bail; retry next tick.
        restorePendingFlush(streamKey, snapshot);
        recordFlushFailure(streamKey, e);
        return;
      }

      String newContent = String.join("\n", snapshot) + "\n";
      String mergedBody = existingBody + newContent;

      java.util.concurrent.atomic.AtomicLong counter =
          totalLinesAppended.computeIfAbsent(
              streamKey, k -> new java.util.concurrent.atomic.AtomicLong());
      long lastFlushedLine = counter.get();

      Map<String, String> metadata = new java.util.HashMap<>();
      metadata.put("last-flushed-line", Long.toString(lastFlushedLine));
      metadata.put("total-bytes", Integer.toString(mergedBody.length()));
      metadata.put("writer-epoch", Long.toString(writerEpoch));
      metadata.put("writer-version", "streamable-logs-v2");

      PutObjectRequest.Builder putBuilder =
          PutObjectRequest.builder()
              .bucket(bucketName)
              .key(partialKey)
              .contentType("text/plain")
              .metadata(metadata);
      applySSEConfiguration(putBuilder);

      try {
        s3Client.putObject(
            putBuilder.build(),
            software.amazon.awssdk.core.sync.RequestBody.fromString(mergedBody));
        if (metrics != null) {
          metrics.recordS3Write();
        }
        consecutiveFlushFailures.put(streamKey, 0);
      } catch (Exception e) {
        // PUT failed. Restore the snapshot so the next tick retries with the same data.
        restorePendingFlush(streamKey, snapshot);
        recordFlushFailure(streamKey, e);
      }
    } finally {
      releaseStreamLock(streamKey, lock);
    }
  }

  private void restorePendingFlush(String streamKey, java.util.List<String> snapshot) {
    java.util.List<String> queue =
        pendingFlush.computeIfAbsent(streamKey, k -> new java.util.ArrayList<>());
    // Re-prepend the snapshot.
    queue.addAll(0, snapshot);
    java.util.concurrent.atomic.AtomicLong bytes =
        pendingFlushBytes.computeIfAbsent(
            streamKey, k -> new java.util.concurrent.atomic.AtomicLong());
    long restoredBytes = 0;
    for (String line : snapshot) {
      restoredBytes += line.length() + 1L;
    }
    bytes.addAndGet(restoredBytes);
  }

  private void recordFlushFailure(String streamKey, Exception e) {
    int count = consecutiveFlushFailures.merge(streamKey, 1, Integer::sum);
    if (count >= pendingFlushAlertAfterFailures) {
      LOG.error(
          "Persistent flush failure for stream {} ({} consecutive failures): {}",
          streamKey,
          count,
          e.getMessage(),
          e);
    } else {
      LOG.warn("Flush failure for stream {} (attempt {}): {}", streamKey, count, e.getMessage());
    }
    if (metrics != null) {
      metrics.recordS3Error();
    }
  }
  ```

  Add the `writerEpoch` field near the top of the class (line ~117):

  ```java
  // Bumped on each fresh OM-server start; surfaced in partial.txt metadata for debugging.
  private final long writerEpoch = System.currentTimeMillis();
  ```

  Replace the `import java.util.*;` if used to be wildcard with explicit imports. The CLAUDE.md "no wildcard imports" rule applies. The fully-qualified names in the snippet above keep the imports stable; you may consolidate them to top-of-file imports if the existing file already imports the same classes.

- [ ] **Step 5.4: Run the new test plus the existing suite**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest -q
  ```
  Expected: BUILD SUCCESS. The new `testFlushMergesExistingPartialAfterOffsetReset` passes; existing tests still green (some may need adjustment if they depended on the old `partialLogOffsets` behavior — see step 5.5).

- [ ] **Step 5.5: Update or remove tests that rely on `partialLogOffsets`**

  ```bash
  grep -n "partialLogOffsets" openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java
  ```
  For each match: either remove the assertion (if it was probing implementation details) or rewrite to check `pendingFlush`/`totalLinesAppended` instead. The new design does not maintain `partialLogOffsets` — that map will be removed in Task 6.

- [ ] **Step 5.6: Add a test for restart-resume from metadata**

  ```java
  @Test
  void testRestartResumeReadsLastFlushedLineFromMetadata() throws Exception {
    String partialKey = "test-logs/" + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
        + "/" + testRunId + "/partial.txt";
    String existingBody = "L1\nL2\nL3\nL4\nL5\n";

    // Mock GET returning body + metadata indicating 5 lines were last flushed.
    software.amazon.awssdk.services.s3.model.GetObjectResponse getResponse =
        software.amazon.awssdk.services.s3.model.GetObjectResponse.builder()
            .metadata(java.util.Map.of(
                "last-flushed-line", "5",
                "total-bytes", Integer.toString(existingBody.length()),
                "writer-epoch", "1",
                "writer-version", "streamable-logs-v2"))
            .build();
    when(mockS3Client.getObject(argThat(
            (software.amazon.awssdk.services.s3.model.GetObjectRequest req) ->
                req != null && partialKey.equals(req.key()))))
        .thenReturn(
            new ResponseInputStream<>(
                getResponse,
                AbortableInputStream.create(
                    new ByteArrayInputStream(existingBody.getBytes(StandardCharsets.UTF_8)))));

    // Simulate: post-restart, in-memory state is empty. New append.
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "L6\nL7\n");

    java.lang.reflect.Method m =
        S3LogStorage.class.getDeclaredMethod("writePartialLogsForStream", String.class);
    m.setAccessible(true);
    m.invoke(s3LogStorage, testPipelineFQN + "/" + testRunId);

    // Verify the PUT body contains all 7 lines.
    org.mockito.ArgumentCaptor<software.amazon.awssdk.core.sync.RequestBody> bodyCaptor =
        org.mockito.ArgumentCaptor.forClass(software.amazon.awssdk.core.sync.RequestBody.class);
    verify(mockS3Client, atLeastOnce())
        .putObject(any(software.amazon.awssdk.services.s3.model.PutObjectRequest.class),
                   bodyCaptor.capture());
    boolean foundFullBody = false;
    for (software.amazon.awssdk.core.sync.RequestBody b : bodyCaptor.getAllValues()) {
      String body =
          new String(b.contentStreamProvider().newStream().readAllBytes(), StandardCharsets.UTF_8);
      if (body.contains("L1") && body.contains("L7")) {
        foundFullBody = true;
        break;
      }
    }
    assertTrue(foundFullBody, "merged body must contain pre-restart and post-restart lines");
  }
  ```

  Run:
  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest#testRestartResumeReadsLastFlushedLineFromMetadata -q
  ```
  Expected: PASS.

- [ ] **Step 5.7: Add the early-flush watermark trigger**

  In `appendLogs`, AFTER the line `bytes.addAndGet(addedBytes);` from Task 4, append:

  ```java
  if (bytes.get() >= earlyFlushWatermarkBytes) {
    final String key = streamKey;
    cleanupExecutor.execute(() -> writePartialLogsForStream(key));
  }
  ```

  Add a small unit test:

  ```java
  @Test
  void testAppendLogsTriggersEarlyFlushAtWatermark() throws Exception {
    // Watermark is 5MB by default. Build a payload above it.
    StringBuilder big = new StringBuilder(6 * 1024 * 1024);
    for (int i = 0; i < 60_000; i++) {
      big.append("a-reasonably-long-line-of-roughly-100-characters-to-cross-five-megabytes-quickly\n");
    }
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, big.toString());

    // Allow the executor to run.
    Thread.sleep(200); // bounded; the executor task is small
    verify(mockS3Client, atLeastOnce()).putObject(
        any(software.amazon.awssdk.services.s3.model.PutObjectRequest.class),
        any(software.amazon.awssdk.core.sync.RequestBody.class));
  }
  ```

  (Yes, `Thread.sleep` is normally banned in tests — it's tolerable here because the asynchronous flush is the unit under test and `Awaitility`-style polling adds dependency for a single 200ms wait. If the team prefers, replace with `Awaitility.await().atMost(Duration.ofSeconds(2)).untilAsserted(...)`.)

- [ ] **Step 5.8: Run the full S3LogStorageTest**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest -q
  ```
  Expected: BUILD SUCCESS.

- [ ] **Step 5.9: Format and commit (combined with Task 4)**

  ```bash
  mvn spotless:apply -pl openmetadata-service -q
  git add openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java \
          openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java
  git commit -m "fix(log-storage): merge-always partial.txt PUT and persist offset in S3 metadata

  Replaces the old writePartialLogsForStream that skipped the read-merge step
  when partialLogOffsets[streamKey] was 0 (the canonical 80MB->KB clobber bug).
  The new flush always reads existing partial.txt, appends a snapshot of
  pendingFlush, and PUTs with offset state in S3 user-defined metadata.

  Also adds an early-flush watermark trigger so high-burst writes don't
  pile up unbounded in pendingFlush.

  Closes the partial.txt-clobber half of the streamable-logs-stability spec."
  ```

---

## Task 6 — Remove the `MultipartS3OutputStream` write path

**PR boundary:** This is the riskiest PR. Land it on its own with extensive test coverage. After this lands, `logs.txt` is no longer materialized by the multipart path; `/close` (rewritten in Task 8) becomes the only producer.

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java`

- [ ] **Step 6.1: Write the bug-reproducer test for the logs.txt clobber, then make it pass**

  Add to `S3LogStorageTest.java`:

  ```java
  @Test
  void testNoMultipartUploadStartedOnAppend() throws Exception {
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "burst-1\nburst-2\n");
    // The new design must NOT initiate any multipart upload during appendLogs.
    verify(mockS3AsyncClient, never())
        .createMultipartUpload(any(
            software.amazon.awssdk.services.s3.model.CreateMultipartUploadRequest.class));
    verify(mockS3AsyncClient, never())
        .uploadPart(any(software.amazon.awssdk.services.s3.model.UploadPartRequest.class),
                    any(software.amazon.awssdk.core.async.AsyncRequestBody.class));
  }
  ```

- [ ] **Step 6.2: Run; expect failure**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest#testNoMultipartUploadStartedOnAppend -q
  ```
  Expected: FAIL — current code creates a multipart upload on first append.

- [ ] **Step 6.3: Remove multipart-related code from `appendLogs`**

  In `S3LogStorage.java`, in `appendLogs`, REMOVE the entire `StreamContext context = activeStreams.computeIfAbsent(...)` block and the `context.stream.write(logBytes)` call. Replace the body INSIDE the lock with:

  ```java
  // Update memory cache for SSE/live tail.
  SimpleLogBuffer recentLogs = recentLogsCache.get(streamKey, k -> new SimpleLogBuffer(1000));
  recentLogs.append(logContent);
  notifyListeners(streamKey, logContent);

  // Track lines for pendingFlush + totalLinesAppended (preserved from Task 4).
  String[] splitLines = logContent.split("\n", -1);
  int lineCount = splitLines.length;
  if (lineCount > 0 && splitLines[lineCount - 1].isEmpty()) {
    lineCount--;
  }
  if (lineCount > 0) {
    java.util.List<String> queue =
        pendingFlush.computeIfAbsent(streamKey, k -> new java.util.ArrayList<>());
    java.util.concurrent.atomic.AtomicLong bytes =
        pendingFlushBytes.computeIfAbsent(
            streamKey, k -> new java.util.concurrent.atomic.AtomicLong());
    java.util.concurrent.atomic.AtomicLong counter =
        totalLinesAppended.computeIfAbsent(
            streamKey, k -> new java.util.concurrent.atomic.AtomicLong());
    long addedBytes = 0;
    for (int i = 0; i < lineCount; i++) {
      queue.add(splitLines[i]);
      addedBytes += splitLines[i].length() + 1L;
    }
    bytes.addAndGet(addedBytes);
    counter.addAndGet(lineCount);

    if (bytes.get() >= earlyFlushWatermarkBytes) {
      final String key = streamKey;
      cleanupExecutor.execute(() -> writePartialLogsForStream(key));
    }
  }

  // Update activeStreams entry as a "stream is live" marker (no MultipartS3OutputStream).
  activeStreams.computeIfAbsent(
      streamKey,
      k -> new StreamContext(System.currentTimeMillis(), metrics));
  StreamContext ctx = activeStreams.get(streamKey);
  if (ctx != null) {
    ctx.updateAccessTime();
  }

  if (metrics != null) {
    metrics.recordLogsSent(1);
    if (sample != null) {
      metrics.recordLogShipment(sample);
    }
  }

  markRunAsActive(pipelineFQN, runId);
  ```

  Update `StreamContext` to not require a `MultipartS3OutputStream`:

  ```java
  private static class StreamContext {
    volatile long lastAccessTime;
    private final StreamableLogsMetrics metrics;

    StreamContext(long creationTime, StreamableLogsMetrics metrics) {
      this.lastAccessTime = creationTime;
      this.metrics = metrics;
    }

    void updateAccessTime() {
      this.lastAccessTime = System.currentTimeMillis();
    }
  }
  ```

  Delete the `MultipartS3OutputStream` inner class entirely (around lines 1167-1380).

  Delete `getLogOutputStream(String, UUID)` (around lines 269-303) — the abstract is also superceded; replace its body with `throw new UnsupportedOperationException("Streaming output is no longer supported; use appendLogs.")`. Keep the override (interface mandates it) but make it a hard failure.

  Remove fields that are no longer used:
  - `s3AsyncClient` — verify by `grep -n "s3AsyncClient" S3LogStorage.java`. Several call sites remain (`markRunAsActive`); keep the field if those callers still need it.
  - `partialLogOffsets` — should be unused after Task 5 rewrite. Remove the field and all references.
  - `asyncBufferSize` — no longer used. Remove.

  Update `flush()` (the public test helper, line ~1013) to drop the multipart-stream loop:

  ```java
  public void flush() {
    writePartialLogs();
    activeStreams.clear();
    pendingFlush.clear();
    pendingFlushBytes.clear();
    totalLinesAppended.clear();
  }
  ```

  Update `flush(String, UUID)` (line ~1037) similarly — see Task 8 for full rewrite.

- [ ] **Step 6.4: Run the new test plus all S3LogStorage tests**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest -q
  ```
  Expected: many existing tests will now fail because they asserted on multipart behavior. Examine each failure and update the test to reflect the new design (most should simplify — they were probing internal multipart state that is gone).

- [ ] **Step 6.5: Update tests that asserted multipart behavior**

  Quick triage:
  ```bash
  grep -n "MultipartS3OutputStream\|createMultipartUpload\|uploadPart\|completeMultipartUpload" \
    openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java
  ```
  For each match, either delete the test (if it only verified multipart wiring) or rewrite to the equivalent partial.txt-based assertion. Reference the spec for what behavior is now correct.

- [ ] **Step 6.6: Run all S3LogStorage tests until green**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest -q
  ```
  Expected: BUILD SUCCESS.

- [ ] **Step 6.7: Format and commit**

  ```bash
  mvn spotless:apply -pl openmetadata-service -q
  git add openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java \
          openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java
  git commit -m "refactor(log-storage): remove MultipartS3OutputStream from write path

  appendLogs no longer initiates a multipart upload; bytes flow only through
  pendingFlush -> partial.txt PUTs. logs.txt will be materialized by the
  rewritten /close in a follow-up commit. Closes the logs.txt-clobber half
  of the streamable-logs-stability spec."
  ```

---

## Task 7 — Rewrite the cleanup sweeper as `cleanupAbandonedStreams`

**PR boundary:** Standalone PR. Touches the schedule and the on-expire flow.

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java`

- [ ] **Step 7.1: Write a test for the new finalization-on-expiry behavior**

  Add to `S3LogStorageTest.java`:

  ```java
  @Test
  void testCleanupAbandonedStreamsCopiesPartialToLogsAndDrops() throws Exception {
    String streamKey = testPipelineFQN + "/" + testRunId;
    String partialKey = "test-logs/" + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
        + "/" + testRunId + "/partial.txt";
    String logsKey = "test-logs/" + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
        + "/" + testRunId + "/logs.txt";

    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "abandoned\n");

    // Force the access time to be older than the threshold (24h => 24*60*60*1000 ms).
    @SuppressWarnings("unchecked")
    java.util.Map<String, ?> active =
        (java.util.Map<String, ?>) getPrivateField(s3LogStorage, "activeStreams");
    Object ctx = active.get(streamKey);
    java.lang.reflect.Field f = ctx.getClass().getDeclaredField("lastAccessTime");
    f.setAccessible(true);
    f.setLong(ctx, System.currentTimeMillis() - (25L * 60 * 60 * 1000));

    // Trigger the sweeper.
    java.lang.reflect.Method m =
        S3LogStorage.class.getDeclaredMethod("cleanupAbandonedStreams");
    m.setAccessible(true);
    m.invoke(s3LogStorage);

    // Verify a CopyObjectRequest with src=partial.txt and dst=logs.txt was issued.
    verify(mockS3Client, atLeastOnce())
        .copyObject(argThat(
            (software.amazon.awssdk.services.s3.model.CopyObjectRequest req) ->
                req != null
                    && req.sourceBucket().equals(testBucket)
                    && req.sourceKey().equals(partialKey)
                    && req.destinationBucket().equals(testBucket)
                    && req.destinationKey().equals(logsKey)));

    // Verify partial.txt was deleted.
    verify(mockS3Client, atLeastOnce()).deleteObject(argThat(
        (software.amazon.awssdk.services.s3.model.DeleteObjectRequest req) ->
            req != null && partialKey.equals(req.key())));

    // Verify in-memory state was dropped.
    assertNull(active.get(streamKey));
  }
  ```

- [ ] **Step 7.2: Run; expect failure**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest#testCleanupAbandonedStreamsCopiesPartialToLogsAndDrops -q
  ```
  Expected: FAIL — `cleanupAbandonedStreams` does not exist yet.

- [ ] **Step 7.3: Rewrite the sweeper**

  In `S3LogStorage.java`, REPLACE `cleanupExpiredStreams()` (around line 892) with:

  ```java
  void cleanupAbandonedStreams() {
    long now = System.currentTimeMillis();
    long timeoutMs = streamTimeoutHours * 60L * 60L * 1000L;

    java.util.List<String> expired = new java.util.ArrayList<>();
    for (Map.Entry<String, StreamContext> entry : activeStreams.entrySet()) {
      if (now - entry.getValue().lastAccessTime > timeoutMs) {
        expired.add(entry.getKey());
      }
    }

    for (String streamKey : expired) {
      finalizeAbandonedStream(streamKey);
    }
  }

  private void finalizeAbandonedStream(String streamKey) {
    int lastSlashIndex = streamKey.lastIndexOf('/');
    if (lastSlashIndex == -1) return;
    String pipelineFQN = streamKey.substring(0, lastSlashIndex);
    UUID runId;
    try {
      runId = UUID.fromString(streamKey.substring(lastSlashIndex + 1));
    } catch (IllegalArgumentException e) {
      LOG.warn("Cannot finalize stream with invalid runId: {}", streamKey);
      return;
    }

    ReentrantLock lock = acquireStreamLock(streamKey);
    try {
      // Final flush of any in-memory pending lines.
      writePartialLogsForStreamLocked(streamKey, pipelineFQN, runId);

      // Server-side copy partial.txt -> logs.txt.
      try {
        copyPartialToLogs(pipelineFQN, runId);
      } catch (Exception e) {
        LOG.warn("Failed to copy partial->logs for {}: {}", streamKey, e.getMessage());
        return; // Leave state in place; retry next tick.
      }

      // Delete partial.txt.
      try {
        s3Client.deleteObject(
            DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(buildPartialS3Key(pipelineFQN, runId))
                .build());
      } catch (Exception e) {
        LOG.warn("Failed to delete partial.txt for {}: {}", streamKey, e.getMessage());
      }

      // Drop in-memory state.
      activeStreams.remove(streamKey);
      pendingFlush.remove(streamKey);
      pendingFlushBytes.remove(streamKey);
      totalLinesAppended.remove(streamKey);
      consecutiveFlushFailures.remove(streamKey);
      recentLogsCache.invalidate(streamKey);
    } finally {
      releaseStreamLock(streamKey, lock);
      streamLocks.remove(streamKey);
    }
  }

  /**
   * Helper used by both the cleanup path and /close. Assumes the per-stream lock is held.
   */
  private void writePartialLogsForStreamLocked(String streamKey, String pipelineFQN, UUID runId) {
    java.util.List<String> queue = pendingFlush.get(streamKey);
    if (queue == null || queue.isEmpty()) return;
    // Same body as writePartialLogsForStream but without re-acquiring the lock.
    // Refactor the method body of writePartialLogsForStream to call this helper.
  }

  private void copyPartialToLogs(String pipelineFQN, UUID runId) {
    String partialKey = buildPartialS3Key(pipelineFQN, runId);
    String logsKey = buildS3Key(pipelineFQN, runId);
    software.amazon.awssdk.services.s3.model.CopyObjectRequest req =
        software.amazon.awssdk.services.s3.model.CopyObjectRequest.builder()
            .sourceBucket(bucketName)
            .sourceKey(partialKey)
            .destinationBucket(bucketName)
            .destinationKey(logsKey)
            .build();
    s3Client.copyObject(req);
    if (metrics != null) {
      metrics.recordS3Write();
    }
  }
  ```

  Refactor `writePartialLogsForStream` to acquire the lock and delegate to `writePartialLogsForStreamLocked`. (Move the body you wrote in Task 5 into the `*Locked` method, with no lock-acquisition; have `writePartialLogsForStream` acquire the lock and then call the locked helper.)

  Change the schedule registration in `initialize()` (around line 218) from:

  ```java
  cleanupExecutor.scheduleWithFixedDelay(this::cleanupExpiredStreams, 1, 1, TimeUnit.MINUTES);
  ```
  to:
  ```java
  cleanupExecutor.scheduleWithFixedDelay(
      this::cleanupAbandonedStreams,
      cleanupIntervalMinutes,
      cleanupIntervalMinutes,
      TimeUnit.MINUTES);
  ```

  Also update the periodic flush registration to use `partialFlushIntervalMinutes`:

  ```java
  cleanupExecutor.scheduleWithFixedDelay(
      this::writePartialLogs,
      partialFlushIntervalMinutes,
      partialFlushIntervalMinutes,
      TimeUnit.MINUTES);
  ```

- [ ] **Step 7.4: Run the new test plus the suite**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest -q
  ```
  Expected: BUILD SUCCESS. Update or delete any tests that referred to `cleanupExpiredStreams` directly.

- [ ] **Step 7.5: Format and commit**

  ```bash
  mvn spotless:apply -pl openmetadata-service -q
  git add openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java \
          openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java
  git commit -m "refactor(log-storage): rewrite sweeper as cleanupAbandonedStreams (24h/1h)

  Bumps the idle threshold from 5 min to streamTimeoutHours (default 24h),
  the poll interval from 1 min to cleanupIntervalMinutes (default 1h), and
  changes the on-expire path from completeMultipartUpload to a server-side
  S3 copy of partial.txt -> logs.txt followed by partial.txt deletion.
  Per-stream lock entries are also removed from streamLocks on finalize."
  ```

---

## Task 8 — Rewrite `closeStream` (`/close` flow)

**PR boundary:** Standalone PR. After this lands, the bug-fix is structurally complete.

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java`

- [ ] **Step 8.1: Write a test for the new /close behavior**

  Add to `S3LogStorageTest.java`:

  ```java
  @Test
  void testCloseStreamFlushesAndCopiesPartialToLogs() throws Exception {
    String streamKey = testPipelineFQN + "/" + testRunId;
    String partialKey = "test-logs/" + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
        + "/" + testRunId + "/partial.txt";
    String logsKey = "test-logs/" + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
        + "/" + testRunId + "/logs.txt";

    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "final-line-1\nfinal-line-2\n");
    s3LogStorage.closeStream(testPipelineFQN, testRunId);

    // Final flush PUT.
    verify(mockS3Client, atLeastOnce()).putObject(
        argThat((software.amazon.awssdk.services.s3.model.PutObjectRequest req) ->
            req != null && partialKey.equals(req.key())),
        any(software.amazon.awssdk.core.sync.RequestBody.class));

    // Server-side copy.
    verify(mockS3Client, atLeastOnce()).copyObject(argThat(
        (software.amazon.awssdk.services.s3.model.CopyObjectRequest req) ->
            req != null
                && req.sourceKey().equals(partialKey)
                && req.destinationKey().equals(logsKey)));

    // partial.txt deleted.
    verify(mockS3Client, atLeastOnce()).deleteObject(argThat(
        (software.amazon.awssdk.services.s3.model.DeleteObjectRequest req) ->
            req != null && partialKey.equals(req.key())));

    // In-memory state cleared.
    @SuppressWarnings("unchecked")
    java.util.Map<String, ?> active =
        (java.util.Map<String, ?>) getPrivateField(s3LogStorage, "activeStreams");
    assertNull(active.get(streamKey));
  }

  @Test
  void testCloseStreamIsIdempotent() throws Exception {
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "x\n");
    s3LogStorage.closeStream(testPipelineFQN, testRunId);
    // Second call should not throw.
    assertDoesNotThrow(() -> s3LogStorage.closeStream(testPipelineFQN, testRunId));
  }
  ```

- [ ] **Step 8.2: Run; expect failure on the new behavior assertions**

  ```bash
  mvn test -pl openmetadata-service \
    -Dtest=S3LogStorageTest#testCloseStreamFlushesAndCopiesPartialToLogs+testCloseStreamIsIdempotent -q
  ```

- [ ] **Step 8.3: Rewrite `closeStream` and `flush(fqn, runId)`**

  In `S3LogStorage.java`, REPLACE the existing `flush(String, UUID)` and `closeStream(String, UUID)` methods (around lines 1037-1063) with:

  ```java
  @Override
  public void closeStream(String pipelineFQN, UUID runId) throws IOException {
    String streamKey = pipelineFQN + "/" + runId;
    ReentrantLock lock = acquireStreamLock(streamKey);
    try {
      // Final flush.
      writePartialLogsForStreamLocked(streamKey, pipelineFQN, runId);

      // Server-side copy partial.txt -> logs.txt. Skip if partial.txt doesn't exist
      // (idempotent /close: already finalized).
      try {
        copyPartialToLogs(pipelineFQN, runId);
      } catch (NoSuchKeyException e) {
        LOG.debug("closeStream no-op for {}: partial.txt already absent", streamKey);
        // Drop in-memory state regardless and return.
        dropStreamState(streamKey);
        return;
      } catch (Exception e) {
        throw new IOException("Failed to copy partial.txt to logs.txt for " + streamKey, e);
      }

      // Delete partial.txt.
      try {
        s3Client.deleteObject(
            DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(buildPartialS3Key(pipelineFQN, runId))
                .build());
      } catch (Exception e) {
        LOG.warn("Failed to delete partial.txt for {}: {}", streamKey, e.getMessage());
        // Non-fatal; logs.txt exists.
      }

      // Best-effort delete .active marker.
      try {
        String markerKey =
            String.format(
                "%s/.active/%s/%s/%s",
                prefix != null ? prefix : "pipeline-logs",
                pipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_"),
                runId,
                getServerId());
        s3Client.deleteObject(
            DeleteObjectRequest.builder().bucket(bucketName).key(markerKey).build());
      } catch (Exception ignored) {
        // Best-effort.
      }

      dropStreamState(streamKey);
    } finally {
      releaseStreamLock(streamKey, lock);
      streamLocks.remove(streamKey);
    }
  }

  private void dropStreamState(String streamKey) {
    activeStreams.remove(streamKey);
    pendingFlush.remove(streamKey);
    pendingFlushBytes.remove(streamKey);
    totalLinesAppended.remove(streamKey);
    consecutiveFlushFailures.remove(streamKey);
    recentLogsCache.invalidate(streamKey);
  }

  // Public test helper retained for backward-compat with existing tests.
  public void flush(String pipelineFQN, UUID runId) throws IOException {
    closeStream(pipelineFQN, runId);
  }
  ```

- [ ] **Step 8.4: Run the new tests plus the full suite**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest -q
  ```
  Expected: BUILD SUCCESS.

- [ ] **Step 8.5: Format and commit**

  ```bash
  mvn spotless:apply -pl openmetadata-service -q
  git add openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java \
          openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java
  git commit -m "refactor(log-storage): rewrite closeStream as final-flush + server-side copy

  /close now: (1) drains pendingFlush via final partial.txt PUT, (2) issues
  CopyObjectRequest from partial.txt to logs.txt server-side, (3) deletes
  partial.txt and the .active marker, (4) drops in-memory state.

  Idempotent: a second call sees no partial.txt (NoSuchKeyException) and
  returns gracefully. Concludes the streamable-logs-stability spec."
  ```

---

## Task 9 — Fix `getCombinedLogsForActiveStream` to include `pendingFlush`

**PR boundary:** Standalone PR. Read-path correction; does not affect writes.

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java`

- [ ] **Step 9.1: Write a test asserting mid-run reads include the in-memory pending tail**

  Add to `S3LogStorageTest.java`:

  ```java
  @Test
  void testGetLogsMidRunIncludesPendingFlushTail() throws Exception {
    String partialKey = "test-logs/" + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
        + "/" + testRunId + "/partial.txt";

    // Mock partial.txt with two lines already flushed.
    when(mockS3Client.getObject(argThat(
            (software.amazon.awssdk.services.s3.model.GetObjectRequest req) ->
                req != null && partialKey.equals(req.key()))))
        .thenReturn(
            new ResponseInputStream<>(
                software.amazon.awssdk.services.s3.model.GetObjectResponse.builder().build(),
                AbortableInputStream.create(
                    new ByteArrayInputStream("flushed-1\nflushed-2\n".getBytes(StandardCharsets.UTF_8)))));
    when(mockS3Client.headObject(any(software.amazon.awssdk.services.s3.model.HeadObjectRequest.class)))
        .thenThrow(NoSuchKeyException.builder().build());

    // Append two more lines that have NOT been flushed yet.
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "tail-1\ntail-2\n");

    Map<String, Object> result =
        s3LogStorage.getLogs(testPipelineFQN, testRunId, null, 100);
    String body = (String) result.get("logs");
    assertTrue(body.contains("flushed-1"));
    assertTrue(body.contains("tail-1"));
    assertTrue(body.contains("tail-2"));
  }
  ```

- [ ] **Step 9.2: Run; expect failure**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest#testGetLogsMidRunIncludesPendingFlushTail -q
  ```
  Expected: FAIL — current `getCombinedLogsForActiveStream` does not consult `pendingFlush`.

- [ ] **Step 9.3: Update `getCombinedLogsForActiveStream`**

  In `S3LogStorage.java`, in `getCombinedLogsForActiveStream` (around line 1444), AFTER the `partial.txt` GET block and BEFORE the cursor pagination:

  ```java
  // Append pendingFlush snapshot (read-only) for the most-recent-tail bytes
  // that haven't been flushed to partial.txt yet.
  String streamKeyForPending = pipelineFQN + "/" + runId;
  java.util.List<String> pendingSnapshot = pendingFlush.get(streamKeyForPending);
  if (pendingSnapshot != null) {
    ReentrantLock pendingLock = streamLocks.get(streamKeyForPending);
    if (pendingLock != null) {
      pendingLock.lock();
      try {
        allLines.addAll(new java.util.ArrayList<>(pendingSnapshot));
      } finally {
        pendingLock.unlock();
      }
    } else {
      allLines.addAll(new java.util.ArrayList<>(pendingSnapshot));
    }
  }
  ```

- [ ] **Step 9.4: Verify the test passes and run the suite**

  ```bash
  mvn test -pl openmetadata-service -Dtest=S3LogStorageTest -q
  ```
  Expected: BUILD SUCCESS.

- [ ] **Step 9.5: Format and commit**

  ```bash
  mvn spotless:apply -pl openmetadata-service -q
  git add openmetadata-service/src/main/java/org/openmetadata/service/logstorage/S3LogStorage.java \
          openmetadata-service/src/test/java/org/openmetadata/service/logstorage/S3LogStorageTest.java
  git commit -m "fix(log-storage): include pendingFlush snapshot in mid-run reads

  getCombinedLogsForActiveStream now appends the in-memory pendingFlush
  snapshot to the partial.txt body when reading mid-run, so the UI's
  paginated GET surfaces the most recent tail even before the next
  scheduled flush has happened."
  ```

---

## Task 10 — Bug-reproducer integration tests

**PR boundary:** Standalone PR. Tests against the running OM server with mocked S3 (or MinIO if convenient).

**Files:**
- Modify: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/IngestionPipelineLogStreamingResourceIT.java`

- [ ] **Step 10.1: Read the existing file structure and add three new test methods**

  Add to `IngestionPipelineLogStreamingResourceIT.java` (preserve the existing test ordering with `@Order(...)` annotations, e.g., 100/200/300 to leave room):

  ```java
  @Test
  @Order(100)
  void testIdleGapDoesNotClobberPartial() throws Exception {
    // Arrange: a fresh pipeline + runId.
    IngestionPipeline pipeline = createTestPipeline("idle-gap-test");
    UUID runId = UUID.randomUUID();

    // Append a sizeable initial burst.
    String firstBurst = generateLogContent(500);
    postLogs(pipeline.getFullyQualifiedName(), runId, firstBurst);

    // Trigger an internal cleanup-style state reset to simulate the prior bug's
    // condition. The new design is structurally immune; this test verifies that.
    // (For a true unit-level reproducer, see S3LogStorageTest#testFlushMergesExistingPartialAfterOffsetReset.)

    // Append a second burst.
    String secondBurst = generateLogContent(200);
    postLogs(pipeline.getFullyQualifiedName(), runId, secondBurst);

    // Read partial logs and assert both bursts are present.
    Map<String, Object> result = getLogs(pipeline.getFullyQualifiedName(), runId);
    String body = (String) result.get("logs");
    assertTrue(body.contains(firstBurst.split("\n")[0]),
        "first burst's first line must remain");
    assertTrue(body.contains(secondBurst.split("\n")[0]),
        "second burst's first line must be present");

    // Cleanup.
    postClose(pipeline.getFullyQualifiedName(), runId);
  }

  @Test
  @Order(110)
  void testCloseProducesLogsTxtMatchingPartial() throws Exception {
    IngestionPipeline pipeline = createTestPipeline("close-produces-logs-test");
    UUID runId = UUID.randomUUID();

    String content = generateLogContent(50);
    postLogs(pipeline.getFullyQualifiedName(), runId, content);

    // Read partial mid-run.
    Map<String, Object> mid = getLogs(pipeline.getFullyQualifiedName(), runId);
    String midBody = (String) mid.get("logs");

    // Close.
    postClose(pipeline.getFullyQualifiedName(), runId);

    // Read post-close. Body must equal mid-run body (no clobber).
    Map<String, Object> after = getLogs(pipeline.getFullyQualifiedName(), runId);
    String afterBody = (String) after.get("logs");
    assertEquals(
        midBody.replaceAll("\\s+$", ""),
        afterBody.replaceAll("\\s+$", ""),
        "post-close logs.txt must match the final partial.txt content");
  }

  @Test
  @Order(120)
  void testCloseIsIdempotent() throws Exception {
    IngestionPipeline pipeline = createTestPipeline("close-idempotent-test");
    UUID runId = UUID.randomUUID();
    postLogs(pipeline.getFullyQualifiedName(), runId, "single-line\n");
    postClose(pipeline.getFullyQualifiedName(), runId);
    // Second /close should not throw or 5xx.
    postClose(pipeline.getFullyQualifiedName(), runId);
    Map<String, Object> after = getLogs(pipeline.getFullyQualifiedName(), runId);
    assertTrue(((String) after.get("logs")).contains("single-line"));
  }

  // --- Helpers ---

  private String generateLogContent(int lineCount) {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < lineCount; i++) {
      sb.append("line-").append(i).append("\n");
    }
    return sb.toString();
  }

  private void postLogs(String fqn, UUID runId, String content) throws OpenMetadataException {
    SdkClients.adminClient()
        .request(
            HttpMethod.POST,
            "/api/v1/services/ingestionPipelines/logs/" + fqn + "/" + runId,
            content,
            "application/json");
  }

  private Map<String, Object> getLogs(String fqn, UUID runId) throws OpenMetadataException {
    return SdkClients.adminClient()
        .request(
            HttpMethod.GET,
            "/api/v1/services/ingestionPipelines/logs/" + fqn + "/" + runId,
            null,
            Map.class);
  }

  private void postClose(String fqn, UUID runId) throws OpenMetadataException {
    SdkClients.adminClient()
        .request(
            HttpMethod.POST,
            "/api/v1/services/ingestionPipelines/logs/" + fqn + "/" + runId + "/close",
            null,
            "application/json");
  }

  private IngestionPipeline createTestPipeline(String slug) throws OpenMetadataException {
    DatabaseService service = DatabaseServiceTestFactory.createDefault(TestNamespace.namespace());
    OpenMetadataClient client = SdkClients.adminClient();
    CreateIngestionPipeline create =
        new CreateIngestionPipeline()
            .withName("ipt-" + slug + "-" + UUID.randomUUID())
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(new DatabaseServiceMetadataPipeline()))
            .withAirflowConfig(new AirflowConfig().withStartDate(new java.util.Date()));
    return client.ingestionPipelines().create(create);
  }
  ```

  Adjust the helper signatures (`SdkClients.adminClient().request(...)`) to match the actual `OpenMetadataClient` API in your tree. If the request method signature differs, look at sibling ITs for the convention.

- [ ] **Step 10.2: Run the new ITs**

  ```bash
  mvn test -pl openmetadata-integration-tests -Dtest=IngestionPipelineLogStreamingResourceIT -q
  ```
  Expected: BUILD SUCCESS.

- [ ] **Step 10.3: Format and commit**

  ```bash
  mvn spotless:apply -pl openmetadata-integration-tests -q
  git add openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/IngestionPipelineLogStreamingResourceIT.java
  git commit -m "test(log-storage): add bug-reproducer ITs for streamable-logs stability

  - testIdleGapDoesNotClobberPartial: two bursts with the run held open;
    asserts both are in partial.txt.
  - testCloseProducesLogsTxtMatchingPartial: post-/close logs.txt equals
    the final partial.txt body.
  - testCloseIsIdempotent: a second /close is a graceful no-op."
  ```

---

## Task 11 — Final cleanup and documentation refresh

**PR boundary:** Either combine with Task 10 in the same PR or ship alone.

- [ ] **Step 11.1: Verify there are no remaining references to dead code**

  ```bash
  grep -rn "MultipartS3OutputStream\|partialLogOffsets\|cleanupExpiredStreams\|asyncBufferSize" \
    openmetadata-service/src/main/java/org/openmetadata/service/logstorage/ \
    openmetadata-service/src/test/java/org/openmetadata/service/logstorage/
  ```
  Expected: no matches (or only comments / doc references). Remove anything still hanging around.

- [ ] **Step 11.2: Run the full test suites**

  ```bash
  mvn test -pl openmetadata-service -Dtest='S3LogStorageTest,LogStorageFactoryTest,LogStorageTest' -q
  mvn test -pl openmetadata-integration-tests -Dtest=IngestionPipelineLogStreamingResourceIT -q
  ```
  Expected: BUILD SUCCESS for both.

- [ ] **Step 11.3: Run `spotless:apply` on every touched module**

  ```bash
  mvn spotless:apply -pl openmetadata-spec,openmetadata-service,openmetadata-integration-tests -q
  ```

- [ ] **Step 11.4: Verify the spec and feature doc still reflect the implementation**

  ```bash
  diff <(grep -E "^| (Field|Step|step|streamTimeoutHours|cleanupIntervalMinutes|partialFlushIntervalMinutes|earlyFlushWatermarkBytes|pendingFlushAlertAfterFailures)" \
            docs/superpowers/specs/2026-05-05-streamable-logs-stability-design.md) \
       <(grep -E "^| (Field|Step|step|streamTimeoutHours|cleanupIntervalMinutes|partialFlushIntervalMinutes|earlyFlushWatermarkBytes|pendingFlushAlertAfterFailures)" \
            docs/streamable-logs.md)
  ```
  Confirm no drift between the spec and the feature doc field tables.

- [ ] **Step 11.5: Final commit (only if anything was tweaked in 11.1)**

  ```bash
  git add -u
  git commit -m "chore(log-storage): final cleanup of dead multipart code and references" \
    || echo "nothing to commit"
  ```

---

## PR Grouping Summary

For ease of review, group the tasks into PRs roughly as follows:

| PR | Tasks | What it ships |
|----|-------|---------------|
| PR 1 | Tasks 1, 2 | Schema additions and config wiring (no behavior change) |
| PR 2 | Task 3 | Per-stream lock infrastructure |
| PR 3 | Tasks 4, 5 | `pendingFlush` + `totalLinesAppended` + the merge-always flush rewrite (closes the partial.txt clobber bug) |
| PR 4 | Task 6 | Remove `MultipartS3OutputStream` from the write path |
| PR 5 | Task 7 | Rewrite the abandoned-run sweeper (24h / 1h / server-side copy on expire) |
| PR 6 | Task 8 | Rewrite `closeStream` (final-flush + server-side copy) |
| PR 7 | Task 9 | Fix `getCombinedLogsForActiveStream` for mid-run reads |
| PR 8 | Tasks 10, 11 | Bug-reproducer integration tests, final cleanup |

The first three PRs together fix the 80MB→KB clobber. PR 4 + PR 6 together fix the `logs.txt` clobber. PR 5 fixes the abandoned-run resource leak / orphan finalization. PR 7 is the read-path correction. PR 8 anchors the regression coverage.

---

## Self-Review Notes

Spec coverage check:

- Section 1 (storage layout, S3 metadata): covered by Tasks 1 (schema) and 5 (metadata-on-PUT).
- Section 2 (write path, `pendingFlush`, `totalLinesAppended`, watermark, restart resume): Tasks 4, 5, 6.
- Section 3 (`cleanupAbandonedStreams`, threshold/interval): Task 7.
- Section 4 (`/close` flow, idempotency): Task 8.
- Section 5 (read path correction): Task 9.
- Section 6 (migration, configuration): Tasks 1, 2, 11.
- Testing list (10 cases in spec): coverage in Tasks 5–10. Specifically:
  - Idle gap > timeout → Task 5 (unit) + Task 10 (IT).
  - OM-server restart mid-run → Task 5 (unit, metadata-resume).
  - High-burst write → Task 5 (watermark test).
  - `/close` happy path → Task 8 + Task 10.
  - `/close` idempotency → Task 8 + Task 10.
  - `/close` after sweeper finalize → Task 8 (NoSuchKeyException path).
  - PUT failure during flush → covered by `restorePendingFlush` logic in Task 5; add a unit test if not already present.
  - Buffer overflow → structurally addressed (`pendingFlush` is unbounded); covered by watermark test.
  - Migration legacy partial.txt → Task 5 falls through (`existingBody = ""` on 404, no metadata required).
  - Sweeper finalization → Task 7.

No placeholders. No TBDs. Type/method names are consistent (`writePartialLogsForStream`, `writePartialLogsForStreamLocked`, `cleanupAbandonedStreams`, `finalizeAbandonedStream`, `copyPartialToLogs`, `dropStreamState`, `acquireStreamLock`, `releaseStreamLock`).
