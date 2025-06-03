/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.getUri;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.SEPARATOR;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flipkart.zjsonpatch.JsonDiff;
import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.PathNotFoundException;
import io.github.resilience4j.core.functions.CheckedRunnable;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import io.github.resilience4j.retry.RetryRegistry;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.ProcessingException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Form;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.lang.reflect.Field;
import java.net.URI;
import java.text.DateFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.eclipse.jetty.http.HttpStatus;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.function.Executable;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.services.MetadataConnection;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.services.connections.api.RestConnection;
import org.openmetadata.schema.services.connections.database.BigQueryConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.RedshiftConnection;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.services.connections.messaging.RedpandaConnection;
import org.openmetadata.schema.services.connections.metadata.AmundsenConnection;
import org.openmetadata.schema.services.connections.metadata.AtlasConnection;
import org.openmetadata.schema.services.connections.mlmodel.MlflowConnection;
import org.openmetadata.schema.services.connections.pipeline.AirflowConnection;
import org.openmetadata.schema.services.connections.pipeline.GluePipelineConnection;
import org.openmetadata.schema.services.connections.search.ElasticSearchConnection;
import org.openmetadata.schema.services.connections.search.OpenSearchConnection;
import org.openmetadata.schema.services.connections.storage.S3Connection;
import org.openmetadata.schema.type.ApiConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MessagingConnection;
import org.openmetadata.schema.type.MlModelConnection;
import org.openmetadata.schema.type.PipelineConnection;
import org.openmetadata.schema.type.SearchConnection;
import org.openmetadata.schema.type.StorageConnection;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.opentest4j.AssertionFailedError;

@Slf4j
public final class TestUtils {

  // Setting length at +256 since this is the length of the longest EntityName for Test Suites
  public static String LONG_ENTITY_NAME = "a".repeat(256 + 1);
  public static final Map<String, String> ADMIN_AUTH_HEADERS =
      authHeaders(ADMIN_USER_NAME + "@open-metadata.org");
  public static final String GOVERNANCE_BOT = "governance-bot";
  public static final Map<String, String> GOVERNANCE_BOT_AUTH_HEADERS =
      authHeaders(GOVERNANCE_BOT + "@open-metadata.org");
  public static final String INGESTION_BOT = "ingestion-bot";
  public static final Map<String, String> INGESTION_BOT_AUTH_HEADERS =
      authHeaders(INGESTION_BOT + "@open-metadata.org");
  public static final String TEST_USER_NAME = "test";
  public static final Map<String, String> TEST_AUTH_HEADERS =
      authHeaders(TEST_USER_NAME + "@open-metadata.org");
  public static final String USER_WITH_CREATE_PERMISSION_NAME = "testWithCreateUserPermission";
  public static final Map<String, String> USER_WITH_CREATE_HEADERS =
      authHeaders(USER_WITH_CREATE_PERMISSION_NAME + "@open-metadata.org");

  public static final UUID NON_EXISTENT_ENTITY = UUID.randomUUID();

  public static final DatabaseConnection SNOWFLAKE_DATABASE_CONNECTION =
      new DatabaseConnection()
          .withConfig(
              new SnowflakeConnection().withUsername("snowflake").withPassword("snowflake"));
  public static final DatabaseConnection BIGQUERY_DATABASE_CONNECTION =
      new DatabaseConnection().withConfig(new BigQueryConnection().withHostPort("localhost:1000"));
  public static final DatabaseConnection REDSHIFT_DATABASE_CONNECTION =
      new DatabaseConnection()
          .withConfig(
              new RedshiftConnection()
                  .withHostPort("localhost:5002")
                  .withUsername("test")
                  .withPassword("test"));

  public static final URI PIPELINE_URL = getUri("http://localhost:8080");
  public static final DatabaseConnection MYSQL_DATABASE_CONNECTION =
      new DatabaseConnection()
          .withConfig(
              new MysqlConnection()
                  .withHostPort("localhost:3306")
                  .withUsername("test")
                  .withAuthType(new basicAuth().withPassword("test")));
  public static final PipelineConnection AIRFLOW_CONNECTION =
      new PipelineConnection()
          .withConfig(
              new AirflowConnection()
                  .withHostPort(PIPELINE_URL)
                  .withConnection(MYSQL_DATABASE_CONNECTION.getConfig()));

