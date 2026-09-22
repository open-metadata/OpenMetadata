/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.logstorage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.google.common.util.concurrent.Striped;
import io.micrometer.core.instrument.Timer;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.Lock;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.service.monitoring.StreamableLogsMetrics;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.AwsSessionCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.async.AsyncRequestBody;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.S3AsyncClientBuilder;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.AbortMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.BucketLifecycleConfiguration;
import software.amazon.awssdk.services.s3.model.CompleteMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CompletedMultipartUpload;
import software.amazon.awssdk.services.s3.model.CompletedPart;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadResponse;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.ExpirationStatus;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.LifecycleExpiration;
import software.amazon.awssdk.services.s3.model.LifecycleRule;
import software.amazon.awssdk.services.s3.model.LifecycleRuleFilter;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.PutBucketLifecycleConfigurationRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.S3Object;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;
import software.amazon.awssdk.services.s3.model.StorageClass;
import software.amazon.awssdk.services.s3.model.UploadPartCopyRequest;
import software.amazon.awssdk.services.s3.model.UploadPartCopyResponse;
import software.amazon.awssdk.services.s3.model.UploadPartRequest;
import software.amazon.awssdk.services.s3.model.UploadPartResponse;

/**
 * S3-based implementation of LogStorageInterface for storing pipeline logs.
 * Logs are organized as: bucket/prefix/pipelineFQN/runId/logs.txt
 *
 * appendLogs writes only to in-memory state (SimpleLogBuffer, pendingFlush) and notifies SSE
 * listeners. closeStream produces logs.txt by doing a final flush to partial.txt, then a
 * server-side S3 copy from partial.txt to logs.txt, followed by cleanup of partial.txt and
 * in-memory state.
 */
@Slf4j
public class S3LogStorage implements LogStorageInterface {

  private static final int DEFAULT_CLEANUP_INTERVAL_MINUTES = 60;
  private static final int DEFAULT_PARTIAL_FLUSH_INTERVAL_MINUTES = 2;
  private static final long DEFAULT_EARLY_FLUSH_WATERMARK_BYTES = 5L * 1024 * 1024;
  private static final int DEFAULT_PENDING_FLUSH_ALERT_AFTER_FAILURES = 10;
  private static final int DEFAULT_STREAM_TIMEOUT_MINUTES = 1440;
  private static final int DEFAULT_MAX_CONCURRENT_STREAMS = 100;
  private static final int DEFAULT_EXPIRATION_DAYS = 30;
  private static final long MIN_MPU_PART_BYTES = 5L * 1024 * 1024;
  private static final int LOCK_STRIPE_COUNT = 256;
  private static final Duration S3_API_CALL_TIMEOUT = Duration.ofSeconds(30);
  private static final Duration S3_API_CALL_ATTEMPT_TIMEOUT = Duration.ofSeconds(10);

  private S3Client s3Client;
  private S3AsyncClient s3AsyncClient;
  private String bucketName;
  private String prefix;
  private boolean enableSSE;
  private StorageClass storageClass;
  private int expirationDays;
  private int maxConcurrentStreams;
  private boolean isCustomEndpoint = false;
  private ServerSideEncryption sseAlgorithm = null;
  private String kmsKeyId = null;

  private int streamTimeoutMinutes;
  private int cleanupIntervalMinutes;
  private int partialFlushIntervalMinutes;
  private long earlyFlushWatermarkBytes;
  private int pendingFlushAlertAfterFailures;

  // Per-JVM identifier surfaced in partial.txt metadata. Useful for distinguishing the OM-server
  // instance that wrote a given partial.txt during cross-restart debugging.
  private final long writerEpoch = System.currentTimeMillis();

  private final Map<String, StreamContext> activeStreams = new ConcurrentHashMap<>();
  // Per-stream coordination via a fixed-stripe lock keyed on `<fqn>/<runId>`. The stripe
  // count caps memory at LOCK_STRIPE_COUNT regardless of completed-run accumulation, and
  // the same key always maps to the same lock instance - so we never need a remove path
  // (which would race acquire vs. remove and break mutual exclusion). False-contention
  // across stripes is bounded by max-concurrent-streams << stripe count.
  private final Striped<Lock> streamLocks = Striped.lock(LOCK_STRIPE_COUNT);

  // Lines accumulated since the last successful partial.txt PUT, per stream. Drained by the
  // periodic / watermark-driven flush. Values are plain ArrayList - NOT independently
  // thread-safe. MUST be accessed only while holding the corresponding per-stream lock.
  private final Map<String, List<String>> pendingFlush = new ConcurrentHashMap<>();

  // Bytes pending in pendingFlush, per stream - drives the early-flush watermark. Entries are
  // removed when the stream is finalized.
  private final Map<String, AtomicLong> pendingFlushBytes = new ConcurrentHashMap<>();

  // Monotonic logical line counter, per stream. Survives buffer eviction; never decrements.
  // Source of truth for the offset persisted in partial.txt metadata. Entries are removed when
  // the stream is finalized.
  private final Map<String, AtomicLong> totalLinesAppended = new ConcurrentHashMap<>();

  // Per-stream consecutive flush failure count for alerting. Incremented on each failed PUT and
  // reset on success. Entries are removed when the stream is finalized.
  private final Map<String, AtomicInteger> consecutiveFlushFailures = new ConcurrentHashMap<>();
  private final Set<String> scheduledPartialFlushes = ConcurrentHashMap.newKeySet();
  private Cache<String, Boolean> closedStreams;

  // Split so a stuck cleanup task cannot starve partial flush.
  private ScheduledExecutorService partialFlushExecutor;
  private ScheduledExecutorService abandonedCleanupExecutor;

  private final Cache<String, SimpleLogBuffer> recentLogsCache =
      Caffeine.newBuilder().maximumSize(200).expireAfterAccess(30, TimeUnit.MINUTES).build();

  private final Map<String, List<LogStreamListener>> activeListeners = new ConcurrentHashMap<>();
  private StreamableLogsMetrics metrics;

