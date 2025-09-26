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

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.micrometer.core.instrument.Timer;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.service.monitoring.StreamableLogsMetrics;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.AwsSessionCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.AbortMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.BucketLifecycleConfiguration;
import software.amazon.awssdk.services.s3.model.CompleteMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CompletedMultipartUpload;
import software.amazon.awssdk.services.s3.model.CompletedPart;
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadResponse;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.ExpirationStatus;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
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
import software.amazon.awssdk.services.s3.model.UploadPartRequest;
import software.amazon.awssdk.services.s3.model.UploadPartResponse;

/**
 * S3-based implementation of LogStorageInterface for storing pipeline logs.
 * Logs are organized as: bucket/prefix/pipelineFQN/runId/logs.txt
 *
 * This implementation uses async processing to avoid blocking application threads
 * and includes proper resource management to prevent memory leaks.
 */
@Slf4j
public class S3LogStorage implements LogStorageInterface {

  private S3Client s3Client;
  private String bucketName;
  private String prefix;
  private boolean enableSSE;
  private StorageClass storageClass;
  private int expirationDays;
  private int maxConcurrentStreams;
  private long streamTimeoutMs;
  private int asyncBufferSize;
  private boolean isCustomEndpoint = false;

  private final Map<String, StreamContext> activeStreams = new ConcurrentHashMap<>();
  private ExecutorService asyncExecutor;
  private ScheduledExecutorService cleanupExecutor;
  private final Map<String, LogBuffer> logBuffers = new ConcurrentHashMap<>();

  private final Cache<String, CircularBuffer> recentLogsCache =
      Caffeine.newBuilder().maximumSize(200).expireAfterAccess(30, TimeUnit.MINUTES).build();

  private final Map<String, List<LogStreamListener>> activeListeners = new ConcurrentHashMap<>();
  private StreamableLogsMetrics metrics;

  @Override
  public void initialize(Map<String, Object> config) throws IOException {
    try {
      LogStorageConfiguration s3Config = (LogStorageConfiguration) config.get("config");

      // Extract metrics if provided
      if (config.get("metrics") != null) {
        this.metrics = (StreamableLogsMetrics) config.get("metrics");
      }

      this.bucketName = s3Config.getBucketName();
      this.prefix = s3Config.getPrefix() != null ? s3Config.getPrefix() : "pipeline-logs";
      this.enableSSE =
          s3Config.getEnableServerSideEncryption() != null
              ? s3Config.getEnableServerSideEncryption()
              : true;
      this.storageClass =
          s3Config.getStorageClass() != null
              ? StorageClass.fromValue(s3Config.getStorageClass().value())
              : StorageClass.STANDARD_IA;
      this.expirationDays =
          s3Config.getExpirationDays() != null ? s3Config.getExpirationDays() : 30;

      this.maxConcurrentStreams =
          s3Config.getMaxConcurrentStreams() != null ? s3Config.getMaxConcurrentStreams() : 100;
      this.streamTimeoutMs =
          s3Config.getStreamTimeoutMinutes() != null
              ? s3Config.getStreamTimeoutMinutes() * 60000L
              : 300000L; // 5 minutes default
      this.asyncBufferSize =
          s3Config.getAsyncBufferSizeMB() != null
              ? s3Config.getAsyncBufferSizeMB() * 1024 * 1024
              : 5 * 1024 * 1024;

      S3ClientBuilder s3Builder = S3Client.builder().region(Region.of(s3Config.getRegion()));

      URI customEndpoint = s3Config.getAwsConfig().getEndPointURL();
      if (customEndpoint != null) {
        s3Builder.endpointOverride(java.net.URI.create(customEndpoint.toString()));
        s3Builder.forcePathStyle(true); // Required for MinIO
        this.isCustomEndpoint = true;
      }

      String accessKey = s3Config.getAwsConfig().getAwsAccessKeyId();
      String secretKey = s3Config.getAwsConfig().getAwsSecretAccessKey();
      String sessionToken = s3Config.getAwsConfig().getAwsSessionToken();
      if (accessKey != null && secretKey != null) {
        if (sessionToken != null) {
          s3Builder.credentialsProvider(
              StaticCredentialsProvider.create(
                  AwsSessionCredentials.create(accessKey, secretKey, sessionToken)));
        } else {
          s3Builder.credentialsProvider(
              StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)));
        }
      } else {
        AwsCredentialsProvider credentialsProvider =
            getCredentialsProvider(s3Config.getAwsConfig());
        s3Builder.credentialsProvider(credentialsProvider);
      }