  public static final AWSCredentials AWS_CREDENTIALS =
      new AWSCredentials()
          .withAwsAccessKeyId("ABCD")
          .withAwsSecretAccessKey("1234")
          .withAwsRegion("eu-west-2");
  public static final PipelineConnection GLUE_CONNECTION =
      new PipelineConnection()
          .withConfig(new GluePipelineConnection().withAwsConfig(AWS_CREDENTIALS));

  public static final MessagingConnection KAFKA_CONNECTION =
      new MessagingConnection()
          .withConfig(
              new KafkaConnection()
                  .withBootstrapServers("localhost:9092")
                  .withSchemaRegistryURL(getUri("http://localhost:8081")));
  public static final MessagingConnection REDPANDA_CONNECTION =
      new MessagingConnection()
          .withConfig(new RedpandaConnection().withBootstrapServers("localhost:9092"));

  public static final MlModelConnection MLFLOW_CONNECTION =
      new MlModelConnection()
          .withConfig(
              new MlflowConnection()
                  .withRegistryUri("http://localhost:8080")
                  .withTrackingUri("http://localhost:5000"));

  public static final StorageConnection S3_STORAGE_CONNECTION =
      new StorageConnection().withConfig(new S3Connection().withAwsConfig(AWS_CREDENTIALS));

  public static final SearchConnection ELASTIC_SEARCH_CONNECTION =
      new SearchConnection()
          .withConfig(new ElasticSearchConnection().withHostPort(getUri("http://localhost:9200")));

  public static final SearchConnection OPEN_SEARCH_CONNECTION =
      new SearchConnection()
          .withConfig(new OpenSearchConnection().withHostPort(getUri("http://localhost:9200")));

  public static final ApiConnection API_SERVICE_CONNECTION =
      new ApiConnection()
          .withConfig(
              new RestConnection()
                  .withOpenAPISchemaURL(getUri("http://localhost:8585/swagger.json")));

  public static final MetadataConnection AMUNDSEN_CONNECTION =
      new MetadataConnection()
          .withConfig(
              new AmundsenConnection()
                  .withHostPort(getUri("http://localhost:8080"))
                  .withUsername("admin")
                  .withPassword("admin"));
  public static final MetadataConnection ATLAS_CONNECTION =
      new MetadataConnection()
          .withConfig(
              new AtlasConnection()
                  .withHostPort(getUri("http://localhost:8080"))
                  .withUsername("admin")
                  .withPassword("admin"));

  public static final RetryRegistry ELASTIC_SEARCH_RETRY_REGISTRY =
      RetryRegistry.of(
          RetryConfig.custom()
              .maxAttempts(30) // about 3 seconds
              .waitDuration(Duration.ofMillis(100))
              .retryExceptions(RetryableAssertionError.class)
              .build());

  public static void assertCustomProperties(
      List<CustomProperty> expected, List<CustomProperty> actual) {
    if (expected == actual) { // Take care of both being null
      return;
    }
    if (expected != null) {
      actual = listOrEmpty(actual);
      expected.sort(EntityUtil.compareCustomProperty);
      actual.sort(EntityUtil.compareCustomProperty);
      assertEquals(expected.size(), actual.size());
      for (int i = 0; i < expected.size(); i++) {
        assertEquals(expected.get(i).getName(), actual.get(i).getName());
        assertEquals(
            expected.get(i).getPropertyType().getId(), actual.get(i).getPropertyType().getId());
        assertEquals(
            expected.get(i).getPropertyType().getType(), actual.get(i).getPropertyType().getType());
      }
    }
  }

  public enum UpdateType {
    CREATED, // Not updated instead entity was created
    NO_CHANGE, // PUT/PATCH made no change to the entity and the version remains the same
    CHANGE_CONSOLIDATED, // PATCH made change that was consolidated with the previous and no version
    // change
    REVERT, // PATCH resulted in entity reverting to previous version due to consolidation of
    // changes in a session
    MINOR_UPDATE, // PUT/PATCH made backward compatible minor version change
    MAJOR_UPDATE // PUT/PATCH made backward incompatible minor version change
  }

  private TestUtils() {}