  @Override
  public void initialize(Map<String, Object> config) throws IOException {
    try {
      LogStorageConfiguration s3Config = (LogStorageConfiguration) config.get("config");

      if (config.get("metrics") != null) {
        this.metrics = (StreamableLogsMetrics) config.get("metrics");
      }

      this.bucketName = s3Config.getBucketName();
      this.prefix = s3Config.getPrefix() != null ? s3Config.getPrefix() : "pipeline-logs";
      this.enableSSE =
          s3Config.getEnableServerSideEncryption() != null
              ? s3Config.getEnableServerSideEncryption()
              : true;
      if (enableSSE) {
        if (LogStorageConfiguration.SseAlgorithm.AES_256.equals(s3Config.getSseAlgorithm())) {
          this.sseAlgorithm = ServerSideEncryption.AES256;
        } else if (LogStorageConfiguration.SseAlgorithm.AWS_KMS.equals(
            s3Config.getSseAlgorithm())) {
          this.sseAlgorithm = ServerSideEncryption.AWS_KMS;
          this.kmsKeyId = !nullOrEmpty(s3Config.getKmsKeyId()) ? s3Config.getKmsKeyId() : null;
        }
      }
      this.storageClass =
          s3Config.getStorageClass() != null
              ? StorageClass.fromValue(s3Config.getStorageClass().value())
              : StorageClass.STANDARD_IA;
      this.expirationDays =
          s3Config.getExpirationDays() != null
              ? s3Config.getExpirationDays()
              : DEFAULT_EXPIRATION_DAYS;

      this.maxConcurrentStreams =
          s3Config.getMaxConcurrentStreams() != null
              ? s3Config.getMaxConcurrentStreams()
              : DEFAULT_MAX_CONCURRENT_STREAMS;

      this.streamTimeoutMinutes =
          s3Config.getStreamTimeoutMinutes() != null
              ? s3Config.getStreamTimeoutMinutes()
              : DEFAULT_STREAM_TIMEOUT_MINUTES;

      this.cleanupIntervalMinutes =
          s3Config.getCleanupIntervalMinutes() != null
              ? s3Config.getCleanupIntervalMinutes()
              : DEFAULT_CLEANUP_INTERVAL_MINUTES;

      this.partialFlushIntervalMinutes =
          s3Config.getPartialFlushIntervalMinutes() != null
              ? s3Config.getPartialFlushIntervalMinutes()
              : DEFAULT_PARTIAL_FLUSH_INTERVAL_MINUTES;

      this.earlyFlushWatermarkBytes =
          s3Config.getEarlyFlushWatermarkBytes() != null
              ? s3Config.getEarlyFlushWatermarkBytes()
              : DEFAULT_EARLY_FLUSH_WATERMARK_BYTES;

      this.pendingFlushAlertAfterFailures =
          s3Config.getPendingFlushAlertAfterFailures() != null
              ? s3Config.getPendingFlushAlertAfterFailures()
              : DEFAULT_PENDING_FLUSH_ALERT_AFTER_FAILURES;

      this.closedStreams =
          Caffeine.newBuilder()
              .maximumSize(10000)
              .expireAfterWrite(Math.max(1, streamTimeoutMinutes), TimeUnit.MINUTES)
              .build();

      S3ClientBuilder s3Builder =
          S3Client.builder()
              .region(Region.of(s3Config.getAwsConfig().getAwsRegion()))
              .overrideConfiguration(s3ClientOverrideConfiguration());

      URI customEndpoint = s3Config.getAwsConfig().getEndPointURL();
      if (!nullOrEmpty(customEndpoint)) {
        s3Builder.endpointOverride(java.net.URI.create(customEndpoint.toString()));
        s3Builder.forcePathStyle(true); // Required for MinIO
        this.isCustomEndpoint = true;
      }

      AwsCredentialsProvider credentialsProvider = resolveCredentials(s3Config.getAwsConfig());
      s3Builder.credentialsProvider(credentialsProvider);

      this.metrics = (StreamableLogsMetrics) config.get("metrics");
      if (this.metrics == null) {
        LOG.warn("StreamableLogsMetrics not provided, metrics collection disabled");
      }

      this.s3Client = s3Builder.build();

      S3AsyncClientBuilder asyncBuilder =
          S3AsyncClient.builder()
              .region(Region.of(s3Config.getAwsConfig().getAwsRegion()))
              .credentialsProvider(credentialsProvider)
              .overrideConfiguration(s3ClientOverrideConfiguration());

      if (!nullOrEmpty(customEndpoint)) {
        asyncBuilder.endpointOverride(java.net.URI.create(customEndpoint.toString()));
        asyncBuilder.forcePathStyle(true);
      }

      this.s3AsyncClient = asyncBuilder.build();

      try {
        s3Client.headBucket(HeadBucketRequest.builder().bucket(bucketName).build());
      } catch (NoSuchBucketException e) {
        throw new IOException("S3 bucket does not exist: " + bucketName);
      } catch (Exception e) {
        throw new RuntimeException(
            "Error accessing S3 bucket: " + bucketName + ". Validate AWS configuration.", e);
      }

      this.partialFlushExecutor =
          Executors.newSingleThreadScheduledExecutor(namedDaemonFactory("s3-log-partial-flush"));
      this.abandonedCleanupExecutor =
          Executors.newSingleThreadScheduledExecutor(
              namedDaemonFactory("s3-log-abandoned-cleanup"));

      abandonedCleanupExecutor.scheduleWithFixedDelay(
          safeScheduledTask("cleanupAbandonedStreams", this::cleanupAbandonedStreams),
          cleanupIntervalMinutes,
          cleanupIntervalMinutes,
          TimeUnit.MINUTES);

      partialFlushExecutor.scheduleWithFixedDelay(
          safeScheduledTask("writePartialLogs", this::writePartialLogs),
          partialFlushIntervalMinutes,
          partialFlushIntervalMinutes,
          TimeUnit.MINUTES);

      if (expirationDays > 0) {
        try {
          configureLifecyclePolicy();
        } catch (Exception e) {
          LOG.warn(
              "Failed to configure lifecycle policy. This is expected for MinIO or S3-compatible storage: {}",
              e.getMessage());
        }
      }

      LOG.info(
          "S3LogStorage initialized with bucket: {}, prefix: {}, maxStreams: {}, timeoutMinutes: {}",
          bucketName,
          prefix,
          maxConcurrentStreams,
          streamTimeoutMinutes);
    } catch (Exception e) {
      throw new IOException("Failed to initialize S3LogStorage", e);
    }
  }

  private AwsCredentialsProvider resolveCredentials(AWSCredentials config) {
    String accessKey = config.getAwsAccessKeyId();
    String secretKey = config.getAwsSecretAccessKey();
    String sessionToken = config.getAwsSessionToken();
    if ((!nullOrEmpty(accessKey) && !nullOrEmpty(secretKey))
        || !nullOrEmpty(config.getEndPointURL())) {
      if (!nullOrEmpty(sessionToken)) {
        return StaticCredentialsProvider.create(
            AwsSessionCredentials.create(accessKey, secretKey, sessionToken));
      } else {
        return StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
      }
    } else if (Boolean.TRUE.equals(config.getEnabled())) {
      LOG.info("Using AWS DefaultCredentialsProvider (IAM auth enabled)");
      return DefaultCredentialsProvider.create();
    } else {
      throw new IllegalArgumentException(
          "AWS credentials not configured for S3 log storage. Either provide "
              + "awsAccessKeyId/awsSecretAccessKey or set enabled=true to use IAM authentication.");
    }
  }

  private ClientOverrideConfiguration s3ClientOverrideConfiguration() {
    return ClientOverrideConfiguration.builder()
        .apiCallTimeout(S3_API_CALL_TIMEOUT)
        .apiCallAttemptTimeout(S3_API_CALL_ATTEMPT_TIMEOUT)
        .build();
  }

  private boolean isStreamClosed(String streamKey) {
    return closedStreams != null && closedStreams.getIfPresent(streamKey) != null;
  }

  private void markStreamClosed(String streamKey) {
    if (closedStreams != null) {
      closedStreams.put(streamKey, Boolean.TRUE);
    }
  }

