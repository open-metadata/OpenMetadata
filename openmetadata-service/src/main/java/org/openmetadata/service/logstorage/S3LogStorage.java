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

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.*;

/**
 * S3-based implementation of LogStorageInterface for storing pipeline logs.
 * Logs are organized as: bucket/prefix/pipelineFQN/runId/logs.txt
 */
@Slf4j
public class S3LogStorage implements LogStorageInterface {

  private S3Client s3Client;
  private String bucketName;
  private String prefix;
  private boolean enableSSE;
  private StorageClass storageClass;
  private int expirationDays;

  // Map to track active output streams for concurrent writes
  private final Map<String, S3OutputStream> activeStreams = new ConcurrentHashMap<>();

  @Override
  public void initialize(Map<String, Object> config) throws IOException {
    try {
      LogStorageConfiguration s3Config = (LogStorageConfiguration) config.get("config");

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

      // Initialize S3 client
      S3ClientBuilder s3Builder = S3Client.builder().region(Region.of(s3Config.getRegion()));

      // Support custom endpoint for MinIO or other S3-compatible storage
      String customEndpoint = (String) config.get("endpoint");
      if (customEndpoint != null) {
        s3Builder.endpointOverride(java.net.URI.create(customEndpoint));
        s3Builder.forcePathStyle(true); // Required for MinIO
      }

      // Support direct credentials for testing
      String accessKey = (String) config.get("accessKey");
      String secretKey = (String) config.get("secretKey");
      if (accessKey != null && secretKey != null) {
        s3Builder.credentialsProvider(
            StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)));
      } else {
        AwsCredentialsProvider credentialsProvider =
            getCredentialsProvider(s3Config.getAwsConfig());
        s3Builder.credentialsProvider(credentialsProvider);
      }

      this.s3Client = s3Builder.build();

      // Verify bucket exists
      try {
        s3Client.headBucket(HeadBucketRequest.builder().bucket(bucketName).build());
      } catch (NoSuchBucketException e) {
        throw new IOException("S3 bucket does not exist: " + bucketName);
      }

      // Set lifecycle policy if expiration is configured
      if (expirationDays > 0) {
        try {
          configureLifecyclePolicy();
        } catch (Exception e) {
          LOG.warn(
              "Failed to configure lifecycle policy. This is expected for MinIO or S3-compatible storage: {}",
              e.getMessage());
        }
      }