  public static void readResponseError(Response response) throws HttpResponseException {
    try {
      Map<String, Object> error = response.readEntity(Map.class);
      Object code = error.get("code");
      Object message = error.get("message");

      int statusCode = code instanceof Number ? ((Number) code).intValue() : response.getStatus();
      String errorMessage = message != null ? message.toString() : "Unknown error";

      throw new HttpResponseException(statusCode, errorMessage);
    } catch (Exception e) {
      // Fallback if we can't parse the error response
      throw new HttpResponseException(
          response.getStatus(), "Error reading response: " + e.getMessage());
    }
  }

  public static void readResponse(Response response, int expectedResponse)
      throws HttpResponseException {
    if (!HttpStatus.isSuccess(response.getStatus())) {
      readResponseError(response);
    }
    assertEquals(expectedResponse, response.getStatus());
  }

  public static <T> T readResponse(Response response, Class<T> clz, int expectedResponse)
      throws HttpResponseException {
    if (!HttpStatus.isSuccess(response.getStatus())) {
      readResponseError(response);
    }
    assertEquals(expectedResponse, response.getStatus());
    return response.readEntity(clz);
  }

  public static void assertResponse(
      Executable executable, Response.Status expectedStatus, String expectedReason) {
    Exception exception = assertThrows(Exception.class, executable);

    int statusCode;
    String reasonPhrase;

    if (exception instanceof HttpResponseException) {
      HttpResponseException httpException = (HttpResponseException) exception;
      statusCode = httpException.getStatusCode();
      reasonPhrase = httpException.getReasonPhrase();
    } else if (exception instanceof WebApplicationException) {
      WebApplicationException webException = (WebApplicationException) exception;
      statusCode = webException.getResponse().getStatus();
      reasonPhrase = webException.getMessage();
    } else if (exception instanceof ProcessingException) {
      // ProcessingException often wraps the actual HTTP error response
      ProcessingException processingException = (ProcessingException) exception;
      Throwable cause = processingException.getCause();

      // Try to extract status from WebApplicationException in the cause chain
      if (cause instanceof WebApplicationException) {
        WebApplicationException webException = (WebApplicationException) cause;
        statusCode = webException.getResponse().getStatus();
        reasonPhrase = webException.getMessage();
      } else {
        // Fallback: try to parse from message or assume it's a client error
        String message = processingException.getMessage();
        if (message != null && message.contains("HTTP ")) {
          // Try to extract status code from message like "HTTP 403"
          try {
            String[] parts = message.split("HTTP ");
            if (parts.length > 1) {
              String statusPart = parts[1].split(" ")[0];
              statusCode = Integer.parseInt(statusPart);
              reasonPhrase = message;
            } else {
              // Default to 500 for processing errors
              statusCode = 500;
              reasonPhrase = message;
            }
          } catch (NumberFormatException e) {
            statusCode = 500;
            reasonPhrase = message;
          }
        } else {
          statusCode = 500;
          reasonPhrase = processingException.getMessage();
        }
      }
    } else {
      throw new AssertionError("Unexpected exception type: " + exception.getClass(), exception);
    }

    assertEquals(expectedStatus.getStatusCode(), statusCode);

    // Handle Apache HTTP client error message format: "Error reading response: status code: X,
    // reason phrase: Y"
    String actualReason = reasonPhrase;
    if (reasonPhrase != null && reasonPhrase.startsWith("Error reading response: status code:")) {
      // Extract the reason phrase from the wrapped format
      String[] parts = reasonPhrase.split(", reason phrase: ");
      if (parts.length > 1) {
        actualReason = parts[1];
      }
    }

    assertEquals(expectedReason, actualReason);
  }