      this.metrics = (StreamableLogsMetrics) config.get("metrics");
      if (this.metrics == null) {
        LOG.warn("StreamableLogsMetrics not provided, metrics collection disabled");
      }

      this.s3Client = s3Builder.build();

      try {
        s3Client.headBucket(HeadBucketRequest.builder().bucket(bucketName).build());
      } catch (NoSuchBucketException e) {
        throw new IOException("S3 bucket does not exist: " + bucketName);
      }

      this.asyncExecutor =
          new ThreadPoolExecutor(
              2, // Core pool size
              10, // Maximum pool size
              60L,
              TimeUnit.SECONDS, // Keep alive time
              new LinkedBlockingQueue<>(1000), // Bounded queue for backpressure
              new ThreadFactory() {
                private int counter = 0;

                @Override
                public Thread newThread(Runnable r) {
                  Thread thread = new Thread(r);
                  thread.setName("s3-log-writer-" + counter++);
                  thread.setDaemon(true);
                  return thread;
                }
              },
              new ThreadPoolExecutor.CallerRunsPolicy() // Fallback to caller thread if queue full
              );

      this.cleanupExecutor =
          Executors.newSingleThreadScheduledExecutor(
              r -> {
                Thread thread = new Thread(r);
                thread.setName("s3-log-cleanup");
                thread.setDaemon(true);
                return thread;
              });

