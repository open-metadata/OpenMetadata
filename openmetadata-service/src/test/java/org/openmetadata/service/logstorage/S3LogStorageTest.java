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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.google.common.util.concurrent.Striped;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.Lock;
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
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.http.AbortableInputStream;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.S3AsyncClientBuilder;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.CompleteMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CompleteMultipartUploadResponse;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.CopyPartResult;
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadResponse;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectResponse;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsResponse;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.S3Object;
import software.amazon.awssdk.services.s3.model.UploadPartCopyRequest;
import software.amazon.awssdk.services.s3.model.UploadPartCopyResponse;
import software.amazon.awssdk.services.s3.model.UploadPartRequest;
import software.amazon.awssdk.services.s3.model.UploadPartResponse;

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

    try (MockedStatic<S3Client> s3ClientMock = mockStatic(S3Client.class);
        MockedStatic<S3AsyncClient> s3AsyncClientMock = mockStatic(S3AsyncClient.class)) {

      S3ClientBuilder mockBuilder = mock(S3ClientBuilder.class);
      when(S3Client.builder()).thenReturn(mockBuilder);
      when(mockBuilder.region(any())).thenReturn(mockBuilder);
      when(mockBuilder.overrideConfiguration(any(ClientOverrideConfiguration.class)))
          .thenReturn(mockBuilder);
      when(mockBuilder.credentialsProvider(any())).thenReturn(mockBuilder);
      when(mockBuilder.build()).thenReturn(mockS3Client);

      S3AsyncClientBuilder mockAsyncBuilder = mock(S3AsyncClientBuilder.class);
      when(S3AsyncClient.builder()).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.region(any())).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.overrideConfiguration(any(ClientOverrideConfiguration.class)))
          .thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.credentialsProvider(any())).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.build()).thenReturn(mockS3AsyncClient);

      s3LogStorage = new S3LogStorage();
      Map<String, Object> config = new HashMap<>();
      config.put("config", testConfig);

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

  private void mockAsyncPutObject() {
    when(mockS3AsyncClient.putObject(any(PutObjectRequest.class), any(AsyncRequestBody.class)))
        .thenReturn(CompletableFuture.completedFuture(PutObjectResponse.builder().build()));
  }

  @Test
  void testS3LogStorageInitialization() {
    assertNotNull(s3LogStorage);
    assertEquals("s3", s3LogStorage.getStorageType());
  }

  @Test
  void testS3ClientsUseApiCallTimeouts() throws Exception {
    try (MockedStatic<S3Client> s3ClientMock = mockStatic(S3Client.class);
        MockedStatic<S3AsyncClient> s3AsyncClientMock = mockStatic(S3AsyncClient.class)) {

      S3ClientBuilder mockBuilder = mock(S3ClientBuilder.class);
      when(S3Client.builder()).thenReturn(mockBuilder);
      when(mockBuilder.region(any())).thenReturn(mockBuilder);
      when(mockBuilder.overrideConfiguration(any(ClientOverrideConfiguration.class)))
          .thenReturn(mockBuilder);
      when(mockBuilder.credentialsProvider(any())).thenReturn(mockBuilder);
      when(mockBuilder.build()).thenReturn(mockS3Client);

      S3AsyncClientBuilder mockAsyncBuilder = mock(S3AsyncClientBuilder.class);
      when(S3AsyncClient.builder()).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.region(any())).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.overrideConfiguration(any(ClientOverrideConfiguration.class)))
          .thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.credentialsProvider(any())).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.build()).thenReturn(mockS3AsyncClient);
      when(mockS3Client.headBucket(any(HeadBucketRequest.class)))
          .thenReturn(HeadBucketResponse.builder().build());

      S3LogStorage storage = new S3LogStorage();
      Map<String, Object> config = new HashMap<>();
      config.put("config", testConfig);
      storage.initialize(config);

      verify(mockBuilder).overrideConfiguration(any(ClientOverrideConfiguration.class));
      verify(mockAsyncBuilder).overrideConfiguration(any(ClientOverrideConfiguration.class));
      storage.close();
    }
  }

  @Test
  void testNoMultipartUploadStartedOnAppend() throws Exception {
    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "burst-1\nburst-2\n");

    verify(mockS3AsyncClient, never())
        .createMultipartUpload(any(CreateMultipartUploadRequest.class));
    verify(mockS3AsyncClient, never())
        .uploadPart(any(UploadPartRequest.class), any(AsyncRequestBody.class));
  }

  @Test
  void testCloseStreamFlushesAndCopiesPartialToLogs() throws Exception {
    String streamKey = testPipelineFQN + "/" + testRunId;
    String partialKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/partial.txt";
    String logsKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/logs.txt";

    mockAsyncPutObject();
    // GET on partial.txt returns nothing yet (first flush)
    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKey.equals(req.key()))))
        .thenThrow(NoSuchKeyException.builder().build());
    when(mockS3Client.putObject(
            any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
        .thenReturn(PutObjectResponse.builder().build());
    when(mockS3Client.copyObject(any(CopyObjectRequest.class)))
        .thenReturn(software.amazon.awssdk.services.s3.model.CopyObjectResponse.builder().build());
    when(mockS3Client.deleteObject(any(DeleteObjectRequest.class)))
        .thenReturn(DeleteObjectResponse.builder().build());

    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "final-line-1\nfinal-line-2\n");
    s3LogStorage.closeStream(testPipelineFQN, testRunId);

    // Final flush PUT to partial.txt
    verify(mockS3Client, atLeastOnce())
        .putObject(
            argThat((PutObjectRequest req) -> req != null && partialKey.equals(req.key())),
            any(software.amazon.awssdk.core.sync.RequestBody.class));

    // Server-side copy partial -> logs
    verify(mockS3Client, atLeastOnce())
        .copyObject(
            argThat(
                (CopyObjectRequest req) ->
                    req != null
                        && req.sourceKey().equals(partialKey)
                        && req.destinationKey().equals(logsKey)));

    // partial.txt deleted
    verify(mockS3Client, atLeastOnce())
        .deleteObject(
            argThat((DeleteObjectRequest req) -> req != null && partialKey.equals(req.key())));

    // In-memory state cleared
    @SuppressWarnings("unchecked")
    Map<String, ?> active = (Map<String, ?>) getPrivateField(s3LogStorage, "activeStreams");
    assertNull(active.get(streamKey));
  }

  @Test
  void testLateAppendAfterCloseIsDropped() throws Exception {
    String streamKey = testPipelineFQN + "/" + testRunId;
    String partialKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/partial.txt";

    mockAsyncPutObject();
    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKey.equals(req.key()))))
        .thenThrow(NoSuchKeyException.builder().build());
    when(mockS3Client.putObject(
            any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
        .thenReturn(PutObjectResponse.builder().build());
    when(mockS3Client.copyObject(any(CopyObjectRequest.class)))
        .thenReturn(software.amazon.awssdk.services.s3.model.CopyObjectResponse.builder().build());
    when(mockS3Client.deleteObject(any(DeleteObjectRequest.class)))
        .thenReturn(DeleteObjectResponse.builder().build());

    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "before-close\n");
    s3LogStorage.closeStream(testPipelineFQN, testRunId);

    clearInvocations(mockS3Client);
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "late-after-close\n");

    @SuppressWarnings("unchecked")
    Map<String, List<String>> pending =
        (Map<String, List<String>>) getPrivateField(s3LogStorage, "pendingFlush");
    assertFalse(
        pending.containsKey(streamKey),
        "late append after close must not recreate pendingFlush for the completed stream");
    verify(mockS3Client, never())
        .putObject(
            any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class));
  }

  @Test
  void testLatePartialDoesNotOverwriteExistingLogsTxt() throws Exception {
    String partialKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/partial.txt";
    String logsKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/logs.txt";

    mockAsyncPutObject();
    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKey.equals(req.key()))))
        .thenThrow(NoSuchKeyException.builder().build());
    when(mockS3Client.putObject(
            any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
        .thenReturn(PutObjectResponse.builder().build());
    when(mockS3Client.headObject(
            argThat((HeadObjectRequest req) -> req != null && logsKey.equals(req.key()))))
        .thenReturn(HeadObjectResponse.builder().build());
    when(mockS3Client.deleteObject(any(DeleteObjectRequest.class)))
        .thenReturn(DeleteObjectResponse.builder().build());

    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "late-tail\n");
    s3LogStorage.closeStream(testPipelineFQN, testRunId);

    verify(mockS3Client, never()).copyObject(any(CopyObjectRequest.class));
    verify(mockS3Client, atLeastOnce())
        .deleteObject(
            argThat((DeleteObjectRequest req) -> req != null && partialKey.equals(req.key())));
  }

  @Test
  void testLogsTxtHeadObjectGeneric404IsTreatedAsMissing() throws Exception {
    String partialKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/partial.txt";
    String logsKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/logs.txt";

    mockAsyncPutObject();
    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKey.equals(req.key()))))
        .thenThrow(NoSuchKeyException.builder().build());
    when(mockS3Client.putObject(
            any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
        .thenReturn(PutObjectResponse.builder().build());
    when(mockS3Client.headObject(
            argThat((HeadObjectRequest req) -> req != null && logsKey.equals(req.key()))))
        .thenThrow(S3Exception.builder().statusCode(404).message("Not Found").build());
    when(mockS3Client.copyObject(any(CopyObjectRequest.class)))
        .thenReturn(software.amazon.awssdk.services.s3.model.CopyObjectResponse.builder().build());
    when(mockS3Client.deleteObject(any(DeleteObjectRequest.class)))
        .thenReturn(DeleteObjectResponse.builder().build());

    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "tail\n");
    s3LogStorage.closeStream(testPipelineFQN, testRunId);

    verify(mockS3Client)
        .copyObject(
            argThat(
                (CopyObjectRequest req) -> req != null && logsKey.equals(req.destinationKey())));
  }

  @Test
  void testCloseStreamIsIdempotent() throws Exception {
    mockAsyncPutObject();
    // First close: flush writes partial.txt, then copy succeeds, then delete
    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenThrow(NoSuchKeyException.builder().build());
    when(mockS3Client.putObject(
            any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
        .thenReturn(PutObjectResponse.builder().build());
    when(mockS3Client.copyObject(any(CopyObjectRequest.class)))
        .thenReturn(software.amazon.awssdk.services.s3.model.CopyObjectResponse.builder().build());
    when(mockS3Client.deleteObject(any(DeleteObjectRequest.class)))
        .thenReturn(DeleteObjectResponse.builder().build());

    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "x\n");
    s3LogStorage.closeStream(testPipelineFQN, testRunId);

    // Second close: no pending lines -> writePartialLogsForStreamLocked is no-op,
    // then copyPartialToLogs throws NoSuchKeyException -> idempotent path returns.
    when(mockS3Client.copyObject(any(CopyObjectRequest.class)))
        .thenThrow(NoSuchKeyException.builder().build());

    assertDoesNotThrow(() -> s3LogStorage.closeStream(testPipelineFQN, testRunId));
  }

  @Test
  void testGetLogs() throws IOException {
    String logContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n";

    when(mockS3Client.headObject(any(HeadObjectRequest.class)))
        .thenReturn(HeadObjectResponse.builder().contentLength((long) logContent.length()).build());

    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenReturn(createResponseInputStream(logContent));

    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, null, 2);

    assertNotNull(result);
    assertEquals("Line 1\nLine 2", result.get("logs"));
    assertEquals("2", result.get("after"));
    assertEquals((long) logContent.length(), result.get("total"));
  }

  @Test
  void testGetLogsWithPagination() throws IOException {
    String logContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n";

    when(mockS3Client.headObject(any(HeadObjectRequest.class)))
        .thenReturn(HeadObjectResponse.builder().contentLength((long) logContent.length()).build());

    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenReturn(createResponseInputStream(logContent));

    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, "2", 2);

    assertNotNull(result);
    assertEquals("Line 3\nLine 4", result.get("logs"));
    assertEquals("4", result.get("after"));
  }

  @Test
  void testGetLogsNonExistent() throws IOException {
    when(mockS3Client.headObject(any(HeadObjectRequest.class)))
        .thenThrow(NoSuchKeyException.builder().build());
    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenThrow(NoSuchKeyException.builder().build());

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

    ListObjectsV2Response response =
        ListObjectsV2Response.builder()
            .contents(
                S3Object.builder().key(keyPrefix + runId1 + "/logs.txt").build(),
                S3Object.builder().key(keyPrefix + runId2 + "/logs.txt").build())
            .isTruncated(false)
            .build();

    when(mockS3Client.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(response);

    List<UUID> runs = s3LogStorage.listRuns(testPipelineFQN, 10);

    assertNotNull(runs);
    assertEquals(2, runs.size());
    assertTrue(runs.contains(runId1));
    assertTrue(runs.contains(runId2));
  }

  @Test
  void testDeleteLogs() {
    when(mockS3Client.deleteObject(any(DeleteObjectRequest.class)))
        .thenReturn(DeleteObjectResponse.builder().build());

    assertDoesNotThrow(() -> s3LogStorage.deleteLogs(testPipelineFQN, testRunId));

    // Verify both the log object and the partial file are deleted.
    verify(mockS3Client, times(2)).deleteObject(any(DeleteObjectRequest.class));
  }

  @Test
  void testLogsExist() throws IOException {
    when(mockS3Client.headObject(any(HeadObjectRequest.class)))
        .thenReturn(HeadObjectResponse.builder().build());

    assertTrue(s3LogStorage.logsExist(testPipelineFQN, testRunId));

    when(mockS3Client.headObject(any(HeadObjectRequest.class)))
        .thenThrow(NoSuchKeyException.builder().build());

    assertFalse(s3LogStorage.logsExist(testPipelineFQN, testRunId));
  }

  @Test
  void testGetLogInputStream() throws IOException {
    String logContent = "Stream content";

    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenReturn(createResponseInputStream(logContent));

    InputStream stream = s3LogStorage.getLogInputStream(testPipelineFQN, testRunId);

    assertNotNull(stream);
    assertEquals(logContent, new String(stream.readAllBytes(), StandardCharsets.UTF_8));
  }

  @Test
  void testClose() {
    assertDoesNotThrow(() -> s3LogStorage.close());

    verify(mockS3Client).close();
    verify(mockS3AsyncClient).close();
  }

  @Test
  void testGetLogInputStreamUsesRecentLogsForActiveStream() throws IOException {
    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "Line 1\nLine 2");

    InputStream stream = s3LogStorage.getLogInputStream(testPipelineFQN, testRunId);

    assertEquals("Line 1\nLine 2", new String(stream.readAllBytes(), StandardCharsets.UTF_8));
    verify(mockS3Client, never()).getObject(any(GetObjectRequest.class));
  }

  @Test
  void testGetLogsForActiveStreamUsesPartialFilePagination() throws IOException {
    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "memory line 1\nmemory line 2");
    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenReturn(createResponseInputStream("Processed 1\nProcessed 2\nProcessed 3\n"));

    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, "1", 1);

    assertEquals("Processed 2", result.get("logs"));
    assertEquals("2", result.get("after"));
    // Now includes pending lines (2 from memory): 3 from S3 partial + 2 pending = 5 total
    assertEquals(5L, result.get("total"));
    assertEquals(true, result.get("streaming"));
  }

  @Test
  void testGetLogsForActiveStreamFallsBackToMemoryCacheOnPartialMiss() throws IOException {
    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "Line 1\nLine 2\nLine 3");
    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenThrow(NoSuchKeyException.builder().build());

    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, "bad-cursor", 2);

    assertEquals("Line 1\nLine 2", result.get("logs"));
    assertEquals("2", result.get("after"));
    // No partial.txt yet: pendingFlush is the canonical source (3 lines, no duplicates).
    assertEquals(3L, result.get("total"));
    assertEquals(true, result.get("streaming"));

    String body = (String) result.get("logs");
    assertEquals(1, countOccurrences(body, "Line 1"));
    assertEquals(1, countOccurrences(body, "Line 2"));
  }

  @Test
  void testRegisterLogListenerReplaysBufferedLogsAndStopsAfterUnregister() throws IOException {
    mockAsyncPutObject();
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
    mockAsyncPutObject();
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
    mockAsyncPutObject();
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
      when(mockBuilder.overrideConfiguration(any(ClientOverrideConfiguration.class)))
          .thenReturn(mockBuilder);
      when(mockBuilder.credentialsProvider(any())).thenReturn(mockBuilder);
      when(mockBuilder.build()).thenReturn(mockS3Client);

      S3AsyncClientBuilder mockAsyncBuilder = mock(S3AsyncClientBuilder.class);
      when(S3AsyncClient.builder()).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.region(any())).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.overrideConfiguration(any(ClientOverrideConfiguration.class)))
          .thenReturn(mockAsyncBuilder);
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
      when(mockBuilder.overrideConfiguration(any(ClientOverrideConfiguration.class)))
          .thenReturn(mockBuilder);

      S3LogStorage storage = new S3LogStorage();
      Map<String, Object> config = new HashMap<>();
      config.put("config", invalidConfig);

      IOException exception = assertThrows(IOException.class, () -> storage.initialize(config));
      assertInstanceOf(IllegalArgumentException.class, exception.getCause());
      assertTrue(exception.getCause().getMessage().contains("AWS credentials not configured"));
    }
  }

  @Test
  void testInitializeReadsStreamTimeoutDefault() throws Exception {
    S3LogStorage storage = createInitializedS3LogStorage();
    assertEquals(1440, getPrivateField(storage, "streamTimeoutMinutes"));
  }

  private S3LogStorage createInitializedS3LogStorage() throws IOException {
    try (MockedStatic<S3Client> s3ClientMock = mockStatic(S3Client.class);
        MockedStatic<S3AsyncClient> s3AsyncClientMock = mockStatic(S3AsyncClient.class)) {

      S3ClientBuilder mockBuilder = mock(S3ClientBuilder.class);
      when(S3Client.builder()).thenReturn(mockBuilder);
      when(mockBuilder.region(any())).thenReturn(mockBuilder);
      when(mockBuilder.overrideConfiguration(any(ClientOverrideConfiguration.class)))
          .thenReturn(mockBuilder);
      when(mockBuilder.credentialsProvider(any())).thenReturn(mockBuilder);
      when(mockBuilder.build()).thenReturn(mockS3Client);

      S3AsyncClientBuilder mockAsyncBuilder = mock(S3AsyncClientBuilder.class);
      when(S3AsyncClient.builder()).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.region(any())).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.overrideConfiguration(any(ClientOverrideConfiguration.class)))
          .thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.credentialsProvider(any())).thenReturn(mockAsyncBuilder);
      when(mockAsyncBuilder.build()).thenReturn(mockS3AsyncClient);

      when(mockS3Client.headBucket(any(HeadBucketRequest.class)))
          .thenReturn(HeadBucketResponse.builder().build());

      S3LogStorage storage = new S3LogStorage();
      Map<String, Object> config = new HashMap<>();
      config.put("config", testConfig);

      storage.initialize(config);
      return storage;
    }
  }

  @Test
  void testAppendLogsReleasesPerStreamLock() throws Exception {
    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "line 1");
    @SuppressWarnings("unchecked")
    Striped<Lock> locks = (Striped<Lock>) getPrivateField(s3LogStorage, "streamLocks");
    Lock lock = locks.get(testPipelineFQN + "/" + testRunId);
    assertTrue(lock.tryLock(), "lock should be released after appendLogs returns");
    lock.unlock();
  }

  @Test
  void testAppendLogsPopulatesPendingFlushAndCounter() throws Exception {
    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "line 1\nline 2\nline 3");
    String streamKey = testPipelineFQN + "/" + testRunId;

    @SuppressWarnings("unchecked")
    Map<String, List<String>> pending =
        (Map<String, List<String>>) getPrivateField(s3LogStorage, "pendingFlush");
    @SuppressWarnings("unchecked")
    Map<String, AtomicLong> counters =
        (Map<String, AtomicLong>) getPrivateField(s3LogStorage, "totalLinesAppended");

    assertNotNull(pending.get(streamKey));
    assertEquals(3, pending.get(streamKey).size());
    assertEquals(3L, counters.get(streamKey).get());
  }

  @Test
  void testAppendLogsTrailingNewlineDoesNotOvercount() throws Exception {
    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "line A\nline B\n");
    String streamKey = testPipelineFQN + "/" + testRunId;

    @SuppressWarnings("unchecked")
    Map<String, List<String>> pending =
        (Map<String, List<String>>) getPrivateField(s3LogStorage, "pendingFlush");
    @SuppressWarnings("unchecked")
    Map<String, AtomicLong> counters =
        (Map<String, AtomicLong>) getPrivateField(s3LogStorage, "totalLinesAppended");

    // "line A\nline B\n" -> split -> ["line A", "line B", ""] -> trim -> 2 lines
    assertEquals(2, pending.get(streamKey).size(), "trailing newline must not yield an empty line");
    assertEquals(2L, counters.get(streamKey).get());
  }

  @Test
  void testFlushMergesExistingPartialAfterOffsetReset() throws Exception {
    String streamKey = testPipelineFQN + "/" + testRunId;
    String partialKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/partial.txt";

    String existingBody = "old-line-1\nold-line-2\nold-line-3\n";
    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKey.equals(req.key()))))
        .thenReturn(
            new ResponseInputStream<>(
                GetObjectResponse.builder().build(),
                AbortableInputStream.create(
                    new ByteArrayInputStream(existingBody.getBytes(StandardCharsets.UTF_8)))));

    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "new-line-1\nnew-line-2\n");

    java.lang.reflect.Method m =
        S3LogStorage.class.getDeclaredMethod("writePartialLogsForStream", String.class);
    m.setAccessible(true);
    m.invoke(s3LogStorage, streamKey);

    org.mockito.ArgumentCaptor<PutObjectRequest> reqCaptor =
        org.mockito.ArgumentCaptor.forClass(PutObjectRequest.class);
    org.mockito.ArgumentCaptor<software.amazon.awssdk.core.sync.RequestBody> bodyCaptor =
        org.mockito.ArgumentCaptor.forClass(software.amazon.awssdk.core.sync.RequestBody.class);
    verify(mockS3Client, atLeastOnce()).putObject(reqCaptor.capture(), bodyCaptor.capture());

    boolean foundMerged = false;
    for (int i = 0; i < reqCaptor.getAllValues().size(); i++) {
      PutObjectRequest req = reqCaptor.getAllValues().get(i);
      if (partialKey.equals(req.key())) {
        String body =
            new String(
                bodyCaptor.getAllValues().get(i).contentStreamProvider().newStream().readAllBytes(),
                StandardCharsets.UTF_8);
        assertTrue(body.contains("old-line-1"), "merged body must contain prior content");
        assertTrue(body.contains("new-line-1"), "merged body must contain new content");
        assertNotNull(req.metadata().get("last-flushed-line"));
        assertNotNull(req.metadata().get("total-bytes"));
        assertNotNull(req.metadata().get("writer-epoch"));
        foundMerged = true;
        break;
      }
    }
    assertTrue(foundMerged, "expected at least one PUT to partial.txt with merged body");
  }

  @Test
  void testFlushUsesMultipartCopyWhenExistingPartialIsLarge() throws Exception {
    String streamKey = testPipelineFQN + "/" + testRunId;
    String partialKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/partial.txt";

    long largeSize = 6L * 1024 * 1024;
    GetObjectResponse getResponse =
        GetObjectResponse.builder()
            .contentLength(largeSize)
            .metadata(java.util.Map.of("last-flushed-line", "100"))
            .build();
    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKey.equals(req.key()))))
        .thenReturn(
            new ResponseInputStream<>(
                getResponse, AbortableInputStream.create(new ByteArrayInputStream(new byte[0]))));

    when(mockS3Client.createMultipartUpload(any(CreateMultipartUploadRequest.class)))
        .thenReturn(CreateMultipartUploadResponse.builder().uploadId("upload-id-123").build());
    when(mockS3Client.uploadPartCopy(any(UploadPartCopyRequest.class)))
        .thenReturn(
            UploadPartCopyResponse.builder()
                .copyPartResult(CopyPartResult.builder().eTag("etag-1").build())
                .build());
    when(mockS3Client.uploadPart(
            any(UploadPartRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
        .thenReturn(UploadPartResponse.builder().eTag("etag-2").build());
    when(mockS3Client.completeMultipartUpload(any(CompleteMultipartUploadRequest.class)))
        .thenReturn(CompleteMultipartUploadResponse.builder().build());

    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "new-line-1\nnew-line-2\n");

    java.lang.reflect.Method m =
        S3LogStorage.class.getDeclaredMethod("writePartialLogsForStream", String.class);
    m.setAccessible(true);
    m.invoke(s3LogStorage, streamKey);

    org.mockito.ArgumentCaptor<CreateMultipartUploadRequest> createCaptor =
        org.mockito.ArgumentCaptor.forClass(CreateMultipartUploadRequest.class);
    verify(mockS3Client).createMultipartUpload(createCaptor.capture());
    assertEquals(partialKey, createCaptor.getValue().key());
    assertEquals("102", createCaptor.getValue().metadata().get("last-flushed-line"));

    org.mockito.ArgumentCaptor<UploadPartCopyRequest> copyCaptor =
        org.mockito.ArgumentCaptor.forClass(UploadPartCopyRequest.class);
    verify(mockS3Client).uploadPartCopy(copyCaptor.capture());
    assertEquals("upload-id-123", copyCaptor.getValue().uploadId());
    assertEquals(1, copyCaptor.getValue().partNumber());
    assertEquals("bytes=0-" + (largeSize - 1), copyCaptor.getValue().copySourceRange());

    org.mockito.ArgumentCaptor<UploadPartRequest> partCaptor =
        org.mockito.ArgumentCaptor.forClass(UploadPartRequest.class);
    verify(mockS3Client)
        .uploadPart(partCaptor.capture(), any(software.amazon.awssdk.core.sync.RequestBody.class));
    assertEquals(2, partCaptor.getValue().partNumber());

    verify(mockS3Client).completeMultipartUpload(any(CompleteMultipartUploadRequest.class));
    verify(mockS3Client, never())
        .putObject(
            argThat((PutObjectRequest req) -> req != null && partialKey.equals(req.key())),
            any(software.amazon.awssdk.core.sync.RequestBody.class));
  }

  @Test
  void testFlushAbortsMultipartUploadOnFailure() throws Exception {
    String streamKey = testPipelineFQN + "/" + testRunId;
    String partialKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/partial.txt";

    long largeSize = 6L * 1024 * 1024;
    GetObjectResponse getResponse =
        GetObjectResponse.builder()
            .contentLength(largeSize)
            .metadata(java.util.Map.of("last-flushed-line", "0"))
            .build();
    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKey.equals(req.key()))))
        .thenReturn(
            new ResponseInputStream<>(
                getResponse, AbortableInputStream.create(new ByteArrayInputStream(new byte[0]))));

    when(mockS3Client.createMultipartUpload(any(CreateMultipartUploadRequest.class)))
        .thenReturn(CreateMultipartUploadResponse.builder().uploadId("upload-id-456").build());
    when(mockS3Client.uploadPartCopy(any(UploadPartCopyRequest.class)))
        .thenThrow(new RuntimeException("simulated copy failure"));

    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "line\n");

    java.lang.reflect.Method m =
        S3LogStorage.class.getDeclaredMethod("writePartialLogsForStream", String.class);
    m.setAccessible(true);
    m.invoke(s3LogStorage, streamKey);

    verify(mockS3Client)
        .abortMultipartUpload(
            argThat(
                (software.amazon.awssdk.services.s3.model.AbortMultipartUploadRequest req) ->
                    req != null && "upload-id-456".equals(req.uploadId())));
  }

  @Test
  void testRestartResumeReadsLastFlushedLineFromMetadata() throws Exception {
    String partialKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/partial.txt";
    String existingBody = "L1\nL2\nL3\nL4\nL5\n";

    GetObjectResponse getResponse =
        GetObjectResponse.builder()
            .metadata(
                java.util.Map.of(
                    "last-flushed-line", "5",
                    "total-bytes",
                        Integer.toString(existingBody.getBytes(StandardCharsets.UTF_8).length),
                    "writer-epoch", "1",
                    "writer-version", "streamable-logs-v2"))
            .build();
    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKey.equals(req.key()))))
        .thenReturn(
            new ResponseInputStream<>(
                getResponse,
                AbortableInputStream.create(
                    new ByteArrayInputStream(existingBody.getBytes(StandardCharsets.UTF_8)))));

    when(mockS3Client.putObject(
            any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
        .thenReturn(PutObjectResponse.builder().build());
    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "L6\nL7\n");

    java.lang.reflect.Method m =
        S3LogStorage.class.getDeclaredMethod("writePartialLogsForStream", String.class);
    m.setAccessible(true);
    m.invoke(s3LogStorage, testPipelineFQN + "/" + testRunId);

    org.mockito.ArgumentCaptor<software.amazon.awssdk.core.sync.RequestBody> bodyCaptor =
        org.mockito.ArgumentCaptor.forClass(software.amazon.awssdk.core.sync.RequestBody.class);
    verify(mockS3Client, atLeastOnce())
        .putObject(any(PutObjectRequest.class), bodyCaptor.capture());
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

  @Test
  void testFlushUsesMetadataLastFlushedLineToBumpCounter() throws Exception {
    String partialKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/partial.txt";

    String existingBody = "L1\nL2\nL3\nL4\nL5\n";
    GetObjectResponse getResponse =
        GetObjectResponse.builder().metadata(Map.of("last-flushed-line", "5")).build();
    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKey.equals(req.key()))))
        .thenReturn(
            new ResponseInputStream<>(
                getResponse,
                AbortableInputStream.create(
                    new ByteArrayInputStream(existingBody.getBytes(StandardCharsets.UTF_8)))));

    when(mockS3Client.putObject(
            any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
        .thenReturn(PutObjectResponse.builder().build());

    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "L6\nL7\n");

    java.lang.reflect.Method m =
        S3LogStorage.class.getDeclaredMethod("writePartialLogsForStream", String.class);
    m.setAccessible(true);
    m.invoke(s3LogStorage, testPipelineFQN + "/" + testRunId);

    org.mockito.ArgumentCaptor<PutObjectRequest> reqCaptor =
        org.mockito.ArgumentCaptor.forClass(PutObjectRequest.class);
    verify(mockS3Client, atLeastOnce())
        .putObject(reqCaptor.capture(), any(software.amazon.awssdk.core.sync.RequestBody.class));
    boolean foundCorrectMetadata = false;
    for (PutObjectRequest req : reqCaptor.getAllValues()) {
      if (partialKey.equals(req.key())) {
        String lastFlushed = req.metadata().get("last-flushed-line");
        if ("7".equals(lastFlushed)) {
          foundCorrectMetadata = true;
          break;
        }
      }
    }
    assertTrue(
        foundCorrectMetadata,
        "post-restart flush must set last-flushed-line to 7 (5 pre-restart + 2 new)");
  }

  @Test
  void testCleanupAbandonedStreamsCopiesPartialToLogsAndDrops() throws Exception {
    String streamKey = testPipelineFQN + "/" + testRunId;
    String partialKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/partial.txt";
    String logsKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/logs.txt";

    mockAsyncPutObject();
    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKey.equals(req.key()))))
        .thenThrow(NoSuchKeyException.builder().build());
    when(mockS3Client.putObject(
            any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
        .thenReturn(PutObjectResponse.builder().build());
    when(mockS3Client.copyObject(any(CopyObjectRequest.class)))
        .thenReturn(software.amazon.awssdk.services.s3.model.CopyObjectResponse.builder().build());
    when(mockS3Client.deleteObject(any(DeleteObjectRequest.class)))
        .thenReturn(DeleteObjectResponse.builder().build());

    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "abandoned\n");

    @SuppressWarnings("unchecked")
    Map<String, ?> active = (Map<String, ?>) getPrivateField(s3LogStorage, "activeStreams");
    Object ctx = active.get(streamKey);
    java.lang.reflect.Field f = ctx.getClass().getDeclaredField("lastAccessTime");
    f.setAccessible(true);
    f.setLong(ctx, System.currentTimeMillis() - (25L * 60 * 60 * 1000));

    java.lang.reflect.Method m = S3LogStorage.class.getDeclaredMethod("cleanupAbandonedStreams");
    m.setAccessible(true);
    m.invoke(s3LogStorage);

    verify(mockS3Client, atLeastOnce())
        .copyObject(
            argThat(
                (CopyObjectRequest req) ->
                    req != null
                        && partialKey.equals(req.sourceKey())
                        && logsKey.equals(req.destinationKey())));

    verify(mockS3Client, atLeastOnce())
        .deleteObject(
            argThat((DeleteObjectRequest req) -> req != null && partialKey.equals(req.key())));

    assertNull(active.get(streamKey));
  }

  @Test
  void testGetLogsMidRunIncludesPendingFlushTail() throws Exception {
    String partialKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/partial.txt";

    GetObjectResponse getResponse = GetObjectResponse.builder().build();
    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKey.equals(req.key()))))
        .thenReturn(
            new ResponseInputStream<>(
                getResponse,
                AbortableInputStream.create(
                    new ByteArrayInputStream(
                        "flushed-1\nflushed-2\n".getBytes(StandardCharsets.UTF_8)))));

    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "tail-1\ntail-2\n");

    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, null, 100);
    String body = (String) result.get("logs");
    assertTrue(body.contains("flushed-1"), "should include flushed lines");
    assertTrue(body.contains("tail-1"), "should include in-memory tail line 1");
    assertTrue(body.contains("tail-2"), "should include in-memory tail line 2");
    assertEquals(4L, result.get("total"));
  }

  @Test
  void testCloseStreamThrowsIfFinalFlushPutFails() throws Exception {
    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "to-flush\n");
    // Force the next PUT (the final flush) to fail.
    when(mockS3Client.putObject(
            any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
        .thenThrow(
            software.amazon.awssdk.services.s3.model.S3Exception.builder()
                .message("simulated PUT failure")
                .build());
    // GET for the partial.txt returns nothing (no prior file).
    when(mockS3Client.getObject(any(GetObjectRequest.class)))
        .thenThrow(NoSuchKeyException.builder().build());
    assertThrows(IOException.class, () -> s3LogStorage.closeStream(testPipelineFQN, testRunId));
    // pendingFlush should still have the line for retry (restored by restorePendingFlush).
    @SuppressWarnings("unchecked")
    Map<String, java.util.List<String>> pending =
        (Map<String, java.util.List<String>>) getPrivateField(s3LogStorage, "pendingFlush");
    assertEquals(1, pending.get(testPipelineFQN + "/" + testRunId).size());
  }

  @Test
  void testPartialFlushAndAbandonedCleanupExecutorsAreSeparate() throws Exception {
    Object partial = getPrivateField(s3LogStorage, "partialFlushExecutor");
    Object cleanup = getPrivateField(s3LogStorage, "abandonedCleanupExecutor");
    assertNotNull(partial);
    assertNotNull(cleanup);
    assertFalse(partial == cleanup, "executors must be distinct");
  }

  @Test
  void testSafeScheduledTaskSwallowsThrowableSoSchedulerKeepsRunning() throws Exception {
    java.lang.reflect.Method safe =
        S3LogStorage.class.getDeclaredMethod("safeScheduledTask", String.class, Runnable.class);
    safe.setAccessible(true);

    final boolean[] ran = {false};
    Runnable thrower =
        () -> {
          ran[0] = true;
          throw new RuntimeException("boom");
        };

    Runnable wrapped = (Runnable) safe.invoke(s3LogStorage, "test-task", thrower);

    assertDoesNotThrow(wrapped::run);
    assertTrue(ran[0]);
    assertDoesNotThrow(wrapped::run);
  }

  @Test
  void testWritePartialLogsContinuesEvenIfOneStreamFails() throws Exception {
    String runIdA = UUID.randomUUID().toString();
    String runIdB = UUID.randomUUID().toString();
    String streamA = testPipelineFQN + "/" + runIdA;
    String streamB = testPipelineFQN + "/" + runIdB;

    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, UUID.fromString(runIdA), "from-A\n");
    s3LogStorage.appendLogs(testPipelineFQN, UUID.fromString(runIdB), "from-B\n");

    String partialKeyA =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + runIdA
            + "/partial.txt";
    String partialKeyB =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + runIdB
            + "/partial.txt";

    // Stream A: probe throws - its flush will be marked failed.
    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKeyA.equals(req.key()))))
        .thenThrow(new RuntimeException("simulated S3 failure for stream A"));
    // Stream B: probe returns no existing partial.txt, succeeds.
    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKeyB.equals(req.key()))))
        .thenThrow(NoSuchKeyException.builder().build());
    when(mockS3Client.putObject(
            any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
        .thenReturn(PutObjectResponse.builder().build());

    // Direct call to the scheduled body - verifies the loop's per-stream
    // exception handling, NOT the executor.
    java.lang.reflect.Method writePartial =
        S3LogStorage.class.getDeclaredMethod("writePartialLogs");
    writePartial.setAccessible(true);
    assertDoesNotThrow(() -> writePartial.invoke(s3LogStorage));

    // Stream B's PUT must have happened despite A's failure.
    org.mockito.ArgumentCaptor<PutObjectRequest> reqCap =
        org.mockito.ArgumentCaptor.forClass(PutObjectRequest.class);
    verify(mockS3Client, atLeastOnce())
        .putObject(reqCap.capture(), any(software.amazon.awssdk.core.sync.RequestBody.class));
    boolean sawBPut = reqCap.getAllValues().stream().anyMatch(r -> partialKeyB.equals(r.key()));
    assertTrue(sawBPut, "stream B must have been flushed even though stream A failed");
  }

  @Test
  void testWritePartialLogsUpdatesPendingMetricsAndHeartbeat() throws Exception {
    io.micrometer.core.instrument.simple.SimpleMeterRegistry registry =
        new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
    org.openmetadata.service.monitoring.StreamableLogsMetrics testMetrics =
        new org.openmetadata.service.monitoring.StreamableLogsMetrics(registry);

    Field metricsField = S3LogStorage.class.getDeclaredField("metrics");
    metricsField.setAccessible(true);
    metricsField.set(s3LogStorage, testMetrics);

    long beforeHeartbeat = testMetrics.getPartialFlushHeartbeat();
    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "alpha\nbeta\ngamma\n");

    java.lang.reflect.Method writePartial =
        S3LogStorage.class.getDeclaredMethod("writePartialLogs");
    writePartial.setAccessible(true);
    writePartial.invoke(s3LogStorage);

    assertTrue(testMetrics.getPartialFlushHeartbeat() > beforeHeartbeat);
    assertEquals(1, testMetrics.getPendingStreamsCount());
  }

  @Test
  void testFlushSuccessUpdatesLastPartialFlushTimestamp() throws Exception {
    io.micrometer.core.instrument.simple.SimpleMeterRegistry registry =
        new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
    org.openmetadata.service.monitoring.StreamableLogsMetrics testMetrics =
        new org.openmetadata.service.monitoring.StreamableLogsMetrics(registry);
    Field metricsField = S3LogStorage.class.getDeclaredField("metrics");
    metricsField.setAccessible(true);
    metricsField.set(s3LogStorage, testMetrics);

    String streamKey = testPipelineFQN + "/" + testRunId;
    String partialKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/partial.txt";

    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKey.equals(req.key()))))
        .thenThrow(NoSuchKeyException.builder().build());
    when(mockS3Client.putObject(
            any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
        .thenReturn(PutObjectResponse.builder().build());
    mockAsyncPutObject();

    assertEquals(0L, testMetrics.getLastPartialFlushTimestamp());

    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "x\ny\n");
    java.lang.reflect.Method writeStream =
        S3LogStorage.class.getDeclaredMethod("writePartialLogsForStream", String.class);
    writeStream.setAccessible(true);
    writeStream.invoke(s3LogStorage, streamKey);

    assertTrue(testMetrics.getLastPartialFlushTimestamp() > 0L);
  }

  @Test
  void testFlushFailureIncrementsFailureCounter() throws Exception {
    io.micrometer.core.instrument.simple.SimpleMeterRegistry registry =
        new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
    org.openmetadata.service.monitoring.StreamableLogsMetrics testMetrics =
        new org.openmetadata.service.monitoring.StreamableLogsMetrics(registry);
    Field metricsField = S3LogStorage.class.getDeclaredField("metrics");
    metricsField.setAccessible(true);
    metricsField.set(s3LogStorage, testMetrics);

    String partialKey =
        testPrefix
            + "/"
            + testPipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_")
            + "/"
            + testRunId
            + "/partial.txt";

    when(mockS3Client.getObject(
            argThat((GetObjectRequest req) -> req != null && partialKey.equals(req.key()))))
        .thenThrow(new RuntimeException("simulated S3 outage"));

    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "z\n");

    java.lang.reflect.Method writeStream =
        S3LogStorage.class.getDeclaredMethod("writePartialLogsForStream", String.class);
    writeStream.setAccessible(true);
    writeStream.invoke(s3LogStorage, testPipelineFQN + "/" + testRunId);

    assertTrue(testMetrics.getFlushFailuresCount() >= 1);
  }

  @Test
  void testWatermarkFlushSchedulesOnlyOnceWhileFlushAlreadyQueued() throws Exception {
    ScheduledExecutorService executor = mock(ScheduledExecutorService.class);
    Field executorField = S3LogStorage.class.getDeclaredField("partialFlushExecutor");
    executorField.setAccessible(true);
    executorField.set(s3LogStorage, executor);

    Field watermarkField = S3LogStorage.class.getDeclaredField("earlyFlushWatermarkBytes");
    watermarkField.setAccessible(true);
    watermarkField.setLong(s3LogStorage, 1L);

    mockAsyncPutObject();
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "first\n");
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "second\n");
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "third\n");

    verify(executor, times(1)).execute(any(Runnable.class));
  }

  @Test
  void testCleanupHeartbeatUpdates() throws Exception {
    io.micrometer.core.instrument.simple.SimpleMeterRegistry registry =
        new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
    org.openmetadata.service.monitoring.StreamableLogsMetrics testMetrics =
        new org.openmetadata.service.monitoring.StreamableLogsMetrics(registry);
    Field metricsField = S3LogStorage.class.getDeclaredField("metrics");
    metricsField.setAccessible(true);
    metricsField.set(s3LogStorage, testMetrics);

    long before = testMetrics.getAbandonedCleanupHeartbeat();
    s3LogStorage.cleanupAbandonedStreams();
    assertTrue(testMetrics.getAbandonedCleanupHeartbeat() > before);
  }

  private static Object getPrivateField(Object target, String name) throws Exception {
    Field f = target.getClass().getDeclaredField(name);
    f.setAccessible(true);
    return f.get(target);
  }

  private static int countOccurrences(String haystack, String needle) {
    if (haystack == null || needle == null || needle.isEmpty()) {
      return 0;
    }
    int count = 0;
    int index = 0;
    while ((index = haystack.indexOf(needle, index)) != -1) {
      count++;
      index += needle.length();
    }
    return count;
  }
}