  public static void assertResponse(
      Executable executable, Response.Status expectedStatus, List<String> expectedReasons) {
    Exception exception = assertThrows(Exception.class, executable);

    int statusCode;
    String reasonPhrase;

    if (exception instanceof HttpResponseException) {
      HttpResponseException httpException = (HttpResponseException) exception;
      statusCode = httpException.getStatusCode();
      reasonPhrase = httpException.getReasonPhrase();
    } else if (exception instanceof WebApplicationException) {
      WebApplicationException webException = (WebApplicationException) exception;
      statusCode = webException.getResponse().getStatus();
      reasonPhrase = webException.getMessage();
    } else if (exception instanceof ProcessingException) {
      // ProcessingException often wraps the actual HTTP error response
      ProcessingException processingException = (ProcessingException) exception;
      Throwable cause = processingException.getCause();

      // Try to extract status from WebApplicationException in the cause chain
      if (cause instanceof WebApplicationException) {
        WebApplicationException webException = (WebApplicationException) cause;
        statusCode = webException.getResponse().getStatus();
        reasonPhrase = webException.getMessage();
      } else {
        // Fallback: try to parse from message or assume it's a client error
        String message = processingException.getMessage();
        if (message != null && message.contains("HTTP ")) {
          // Try to extract status code from message like "HTTP 403"
          try {
            String[] parts = message.split("HTTP ");
            if (parts.length > 1) {
              String statusPart = parts[1].split(" ")[0];
              statusCode = Integer.parseInt(statusPart);
              reasonPhrase = message;
            } else {
              // Default to 500 for processing errors
              statusCode = 500;
              reasonPhrase = message;
            }
          } catch (NumberFormatException e) {
            statusCode = 500;
            reasonPhrase = message;
          }
        } else {
          statusCode = 500;
          reasonPhrase = processingException.getMessage();
        }
      }
    } else {
      throw new AssertionError("Unexpected exception type: " + exception.getClass(), exception);
    }

    assertEquals(expectedStatus.getStatusCode(), statusCode);

    // Handle Apache HTTP client error message format: "Error reading response: status code: X,
    // reason phrase: Y"
    String actualReason = reasonPhrase;
    if (reasonPhrase != null && reasonPhrase.startsWith("Error reading response: status code:")) {
      // Extract the reason phrase from the wrapped format
      String[] parts = reasonPhrase.split(", reason phrase: ");
      if (parts.length > 1) {
        actualReason = parts[1];
      }
    }

    assertTrue(expectedReasons.contains(actualReason));
  }

  public static void assertResponseContains(
      Executable executable, Response.Status expectedStatus, String expectedReason) {
    Exception exception = assertThrows(Exception.class, executable);

    int statusCode;
    String reasonPhrase;

    if (exception instanceof HttpResponseException) {
      HttpResponseException httpException = (HttpResponseException) exception;
      statusCode = httpException.getStatusCode();
      reasonPhrase = httpException.getReasonPhrase();
    } else if (exception instanceof WebApplicationException) {
      WebApplicationException webException = (WebApplicationException) exception;
      statusCode = webException.getResponse().getStatus();
      reasonPhrase = webException.getMessage();
    } else if (exception instanceof ProcessingException) {
      // ProcessingException often wraps the actual HTTP error response
      ProcessingException processingException = (ProcessingException) exception;
      Throwable cause = processingException.getCause();

      // Try to extract status from WebApplicationException in the cause chain
      if (cause instanceof WebApplicationException) {
        WebApplicationException webException = (WebApplicationException) cause;
        statusCode = webException.getResponse().getStatus();
        reasonPhrase = webException.getMessage();
      } else {
        // Fallback: try to parse from message or assume it's a client error
        String message = processingException.getMessage();
        if (message != null && message.contains("HTTP ")) {
          // Try to extract status code from message like "HTTP 403"
          try {
            String[] parts = message.split("HTTP ");
            if (parts.length > 1) {
              String statusPart = parts[1].split(" ")[0];
              statusCode = Integer.parseInt(statusPart);
              reasonPhrase = message;
            } else {
              // Default to 500 for processing errors
              statusCode = 500;
              reasonPhrase = message;
            }
          } catch (NumberFormatException e) {
            statusCode = 500;
            reasonPhrase = message;
          }
        } else {
          statusCode = 500;
          reasonPhrase = processingException.getMessage();
        }
      }
    } else {
      throw new AssertionError("Unexpected exception type: " + exception.getClass(), exception);
    }

    assertEquals(expectedStatus.getStatusCode(), statusCode);

    // Strip "[" at the beginning and "]" at the end as actual reason may contain more than one
    // error messages
    expectedReason =
        expectedReason.startsWith("[")
            ? expectedReason.substring(1, expectedReason.length() - 1)
            : expectedReason;
    String actualReason = reasonPhrase;
    assertTrue(
        actualReason.contains(expectedReason), expectedReason + " not in actual " + actualReason);
  }