      LOG.info("S3LogStorage initialized with bucket: {}, prefix: {}", bucketName, prefix);
    } catch (Exception e) {
      throw new IOException("Failed to initialize S3LogStorage", e);
    }
  }

  @Override
  public OutputStream getLogOutputStream(String pipelineFQN, UUID runId) throws IOException {
    String key = buildS3Key(pipelineFQN, runId);
    String streamKey = pipelineFQN + "/" + runId;

    // Close any existing stream for this pipeline run
    S3OutputStream existingStream = activeStreams.get(streamKey);
    if (existingStream != null) {
      existingStream.close();
    }

    S3OutputStream stream = new S3OutputStream(s3Client, bucketName, key, enableSSE, storageClass);
    activeStreams.put(streamKey, stream);
    return stream;
  }

  @Override
  public void appendLogs(String pipelineFQN, UUID runId, String logContent) throws IOException {
    // For high-frequency writes, use the output stream instead
    // This is more efficient and avoids read-modify-write race conditions
    String streamKey = pipelineFQN + "/" + runId;
    S3OutputStream stream = activeStreams.get(streamKey);

    if (stream != null) {
      // Use existing stream
      try {
        stream.write(logContent.getBytes(StandardCharsets.UTF_8));
        stream.flush();
        return;
      } catch (IOException e) {
        // Stream might be closed, create new one
        activeStreams.remove(streamKey);
      }
    }

    // If no active stream, do a simple append
    // Accept that some logs might be lost in rare concurrent scenarios
    // This is acceptable for logs and keeps the implementation simple
    String key = buildS3Key(pipelineFQN, runId);
    try {
      String existingContent = "";
      try {
        GetObjectRequest getRequest =
            GetObjectRequest.builder().bucket(bucketName).key(key).build();
        existingContent = s3Client.getObjectAsBytes(getRequest).asUtf8String();
      } catch (NoSuchKeyException e) {
        // Object doesn't exist yet, which is fine
      }

      // Append new content
      String updatedContent = existingContent + logContent;

      PutObjectRequest.Builder putRequestBuilder =
          PutObjectRequest.builder()
              .bucket(bucketName)
              .key(key)
              .contentType("text/plain")
              .storageClass(storageClass);

      if (enableSSE) {
        putRequestBuilder.serverSideEncryption(ServerSideEncryption.AES256);
      }

      s3Client.putObject(
          putRequestBuilder.build(),
          RequestBody.fromString(updatedContent, StandardCharsets.UTF_8));
    } catch (Exception e) {
      throw new IOException("Failed to append logs to S3", e);
    }
  }

  @Override
  public InputStream getLogInputStream(String pipelineFQN, UUID runId) throws IOException {
    String key = buildS3Key(pipelineFQN, runId);

    try {
      GetObjectRequest request = GetObjectRequest.builder().bucket(bucketName).key(key).build();

      return s3Client.getObject(request);
    } catch (NoSuchKeyException e) {
      // Return empty stream if object doesn't exist
      return new ByteArrayInputStream(new byte[0]);
    } catch (Exception e) {
      throw new IOException("Failed to stream logs from S3", e);
    }
  }

  @Override
  public Map<String, Object> getLogs(String pipelineFQN, UUID runId, String afterCursor, int limit)
      throws IOException {
    String key = buildS3Key(pipelineFQN, runId);
    Map<String, Object> result = new HashMap<>();

    try {
      // Check if object exists
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

      // Get object content
      GetObjectRequest getRequest = GetObjectRequest.builder().bucket(bucketName).key(key).build();

      try (InputStream objectContent = s3Client.getObject(getRequest);
          BufferedReader reader =
              new BufferedReader(new InputStreamReader(objectContent, StandardCharsets.UTF_8))) {

        List<String> lines = new ArrayList<>();
        String line;
        int lineNumber = 0;
        int startLine = afterCursor != null ? Integer.parseInt(afterCursor) : 0;

        // Skip to start position
        while (lineNumber < startLine && (line = reader.readLine()) != null) {
          lineNumber++;
        }

        // Read requested lines
        while (lines.size() < limit && (line = reader.readLine()) != null) {
          lines.add(line);
          lineNumber++;
        }

        // Check if more lines exist
        String nextCursor = null;
        if (reader.readLine() != null) {
          nextCursor = String.valueOf(lineNumber);
        }

        result.put("logs", String.join("\n", lines));
        result.put("after", nextCursor);
        result.put("total", totalSize);
      }

      return result;
    } catch (Exception e) {
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

    try {
      ListObjectsV2Request request =
          ListObjectsV2Request.builder()
              .bucket(bucketName)
              .prefix(keyPrefix)
              .maxKeys(limit * 2) // Request more to account for directories
              .build();

      ListObjectsV2Response response = s3Client.listObjectsV2(request);

      for (S3Object s3Object : response.contents()) {
        String key = s3Object.key();
        String relativePath = key.substring(keyPrefix.length());
        String[] parts = relativePath.split("/");

        if (parts.length > 0 && !parts[0].isEmpty()) {
          try {
            UUID runId = UUID.fromString(parts[0]);
            uniqueRunIds.add(runId);
          } catch (IllegalArgumentException e) {
            // Skip invalid UUIDs
          }
        }
      }

      runIds.addAll(uniqueRunIds);

      // Sort by newest first (assuming UUIDs are time-based)
      runIds.sort(Collections.reverseOrder());

      return runIds.size() > limit ? runIds.subList(0, limit) : runIds;
    } catch (Exception e) {
      throw new IOException("Failed to list runs from S3", e);
    }
  }

  @Override
  public void deleteLogs(String pipelineFQN, UUID runId) throws IOException {
    String key = buildS3Key(pipelineFQN, runId);

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
    // Close all active streams
    for (S3OutputStream stream : activeStreams.values()) {
      try {
        stream.close();
      } catch (Exception e) {
        LOG.error("Error closing S3 output stream", e);
      }
    }
    activeStreams.clear();

    if (s3Client != null) {
      s3Client.close();
    }
  }

  private String buildS3Key(String pipelineFQN, UUID runId) {
    return String.format("%s/%s/%s/logs.txt", prefix, pipelineFQN, runId);
  }

  private String buildKeyPrefix(String pipelineFQN) {
    return String.format("%s/%s/", prefix, pipelineFQN);
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

  /**
   * Custom OutputStream for streaming data directly to S3
   */
  private static class S3OutputStream extends OutputStream {
    private final S3Client s3Client;
    private final String bucketName;
    private final String key;
    private final boolean enableSSE;
    private final StorageClass storageClass;
    private final ByteArrayOutputStream buffer;
    private static final int BUFFER_SIZE = 5 * 1024 * 1024; // 5MB buffer

    public S3OutputStream(
        S3Client s3Client,
        String bucketName,
        String key,
        boolean enableSSE,
        StorageClass storageClass) {
      this.s3Client = s3Client;
      this.bucketName = bucketName;
      this.key = key;
      this.enableSSE = enableSSE;
      this.storageClass = storageClass;
      this.buffer = new ByteArrayOutputStream(BUFFER_SIZE);
    }

    @Override
    public void write(int b) throws IOException {
      buffer.write(b);
      if (buffer.size() >= BUFFER_SIZE) {
        flush();
      }
    }

    @Override
    public void write(byte[] b, int off, int len) throws IOException {
      buffer.write(b, off, len);
      if (buffer.size() >= BUFFER_SIZE) {
        flush();
      }
    }

    @Override
    public void flush() throws IOException {
      if (buffer.size() > 0) {
        uploadBuffer();
      }
    }

    @Override
    public void close() throws IOException {
      flush();
      buffer.close();
    }

    private void uploadBuffer() throws IOException {
      try {
        byte[] data = buffer.toByteArray();

        PutObjectRequest.Builder requestBuilder =
            PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType("text/plain")
                .storageClass(storageClass);

        if (enableSSE) {
          requestBuilder.serverSideEncryption(ServerSideEncryption.AES256);
        }

        s3Client.putObject(requestBuilder.build(), RequestBody.fromBytes(data));

        buffer.reset();
      } catch (Exception e) {
        throw new IOException("Failed to upload to S3", e);
      }
    }
  }
}
