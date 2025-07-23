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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.*;

@ExtendWith(MockitoExtension.class)
public class S3LogStorageTest {

  @Mock private S3Client mockS3Client;

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
            .withRegion("us-east-1")
            .withPrefix(testPrefix)
            .withEnableServerSideEncryption(true)
            .withStorageClass(LogStorageConfiguration.StorageClass.STANDARD_IA)
            .withExpirationDays(30);

    // Mock S3Client builder
    try (MockedStatic<S3Client> s3ClientMock = mockStatic(S3Client.class)) {
      S3ClientBuilder mockBuilder = mock(S3ClientBuilder.class);
      when(S3Client.builder()).thenReturn(mockBuilder);
      when(mockBuilder.region(any())).thenReturn(mockBuilder);
      when(mockBuilder.credentialsProvider(any())).thenReturn(mockBuilder);
      when(mockBuilder.build()).thenReturn(mockS3Client);

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

  @Test
  void testS3LogStorageInitialization() {
    assertNotNull(s3LogStorage);
    assertEquals("s3", s3LogStorage.getStorageType());
  }

  @Test
  void testAppendLogs() throws IOException {
    String existingContent = "Existing log content\n";
    String newContent = "New log content\n";
    String expectedKey = String.format("%s/%s/%s/logs.txt", testPrefix, testPipelineFQN, testRunId);

    // Mock getting existing content
    when(mockS3Client.getObjectAsBytes(any(GetObjectRequest.class)))
        .thenReturn(
            ResponseBytes.fromByteArray(
                GetObjectResponse.builder().build(),
                existingContent.getBytes(StandardCharsets.UTF_8)));

    // Mock putting updated content
    when(mockS3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
        .thenReturn(PutObjectResponse.builder().build());

    // Test appending logs
    assertDoesNotThrow(() -> s3LogStorage.appendLogs(testPipelineFQN, testRunId, newContent));

    // Verify S3 operations
    verify(mockS3Client)
        .getObjectAsBytes(
            argThat(
                (GetObjectRequest request) ->
                    request.bucket().equals(testBucket) && request.key().equals(expectedKey)));
    verify(mockS3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));
  }

  @Test
  void testAppendLogsToNewFile() throws IOException {
    String newContent = "First log content\n";
    String expectedKey = String.format("%s/%s/%s/logs.txt", testPrefix, testPipelineFQN, testRunId);

    // Mock getting non-existent content
    when(mockS3Client.getObjectAsBytes(any(GetObjectRequest.class)))
        .thenThrow(NoSuchKeyException.builder().build());

    // Mock putting new content
    when(mockS3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
        .thenReturn(PutObjectResponse.builder().build());

    // Test appending logs to new file
    assertDoesNotThrow(() -> s3LogStorage.appendLogs(testPipelineFQN, testRunId, newContent));

    // Verify S3 operations
    verify(mockS3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));
  }

  @Test
  void testGetLogs() throws IOException {
    String logContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n";
    String expectedKey = String.format("%s/%s/%s/logs.txt", testPrefix, testPipelineFQN, testRunId);

    // Mock head object
    when(mockS3Client.headObject(any(HeadObjectRequest.class)))
        .thenReturn(HeadObjectResponse.builder().contentLength((long) logContent.length()).build());

    // Mock get object
    InputStream contentStream =
        new ByteArrayInputStream(logContent.getBytes(StandardCharsets.UTF_8));
    when(mockS3Client.getObject(any(GetObjectRequest.class), any(ResponseTransformer.class)))
        .thenReturn(contentStream);

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

    // Mock get object
    InputStream contentStream =
        new ByteArrayInputStream(logContent.getBytes(StandardCharsets.UTF_8));
    when(mockS3Client.getObject(any(GetObjectRequest.class), any(ResponseTransformer.class)))
        .thenReturn(contentStream);

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
  void testDeleteLogs() throws IOException {
    String expectedKey = String.format("%s/%s/%s/logs.txt", testPrefix, testPipelineFQN, testRunId);

    // Mock delete object
    when(mockS3Client.deleteObject(any(DeleteObjectRequest.class)))
        .thenReturn(DeleteObjectResponse.builder().build());

    // Test deleting logs
    assertDoesNotThrow(() -> s3LogStorage.deleteLogs(testPipelineFQN, testRunId));

    // Verify delete was called
    verify(mockS3Client)
        .deleteObject(
            argThat(
                (DeleteObjectRequest request) ->
                    request.bucket().equals(testBucket) && request.key().equals(expectedKey)));
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
    InputStream expectedStream =
        new ByteArrayInputStream(logContent.getBytes(StandardCharsets.UTF_8));

    // Mock get object
    when(mockS3Client.getObject(any(GetObjectRequest.class), any(ResponseTransformer.class)))
        .thenReturn(expectedStream);

    // Test getting input stream
    InputStream stream = s3LogStorage.getLogInputStream(testPipelineFQN, testRunId);

    assertNotNull(stream);
    assertEquals(logContent, new String(stream.readAllBytes(), StandardCharsets.UTF_8));
  }

  @Test
  void testGetLogOutputStream() throws IOException {
    // Test getting output stream
    OutputStream stream = s3LogStorage.getLogOutputStream(testPipelineFQN, testRunId);

    assertNotNull(stream);
    assertInstanceOf(OutputStream.class, stream);

    // Write some data
    stream.write("Test output".getBytes(StandardCharsets.UTF_8));
    stream.close();
  }

  @Test
  void testClose() throws IOException {
    // Create and add a mock stream
    OutputStream stream = s3LogStorage.getLogOutputStream(testPipelineFQN, testRunId);

    // Test closing
    assertDoesNotThrow(() -> s3LogStorage.close());

    // Verify S3 client was closed
    verify(mockS3Client).close();
  }
}