  public static <T> void assertEntityPagination(
      List<T> allEntities, ResultList<T> actual, int limit, int offset) {
    assertFalse(actual.getData().isEmpty());
    if (actual.getPaging().getAfter() != null && actual.getPaging().getBefore() != null) {
      // Last page may have less than limit number of records
      assertEquals(limit, actual.getData().size());
    }
    for (int i = 0; i < actual.getData().size(); i++) {
      assertEquals(allEntities.get(offset + i), actual.getData().get(i));
    }
    // Ensure total count returned in paging is correct
    assertEquals(allEntities.size(), actual.getPaging().getTotal());
  }

  public static void post(WebTarget target, Map<String, String> headers)
      throws HttpResponseException {
    post(target, null, headers);
  }

  public static <K> void post(WebTarget target, K request, Map<String, String> headers)
      throws HttpResponseException {
    post(target, request, Status.CREATED.getStatusCode(), headers);
  }

  public static <K> void post(
      WebTarget target, K request, int expectedStatus, Map<String, String> headers)
      throws HttpResponseException {
    Entity<K> entity =
        (request == null) ? null : Entity.entity(request, MediaType.APPLICATION_JSON);
    Response response = SecurityUtil.addHeaders(target, headers).post(entity);
    readResponse(response, expectedStatus);
  }