  @Override
  public void appendLogs(String pipelineFQN, UUID runId, String logContent) throws IOException {
    if (nullOrEmpty(logContent)) {
      return;
    }

    Timer.Sample sample = null;
    if (metrics != null) {
      sample = metrics.startLogShipment();
      metrics.recordBatchSize(logContent.split("\n").length);
    }

    String streamKey = pipelineFQN + "/" + runId;
    Lock lock = acquireStreamLock(streamKey);
    try {
      if (isStreamClosed(streamKey)) {
        LOG.debug("Dropping late logs for already closed stream {}", streamKey);
        return;
      }

      // Update memory cache for real-time log viewing
      SimpleLogBuffer recentLogs = recentLogsCache.get(streamKey, k -> new SimpleLogBuffer(1000));
      recentLogs.append(logContent);

      // Track the run as live (no multipart upload here - bytes flow through pendingFlush ->
      // partial.txt).
      StreamContext ctx =
          activeStreams.computeIfAbsent(
              streamKey, k -> new StreamContext(System.currentTimeMillis(), metrics));
      ctx.updateAccessTime();

      // Track lines for the durable-pending flush queue and the logical line counter.
      String[] splitLines = logContent.split("\n", -1);
      int lineCount = splitLines.length;
      if (lineCount > 0 && splitLines[lineCount - 1].isEmpty()) {
        lineCount--;
      }
      if (lineCount > 0) {
        List<String> queue = pendingFlush.computeIfAbsent(streamKey, k -> new ArrayList<>());
        AtomicLong bytes = pendingFlushBytes.computeIfAbsent(streamKey, k -> new AtomicLong());
        AtomicLong counter = totalLinesAppended.computeIfAbsent(streamKey, k -> new AtomicLong());
        long addedBytes = 0;
        for (int i = 0; i < lineCount; i++) {
          queue.add(splitLines[i]);
          addedBytes += splitLines[i].length() + 1L; // +1 for the join newline at flush time
        }
        bytes.addAndGet(addedBytes);
        counter.addAndGet(lineCount);
        if (bytes.get() >= earlyFlushWatermarkBytes && scheduledPartialFlushes.add(streamKey)) {
          final String key = streamKey;
          partialFlushExecutor.execute(
              safeScheduledTask(
                  "writePartialLogsForStream",
                  () -> {
                    try {
                      writePartialLogsForStream(key);
                    } finally {
                      scheduledPartialFlushes.remove(key);
                    }
                  }));
        }
      }

      // Notify listeners for SSE/WebSocket streaming
      notifyListeners(streamKey, logContent);

      if (metrics != null) {
        metrics.recordLogsSent(1);
        if (sample != null) {
          metrics.recordLogShipment(sample);
        }
      }
    } catch (Exception e) {
      if (metrics != null) {
        metrics.recordLogsFailed();
      }
      throw new IOException("Failed to append logs for " + pipelineFQN + "/" + runId, e);
    } finally {
      releaseStreamLock(streamKey, lock);
    }

    markRunAsActive(pipelineFQN, runId);
  }