      cleanupExecutor.scheduleWithFixedDelay(this::cleanupExpiredStreams, 1, 1, TimeUnit.MINUTES);
      cleanupExecutor.scheduleWithFixedDelay(this::flushAllBuffers, 5, 5, TimeUnit.SECONDS);

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
          "S3LogStorage initialized with bucket: {}, prefix: {}, maxStreams: {}, timeoutMs: {}",
          bucketName,
          prefix,
          maxConcurrentStreams,
          streamTimeoutMs);
    } catch (Exception e) {
      throw new IOException("Failed to initialize S3LogStorage", e);
    }
  }

  @Override
  public OutputStream getLogOutputStream(String pipelineFQN, UUID runId) throws IOException {
    String streamKey = pipelineFQN + "/" + runId;

    if (activeStreams.size() >= maxConcurrentStreams) {
      cleanupExpiredStreams();
      if (activeStreams.size() >= maxConcurrentStreams) {
        throw new IOException("Maximum concurrent log streams reached: " + maxConcurrentStreams);
      }
    }

    StreamContext existingContext = activeStreams.get(streamKey);
    if (existingContext != null) {
      existingContext.close();
      activeStreams.remove(streamKey);
    }

    String key = buildS3Key(pipelineFQN, runId);
    MultipartS3OutputStream stream =
        new MultipartS3OutputStream(
            s3Client, bucketName, key, enableSSE, storageClass, isCustomEndpoint, asyncExecutor);

    StreamContext context = new StreamContext(stream, System.currentTimeMillis());
    activeStreams.put(streamKey, context);

    return stream;
  }

  @Override
  public void appendLogs(String pipelineFQN, UUID runId, String logContent) throws IOException {
    Timer.Sample sample = null;
    if (metrics != null) {
      sample = metrics.startLogShipment();
      metrics.recordBatchSize(logContent.split("\n").length);
    }

    String bufferKey = pipelineFQN + "/" + runId;
    LogBuffer buffer = null;

    try {
      CircularBuffer recentLogs = recentLogsCache.get(bufferKey, k -> new CircularBuffer(1000));
      recentLogs.append(logContent);

      notifyListeners(bufferKey, logContent);

      buffer = logBuffers.computeIfAbsent(bufferKey, k -> new LogBuffer(pipelineFQN, runId));
      buffer.append(logContent);

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
      throw e;
    }

    markRunAsActive(pipelineFQN, runId);

    if (buffer != null && (buffer.shouldFlush() || buffer.isExpired())) {
      flushBuffer(bufferKey, buffer);
    }
  }

  @Override
  public InputStream getLogInputStream(String pipelineFQN, UUID runId) throws IOException {
    String bufferKey = pipelineFQN + "/" + runId;
    LogBuffer buffer = logBuffers.get(bufferKey);
    if (buffer != null && buffer.hasContent()) {
      flushBufferAndWait(bufferKey, buffer);
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
    String bufferKey = pipelineFQN + "/" + runId;
    LogBuffer buffer = logBuffers.get(bufferKey);
    if (buffer != null && buffer.hasContent()) {
      flushBufferAndWait(bufferKey, buffer);
    }

    String key = buildS3Key(pipelineFQN, runId);
    Map<String, Object> result = new HashMap<>();

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
        int startLine =
            afterCursor != null && !afterCursor.isEmpty() ? Integer.parseInt(afterCursor) : 0;

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
    List<UUID> runIds = new ArrayList<>();
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

      runIds.addAll(uniqueRunIds);

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

    String bufferKey = pipelineFQN + "/" + runId;
    logBuffers.remove(bufferKey);

    try {
      DeleteObjectRequest request =
          DeleteObjectRequest.builder().bucket(bucketName).key(key).build();

      s3Client.deleteObject(request);
    } catch (Exception e) {
      throw new IOException("Failed to delete logs from S3", e);
    }
  }

  @Override
  public void deleteAllLogs(String pipelineFQN) throws IOException {
    String keyPrefix = buildKeyPrefix(pipelineFQN);

    logBuffers.entrySet().removeIf(entry -> entry.getKey().startsWith(pipelineFQN + "/"));

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

  @Override
  public void close() throws IOException {
    flushAllBuffers();

    for (StreamContext context : activeStreams.values()) {
      try {
        context.close();
      } catch (Exception e) {
        LOG.error("Error closing S3 output stream", e);
      }
    }
    activeStreams.clear();
    logBuffers.clear();

    if (cleanupExecutor != null) {
      cleanupExecutor.shutdown();
      try {
        if (!cleanupExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
          cleanupExecutor.shutdownNow();
        }
      } catch (InterruptedException e) {
        cleanupExecutor.shutdownNow();
        Thread.currentThread().interrupt();
      }
    }

    if (asyncExecutor != null) {
      asyncExecutor.shutdown();
      try {
        if (!asyncExecutor.awaitTermination(10, TimeUnit.SECONDS)) {
          asyncExecutor.shutdownNow();
        }
      } catch (InterruptedException e) {
        asyncExecutor.shutdownNow();
        Thread.currentThread().interrupt();
      }
    }

    if (s3Client != null) {
      s3Client.close();
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

  private AwsCredentialsProvider getCredentialsProvider(AWSCredentials awsCredentials) {
    if (awsCredentials != null
        && awsCredentials.getAwsAccessKeyId() != null
        && awsCredentials.getAwsSecretAccessKey() != null) {
      return StaticCredentialsProvider.create(
          AwsBasicCredentials.create(
              awsCredentials.getAwsAccessKeyId(), awsCredentials.getAwsSecretAccessKey()));
    }
    return DefaultCredentialsProvider.create();
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
      LOG.info("S3 lifecycle policy configured with {} days expiration", expirationDays);
    } catch (Exception e) {
      LOG.warn("Failed to configure S3 lifecycle policy", e);
    }
  }

  private void cleanupExpiredStreams() {
    long now = System.currentTimeMillis();
    Iterator<Map.Entry<String, StreamContext>> iterator = activeStreams.entrySet().iterator();

    while (iterator.hasNext()) {
      Map.Entry<String, StreamContext> entry = iterator.next();
      StreamContext context = entry.getValue();

      if (now - context.lastAccessTime > streamTimeoutMs) {
        try {
          LOG.debug("Closing expired stream: {}", entry.getKey());
          context.close();
        } catch (Exception e) {
          LOG.error("Error closing expired stream: {}", entry.getKey(), e);
        }
        iterator.remove();
      }
    }
  }

  private void flushAllBuffers() {
    for (Map.Entry<String, LogBuffer> entry : logBuffers.entrySet()) {
      LogBuffer buffer = entry.getValue();
      if (buffer.hasContent()) {
        flushBufferAndWait(entry.getKey(), buffer);
      }
    }
  }

  public void flush() {
    flushAllBuffers();
  }

  private void flushBufferAndWait(String bufferKey, LogBuffer buffer) {
    if (!buffer.hasContent()) {
      return;
    }

    String content = buffer.getAndReset();
    if (content == null || content.isEmpty()) {
      return;
    }

    Timer.Sample s3Sample = null;
    if (metrics != null) {
      s3Sample = metrics.startS3Operation();
    }

    try {
      String key = buildS3Key(buffer.pipelineFQN, buffer.runId);

      String existingContent = "";
      try {
        GetObjectRequest getRequest =
            GetObjectRequest.builder().bucket(bucketName).key(key).build();
        existingContent = s3Client.getObjectAsBytes(getRequest).asUtf8String();
      } catch (NoSuchKeyException e) {
      }

      String updatedContent = existingContent + content;

      PutObjectRequest.Builder putRequestBuilder =
          PutObjectRequest.builder().bucket(bucketName).key(key).contentType("text/plain");

      if (!isCustomEndpoint && storageClass != null) {
        putRequestBuilder.storageClass(storageClass);
      }

      if (enableSSE && !isCustomEndpoint) {
        putRequestBuilder.serverSideEncryption(ServerSideEncryption.AES256);
      }

      s3Client.putObject(
          putRequestBuilder.build(),
          RequestBody.fromString(updatedContent, StandardCharsets.UTF_8));

      if (metrics != null) {
        metrics.recordS3Write();
        if (s3Sample != null) {
          metrics.recordS3Operation(s3Sample);
        }
        metrics.updateWriteThroughput(updatedContent.length());
      }

      String listenerKey = buffer.pipelineFQN + "_" + buffer.runId;
      notifyListeners(listenerKey, content);
    } catch (Exception e) {
      LOG.error("Failed to flush log buffer synchronously", e);
      if (metrics != null) {
        metrics.recordS3Error();
      }
    }
  }

  private void markRunAsActive(String pipelineFQN, UUID runId) {
    String markerKey =
        String.format(
            "%s/.active/%s/%s/%s",
            prefix != null ? prefix : "pipeline-logs",
            pipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_"),
            runId,
            getServerId());

    asyncExecutor.submit(
        () -> {
          try {
            PutObjectRequest request =
                PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(markerKey)
                    .contentType("text/plain")
                    .metadata(
                        Map.of(
                            "server-id", getServerId(),
                            "timestamp", String.valueOf(System.currentTimeMillis()),
                            "pipeline", pipelineFQN))
                    .build();

            s3Client.putObject(
                request, RequestBody.fromString(String.valueOf(System.currentTimeMillis())));
          } catch (Exception e) {
            LOG.debug("Failed to mark run as active: {}/{}", pipelineFQN, runId, e);
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

  private void flushBuffer(String bufferKey, LogBuffer buffer) {
    if (!buffer.hasContent()) {
      return;
    }

    String content = buffer.getAndReset();
    if (content == null || content.isEmpty()) {
      return;
    }

    asyncExecutor.submit(
        () -> {
          Timer.Sample s3Sample = null;
          if (metrics != null) {
            s3Sample = metrics.startS3Operation();
          }

          try {
            String key = buildS3Key(buffer.pipelineFQN, buffer.runId);

            String existingContent = "";
            try {
              GetObjectRequest getRequest =
                  GetObjectRequest.builder().bucket(bucketName).key(key).build();
              LOG.debug("Attempting to read from S3: bucket='{}', key='{}'", bucketName, key);
              existingContent = s3Client.getObjectAsBytes(getRequest).asUtf8String();
            } catch (NoSuchKeyException e) {
              LOG.debug("Object doesn't exist yet for key: {}", key);
            } catch (S3Exception e) {
              LOG.error("S3 error reading key '{}': {}", key, e.getMessage());
              throw e;
            }

            String updatedContent = existingContent + content;

            PutObjectRequest.Builder putRequestBuilder =
                PutObjectRequest.builder().bucket(bucketName).key(key).contentType("text/plain");

            if (!isCustomEndpoint && storageClass != null) {
              putRequestBuilder.storageClass(storageClass);
            }

            if (enableSSE && !isCustomEndpoint) {
              putRequestBuilder.serverSideEncryption(ServerSideEncryption.AES256);
            }

            s3Client.putObject(
                putRequestBuilder.build(),
                RequestBody.fromString(updatedContent, StandardCharsets.UTF_8));

            if (metrics != null) {
              metrics.recordS3Write();
              if (s3Sample != null) {
                metrics.recordS3Operation(s3Sample);
              }
              metrics.updateWriteThroughput(updatedContent.length());
            }

          } catch (Exception e) {
            LOG.error("Failed to flush log buffer for {}/{}", buffer.pipelineFQN, buffer.runId, e);
            if (metrics != null) {
              metrics.recordS3Error();
            }
          }
        });
  }

  /**
   * Context for tracking active streams with TTL
   */
  private static class StreamContext {
    final MultipartS3OutputStream stream;
    volatile long lastAccessTime;

    StreamContext(MultipartS3OutputStream stream, long creationTime) {
      this.stream = stream;
      this.lastAccessTime = creationTime;
    }

    void updateAccessTime() {
      this.lastAccessTime = System.currentTimeMillis();
    }

    void close() throws IOException {
      stream.close();
    }
  }

  /**
   * Buffer for batching log writes
   */
  private static class LogBuffer {
    private final String pipelineFQN;
    private final UUID runId;
    private final StringBuilder buffer;
    private final long creationTime;
    private static final int MAX_BUFFER_SIZE = 64 * 1024; // 64KB
    private static final long MAX_AGE_MS = 5000; // 5 seconds

    LogBuffer(String pipelineFQN, UUID runId) {
      this.pipelineFQN = pipelineFQN;
      this.runId = runId;
      this.buffer = new StringBuilder();
      this.creationTime = System.currentTimeMillis();
    }

    synchronized void append(String content) {
      buffer.append(content);
    }

    synchronized boolean hasContent() {
      return buffer.length() > 0;
    }

    synchronized boolean shouldFlush() {
      return buffer.length() >= MAX_BUFFER_SIZE;
    }

    boolean isExpired() {
      return System.currentTimeMillis() - creationTime > MAX_AGE_MS;
    }

    synchronized String getAndReset() {
      if (buffer.length() == 0) {
        return null;
      }
      String content = buffer.toString();
      buffer.setLength(0);
      return content;
    }
  }

  /**
   * Custom OutputStream for streaming data to S3 using multipart uploads
   * This properly handles append operations without data loss
   */
  private static class MultipartS3OutputStream extends OutputStream {
    private final S3Client s3Client;
    private final String bucketName;
    private final String key;
    private final boolean enableSSE;
    private final StorageClass storageClass;
    private final boolean isCustomEndpoint;
    private final ExecutorService executor;
    private final List<CompletedPart> completedParts;
    private final ByteArrayOutputStream buffer;
    private String uploadId;
    private int partNumber = 1;
    private final AtomicBoolean closed = new AtomicBoolean(false);
    private static final int PART_SIZE = 5 * 1024 * 1024; // 5MB minimum for multipart

    public MultipartS3OutputStream(
        S3Client s3Client,
        String bucketName,
        String key,
        boolean enableSSE,
        StorageClass storageClass,
        boolean isCustomEndpoint,
        ExecutorService executor)
        throws IOException {
      this.s3Client = s3Client;
      this.bucketName = bucketName;
      this.key = key;
      this.enableSSE = enableSSE;
      this.storageClass = storageClass;
      this.isCustomEndpoint = isCustomEndpoint;
      this.executor = executor;
      this.completedParts = new ArrayList<>();
      this.buffer = new ByteArrayOutputStream(PART_SIZE);

      initializeMultipartUpload();
    }

    private void initializeMultipartUpload() throws IOException {
      try {
        CreateMultipartUploadRequest.Builder requestBuilder =
            CreateMultipartUploadRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType("text/plain");

        if (!isCustomEndpoint && storageClass != null) {
          requestBuilder.storageClass(storageClass);
        }

        if (enableSSE && !isCustomEndpoint) {
          requestBuilder.serverSideEncryption(ServerSideEncryption.AES256);
        }

        CreateMultipartUploadResponse response =
            s3Client.createMultipartUpload(requestBuilder.build());
        this.uploadId = response.uploadId();
      } catch (Exception e) {
        throw new IOException("Failed to initialize multipart upload", e);
      }
    }

    @Override
    public void write(int b) throws IOException {
      if (closed.get()) {
        throw new IOException("Stream is closed");
      }
      buffer.write(b);
      if (buffer.size() >= PART_SIZE) {
        uploadPart();
      }
    }

    @Override
    public void write(byte[] b, int off, int len) throws IOException {
      if (closed.get()) {
        throw new IOException("Stream is closed");
      }
      buffer.write(b, off, len);
      if (buffer.size() >= PART_SIZE) {
        uploadPart();
      }
    }

    @Override
    public void flush() throws IOException {}

    @Override
    public void close() throws IOException {
      if (closed.compareAndSet(false, true)) {
        try {
          if (buffer.size() > 0) {
            uploadPart();
          }

          if (uploadId != null && !completedParts.isEmpty()) {
            CompleteMultipartUploadRequest completeRequest =
                CompleteMultipartUploadRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .uploadId(uploadId)
                    .multipartUpload(
                        CompletedMultipartUpload.builder().parts(completedParts).build())
                    .build();

            s3Client.completeMultipartUpload(completeRequest);
          } else if (uploadId != null) {
            AbortMultipartUploadRequest abortRequest =
                AbortMultipartUploadRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .uploadId(uploadId)
                    .build();

            s3Client.abortMultipartUpload(abortRequest);
          }
        } catch (Exception e) {
          if (uploadId != null) {
            try {
              s3Client.abortMultipartUpload(
                  AbortMultipartUploadRequest.builder()
                      .bucket(bucketName)
                      .key(key)
                      .uploadId(uploadId)
                      .build());
            } catch (Exception abortEx) {
              LOG.error("Failed to abort multipart upload", abortEx);
            }
          }
          throw new IOException("Failed to complete multipart upload", e);
        } finally {
          buffer.close();
        }
      }
    }

    private void uploadPart() throws IOException {
      if (buffer.size() == 0) {
        return;
      }

      byte[] data = buffer.toByteArray();
      buffer.reset();

      try {
        UploadPartRequest uploadRequest =
            UploadPartRequest.builder()
                .bucket(bucketName)
                .key(key)
                .uploadId(uploadId)
                .partNumber(partNumber)
                .build();

        UploadPartResponse response =
            s3Client.uploadPart(uploadRequest, RequestBody.fromBytes(data));

        completedParts.add(
            CompletedPart.builder().partNumber(partNumber).eTag(response.eTag()).build());

        partNumber++;
      } catch (Exception e) {
        throw new IOException("Failed to upload part " + (partNumber - 1), e);
      }
    }
  }

  /**
   * Register a listener for live log streaming (for SSE/WebSocket support)
   */
  public void registerLogListener(String pipelineFQN, UUID runId, LogStreamListener listener) {
    String key = pipelineFQN + "/" + runId;
    activeListeners.computeIfAbsent(key, k -> new CopyOnWriteArrayList<>()).add(listener);

    CircularBuffer recentLogs = recentLogsCache.getIfPresent(key);
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
    CircularBuffer buffer = recentLogsCache.getIfPresent(key);
    if (buffer != null) {
      return buffer.getRecentLines(lines);
    }
    return Collections.emptyList();
  }

  /**
   * Simple circular buffer for keeping recent logs in memory
   */
  private static class CircularBuffer {
    private final String[] buffer;
    private final AtomicInteger writeIndex = new AtomicInteger(0);
    private final AtomicInteger size = new AtomicInteger(0);

    CircularBuffer(int capacity) {
      this.buffer = new String[capacity];
    }

    synchronized void append(String logLine) {
      String[] lines = logLine.split("\n");
      for (String line : lines) {
        int index = writeIndex.getAndIncrement() % buffer.length;
        buffer[index] = line;
        if (size.get() < buffer.length) {
          size.incrementAndGet();
        }
      }
    }

    synchronized List<String> getRecentLines(int count) {
      List<String> result = new ArrayList<>();
      int currentSize = size.get();
      int start = Math.max(0, currentSize - count);

      for (int i = start; i < currentSize && result.size() < count; i++) {
        int index = i % buffer.length;
        if (buffer[index] != null) {
          result.add(buffer[index]);
        }
      }

      return result;
    }
  }

  /**
   * Interface for log stream listeners (SSE/WebSocket endpoints implement this)
   */
  public interface LogStreamListener {
    void onLogLine(String logLine);
  }
}
