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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.async.AsyncRequestBody;
import software.amazon.awssdk.http.AbortableInputStream;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.S3AsyncClientBuilder;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.*;

@ExtendWith(MockitoExtension.class)
public class S3LogStorageTest {

  @Mock private S3Client mockS3Client;
  @Mock private S3AsyncClient mockS3AsyncClient;

  private S3LogStorage s3LogStorage;
  private LogStorageConfiguration testConfig;
  private final String testBucket = "test-bucket";
  private final String testPrefix = "test-logs";
  private final String testPipelineFQN = "service.database.pipeline";
  private final UUID testRunId = UUID.randomUUID();

  @BeforeEach
  void setUp() throws IOException {
    // Create test configuration
    testConfig =
        new LogStorageConfiguration()
            .withType(LogStorageConfiguration.Type.S_3)
            .withBucketName(testBucket)
            .withAwsConfig(
                new AWSCredentials()
                    .withAwsRegion("us-east-1")
                    .withAwsAccessKeyId("test-access-key")
                    .withAwsSecretAccessKey("test-secret-key"))
            .withPrefix(testPrefix)
            .withEnableServerSideEncryption(true)
            .withStorageClass(LogStorageConfiguration.StorageClass.STANDARD_IA)
            .withExpirationDays(30);

    // Mock S3Client and S3AsyncClient builders
    try (MockedStatic<S3Client> s3ClientMock = mockStatic(S3Client.class);
        MockedStatic<S3AsyncClient> s3AsyncClientMock = mockStatic(S3AsyncClient.class)) {

      S3ClientBuilder mockBuilder = mock(S3ClientBuilder.class);
      when(S3Client.builder()).thenReturn(mockBuilder);
      when(mockBuilder.region(any())).thenReturn(mockBuilder);
      when(mockBuilder.credentialsProvider(any())).thenReturn(mockBuilder);
      when(mockBuilder.build()).thenReturn(mockS3Client);

      S3AsyncClientBuilder mockAsyncBuilder = mock(S3AsyncClientBuilder.class);
      when(S3AsyncClient.builder()).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.region(any())).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.credentialsProvider(any())).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.build()).thenReturn(mockS3AsyncClient);

      // Initialize S3LogStorage
      s3LogStorage = new S3LogStorage();
      Map<String, Object> config = new HashMap<>();
      config.put("config", testConfig);

      // Mock bucket exists check
      when(mockS3Client.headBucket(any(HeadBucketRequest.class)))
          .thenReturn(HeadBucketResponse.builder().build());

      s3LogStorage.initialize(config);
    }
  }

  // Helper method to create ResponseInputStream for mocking
  private ResponseInputStream<GetObjectResponse> createResponseInputStream(String content) {
    InputStream inputStream = new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8));
    GetObjectResponse response = GetObjectResponse.builder().build();
    return new ResponseInputStream<>(response, AbortableInputStream.create(inputStream));
  }

  private void mockActiveStreamCreation() {
    when(mockS3AsyncClient.createMultipartUpload(any(CreateMultipartUploadRequest.class)))
        .thenReturn(
            CompletableFuture.completedFuture(
                CreateMultipartUploadResponse.builder().uploadId("test-upload-id").build()));
    when(mockS3AsyncClient.putObject(any(PutObjectRequest.class), any(AsyncRequestBody.class)))
        .thenReturn(CompletableFuture.completedFuture(PutObjectResponse.builder().build()));
  }

  private void mockMultipartUploadCompletion() {
    when(mockS3AsyncClient.uploadPart(any(UploadPartRequest.class), any(AsyncRequestBody.class)))
        .thenReturn(
            CompletableFuture.completedFuture(
                UploadPartResponse.builder().eTag("test-etag").build()));
    when(mockS3AsyncClient.completeMultipartUpload(any(CompleteMultipartUploadRequest.class)))
        .thenReturn(
            CompletableFuture.completedFuture(CompleteMultipartUploadResponse.builder().build()));
  }

  @Test
  void testS3LogStorageInitialization() {
    assertNotNull(s3LogStorage);
    assertEquals("s3", s3LogStorage.getStorageType());
  }

  @Test
  void testAppendLogs() {
    String newContent = "New log content\n";
    String expectedKey = String.format("%s/%s/%s/logs.txt", testPrefix, testPipelineFQN, testRunId);

    // Mock async multipart upload initialization
    when(mockS3AsyncClient.createMultipartUpload(any(CreateMultipartUploadRequest.class)))
        .thenReturn(
            CompletableFuture.completedFuture(
                CreateMultipartUploadResponse.builder().uploadId("test-upload-id").build()));

    // Mock async upload part
    when(mockS3AsyncClient.uploadPart(any(UploadPartRequest.class), any(AsyncRequestBody.class)))
        .thenReturn(
            CompletableFuture.completedFuture(
                UploadPartResponse.builder().eTag("test-etag").build()));

    // Mock async complete multipart upload
    when(mockS3AsyncClient.completeMultipartUpload(any(CompleteMultipartUploadRequest.class)))
        .thenReturn(
            CompletableFuture.completedFuture(CompleteMultipartUploadResponse.builder().build()));

    // Mock async putObject for marking run as active
    when(mockS3AsyncClient.putObject(any(PutObjectRequest.class), any(AsyncRequestBody.class)))
        .thenReturn(CompletableFuture.completedFuture(PutObjectResponse.builder().build()));

    // Test appending logs
    assertDoesNotThrow(() -> s3LogStorage.appendLogs(testPipelineFQN, testRunId, newContent));

    // Verify multipart upload was initiated
    verify(mockS3AsyncClient, times(1))
        .createMultipartUpload(any(CreateMultipartUploadRequest.class));

    // Flush to complete multipart upload
    s3LogStorage.flush();

    // Verify multipart upload was completed
    verify(mockS3AsyncClient, times(1))
        .completeMultipartUpload(any(CompleteMultipartUploadRequest.class));
  }

  @Test
  void testAppendLogsToNewFile() {
    String newContent = "First log content\n";
    String expectedKey = String.format("%s/%s/%s/logs.txt", testPrefix, testPipelineFQN, testRunId);

    // Mock async multipart upload for new file
    when(mockS3AsyncClient.createMultipartUpload(any(CreateMultipartUploadRequest.class)))
        .thenReturn(
            CompletableFuture.completedFuture(
                CreateMultipartUploadResponse.builder().uploadId("test-upload-id").build()));

    // Mock async putObject for marking run as active
    when(mockS3AsyncClient.putObject(any(PutObjectRequest.class), any(AsyncRequestBody.class)))
        .thenReturn(CompletableFuture.completedFuture(PutObjectResponse.builder().build()));

    // Note: uploadPart and completeMultipartUpload won't be called until flush/close
    // since the content is too small (< 5MB)

    // Test appending logs to new file
    assertDoesNotThrow(() -> s3LogStorage.appendLogs(testPipelineFQN, testRunId, newContent));

    // Verify multipart upload was initiated
    verify(mockS3AsyncClient, times(1))
        .createMultipartUpload(any(CreateMultipartUploadRequest.class));
  }

  @Test
  void testGetLogs() throws IOException {
    String logContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n";
    String expectedKey = String.format("%s/%s/%s/logs.txt", testPrefix, testPipelineFQN, testRunId);

    // Mock head object
    when(mockS3Client.headObject(any(HeadObjectRequest.class)))
        .thenReturn(HeadObjectResponse.builder().contentLength((long) logContent.length()).build());

    // Mock get object - use ResponseInputStream
    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenReturn(createResponseInputStream(logContent));

    // Test getting logs
    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, null, 2);

    assertNotNull(result);
    assertEquals("Line 1\nLine 2", result.get("logs"));
    assertEquals("2", result.get("after")); // Next cursor
    assertEquals((long) logContent.length(), result.get("total"));
  }

  @Test
  void testGetLogsWithPagination() throws IOException {
    String logContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n";

    // Mock head object
    when(mockS3Client.headObject(any(HeadObjectRequest.class)))
        .thenReturn(HeadObjectResponse.builder().contentLength((long) logContent.length()).build());

    // Mock get object - use ResponseInputStream
    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenReturn(createResponseInputStream(logContent));

    // Test getting logs with cursor
    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, "2", 2);

    assertNotNull(result);
    assertEquals("Line 3\nLine 4", result.get("logs"));
    assertEquals("4", result.get("after")); // Next cursor
  }

  @Test
  void testGetLogsNonExistent() throws IOException {
    // Mock head object for non-existent
    when(mockS3Client.headObject(any(HeadObjectRequest.class)))
        .thenThrow(NoSuchKeyException.builder().build());

    // Test getting non-existent logs
    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, null, 10);

    assertNotNull(result);
    assertEquals("", result.get("logs"));
    assertNull(result.get("after"));
    assertEquals(0L, result.get("total"));
  }

  @Test
  void testListRuns() throws IOException {
    String keyPrefix = String.format("%s/%s/", testPrefix, testPipelineFQN);
    UUID runId1 = UUID.randomUUID();
    UUID runId2 = UUID.randomUUID();

    // Mock list objects response
    ListObjectsV2Response response =
        ListObjectsV2Response.builder()
            .contents(
                S3Object.builder().key(keyPrefix + runId1 + "/logs.txt").build(),
                S3Object.builder().key(keyPrefix + runId2 + "/logs.txt").build())
            .isTruncated(false)
            .build();

    when(mockS3Client.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(response);

    // Test listing runs
    List<UUID> runs = s3LogStorage.listRuns(testPipelineFQN, 10);

    assertNotNull(runs);
    assertEquals(2, runs.size());
    assertTrue(runs.contains(runId1));
    assertTrue(runs.contains(runId2));
  }

  @Test
  void testDeleteLogs() {
    // Mock delete object
    when(mockS3Client.deleteObject(any(DeleteObjectRequest.class)))
        .thenReturn(DeleteObjectResponse.builder().build());

    // Test deleting logs
    assertDoesNotThrow(() -> s3LogStorage.deleteLogs(testPipelineFQN, testRunId));

    // Verify both the log object and active marker are deleted.
    verify(mockS3Client, times(2)).deleteObject(any(DeleteObjectRequest.class));
  }

  @Test
  void testLogsExist() throws IOException {
    String expectedKey = String.format("%s/%s/%s/logs.txt", testPrefix, testPipelineFQN, testRunId);

    // Mock head object for existing
    when(mockS3Client.headObject(any(HeadObjectRequest.class)))
        .thenReturn(HeadObjectResponse.builder().build());

    // Test logs exist
    assertTrue(s3LogStorage.logsExist(testPipelineFQN, testRunId));

    // Mock head object for non-existent
    when(mockS3Client.headObject(any(HeadObjectRequest.class)))
        .thenThrow(NoSuchKeyException.builder().build());

    // Test logs don't exist
    assertFalse(s3LogStorage.logsExist(testPipelineFQN, testRunId));
  }

  @Test
  void testGetLogInputStream() throws IOException {
    String logContent = "Stream content";

    // Mock get object - use ResponseInputStream
    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenReturn(createResponseInputStream(logContent));

    // Test getting input stream
    InputStream stream = s3LogStorage.getLogInputStream(testPipelineFQN, testRunId);

    assertNotNull(stream);
    assertEquals(logContent, new String(stream.readAllBytes(), StandardCharsets.UTF_8));
  }

  @Test
  void testGetLogOutputStream() throws IOException {
    // Mock async multipart upload operations
    when(mockS3AsyncClient.createMultipartUpload(any(CreateMultipartUploadRequest.class)))
        .thenReturn(
            CompletableFuture.completedFuture(
                CreateMultipartUploadResponse.builder().uploadId("test-upload-id").build()));

    when(mockS3AsyncClient.uploadPart(any(UploadPartRequest.class), any(AsyncRequestBody.class)))
        .thenReturn(
            CompletableFuture.completedFuture(
                UploadPartResponse.builder().eTag("test-etag").build()));

    when(mockS3AsyncClient.completeMultipartUpload(any(CompleteMultipartUploadRequest.class)))
        .thenReturn(
            CompletableFuture.completedFuture(CompleteMultipartUploadResponse.builder().build()));

    // Test getting output stream
    OutputStream stream = s3LogStorage.getLogOutputStream(testPipelineFQN, testRunId);

    assertNotNull(stream);
    assertInstanceOf(OutputStream.class, stream);

    // Write some data
    stream.write("Test output".getBytes(StandardCharsets.UTF_8));
    stream.close();

    // Verify multipart upload was initiated and completed
    verify(mockS3AsyncClient).createMultipartUpload(any(CreateMultipartUploadRequest.class));
    verify(mockS3AsyncClient).completeMultipartUpload(any(CompleteMultipartUploadRequest.class));
  }

  @Test
  void testClose() throws IOException {
    // Mock async multipart upload operations
    when(mockS3AsyncClient.createMultipartUpload(any(CreateMultipartUploadRequest.class)))
        .thenReturn(
            CompletableFuture.completedFuture(
                CreateMultipartUploadResponse.builder().uploadId("test-upload-id").build()));

    when(mockS3AsyncClient.abortMultipartUpload(any(AbortMultipartUploadRequest.class)))
        .thenReturn(
            CompletableFuture.completedFuture(AbortMultipartUploadResponse.builder().build()));

    // Create and add a mock stream
    OutputStream stream = s3LogStorage.getLogOutputStream(testPipelineFQN, testRunId);

    // Test closing
    assertDoesNotThrow(() -> s3LogStorage.close());

    // Verify S3 clients were closed
    verify(mockS3Client).close();
    verify(mockS3AsyncClient).close();
  }

  @Test
  void testCloseStream() throws IOException {
    // Mock async multipart upload operations
    when(mockS3AsyncClient.createMultipartUpload(any(CreateMultipartUploadRequest.class)))
        .thenReturn(
            CompletableFuture.completedFuture(
                CreateMultipartUploadResponse.builder().uploadId("test-upload-id").build()));

    when(mockS3AsyncClient.putObject(any(PutObjectRequest.class), any(AsyncRequestBody.class)))
        .thenReturn(CompletableFuture.completedFuture(PutObjectResponse.builder().build()));

    when(mockS3AsyncClient.uploadPart(any(UploadPartRequest.class), any(AsyncRequestBody.class)))
        .thenReturn(
            CompletableFuture.completedFuture(
                UploadPartResponse.builder().eTag("test-etag").build()));

    when(mockS3AsyncClient.completeMultipartUpload(any(CompleteMultipartUploadRequest.class)))
        .thenReturn(
            CompletableFuture.completedFuture(CompleteMultipartUploadResponse.builder().build()));

    // Append some logs to create an active stream
    String logContent = "Test log content for closeStream";
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, logContent);

    // Test closing the specific stream
    assertDoesNotThrow(() -> s3LogStorage.closeStream(testPipelineFQN, testRunId));

    // Verify that the multipart upload was completed
    verify(mockS3AsyncClient).completeMultipartUpload(any(CompleteMultipartUploadRequest.class));
  }

  @Test
  void testGetLogInputStreamUsesRecentLogsForActiveStream() throws IOException {
    mockActiveStreamCreation();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "Line 1\nLine 2");

    InputStream stream = s3LogStorage.getLogInputStream(testPipelineFQN, testRunId);

    assertEquals("Line 1\nLine 2", new String(stream.readAllBytes(), StandardCharsets.UTF_8));
    verify(mockS3Client, never()).getObject(any(GetObjectRequest.class));
  }

  @Test
  void testGetLogsForActiveStreamUsesPartialFilePagination() throws IOException {
    mockActiveStreamCreation();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "memory line 1\nmemory line 2");
    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenReturn(createResponseInputStream("Processed 1\nProcessed 2\nProcessed 3\n"));

    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, "1", 1);

    assertEquals("Processed 2", result.get("logs"));
    assertEquals("2", result.get("after"));
    assertEquals(3L, result.get("total"));
    assertEquals(true, result.get("streaming"));
  }

  @Test
  void testGetLogsForActiveStreamFallsBackToMemoryCacheOnPartialMiss() throws IOException {
    mockActiveStreamCreation();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "Line 1\nLine 2\nLine 3");
    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenThrow(NoSuchKeyException.builder().build());

    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, "bad-cursor", 2);

    assertEquals("Line 1\nLine 2", result.get("logs"));
    assertEquals("2", result.get("after"));
    assertEquals(3L, result.get("total"));
    assertEquals(true, result.get("streaming"));
  }

  @Test
  void testRegisterLogListenerReplaysBufferedLogsAndStopsAfterUnregister() throws IOException {
    mockActiveStreamCreation();
    S3LogStorage.LogStreamListener listener = mock(S3LogStorage.LogStreamListener.class);

    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "old-1\nold-2");
    s3LogStorage.registerLogListener(testPipelineFQN, testRunId, listener);

    verify(listener).onLogLine("old-1");
    verify(listener).onLogLine("old-2");

    clearInvocations(listener);
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "new-1\nnew-2");
    verify(listener).onLogLine("new-1\nnew-2");

    clearInvocations(listener);
    s3LogStorage.unregisterLogListener(testPipelineFQN, testRunId, listener);
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "after-unregister");

    verifyNoInteractions(listener);
  }

  @Test
  void testDeleteAllLogsClearsRecentCacheAndDeletesPaginatedObjects() throws IOException {
    mockActiveStreamCreation();
    mockMultipartUploadCompletion();
    UUID secondRunId = UUID.randomUUID();
    String sanitizedPipeline = testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_");
    String keyPrefix = String.format("%s/%s/", testPrefix, sanitizedPipeline);

    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "first");
    s3LogStorage.appendLogs(testPipelineFQN, secondRunId, "second");

    when(mockS3Client.listObjectsV2(any(ListObjectsV2Request.class)))
        .thenReturn(
            ListObjectsV2Response.builder()
                .contents(S3Object.builder().key(keyPrefix + testRunId + "/logs.txt").build())
                .isTruncated(true)
                .nextContinuationToken("page-2")
                .build(),
            ListObjectsV2Response.builder()
                .contents(S3Object.builder().key(keyPrefix + secondRunId + "/logs.txt").build())
                .isTruncated(false)
                .build());
    when(mockS3Client.deleteObjects(any(DeleteObjectsRequest.class)))
        .thenReturn(DeleteObjectsResponse.builder().build());

    s3LogStorage.deleteAllLogs(testPipelineFQN);

    assertTrue(s3LogStorage.getRecentLogs(testPipelineFQN, testRunId, 10).isEmpty());
    assertTrue(s3LogStorage.getRecentLogs(testPipelineFQN, secondRunId, 10).isEmpty());
    verify(mockS3Client, times(2)).listObjectsV2(any(ListObjectsV2Request.class));
    verify(mockS3Client, times(2)).deleteObjects(any(DeleteObjectsRequest.class));
  }

  @Test
  void testAppendLogsTruncatesLongLinesAndCapsRecentLogBuffer() throws IOException {
    mockActiveStreamCreation();
    String oversizedLine = "x".repeat(10 * 1024 + 25);
    StringBuilder manyLines = new StringBuilder();
    for (int i = 0; i < 1005; i++) {
      manyLines.append("line").append(i).append('\n');
    }

    s3LogStorage.appendLogs(testPipelineFQN, testRunId, oversizedLine);
    List<String> initialLogs = s3LogStorage.getRecentLogs(testPipelineFQN, testRunId, 10);
    assertEquals(1, initialLogs.size());
    assertTrue(initialLogs.get(0).contains("[truncated 25 chars]"));

    s3LogStorage.appendLogs(testPipelineFQN, testRunId, manyLines.toString());
    List<String> recentLogs = s3LogStorage.getRecentLogs(testPipelineFQN, testRunId, 2000);

    assertEquals(1000, recentLogs.size());
    assertEquals("line5", recentLogs.get(0));
    assertEquals("line1004", recentLogs.get(recentLogs.size() - 1));
  }

  @Test
  void testGetLogsWithInvalidCursorFallsBackToBeginningForCompletedFile() throws IOException {
    String logContent = "Line 1\nLine 2\nLine 3\n";

    when(mockS3Client.headObject(any(HeadObjectRequest.class)))
        .thenReturn(HeadObjectResponse.builder().contentLength((long) logContent.length()).build());
    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenReturn(createResponseInputStream(logContent));

    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, "bad-cursor", 2);

    assertEquals("Line 1\nLine 2", result.get("logs"));
    assertEquals("2", result.get("after"));
    assertEquals((long) logContent.length(), result.get("total"));
  }

  @Test
  void testGetLogOutputStreamAbortWithoutDataAndRejectsFurtherWrites() throws IOException {
    when(mockS3AsyncClient.createMultipartUpload(any(CreateMultipartUploadRequest.class)))
        .thenReturn(
            CompletableFuture.completedFuture(
                CreateMultipartUploadResponse.builder().uploadId("test-upload-id").build()));
    when(mockS3AsyncClient.abortMultipartUpload(any(AbortMultipartUploadRequest.class)))
        .thenReturn(
            CompletableFuture.completedFuture(AbortMultipartUploadResponse.builder().build()));

    OutputStream outputStream = s3LogStorage.getLogOutputStream(testPipelineFQN, testRunId);
    outputStream.close();

    verify(mockS3AsyncClient).abortMultipartUpload(any(AbortMultipartUploadRequest.class));
    assertThrows(IOException.class, () -> outputStream.write(1));
  }

  @Test
  void testLogsExistWrapsUnexpectedHeadObjectErrors() {
    when(mockS3Client.headObject(any(HeadObjectRequest.class)))
        .thenThrow(new RuntimeException("boom"));

    IOException exception =
        assertThrows(IOException.class, () -> s3LogStorage.logsExist(testPipelineFQN, testRunId));

    assertTrue(exception.getMessage().contains("Failed to check if logs exist in S3"));
  }

  @Test
  void testInitializeFailsWhenBucketDoesNotExist() {
    try (MockedStatic<S3Client> s3ClientMock = mockStatic(S3Client.class);
        MockedStatic<S3AsyncClient> s3AsyncClientMock = mockStatic(S3AsyncClient.class)) {

      S3ClientBuilder mockBuilder = mock(S3ClientBuilder.class);
      when(S3Client.builder()).thenReturn(mockBuilder);
      when(mockBuilder.region(any())).thenReturn(mockBuilder);
      when(mockBuilder.credentialsProvider(any())).thenReturn(mockBuilder);
      when(mockBuilder.build()).thenReturn(mockS3Client);

      S3AsyncClientBuilder mockAsyncBuilder = mock(S3AsyncClientBuilder.class);
      when(S3AsyncClient.builder()).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.region(any())).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.credentialsProvider(any())).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.build()).thenReturn(mockS3AsyncClient);

      when(mockS3Client.headBucket(any(HeadBucketRequest.class)))
          .thenThrow(NoSuchBucketException.builder().build());

      S3LogStorage storage = new S3LogStorage();
      Map<String, Object> config = new HashMap<>();
      config.put("config", testConfig);

      IOException exception = assertThrows(IOException.class, () -> storage.initialize(config));
      assertTrue(exception.getMessage().contains("Failed to initialize S3LogStorage"));
      assertTrue(exception.getCause().getMessage().contains("S3 bucket does not exist"));
    }
  }

  @Test
  void testInitializeFailsWhenCredentialsAreMissing() {
    LogStorageConfiguration invalidConfig =
        new LogStorageConfiguration()
            .withType(LogStorageConfiguration.Type.S_3)
            .withBucketName(testBucket)
            .withAwsConfig(new AWSCredentials().withAwsRegion("us-east-1"))
            .withPrefix(testPrefix);

    try (MockedStatic<S3Client> s3ClientMock = mockStatic(S3Client.class);
        MockedStatic<S3AsyncClient> s3AsyncClientMock = mockStatic(S3AsyncClient.class)) {

      S3ClientBuilder mockBuilder = mock(S3ClientBuilder.class);
      when(S3Client.builder()).thenReturn(mockBuilder);
      when(mockBuilder.region(any())).thenReturn(mockBuilder);

      S3LogStorage storage = new S3LogStorage();
      Map<String, Object> config = new HashMap<>();
      config.put("config", invalidConfig);

      IOException exception = assertThrows(IOException.class, () -> storage.initialize(config));
      assertInstanceOf(IllegalArgumentException.class, exception.getCause());
      assertTrue(exception.getCause().getMessage().contains("AWS credentials not configured"));
    }
  }
}