  @Override
  public InputStream getLogInputStream(String pipelineFQN, UUID runId) throws IOException {
    String streamKey = pipelineFQN + "/" + runId;

    // Check if pipeline is still running (active stream in progress)
    StreamContext activeStream = activeStreams.get(streamKey);
    if (activeStream != null) {
      // Pipeline is still running - read from memory cache
      List<String> recentLines = getRecentLogs(pipelineFQN, runId, 1000);
      String content = String.join("\n", recentLines);
      return new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8));
    }

    String key = buildS3Key(pipelineFQN, runId);

    Timer.Sample s3Sample = null;
    if (metrics != null) {
      s3Sample = metrics.startS3Operation();
    }

    try {
      GetObjectRequest request = GetObjectRequest.builder().bucket(bucketName).key(key).build();
      InputStream result = s3Client.getObject(request);

      if (metrics != null) {
        metrics.recordS3Read();
        if (s3Sample != null) {
          metrics.recordS3Operation(s3Sample);
        }
      }

      return result;
    } catch (NoSuchKeyException e) {
      List<String> recentLines = getRecentLogs(pipelineFQN, runId, 1000);
      if (!recentLines.isEmpty()) {
        String content = String.join("\n", recentLines);
        return new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8));
      }
      return new ByteArrayInputStream(new byte[0]);
    } catch (Exception e) {
      if (metrics != null) {
        metrics.recordS3Error();
      }
      throw new IOException("Failed to stream logs from S3", e);
    }
  }

  @Override
  public Map<String, Object> getLogs(String pipelineFQN, UUID runId, String afterCursor, int limit)
      throws IOException {
    String streamKey = pipelineFQN + "/" + runId;
    Map<String, Object> result = new HashMap<>();

    // Check if pipeline is still running (active stream in progress)
    StreamContext activeStream = activeStreams.get(streamKey);
    if (activeStream != null) {
      // Pipeline is still running - combine completed logs from S3 + recent logs from memory
      result = getCombinedLogsForActiveStream(pipelineFQN, runId, afterCursor, limit);
      result.put("streaming", true); // Indicate logs are still being written
      LOG.debug(
          "Reading combined logs (S3 + memory) for active pipeline {}/{}", pipelineFQN, runId);
      return result;
    }

    // Pipeline completed - read from S3
    String key = buildS3Key(pipelineFQN, runId);

    Timer.Sample s3Sample = null;
    if (metrics != null) {
      s3Sample = metrics.startS3Operation();
    }

    try {
      HeadObjectRequest headRequest =
          HeadObjectRequest.builder().bucket(bucketName).key(key).build();

      HeadObjectResponse headResponse;
      try {
        headResponse = s3Client.headObject(headRequest);
      } catch (NoSuchKeyException e) {
        // Main file doesn't exist - check for partial file first
        String partialKey = buildPartialS3Key(pipelineFQN, runId);
        try {
          GetObjectRequest getRequest =
              GetObjectRequest.builder().bucket(bucketName).key(partialKey).build();
          try (InputStream objectContent = s3Client.getObject(getRequest);
              BufferedReader reader =
                  new BufferedReader(
                      new InputStreamReader(objectContent, StandardCharsets.UTF_8))) {

            List<String> allLines = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
              allLines.add(line);
            }

            // Apply pagination
            int startIndex = 0;
            if (afterCursor != null && !afterCursor.isEmpty()) {
              try {
                startIndex = Integer.parseInt(afterCursor);
              } catch (NumberFormatException ex) {
                LOG.warn("Invalid cursor format: {}", afterCursor);
              }
            }

            int endIndex = Math.min(startIndex + limit, allLines.size());
            List<String> resultLines =
                startIndex < allLines.size()
                    ? allLines.subList(startIndex, endIndex)
                    : Collections.emptyList();

            result.put("logs", String.join("\n", resultLines));
            result.put("after", endIndex < allLines.size() ? String.valueOf(endIndex) : null);
            result.put("total", (long) allLines.size());

            if (metrics != null && s3Sample != null) {
              metrics.recordS3Read();
              metrics.recordS3Operation(s3Sample);
            }
            return result;
          }
        } catch (NoSuchKeyException ex) {
          // Neither main nor partial file exists - this means truly no logs
          LOG.debug("No logs found (neither main nor partial) for {}/{}", pipelineFQN, runId);
        } catch (Exception ex) {
          LOG.warn(
              "Failed to read partial logs from S3 for {}/{}: {}",
              pipelineFQN,
              runId,
              ex.getMessage());
        }

        result.put("logs", "");
        result.put("after", null);
        result.put("total", 0L);
        return result;
      }

      long totalSize = headResponse.contentLength();

      GetObjectRequest getRequest = GetObjectRequest.builder().bucket(bucketName).key(key).build();

      try (InputStream objectContent = s3Client.getObject(getRequest);
          BufferedReader reader =
              new BufferedReader(new InputStreamReader(objectContent, StandardCharsets.UTF_8))) {

        List<String> lines = new ArrayList<>();
        String line;
        int lineNumber = 0;
        int startLine = 0;
        if (afterCursor != null && !afterCursor.isEmpty()) {
          try {
            startLine = Integer.parseInt(afterCursor);
          } catch (NumberFormatException ex) {
            LOG.warn("Invalid cursor format: {}", afterCursor);
          }
        }

        while (lineNumber < startLine && (line = reader.readLine()) != null) {
          lineNumber++;
        }

        while (lines.size() < limit && (line = reader.readLine()) != null) {
          lines.add(line);
          lineNumber++;
        }

        String nextCursor = null;
        if (reader.readLine() != null) {
          nextCursor = String.valueOf(lineNumber);
        }

        result.put("logs", String.join("\n", lines));
        result.put("after", nextCursor);
        result.put("total", totalSize);
      }

      if (metrics != null) {
        metrics.recordS3Read();
        if (s3Sample != null) {
          metrics.recordS3Operation(s3Sample);
        }
      }

      return result;
    } catch (Exception e) {
      if (metrics != null) {
        metrics.recordS3Error();
      }
      throw new IOException("Failed to get logs from S3", e);
    }
  }

  @Override
  public UUID getLatestRunId(String pipelineFQN) throws IOException {
    List<UUID> runs = listRuns(pipelineFQN, 1);
    return runs.isEmpty() ? null : runs.get(0);
  }

  @Override
  public List<UUID> listRuns(String pipelineFQN, int limit) throws IOException {
    String keyPrefix = buildKeyPrefix(pipelineFQN);
    Set<UUID> uniqueRunIds = new HashSet<>();

    Timer.Sample s3Sample = null;
    if (metrics != null) {
      s3Sample = metrics.startS3Operation();
    }

    try {
      ListObjectsV2Request request =
          ListObjectsV2Request.builder()
              .bucket(bucketName)
              .prefix(keyPrefix)
              .maxKeys(limit * 2) // Request more to account for directories
              .build();

      ListObjectsV2Response response = s3Client.listObjectsV2(request);

      if (metrics != null) {
        metrics.recordS3Read();
        if (s3Sample != null) {
          metrics.recordS3Operation(s3Sample);
        }
      }

      for (S3Object s3Object : response.contents()) {
        String key = s3Object.key();
        // Key format is: pipeline-logs/{sanitizedFQN}/{runId}/logs.txt
        // After removing prefix, we have: {runId}/logs.txt
        if (key.length() > keyPrefix.length()) {
          String relativePath = key.substring(keyPrefix.length());
          String[] parts = relativePath.split("/");

          if (parts.length > 0 && !parts[0].isEmpty()) {
            try {
              UUID runId = UUID.fromString(parts[0]);
              uniqueRunIds.add(runId);
              LOG.debug("Found run ID: {} from key: {}", runId, key);
            } catch (IllegalArgumentException e) {
              LOG.debug("Invalid UUID format: {} in key: {}", parts[0], key);
            }
          }
        }
      }

      List<UUID> runIds = new ArrayList<>(uniqueRunIds);

      runIds.sort(Collections.reverseOrder());

      return runIds.size() > limit ? runIds.subList(0, limit) : runIds;
    } catch (Exception e) {
      if (metrics != null) {
        metrics.recordS3Error();
      }
      throw new IOException("Failed to list runs from S3", e);
    }
  }

  @Override
  public void deleteLogs(String pipelineFQN, UUID runId) throws IOException {
    String key = buildS3Key(pipelineFQN, runId);
    String partialKey = buildPartialS3Key(pipelineFQN, runId);

    String streamKey = pipelineFQN + "/" + runId;
    Lock lock = acquireStreamLock(streamKey);
    try {
      dropStreamState(streamKey);
      if (closedStreams != null) {
        closedStreams.invalidate(streamKey);
      }
    } finally {
      releaseStreamLock(streamKey, lock);
    }

    try {
      // Delete main logs file
      DeleteObjectRequest request =
          DeleteObjectRequest.builder().bucket(bucketName).key(key).build();
      s3Client.deleteObject(request);

      // Delete partial logs file if it exists
      try {
        DeleteObjectRequest partialRequest =
            DeleteObjectRequest.builder().bucket(bucketName).key(partialKey).build();
        s3Client.deleteObject(partialRequest);
      } catch (Exception e) {
        // Partial file may not exist, which is fine
        LOG.debug("Could not delete partial logs file (may not exist): {}", e.getMessage());
      }
    } catch (Exception e) {
      throw new IOException("Failed to delete logs from S3", e);
    }
  }

  @Override
  public void deleteAllLogs(String pipelineFQN) throws IOException {
    String keyPrefix = buildKeyPrefix(pipelineFQN);
    String streamKeyPrefix = pipelineFQN + "/";

    // NOTE: The per-stream lock is not acquired here because we iterate across all streams for the
    // pipeline. This method may race with active writers; out of scope for this fix.
    activeStreams
        .entrySet()
        .removeIf(
            entry -> {
              if (entry.getKey().startsWith(pipelineFQN + "/")) {
                dropStreamState(entry.getKey());
                return true;
              }
              return false;
            });

    recentLogsCache.asMap().keySet().removeIf(streamKey -> streamKey.startsWith(streamKeyPrefix));
    activeListeners.keySet().removeIf(streamKey -> streamKey.startsWith(streamKeyPrefix));
    if (closedStreams != null) {
      closedStreams.asMap().keySet().removeIf(streamKey -> streamKey.startsWith(streamKeyPrefix));
    }

    try {
      ListObjectsV2Request request =
          ListObjectsV2Request.builder().bucket(bucketName).prefix(keyPrefix).build();

      ListObjectsV2Response response;
      String continuationToken = null;

      do {
        if (continuationToken != null) {
          request = request.toBuilder().continuationToken(continuationToken).build();
        }

        response = s3Client.listObjectsV2(request);

        List<ObjectIdentifier> objectsToDelete = new ArrayList<>();
        for (S3Object s3Object : response.contents()) {
          objectsToDelete.add(ObjectIdentifier.builder().key(s3Object.key()).build());
        }

        if (!objectsToDelete.isEmpty()) {
          DeleteObjectsRequest deleteRequest =
              DeleteObjectsRequest.builder()
                  .bucket(bucketName)
                  .delete(Delete.builder().objects(objectsToDelete).build())
                  .build();

          s3Client.deleteObjects(deleteRequest);
        }

        continuationToken = response.nextContinuationToken();
      } while (response.isTruncated());
    } catch (Exception e) {
      throw new IOException("Failed to delete all logs from S3", e);
    }
  }

  @Override
  public boolean logsExist(String pipelineFQN, UUID runId) throws IOException {
    String key = buildS3Key(pipelineFQN, runId);

    try {
      HeadObjectRequest request = HeadObjectRequest.builder().bucket(bucketName).key(key).build();

      s3Client.headObject(request);
      return true;
    } catch (NoSuchKeyException e) {
      return false;
    } catch (Exception e) {
      throw new IOException("Failed to check if logs exist in S3", e);
    }
  }

  @Override
  public String getStorageType() {
    return "s3";
  }

  private static ThreadFactory namedDaemonFactory(String threadName) {
    return r -> {
      Thread t = new Thread(r);
      t.setName(threadName);
      t.setDaemon(true);
      return t;
    };
  }

  /** Swallow Throwables so a scheduled task that throws is not silently de-scheduled. */
  private Runnable safeScheduledTask(String name, Runnable task) {
    return () -> {
      try {
        task.run();
      } catch (Throwable t) { // NOSONAR
        LOG.error("Scheduled task {} threw - swallowing so the scheduler keeps running", name, t);
      }
    };
  }

  private void shutdownExecutor(ScheduledExecutorService executor, String name) {
    if (executor == null) {
      return;
    }
    executor.shutdown();
    try {
      if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
        executor.shutdownNow();
      }
    } catch (InterruptedException e) {
      LOG.debug("Interrupted while shutting down executor {}", name);
      executor.shutdownNow();
      Thread.currentThread().interrupt();
    }
  }

  @Override
  public void close() {
    activeStreams.clear();

    shutdownExecutor(partialFlushExecutor, "s3-log-partial-flush");
    shutdownExecutor(abandonedCleanupExecutor, "s3-log-abandoned-cleanup");

    if (s3Client != null) {
      s3Client.close();
    }

    if (s3AsyncClient != null) {
      s3AsyncClient.close();
    }
  }

  private String buildS3Key(String pipelineFQN, UUID runId) {
    String sanitizedFQN = pipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_");

    String cleanPrefix =
        prefix != null && prefix.endsWith("/")
            ? prefix.substring(0, prefix.length() - 1)
            : (prefix != null ? prefix : "");

    String key = String.format("%s/%s/%s/logs.txt", cleanPrefix, sanitizedFQN, runId);
    LOG.debug(
        "Building S3 key: original FQN='{}', sanitized FQN='{}', final key='{}'",
        pipelineFQN,
        sanitizedFQN,
        key);
    return key;
  }

  private String buildKeyPrefix(String pipelineFQN) {
    String sanitizedFQN = pipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_");

    String cleanPrefix =
        prefix != null && prefix.endsWith("/")
            ? prefix.substring(0, prefix.length() - 1)
            : (prefix != null ? prefix : "");

    return String.format("%s/%s/", cleanPrefix, sanitizedFQN);
  }

  private void configureLifecyclePolicy() {
    try {
      LifecycleRule rule =
          LifecycleRule.builder()
              .id("pipeline-logs-expiration")
              .status(ExpirationStatus.ENABLED)
              .expiration(LifecycleExpiration.builder().days(expirationDays).build())
              .filter(LifecycleRuleFilter.builder().prefix(prefix).build())
              .build();

      PutBucketLifecycleConfigurationRequest request =
          PutBucketLifecycleConfigurationRequest.builder()
              .bucket(bucketName)
              .lifecycleConfiguration(BucketLifecycleConfiguration.builder().rules(rule).build())
              .build();

      s3Client.putBucketLifecycleConfiguration(request);
      LOG.info("S3 lifecycle policy configured: {} days expiration", expirationDays);
    } catch (Exception e) {
      LOG.warn("Failed to configure S3 lifecycle policy", e);
    }
  }

  private void applySSEConfiguration(PutObjectRequest.Builder requestBuilder) {
    if (enableSSE && !isCustomEndpoint) {
      if (sseAlgorithm != null) {
        requestBuilder.serverSideEncryption(sseAlgorithm);
        if (sseAlgorithm == ServerSideEncryption.AWS_KMS && kmsKeyId != null) {
          requestBuilder.ssekmsKeyId(kmsKeyId);
        }
      } else {
        requestBuilder.serverSideEncryption(ServerSideEncryption.AES256);
      }
    }
  }

  private void applySSEConfiguration(CopyObjectRequest.Builder requestBuilder) {
    if (enableSSE && !isCustomEndpoint) {
      if (sseAlgorithm != null) {
        requestBuilder.serverSideEncryption(sseAlgorithm);
        if (sseAlgorithm == ServerSideEncryption.AWS_KMS && kmsKeyId != null) {
          requestBuilder.ssekmsKeyId(kmsKeyId);
        }
      } else {
        requestBuilder.serverSideEncryption(ServerSideEncryption.AES256);
      }
    }
  }

  private void applySSEConfiguration(CreateMultipartUploadRequest.Builder requestBuilder) {
    if (enableSSE && !isCustomEndpoint) {
      if (sseAlgorithm != null) {
        requestBuilder.serverSideEncryption(sseAlgorithm);
        if (sseAlgorithm == ServerSideEncryption.AWS_KMS && kmsKeyId != null) {
          requestBuilder.ssekmsKeyId(kmsKeyId);
        }
      } else {
        requestBuilder.serverSideEncryption(ServerSideEncryption.AES256);
      }
    }
  }

  void cleanupAbandonedStreams() {
    if (metrics != null) {
      metrics.recordAbandonedCleanupHeartbeat();
    }
    long now = System.currentTimeMillis();
    long timeoutMs = streamTimeoutMinutes * 60L * 1000L;

    List<String> expired = new ArrayList<>();
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
    if (lastSlashIndex == -1) {
      LOG.warn("Cannot finalize stream with malformed key: {}", streamKey);
      return;
    }
    String pipelineFQN = streamKey.substring(0, lastSlashIndex);
    UUID runId;
    try {
      runId = UUID.fromString(streamKey.substring(lastSlashIndex + 1));
    } catch (IllegalArgumentException e) {
      LOG.warn("Cannot finalize stream with invalid runId: {}", streamKey);
      return;
    }

    Lock lock = acquireStreamLock(streamKey);
    try {
      // Re-check expiration under the lock - appendLogs may have bumped lastAccessTime.
      StreamContext ctx = activeStreams.get(streamKey);
      long timeoutMs = streamTimeoutMinutes * 60L * 1000L;
      if (ctx == null || System.currentTimeMillis() - ctx.lastAccessTime <= timeoutMs) {
        return; // Stream is no longer expired (or already finalized by another path).
      }

      if (!writePartialLogsForStreamLocked(streamKey, pipelineFQN, runId)) {
        LOG.warn("Final flush failed for abandoned stream {}; will retry next sweep", streamKey);
        return; // Leave state intact for the next sweep.
      }

      try {
        copyPartialToLogs(pipelineFQN, runId);
      } catch (NoSuchKeyException e) {
        LOG.debug("finalizeAbandonedStream no-op for {}: partial.txt absent", streamKey);
      } catch (Exception e) {
        LOG.warn(
            "Failed to copy partial->logs for abandoned stream {}: {}", streamKey, e.getMessage());
        return;
      }

      try {
        s3Client.deleteObject(
            DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(buildPartialS3Key(pipelineFQN, runId))
                .build());
      } catch (Exception e) {
        LOG.warn(
            "Failed to delete partial.txt for abandoned stream {}: {}", streamKey, e.getMessage());
      }

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

      markStreamClosed(streamKey);
      dropStreamState(streamKey);
    } finally {
      releaseStreamLock(streamKey, lock);
    }
  }

  /** Scheduled tick: flush each active stream's pendingFlush to partial.txt. */
  private void writePartialLogs() {
    if (metrics != null) {
      metrics.recordPartialFlushHeartbeat();
    }
    long totalBytes = 0;
    long totalLines = 0;
    for (String streamKey : activeStreams.keySet()) {
      try {
        writePartialLogsForStream(streamKey);
      } catch (Exception e) {
        LOG.warn("Failed to write partial logs for stream: {}", streamKey, e);
      }
      AtomicLong b = pendingFlushBytes.get(streamKey);
      if (b != null) {
        totalBytes += b.get();
      }
      List<String> q = pendingFlush.get(streamKey);
      if (q != null) {
        totalLines += q.size();
      }
    }
    if (metrics != null) {
      metrics.updatePendingStreamsCount(activeStreams.size());
      metrics.updatePendingFlushBytes(totalBytes);
      metrics.updatePendingFlushLines(totalLines);
    }
  }

  private void writePartialLogsForStream(String streamKey) {
    // Parse the streamKey before acquiring the lock - these are pure local string ops
    // that don't need protection and let us validate the key shape before any I/O.
    int lastSlashIndex = streamKey.lastIndexOf('/');
    if (lastSlashIndex == -1) {
      LOG.warn("Invalid stream key format: {}", streamKey);
      return;
    }

    String pipelineFQN = streamKey.substring(0, lastSlashIndex);
    UUID runId = UUID.fromString(streamKey.substring(lastSlashIndex + 1));

    Lock lock = acquireStreamLock(streamKey);
    try {
      // Result is intentionally discarded; failures are logged inside the locked method.
      writePartialLogsForStreamLocked(streamKey, pipelineFQN, runId);
    } finally {
      releaseStreamLock(streamKey, lock);
    }
  }

  private boolean writePartialLogsForStreamLocked(
      String streamKey, String pipelineFQN, UUID runId) {
    List<String> queue = pendingFlush.get(streamKey);
    if (queue == null || queue.isEmpty()) {
      return true;
    }

    List<String> snapshot = new ArrayList<>(queue);
    queue.clear();
    AtomicLong bytes = pendingFlushBytes.get(streamKey);
    if (bytes != null) {
      // Counter is reset under the lock; restorePendingFlush below adds back to it on failure.
      // If this lock scope is ever narrowed, revisit the atomicity of clear+set+restore.
      bytes.set(0);
    }

    String partialKey = buildPartialS3Key(pipelineFQN, runId);
    PartialProbe probe;
    try {
      probe = probeAndReadPartial(partialKey);
    } catch (Exception e) {
      restorePendingFlush(streamKey, snapshot);
      recordFlushFailure(streamKey, e);
      return false;
    }

    String newContent = String.join("\n", snapshot) + "\n";
    byte[] newContentBytes = newContent.getBytes(StandardCharsets.UTF_8);

    AtomicLong counter = totalLinesAppended.computeIfAbsent(streamKey, k -> new AtomicLong());
    long candidate = probe.priorFlushedLine + snapshot.size();
    counter.accumulateAndGet(candidate, Math::max);
    long lastFlushedLine = counter.get();

    Map<String, String> metadata =
        buildPartialMetadata(lastFlushedLine, probe.size + newContentBytes.length);

    try {
      if (probe.useMpu) {
        concatenateViaMultipartUpload(partialKey, probe.size, newContentBytes, metadata);
      } else {
        putMergedPartial(partialKey, probe.existingBody, newContent, metadata);
      }
      if (metrics != null) {
        metrics.recordS3Write();
        metrics.recordPartialFlushSuccess();
      }
      consecutiveFlushFailures.computeIfAbsent(streamKey, k -> new AtomicInteger(0)).set(0);
      return true;
    } catch (Exception e) {
      restorePendingFlush(streamKey, snapshot);
      recordFlushFailure(streamKey, e);
      return false;
    }
  }

  private Map<String, String> buildPartialMetadata(long lastFlushedLine, long totalBytes) {
    Map<String, String> metadata = new HashMap<>();
    metadata.put("last-flushed-line", Long.toString(lastFlushedLine));
    metadata.put("total-bytes", Long.toString(totalBytes));
    metadata.put("writer-epoch", Long.toString(writerEpoch));
    metadata.put("writer-version", "streamable-logs-v2");
    return metadata;
  }

  // Probes partial.txt via a single GetObject. For small files we read the body now and let
  // the caller PUT a merged body. For files >= MIN_MPU_PART_BYTES we abort the body stream and
  // signal the caller to concatenate server-side via Multipart Upload + UploadPartCopy - this
  // avoids holding the full existing body in JVM heap and re-uploading it on every flush.
  private PartialProbe probeAndReadPartial(String partialKey) throws IOException {
    try {
      GetObjectRequest getRequest =
          GetObjectRequest.builder().bucket(bucketName).key(partialKey).build();
      ResponseInputStream<GetObjectResponse> response = s3Client.getObject(getRequest);
      Long contentLength = response.response().contentLength();
      long size = contentLength != null ? contentLength : 0L;
      long priorFlushedLine = parseLastFlushedLine(response.response().metadata());

      if (size >= MIN_MPU_PART_BYTES) {
        response.abort();
        return new PartialProbe(size, priorFlushedLine, null, true);
      }
      try (response) {
        String existingBody = new String(response.readAllBytes(), StandardCharsets.UTF_8);
        return new PartialProbe(size, priorFlushedLine, existingBody, false);
      }
    } catch (NoSuchKeyException e) {
      return new PartialProbe(0L, 0L, "", false);
    }
  }

  private static long parseLastFlushedLine(Map<String, String> objectMetadata) {
    String lastFlushed = objectMetadata.get("last-flushed-line");
    if (lastFlushed == null) {
      return 0L;
    }
    try {
      return Long.parseLong(lastFlushed);
    } catch (NumberFormatException ignored) {
      // Treat as 0; the metadata may be from a buggy or external writer.
      return 0L;
    }
  }

  private void putMergedPartial(
      String partialKey, String existingBody, String newContent, Map<String, String> metadata) {
    String mergedBody = existingBody + newContent;
    PutObjectRequest.Builder putBuilder =
        PutObjectRequest.builder()
            .bucket(bucketName)
            .key(partialKey)
            .contentType("text/plain")
            .metadata(metadata);
    applySSEConfiguration(putBuilder);
    s3Client.putObject(
        putBuilder.build(), software.amazon.awssdk.core.sync.RequestBody.fromString(mergedBody));
  }

  // Server-side concatenation: existing partial.txt becomes part 1 (via UploadPartCopy, no
  // download to JVM), new content becomes part 2 (the last part, exempt from the 5MB minimum).
  // CompleteMultipartUpload atomically replaces partial.txt with the new metadata.
  private void concatenateViaMultipartUpload(
      String partialKey, long existingSize, byte[] newContentBytes, Map<String, String> metadata) {
    String uploadId = createMultipartUpload(partialKey, metadata);
    try {
      CompletedPart copiedPart = uploadExistingAsPart(partialKey, uploadId, existingSize);
      CompletedPart newPart = uploadNewContentAsPart(partialKey, uploadId, newContentBytes);
      s3Client.completeMultipartUpload(
          CompleteMultipartUploadRequest.builder()
              .bucket(bucketName)
              .key(partialKey)
              .uploadId(uploadId)
              .multipartUpload(
                  CompletedMultipartUpload.builder().parts(copiedPart, newPart).build())
              .build());
    } catch (Exception e) {
      abortMultipartUploadQuietly(partialKey, uploadId);
      throw e;
    }
  }

  private String createMultipartUpload(String partialKey, Map<String, String> metadata) {
    CreateMultipartUploadRequest.Builder createBuilder =
        CreateMultipartUploadRequest.builder()
            .bucket(bucketName)
            .key(partialKey)
            .contentType("text/plain")
            .metadata(metadata);
    applySSEConfiguration(createBuilder);
    CreateMultipartUploadResponse response = s3Client.createMultipartUpload(createBuilder.build());
    return response.uploadId();
  }

  private CompletedPart uploadExistingAsPart(
      String partialKey, String uploadId, long existingSize) {
    UploadPartCopyResponse response =
        s3Client.uploadPartCopy(
            UploadPartCopyRequest.builder()
                .sourceBucket(bucketName)
                .sourceKey(partialKey)
                .destinationBucket(bucketName)
                .destinationKey(partialKey)
                .uploadId(uploadId)
                .partNumber(1)
                .copySourceRange("bytes=0-" + (existingSize - 1))
                .build());
    return CompletedPart.builder().partNumber(1).eTag(response.copyPartResult().eTag()).build();
  }

  private CompletedPart uploadNewContentAsPart(
      String partialKey, String uploadId, byte[] newContentBytes) {
    UploadPartResponse response =
        s3Client.uploadPart(
            UploadPartRequest.builder()
                .bucket(bucketName)
                .key(partialKey)
                .uploadId(uploadId)
                .partNumber(2)
                .contentLength((long) newContentBytes.length)
                .build(),
            software.amazon.awssdk.core.sync.RequestBody.fromBytes(newContentBytes));
    return CompletedPart.builder().partNumber(2).eTag(response.eTag()).build();
  }

  private void abortMultipartUploadQuietly(String partialKey, String uploadId) {
    try {
      s3Client.abortMultipartUpload(
          AbortMultipartUploadRequest.builder()
              .bucket(bucketName)
              .key(partialKey)
              .uploadId(uploadId)
              .build());
    } catch (Exception abortEx) {
      LOG.warn(
          "Failed to abort multipart upload {} for {}: {}",
          uploadId,
          partialKey,
          abortEx.getMessage());
    }
  }

  private static final class PartialProbe {
    final long size;
    final long priorFlushedLine;
    final String existingBody;
    final boolean useMpu;

    PartialProbe(long size, long priorFlushedLine, String existingBody, boolean useMpu) {
      this.size = size;
      this.priorFlushedLine = priorFlushedLine;
      this.existingBody = existingBody;
      this.useMpu = useMpu;
    }
  }

  private void restorePendingFlush(String streamKey, List<String> snapshot) {
    List<String> queue = pendingFlush.computeIfAbsent(streamKey, k -> new ArrayList<>());
    queue.addAll(0, snapshot);
    AtomicLong bytes = pendingFlushBytes.computeIfAbsent(streamKey, k -> new AtomicLong());
    long restoredBytes = 0;
    for (String line : snapshot) {
      restoredBytes += line.length() + 1L;
    }
    bytes.addAndGet(restoredBytes);
  }

  private void recordFlushFailure(String streamKey, Exception e) {
    int count =
        consecutiveFlushFailures
            .computeIfAbsent(streamKey, k -> new AtomicInteger(0))
            .incrementAndGet();
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
      metrics.recordFlushFailure();
    }
  }

  /**
   * Flush all active streams. Writes pending logs to partial.txt for each active stream and
   * clears all in-memory state. Called by tests to ensure logs are persisted.
   */
  public void flush() {
    writePartialLogs();
    activeStreams.clear();
    pendingFlush.clear();
    pendingFlushBytes.clear();
    totalLinesAppended.clear();
    consecutiveFlushFailures.clear();
  }

  /**
   * Flush a specific pipeline run's stream. Delegates to closeStream for backward compatibility.
   *
   * @param pipelineFQN Fully qualified pipeline name
   * @param runId Run identifier
   */
  public void flush(String pipelineFQN, UUID runId) throws IOException {
    closeStream(pipelineFQN, runId);
  }

  @Override
  public void closeStream(String pipelineFQN, UUID runId) throws IOException {
    String streamKey = pipelineFQN + "/" + runId;
    Lock lock = acquireStreamLock(streamKey);
    try {
      // Final flush: drain remaining pendingFlush to partial.txt.
      if (!writePartialLogsForStreamLocked(streamKey, pipelineFQN, runId)) {
        // Final flush failed - partial.txt may be stale; do not produce logs.txt.
        // pendingFlush has been restored. Caller should retry.
        throw new IOException(
            "Failed to flush remaining logs to partial.txt for "
                + streamKey
                + "; close aborted, retry next call");
      }

      // Server-side copy partial.txt -> logs.txt.
      try {
        copyPartialToLogs(pipelineFQN, runId);
      } catch (NoSuchKeyException e) {
        // Idempotent close: partial.txt already absent (likely a retry of a prior /close).
        LOG.debug("closeStream no-op for {}: partial.txt already absent", streamKey);
        markStreamClosed(streamKey);
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

      markStreamClosed(streamKey);
      dropStreamState(streamKey);
    } finally {
      releaseStreamLock(streamKey, lock);
    }
  }

  private void copyPartialToLogs(String pipelineFQN, UUID runId) {
    String partialKey = buildPartialS3Key(pipelineFQN, runId);
    String logsKey = buildS3Key(pipelineFQN, runId);
    if (objectExists(logsKey)) {
      LOG.warn(
          "logs.txt already exists for {}/{}; deleting late partial.txt without overwriting logs.txt",
          pipelineFQN,
          runId);
      return;
    }
    CopyObjectRequest.Builder builder =
        CopyObjectRequest.builder()
            .sourceBucket(bucketName)
            .sourceKey(partialKey)
            .destinationBucket(bucketName)
            .destinationKey(logsKey);
    applySSEConfiguration(builder);
    s3Client.copyObject(builder.build());
    if (metrics != null) {
      metrics.recordS3Write();
    }
  }

  private boolean objectExists(String key) {
    try {
      HeadObjectResponse response =
          s3Client.headObject(HeadObjectRequest.builder().bucket(bucketName).key(key).build());
      return response != null;
    } catch (NoSuchKeyException e) {
      return false;
    } catch (S3Exception e) {
      if (e.statusCode() == 404) {
        return false;
      }
      throw e;
    }
  }

  private void dropStreamState(String streamKey) {
    activeStreams.remove(streamKey);
    pendingFlush.remove(streamKey);
    pendingFlushBytes.remove(streamKey);
    totalLinesAppended.remove(streamKey);
    consecutiveFlushFailures.remove(streamKey);
    scheduledPartialFlushes.remove(streamKey);
    recentLogsCache.invalidate(streamKey);
    activeListeners.remove(streamKey);
  }

  private void markRunAsActive(String pipelineFQN, UUID runId) {
    String markerKey =
        String.format(
            "%s/.active/%s/%s/%s",
            prefix != null ? prefix : "pipeline-logs",
            pipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_"),
            runId,
            getServerId());

    PutObjectRequest.Builder requestBuilder =
        PutObjectRequest.builder()
            .bucket(bucketName)
            .key(markerKey)
            .contentType("text/plain")
            .metadata(
                Map.of(
                    "server-id", getServerId(),
                    "timestamp", String.valueOf(System.currentTimeMillis()),
                    "pipeline", pipelineFQN));

    applySSEConfiguration(requestBuilder);

    PutObjectRequest request = requestBuilder.build();

    s3AsyncClient
        .putObject(request, AsyncRequestBody.fromString(String.valueOf(System.currentTimeMillis())))
        .whenComplete(
            (response, throwable) -> {
              if (throwable != null) {
                LOG.debug("Failed to mark run as active: {}/{}", pipelineFQN, runId, throwable);
              }
            });
  }

  private String getServerId() {
    String serverId = System.getenv("HOSTNAME");
    if (serverId == null) {
      try {
        serverId = java.net.InetAddress.getLocalHost().getHostName();
      } catch (Exception e) {
        serverId = "server-" + UUID.randomUUID().toString().substring(0, 8);
      }
    }
    return serverId;
  }

  private Lock acquireStreamLock(String streamKey) {
    Lock lock = streamLocks.get(streamKey);
    lock.lock();
    return lock;
  }

  private void releaseStreamLock(String streamKey, Lock lock) {
    if (lock != null) {
      lock.unlock();
    }
  }

  /**
   * Context for tracking active streams with TTL
   */
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

  /**
   * Register a listener for live log streaming (for SSE/WebSocket support)
   */
  public void registerLogListener(String pipelineFQN, UUID runId, LogStreamListener listener) {
    String key = pipelineFQN + "/" + runId;
    activeListeners.computeIfAbsent(key, k -> new CopyOnWriteArrayList<>()).add(listener);

    SimpleLogBuffer recentLogs = recentLogsCache.getIfPresent(key);
    if (recentLogs != null) {
      List<String> recent = recentLogs.getRecentLines(100);
      for (String line : recent) {
        listener.onLogLine(line);
      }
    }
  }

  /**
   * Unregister a log listener
   */
  public void unregisterLogListener(String pipelineFQN, UUID runId, LogStreamListener listener) {
    String key = pipelineFQN + "/" + runId;
    List<LogStreamListener> listeners = activeListeners.get(key);
    if (listeners != null) {
      listeners.remove(listener);
      if (listeners.isEmpty()) {
        activeListeners.remove(key);
      }
    }
  }

  /**
   * Notify all registered listeners about new log content
   */
  private void notifyListeners(String key, String logContent) {
    List<LogStreamListener> listeners = activeListeners.get(key);
    if (listeners != null && !listeners.isEmpty()) {
      for (LogStreamListener listener : listeners) {
        try {
          listener.onLogLine(logContent);
        } catch (Exception e) {
          LOG.debug("Failed to notify listener", e);
        }
      }
    }
  }

  /**
   * Get recent logs from memory cache (much faster than S3)
   */
  public List<String> getRecentLogs(String pipelineFQN, UUID runId, int lines) {
    String key = pipelineFQN + "/" + runId;
    SimpleLogBuffer buffer = recentLogsCache.getIfPresent(key);
    if (buffer != null) {
      return buffer.getRecentLines(lines);
    }
    return Collections.emptyList();
  }

  /**
   * Get logs for active streams: try S3 partial file first, fallback to pendingFlush then memory
   * cache. This provides the best experience: processed logs when available, recent logs when not.
   */
  private Map<String, Object> getCombinedLogsForActiveStream(
      String pipelineFQN, UUID runId, String afterCursor, int limit) {
    Map<String, Object> result = new HashMap<>();
    List<String> allLines = new ArrayList<>();
    boolean foundPartialFile = false;

    // First, try to read from the processed/partial logs file in S3
    String partialKey = buildPartialS3Key(pipelineFQN, runId);
    try {
      GetObjectRequest getRequest =
          GetObjectRequest.builder().bucket(bucketName).key(partialKey).build();
      try (InputStream objectContent = s3Client.getObject(getRequest);
          BufferedReader reader =
              new BufferedReader(new InputStreamReader(objectContent, StandardCharsets.UTF_8))) {

        String line;
        while ((line = reader.readLine()) != null) {
          allLines.add(line);
        }
        foundPartialFile = true;
        LOG.debug(
            "Read {} processed lines from partial S3 file for {}/{}",
            allLines.size(),
            pipelineFQN,
            runId);
      }
    } catch (NoSuchKeyException e) {
      // No partial file exists yet, which is normal for new streams
      LOG.debug(
          "No processed logs file found for {}/{}, will use memory cache", pipelineFQN, runId);
    } catch (Exception e) {
      LOG.warn(
          "Failed to read processed logs from S3 for {}/{}: {}, will use memory cache",
          pipelineFQN,
          runId,
          e.getMessage());
    }

    if (foundPartialFile) {
      // Append pendingFlush tail: lines written AFTER the last partial.txt snapshot are not
      // yet in S3, so appending pendingFlush here is non-overlapping by construction.
      appendPendingFlushUnderLock(pipelineFQN, runId, allLines);
    } else {
      // No partial.txt yet (run hasn't had its first flush). Use pendingFlush as the
      // canonical source - it holds the complete set of unflushed lines. recentLogsCache
      // is for SSE live tail and may have evicted the oldest lines at its 1000-line cap.
      appendPendingFlushUnderLock(pipelineFQN, runId, allLines);
      if (allLines.isEmpty()) {
        // Defensive fallback: pendingFlush was empty (e.g., a flush just ran but partial.txt
        // was not yet visible due to S3 eventual consistency). Fall back to the cache tail.
        String streamKey = pipelineFQN + "/" + runId;
        SimpleLogBuffer buffer = recentLogsCache.getIfPresent(streamKey);
        if (buffer != null) {
          if (afterCursor != null && !afterCursor.isEmpty()) {
            allLines.addAll(buffer.getAllLines());
          } else {
            List<String> allBufferLines = buffer.getAllLines();
            if (limit > 0 && limit < allBufferLines.size() && limit <= 100) {
              allLines.addAll(allBufferLines);
            } else {
              allLines.addAll(buffer.getRecentLines(limit));
            }
          }
          LOG.debug(
              "Using {} lines from memory cache (pendingFlush empty) for active pipeline {}/{}",
              allLines.size(),
              pipelineFQN,
              runId);
        }
      }
    }

    // Apply pagination if needed
    int startIndex = 0;
    if (afterCursor != null && !afterCursor.isEmpty()) {
      try {
        startIndex = Integer.parseInt(afterCursor);
      } catch (NumberFormatException e) {
        LOG.warn("Invalid cursor format: {}", afterCursor);
      }
    }

    int endIndex = Math.min(startIndex + limit, allLines.size());
    List<String> resultLines =
        startIndex < allLines.size()
            ? allLines.subList(startIndex, endIndex)
            : Collections.emptyList();

    result.put("logs", String.join("\n", resultLines));
    result.put("after", endIndex < allLines.size() ? String.valueOf(endIndex) : null);
    result.put("total", (long) allLines.size());

    return result;
  }

  private void appendPendingFlushUnderLock(String pipelineFQN, UUID runId, List<String> target) {
    String streamKey = pipelineFQN + "/" + runId;
    if (!pendingFlush.containsKey(streamKey)) {
      return;
    }
    Lock pendingLock = streamLocks.get(streamKey);
    pendingLock.lock();
    try {
      List<String> livePending = pendingFlush.get(streamKey);
      if (livePending != null && !livePending.isEmpty()) {
        target.addAll(new ArrayList<>(livePending));
      }
    } finally {
      pendingLock.unlock();
    }
  }

  /**
   * Build S3 key for partial logs (completed parts while stream is still active)
   */
  private String buildPartialS3Key(String pipelineFQN, UUID runId) {
    String sanitizedFQN = pipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_");
    String cleanPrefix =
        prefix != null && prefix.endsWith("/")
            ? prefix.substring(0, prefix.length() - 1)
            : (prefix != null ? prefix : "");
    return String.format("%s/%s/%s/partial.txt", cleanPrefix, sanitizedFQN, runId);
  }

  /**
   * Simple append-only log buffer that maintains chronological order
   */
  private static class SimpleLogBuffer {
    private static final int MAX_LINE_LENGTH = 10 * 1024; // 10KB per line max
    private final int maxCapacity;
    private final List<String> lines = Collections.synchronizedList(new ArrayList<>());

    SimpleLogBuffer(int maxCapacity) {
      this.maxCapacity = maxCapacity;
    }

    synchronized void append(String logContent) {
      if (logContent == null || logContent.isEmpty()) {
        return;
      }
      String[] newLines = logContent.split("\n");
      for (String line : newLines) {
        // Truncate individual lines to prevent memory exhaustion
        String truncatedLine = line;
        if (line.length() > MAX_LINE_LENGTH) {
          truncatedLine =
              line.substring(0, MAX_LINE_LENGTH)
                  + "... [truncated "
                  + (line.length() - MAX_LINE_LENGTH)
                  + " chars]";
        }

        lines.add(truncatedLine);

        // Keep only the most recent lines to prevent unlimited memory growth
        if (lines.size() > maxCapacity) {
          // Remove oldest lines to stay within capacity
          int excess = lines.size() - maxCapacity;
          if (excess > 0) {
            lines.subList(0, excess).clear();
          }
        }
      }
    }

    synchronized List<String> getRecentLines(int count) {
      if (lines.isEmpty()) {
        return Collections.emptyList();
      }

      int start = Math.max(0, lines.size() - count);
      return new ArrayList<>(lines.subList(start, lines.size()));
    }

    synchronized List<String> getAllLines() {
      return new ArrayList<>(lines);
    }
  }

  /**
   * Interface for log stream listeners (SSE/WebSocket endpoints implement this)
   */
  public interface LogStreamListener {
    void onLogLine(String logLine);
  }
}