  public static <T, K> T post(
      WebTarget target, K request, Class<T> clz, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers)
            .post(Entity.entity(request, MediaType.APPLICATION_JSON));
    return readResponse(response, clz, Status.CREATED.getStatusCode());
  }

  public static <T, K> T post(
      WebTarget target, K request, Class<T> clz, int expectedStatus, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers)
            .post(Entity.entity(request, MediaType.APPLICATION_JSON));
    return readResponse(response, clz, expectedStatus);
  }

  public static <T> T patch(
      WebTarget target, JsonNode patch, Class<T> clz, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers)
            .method(
                "PATCH",
                Entity.entity(patch.toString(), MediaType.APPLICATION_JSON_PATCH_JSON_TYPE));
    return readResponse(response, clz, Status.OK.getStatusCode());
  }

  public static <K> void put(
      WebTarget target, K request, Status expectedStatus, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers)
            .method("PUT", Entity.entity(request, MediaType.APPLICATION_JSON));
    readResponse(response, expectedStatus.getStatusCode());
  }

  public static void put(WebTarget target, Status expectedStatus, Map<String, String> headers)
      throws HttpResponseException {
    Invocation.Builder builder = SecurityUtil.addHeaders(target, headers);
    Response response = builder.method("PUT");
    readResponse(response, expectedStatus.getStatusCode());
  }

  public static <T, K> T put(
      WebTarget target, K request, Class<T> clz, Status expectedStatus, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers)
            .method("PUT", Entity.entity(request, MediaType.APPLICATION_JSON));
    return readResponse(response, clz, expectedStatus.getStatusCode());
  }

  public static <T> T putCsv(
      WebTarget target,
      String request,
      Class<T> clz,
      Status expectedStatus,
      Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers)
            .method("PUT", Entity.entity(request, MediaType.TEXT_PLAIN));
    return readResponse(response, clz, expectedStatus.getStatusCode());
  }

  public static void get(WebTarget target, Map<String, String> headers)
      throws HttpResponseException {
    final Response response = SecurityUtil.addHeaders(target, headers).get();
    readResponse(response, Status.NO_CONTENT.getStatusCode());
  }

  public static <T> T get(WebTarget target, Class<T> clz, Map<String, String> headers)
      throws HttpResponseException {
    final Response response = SecurityUtil.addHeaders(target, headers).get();
    return readResponse(response, clz, Status.OK.getStatusCode());
  }

  public static <T> T getWithResponse(
      WebTarget target, Class<T> clz, Map<String, String> headers, int statusConde)
      throws HttpResponseException {
    final Response response = SecurityUtil.addHeaders(target, headers).get();
    return readResponse(response, clz, statusConde);
  }

  public static <T> T delete(WebTarget target, Class<T> clz, Map<String, String> headers)
      throws HttpResponseException {
    final Response response = SecurityUtil.addHeaders(target, headers).delete();
    return readResponse(response, clz, Status.OK.getStatusCode());
  }

  public static void delete(WebTarget target, Map<String, String> headers)
      throws HttpResponseException {
    final Response response = SecurityUtil.addHeaders(target, headers).delete();
    if (!HttpStatus.isSuccess(response.getStatus())) {
      readResponseError(response);
    }
    assertEquals(Status.OK.getStatusCode(), response.getStatus());
  }

  public static jakarta.ws.rs.core.Response deleteAsync(
      WebTarget target, Map<String, String> headers) throws HttpResponseException {
    try {
      final jakarta.ws.rs.core.Response response =
          SecurityUtil.addHeaders(target, headers).delete();
      int status = response.getStatus();

      // For async operations, we expect 202 Accepted
      if (status != Response.Status.ACCEPTED.getStatusCode()) {
        if (!HttpStatus.isSuccess(status)) {
          readResponseError(response);
        }
        throw new HttpResponseException(
            status,
            "Expected status " + Response.Status.ACCEPTED.getStatusCode() + " but got " + status);
      }
      return response;
    } catch (HttpResponseException e) {
      throw e;
    } catch (Exception e) {
      throw new HttpResponseException(500, "Failed to execute delete request: " + e.getMessage());
    }
  }

  public static void assertDeleted(List<EntityReference> list, Boolean expected) {
    listOrEmpty(list).forEach(e -> assertEquals(expected, e.getDeleted()));
  }

  public static void validateEntityReference(EntityReference ref) {
    assertNotNull(ref);
    assertNotNull(ref.getId(), invalidEntityReference(ref, "null Id"));
    assertNotNull(ref.getHref(), invalidEntityReference(ref, "null href"));
    assertNotNull(ref.getName(), invalidEntityReference(ref, "null name"));
    assertNotNull(ref.getFullyQualifiedName(), invalidEntityReference(ref, "null fqn"));
    assertNotNull(ref.getType(), invalidEntityReference(ref, "null type"));
    // Ensure data entities use fully qualified name
    if (List.of(
            "table",
            "database",
            "metrics",
            "dashboard",
            "pipeline",
            "report",
            "topic",
            "chart",
            "location")
        .contains(ref.getType())) {
      // FullyQualifiedName has "." as separator
      assertTrue(
          ref.getFullyQualifiedName().contains(SEPARATOR),
          "entity name is not fully qualified - " + ref.getName());
    }
  }

  public static String invalidEntityReference(EntityReference ref, String message) {
    return String.format("%s:%s %s", ref.getType(), ref.getId(), message);
  }

  public static void validateEntityReferences(List<EntityReference> list) {
    validateEntityReferences(list, false);
  }

  public static void validateEntityReferences(
      List<EntityReference> list, boolean expectedNotEmpty) {
    if (expectedNotEmpty) {
      assertNotNull(list);
      assertListNotEmpty(list);
    }
    listOrEmpty(list).forEach(TestUtils::validateEntityReference);
    validateAlphabeticalOrdering(list, EntityUtil.compareEntityReference);
  }

  public static void validateTags(List<TagLabel> expectedList, List<TagLabel> actualList)
      throws HttpResponseException {
    if (expectedList == null) {
      return;
    }
    actualList = listOrEmpty(actualList);
    actualList.forEach(TestUtils::validateTagLabel);

    // When tags from the expected list is added to an entity, the derived tags for those tags are
    // automatically added. So add to the expectedList, the derived tags before validating the tags
    List<TagLabel> updatedExpectedList = new ArrayList<>();
    EntityUtil.mergeTags(updatedExpectedList, expectedList);

    TagResourceTest tagResourceTest = new TagResourceTest();
    for (TagLabel expected : expectedList) {
      if (expected.getSource() == TagSource.GLOSSARY) {
        GlossaryTerm glossaryTerm =
            new GlossaryTermResourceTest()
                .getEntityByName(expected.getTagFQN(), null, "tags", ADMIN_AUTH_HEADERS);
        List<TagLabel> derived = new ArrayList<>();
        for (TagLabel tag : listOrEmpty(glossaryTerm.getTags())) {
          Tag associatedTag = tagResourceTest.getEntityByName(tag.getTagFQN(), ADMIN_AUTH_HEADERS);
          derived.add(
              new TagLabel()
                  .withTagFQN(tag.getTagFQN())
                  .withName(tag.getName())
                  .withDisplayName(tag.getDisplayName())
                  .withState(expected.getState())
                  .withDescription(associatedTag.getDescription())
                  .withLabelType(TagLabel.LabelType.DERIVED));
        }
        EntityUtil.mergeTags(updatedExpectedList, derived);
      }
    }
    assertTrue(compareListsIgnoringOrder(updatedExpectedList, actualList));
  }

  public static void validateTagLabel(TagLabel label) {
    assertNotNull(label.getTagFQN(), label.getTagFQN());
    assertNotNull(label.getDescription(), label.getTagFQN());
    assertNotNull(label.getLabelType(), label.getTagFQN());
    assertNotNull(label.getSource(), label.getTagFQN());
    assertNotNull(label.getState(), label.getTagFQN());
  }

  public static void checkUserFollowing(
      UUID userId, UUID entityId, boolean expectedFollowing, Map<String, String> authHeaders)
      throws HttpResponseException {
    // GET .../users/{userId} shows user as following table
    User user = new UserResourceTest().getEntity(userId, "follows", authHeaders);
    existsInEntityReferenceList(user.getFollows(), entityId, expectedFollowing);
  }

  public static void assertEntityReferenceIds(List<UUID> expected, List<EntityReference> actual) {
    if (expected == null && actual == null) {
      return;
    }
    expected = listOrEmpty(expected);
    actual = listOrEmpty(actual);
    if (expected.isEmpty()) {
      return;
    }
    assertEquals(expected.size(), actual.size());
    for (UUID id : expected) {
      assertNotNull(
          actual.stream().filter(entity -> entity.getId().equals(id)).findAny().orElse(null));
    }
    validateEntityReferences(actual);
  }

  public static void assertEntityReferences(
      List<EntityReference> expected, List<EntityReference> actual) {
    if (expected == actual) { // Take care of both being null
      return;
    }
    if (expected != null) {
      actual = listOrEmpty(actual);
      assertEquals(expected.size(), actual.size());
      for (EntityReference e : expected) {
        TestUtils.existsInEntityReferenceList(actual, e.getId(), true);
      }
    }
  }

  public static void assertEntityReferenceNames(
      List<String> expected, List<EntityReference> actual) {
    if (expected != null) {
      actual = listOrEmpty(actual);
      assertEquals(expected.size(), actual.size());
      for (String e : expected) {
        TestUtils.existsInEntityReferenceList(actual, e, true);
      }
    }
  }

  public static void existsInEntityReferenceList(
      List<EntityReference> ownsList, UUID id, boolean expectedExistsInList) {
    EntityReference ref = null;
    for (EntityReference r : ownsList) {
      validateEntityReference(r);
      if (r.getId().equals(id)) {
        ref = r;
        break;
      }
    }
    if (expectedExistsInList) {
      assertNotNull(ref, "EntityReference does not exist for " + id);
    } else {
      if (ref != null) {
        assertTrue(ref.getDeleted(), "EntityReference is not deleted as expected " + id);
      }
    }
  }

  // TODO clean up
  public static void existsInEntityReferenceList(
      List<EntityReference> list, String fqn, boolean expectedExistsInList) {
    EntityReference ref = null;
    for (EntityReference r : list) {
      // TODO Change description does not href in EntityReferences
      // validateEntityReference(r);
      if (r.getFullyQualifiedName().equals(fqn)) {
        ref = r;
        break;
      }
    }
    if (expectedExistsInList) {
      assertNotNull(ref, "EntityReference does not exist for " + fqn);
    } else {
      if (ref != null) {
        assertTrue(ref.getDeleted(), "EntityReference is not deleted as expected " + fqn);
      }
    }
  }

  public static void assertListNull(Object... values) {
    int index = 0;
    for (Object value : values) {
      Assertions.assertNull(value, "Object at index " + index + " is not null");
      index++;
    }
  }

  public static void assertListNotNull(Object... values) {
    int index = 0;
    for (Object value : values) {
      Assertions.assertNotNull(value, "Object at index " + index + " is null");
      index++;
    }
  }

  public static void assertListNotEmpty(List<?>... values) {
    int index = 0;
    for (List<?> value : values) {
      Assertions.assertFalse(value.isEmpty(), "List at index " + index + " is empty");
      index++;
    }
  }

  public static <T> void validateAlphabeticalOrdering(List<T> list, Comparator<T> comparator) {
    Iterator<T> iterator = listOrEmpty(list).iterator();
    if (!iterator.hasNext()) {
      return;
    }
    T prev = iterator.next();
    while (iterator.hasNext()) {
      T next = iterator.next();
      if (comparator.compare(prev, next) > 0) {
        return;
      }
      prev = next;
    }
  }

  public static Long dateToTimestamp(String dateStr) throws ParseException {
    DateFormat formatter = new SimpleDateFormat("yyyy-MM-dd");
    Date date = formatter.parse(dateStr);
    return date.getTime();
  }

  public static <T> String getEntityNameLengthError(Class<T> clazz) {
    try {
      Field field = clazz.getDeclaredField("name");

      // Try javax.validation.constraints.Size first
      Size size = field.getAnnotation(Size.class);
      if (size != null) {
        return String.format(
            "[query param name size must be between %d and %d]", size.min(), size.max());
      }

      // Try jakarta.validation.constraints.Size
      jakarta.validation.constraints.Size jakartaSize =
          field.getAnnotation(jakarta.validation.constraints.Size.class);
      if (jakartaSize != null) {
        return String.format(
            "[query param name size must be between %d and %d]",
            jakartaSize.min(), jakartaSize.max());
      }

      // Fallback if no Size annotation found
      LOG.warn("No Size annotation found for name field in {}", clazz.getSimpleName());
      return "[query param name size must be between 1 and 256]"; // Default values
    } catch (NoSuchFieldException e) {
      LOG.warn("Failed to find constraints for the entity {}", clazz.getSimpleName(), e);
    }
    return null;
  }

  public static <T> boolean compareListsIgnoringOrder(List<T> expected, List<T> actual) {
    int exists = 0;
    if (expected == null || actual == null) return false;
    if (expected.size() != actual.size()) return false;

    for (T o : expected) {
      if (actual.contains(o)) exists++;
    }

    return actual.size() == exists;
  }

  public static void assertStyle(Style expected, Style actual) {
    if (expected == null) return;
    assertEquals(expected.getIconURL(), actual.getIconURL());
    assertEquals(expected.getColor(), actual.getColor());
  }

  public static void assertEventually(String name, CheckedRunnable runnable) {
    assertEventually(name, runnable, ELASTIC_SEARCH_RETRY_REGISTRY);
  }

  public static void assertEventually(
      String name, CheckedRunnable runnable, RetryRegistry retryRegistry) {
    try {
      Retry.decorateCheckedRunnable(
              retryRegistry.retry(name),
              () -> {
                try {
                  runnable.run();
                } catch (AssertionError e) {
                  // translate AssertionErrors to Exceptions to that retry processes
                  // them correctly. This is required because retry library only retries on
                  // Exceptions and:
                  // AssertionError -> Error -> Throwable
                  // RetryableAssertionError -> Exception -> Throwable
                  throw new RetryableAssertionError(e);
                }
              })
          .run();
    } catch (RetryableAssertionError e) {
      throw new AssertionFailedError(
          "Max retries exceeded polling for eventual assert", e.getCause());
    } catch (Throwable e) {
      throw new AssertionFailedError("Unexpected error while running retry: " + e.getMessage(), e);
    }
  }

  public static JsonNode getJsonPatch(String originalJson, String updatedJson) {
    try {
      ObjectMapper mapper = new ObjectMapper();
      return JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));
    } catch (JsonProcessingException ignored) {
    }
    return null;
  }

  public static void assertFieldExists(
      DocumentContext jsonContext, String jsonPath, String fieldName) {
    List<Map<String, Object>> result = jsonContext.read(jsonPath, List.class);
    assertFalse(
        (result == null || result.isEmpty()), "The query should contain '" + fieldName + "' term.");
  }

  public static void assertFieldDoesNotExist(
      DocumentContext jsonContext, String jsonPath, String fieldName) {
    try {
      List<Map<String, Object>> result = jsonContext.read(jsonPath, List.class);
      assertTrue(result.isEmpty(), "The query should not contain '" + fieldName + "' term.");
    } catch (PathNotFoundException e) {
      // If the path doesn't exist, this is expected behavior, so the test should pass.
      assertTrue(true, "The path does not exist as expected: " + jsonPath);
    }
  }

  public static Form buildMultipartForm(
      java.io.InputStream fileStream,
      String fileParamName,
      String fileName,
      String entityLink,
      String contentType,
      Double size) {
    Form form = new Form();
    form.param("file", "dummy"); // For simplicity, a dummy value is used
    form.param("entityLink", entityLink);
    form.param("contentType", contentType);
    form.param("size", String.valueOf(size));
    return form;
  }
}
