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
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.SEPARATOR;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;

import java.lang.reflect.Field;
import java.net.URI;
import java.net.URISyntaxException;
import java.text.DateFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.json.JsonObject;
import javax.json.JsonPatch;
import javax.validation.constraints.Size;
import javax.ws.rs.client.Entity;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
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
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.services.connections.dashboard.MetabaseConnection;
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
import org.openmetadata.schema.services.connections.storage.S3Connection;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MessagingConnection;
import org.openmetadata.schema.type.MlModelConnection;
import org.openmetadata.schema.type.PipelineConnection;
import org.openmetadata.schema.type.StorageConnection;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.SecurityUtil;

@Slf4j
public final class TestUtils {
  public static String LONG_ENTITY_NAME = "a".repeat(128 + 1);
  public static final Map<String, String> ADMIN_AUTH_HEADERS = authHeaders(ADMIN_USER_NAME + "@open-metadata.org");
  public static final String INGESTION_BOT = "ingestion-bot";
  public static final Map<String, String> INGESTION_BOT_AUTH_HEADERS =
      authHeaders(INGESTION_BOT + "@open-metadata.org");
  public static final String TEST_USER_NAME = "test";
  public static final Map<String, String> TEST_AUTH_HEADERS = authHeaders(TEST_USER_NAME + "@open-metadata.org");

  public static final UUID NON_EXISTENT_ENTITY = UUID.randomUUID();

  public static final DatabaseConnection MYSQL_DATABASE_CONNECTION;
  public static final DatabaseConnection SNOWFLAKE_DATABASE_CONNECTION;
  public static final DatabaseConnection BIGQUERY_DATABASE_CONNECTION;
  public static final DatabaseConnection REDSHIFT_DATABASE_CONNECTION;

  public static PipelineConnection AIRFLOW_CONNECTION;
  public static PipelineConnection GLUE_CONNECTION;

  public static MessagingConnection KAFKA_CONNECTION;
  public static MessagingConnection REDPANDA_CONNECTION;
  public static DashboardConnection METABASE_CONNECTION;

  public static final MlModelConnection MLFLOW_CONNECTION;
  public static final StorageConnection S3_STORAGE_CONNECTION;
  public static MetadataConnection AMUNDSEN_CONNECTION;
  public static MetadataConnection ATLAS_CONNECTION;

  public static URI PIPELINE_URL;

  public static final AWSCredentials AWS_CREDENTIALS;

  public static void assertCustomProperties(List<CustomProperty> expected, List<CustomProperty> actual) {
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
        assertEquals(expected.get(i).getPropertyType().getId(), actual.get(i).getPropertyType().getId());
        assertEquals(expected.get(i).getPropertyType().getType(), actual.get(i).getPropertyType().getType());
      }
    }
  }

  public enum UpdateType {
    CREATED, // Not updated instead entity was created
    NO_CHANGE, // PUT/PATCH made no change
    MINOR_UPDATE, // PUT/PATCH made backward compatible minor version change
    MAJOR_UPDATE // PUT/PATCH made backward incompatible minor version change
  }

  static {
    MYSQL_DATABASE_CONNECTION =
        new DatabaseConnection()
            .withConfig(
                new MysqlConnection()
                    .withHostPort("localhost:3306")
                    .withUsername("test")
                    .withAuthType(new basicAuth().withPassword("test")));
    REDSHIFT_DATABASE_CONNECTION =
        new DatabaseConnection()
            .withConfig(
                new RedshiftConnection().withHostPort("localhost:5002").withUsername("test").withPassword("test"));
    BIGQUERY_DATABASE_CONNECTION =
        new DatabaseConnection().withConfig(new BigQueryConnection().withHostPort("localhost:1000"));
    SNOWFLAKE_DATABASE_CONNECTION =
        new DatabaseConnection()
            .withConfig(new SnowflakeConnection().withUsername("snowflake").withPassword("snowflake"));
  }

  static {
    try {
      KAFKA_CONNECTION =
          new MessagingConnection()
              .withConfig(
                  new KafkaConnection()
                      .withBootstrapServers("localhost:9092")
                      .withSchemaRegistryURL(new URI("http://localhost:8081")));
    } catch (URISyntaxException e) {
      KAFKA_CONNECTION = null;
      e.printStackTrace();
    }
  }

  static {
    try {
      REDPANDA_CONNECTION =
          new MessagingConnection().withConfig(new RedpandaConnection().withBootstrapServers("localhost:9092"));
    } catch (Exception e) {
      REDPANDA_CONNECTION = null;
      e.printStackTrace();
    }
  }

  static {
    try {
      METABASE_CONNECTION =
          new DashboardConnection()
              .withConfig(
                  new MetabaseConnection()
                      .withHostPort(new URI("http://localhost:8080"))
                      .withUsername("admin")
                      .withPassword("admin"));
    } catch (URISyntaxException e) {
      METABASE_CONNECTION = null;
      e.printStackTrace();
    }
  }

  static {
    MLFLOW_CONNECTION =
        new MlModelConnection()
            .withConfig(
                new MlflowConnection()
                    .withRegistryUri("http://localhost:8080")
                    .withTrackingUri("http://localhost:5000"));
  }

  static {
    AWS_CREDENTIALS =
        new AWSCredentials().withAwsAccessKeyId("ABCD").withAwsSecretAccessKey("1234").withAwsRegion("eu-west-2");
  }

  static {
    S3_STORAGE_CONNECTION = new StorageConnection().withConfig(new S3Connection().withAwsConfig(AWS_CREDENTIALS));
  }

  static {
    try {
      PIPELINE_URL = new URI("http://localhost:8080");
      AIRFLOW_CONNECTION =
          new PipelineConnection()
              .withConfig(
                  new AirflowConnection()
                      .withHostPort(PIPELINE_URL)
                      .withConnection(MYSQL_DATABASE_CONNECTION.getConfig()));

      GLUE_CONNECTION =
          new PipelineConnection().withConfig(new GluePipelineConnection().withAwsConfig(AWS_CREDENTIALS));
    } catch (URISyntaxException e) {
      PIPELINE_URL = null;
      e.printStackTrace();
    }
  }

  static {
    try {
      AMUNDSEN_CONNECTION =
          new MetadataConnection()
              .withConfig(
                  new AmundsenConnection()
                      .withHostPort(new URI("http://localhost:8080"))
                      .withUsername("admin")
                      .withPassword("admin"));
    } catch (URISyntaxException e) {
      AMUNDSEN_CONNECTION = null;
      e.printStackTrace();
    }
  }

  static {
    try {
      ATLAS_CONNECTION =
          new MetadataConnection()
              .withConfig(
                  new AtlasConnection()
                      .withHostPort(new URI("http://localhost:8080"))
                      .withUsername("admin")
                      .withPassword("admin"));
    } catch (URISyntaxException e) {
      ATLAS_CONNECTION = null;
      e.printStackTrace();
    }
  }

  private TestUtils() {}

  public static void readResponseError(Response response) throws HttpResponseException {
    JsonObject error = response.readEntity(JsonObject.class);
    throw new HttpResponseException(error.getInt("code"), error.getString("message"));
  }

  public static void readResponse(Response response, int expectedResponse) throws HttpResponseException {
    if (!HttpStatus.isSuccess(response.getStatus())) {
      readResponseError(response);
    }
    assertEquals(expectedResponse, response.getStatus());
  }

  public static <T> T readResponse(Response response, Class<T> clz, int expectedResponse) throws HttpResponseException {
    if (!HttpStatus.isSuccess(response.getStatus())) {
      readResponseError(response);
    }
    assertEquals(expectedResponse, response.getStatus());
    return response.readEntity(clz);
  }

  public static void assertResponse(Executable executable, Response.Status expectedStatus, String expectedReason) {
    HttpResponseException exception = assertThrows(HttpResponseException.class, executable);
    assertEquals(expectedStatus.getStatusCode(), exception.getStatusCode());
    assertEquals(expectedReason, exception.getReasonPhrase());
  }

  public static void assertResponseContains(
      Executable executable, Response.Status expectedStatus, String expectedReason) {
    HttpResponseException exception = assertThrows(HttpResponseException.class, executable);
    assertEquals(expectedStatus.getStatusCode(), exception.getStatusCode());

    // Strip "[" at the beginning and "]" at the end as actual reason may contain more than one error messages
    expectedReason =
        expectedReason.startsWith("[") ? expectedReason.substring(1, expectedReason.length() - 1) : expectedReason;
    String actualReason = exception.getReasonPhrase();
    assertTrue(actualReason.contains(expectedReason), expectedReason + " not in actual " + actualReason);
  }

  public static <T> void assertEntityPagination(List<T> allEntities, ResultList<T> actual, int limit, int offset) {
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

  public static void post(WebTarget target, Map<String, String> headers) throws HttpResponseException {
    post(target, null, headers);
  }

  public static <K> void post(WebTarget target, K request, Map<String, String> headers) throws HttpResponseException {
    Entity<K> entity = (request == null) ? null : Entity.entity(request, MediaType.APPLICATION_JSON);
    Response response = SecurityUtil.addHeaders(target, headers).post(entity);
    readResponse(response, Status.CREATED.getStatusCode());
  }

  public static <T, K> T post(WebTarget target, K request, Class<T> clz, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers).post(Entity.entity(request, MediaType.APPLICATION_JSON));
    return readResponse(response, clz, Status.CREATED.getStatusCode());
  }

  public static <T, K> T post(
      WebTarget target, K request, Class<T> clz, int expectedStatus, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers).post(Entity.entity(request, MediaType.APPLICATION_JSON));
    return readResponse(response, clz, expectedStatus);
  }

  public static <T> T patch(WebTarget target, JsonPatch patch, Class<T> clz, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers)
            .method("PATCH", Entity.entity(patch.toJsonArray().toString(), MediaType.APPLICATION_JSON_PATCH_JSON_TYPE));
    return readResponse(response, clz, Status.OK.getStatusCode());
  }

  public static <K> void put(WebTarget target, K request, Status expectedStatus, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers).method("PUT", Entity.entity(request, MediaType.APPLICATION_JSON));
    readResponse(response, expectedStatus.getStatusCode());
  }

  public static <T, K> T put(
      WebTarget target, K request, Class<T> clz, Status expectedStatus, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers).method("PUT", Entity.entity(request, MediaType.APPLICATION_JSON));
    return readResponse(response, clz, expectedStatus.getStatusCode());
  }

  public static <T> T putCsv(
      WebTarget target, String request, Class<T> clz, Status expectedStatus, Map<String, String> headers)
      throws HttpResponseException {
    Response response =
        SecurityUtil.addHeaders(target, headers).method("PUT", Entity.entity(request, MediaType.TEXT_PLAIN));
    return readResponse(response, clz, expectedStatus.getStatusCode());
  }

  public static void get(WebTarget target, Map<String, String> headers) throws HttpResponseException {
    final Response response = SecurityUtil.addHeaders(target, headers).get();
    readResponse(response, Status.NO_CONTENT.getStatusCode());
  }

  public static <T> T get(WebTarget target, Class<T> clz, Map<String, String> headers) throws HttpResponseException {
    final Response response = SecurityUtil.addHeaders(target, headers).get();
    return readResponse(response, clz, Status.OK.getStatusCode());
  }

  public static <T> T getWithResponse(WebTarget target, Class<T> clz, Map<String, String> headers, int statusConde)
      throws HttpResponseException {
    final Response response = SecurityUtil.addHeaders(target, headers).get();
    return readResponse(response, clz, statusConde);
  }

  public static <T> T delete(WebTarget target, Class<T> clz, Map<String, String> headers) throws HttpResponseException {
    final Response response = SecurityUtil.addHeaders(target, headers).delete();
    return readResponse(response, clz, Status.OK.getStatusCode());
  }

  public static void delete(WebTarget target, Map<String, String> headers) throws HttpResponseException {
    final Response response = SecurityUtil.addHeaders(target, headers).delete();
    if (!HttpStatus.isSuccess(response.getStatus())) {
      readResponseError(response);
    }
    assertEquals(Status.OK.getStatusCode(), response.getStatus());
  }

  public static void assertDeleted(List<EntityReference> list, Boolean expected) {
    listOrEmpty(list).forEach(e -> assertEquals(expected, e.getDeleted()));
  }

  public static void validateEntityReference(EntityReference ref) {
    assertNotNull(ref.getId(), invalidEntityReference(ref, "null Id"));
    assertNotNull(ref.getHref(), invalidEntityReference(ref, "null href"));
    assertNotNull(ref.getName(), invalidEntityReference(ref, "null name"));
    assertNotNull(ref.getFullyQualifiedName(), invalidEntityReference(ref, "null fqn"));
    assertNotNull(ref.getType(), invalidEntityReference(ref, "null type"));
    // Ensure data entities use fully qualified name
    if (List.of("table", "database", "metrics", "dashboard", "pipeline", "report", "topic", "chart", "location")
        .contains(ref.getType())) {
      // FullyQualifiedName has "." as separator
      assertTrue(
          ref.getFullyQualifiedName().contains(SEPARATOR), "entity name is not fully qualified - " + ref.getName());
    }
  }

  public static String invalidEntityReference(EntityReference ref, String message) {
    return String.format("%s:%s %s", ref.getType(), ref.getId(), message);
  }

  public static void validateEntityReferences(List<EntityReference> list) {
    validateEntityReferences(list, false);
  }

  public static void validateEntityReferences(List<EntityReference> list, boolean expectedNotEmpty) {
    if (expectedNotEmpty) {
      assertNotNull(list);
      assertListNotEmpty(list);
    }
    listOrEmpty(list).forEach(TestUtils::validateEntityReference);
    validateAlphabeticalOrdering(list, EntityUtil.compareEntityReference);
  }

  public static void validateTags(List<TagLabel> expectedList, List<TagLabel> actualList) throws HttpResponseException {
    if (expectedList == null) {
      return;
    }
    actualList = listOrEmpty(actualList);
    actualList.forEach(TestUtils::validateTagLabel);

    // When tags from the expected list is added to an entity, the derived tags for those tags are automatically added
    // So add to the expectedList, the derived tags before validating the tags
    List<TagLabel> updatedExpectedList = new ArrayList<>();
    EntityUtil.mergeTags(updatedExpectedList, expectedList);

    TagResourceTest tagResourceTest = new TagResourceTest();
    for (TagLabel expected : expectedList) {
      if (expected.getSource() == TagSource.GLOSSARY) {
        GlossaryTerm glossaryTerm =
            new GlossaryTermResourceTest().getEntityByName(expected.getTagFQN(), null, "tags", ADMIN_AUTH_HEADERS);
        List<TagLabel> derived = new ArrayList<>();
        for (TagLabel tag : listOrEmpty(glossaryTerm.getTags())) {
          Tag associatedTag = tagResourceTest.getEntityByName(tag.getTagFQN(), ADMIN_AUTH_HEADERS);
          derived.add(
              new TagLabel()
                  .withTagFQN(tag.getTagFQN())
                  .withState(expected.getState())
                  .withDescription(associatedTag.getDescription())
                  .withLabelType(TagLabel.LabelType.DERIVED));
        }
        EntityUtil.mergeTags(updatedExpectedList, derived);
      }
    }
    updatedExpectedList.sort(EntityUtil.compareTagLabel);
    actualList.sort(EntityUtil.compareTagLabel);
    assertEquals(updatedExpectedList.size(), actualList.size());
    assertEquals(updatedExpectedList, actualList);
  }

  public static void validateTagLabel(TagLabel label) {
    assertNotNull(label.getTagFQN(), label.getTagFQN());
    assertNotNull(label.getDescription(), label.getTagFQN());
    assertNotNull(label.getLabelType(), label.getTagFQN());
    assertNotNull(label.getSource(), label.getTagFQN());
    assertNotNull(label.getState(), label.getTagFQN());
    // TODO
    // assertNotNull(label.getHref());
  }

  public static void checkUserFollowing(
      UUID userId, UUID entityId, boolean expectedFollowing, Map<String, String> authHeaders)
      throws HttpResponseException {
    // GET .../users/{userId} shows user as following table
    User user = new UserResourceTest().getEntity(userId, "follows", authHeaders);
    existsInEntityReferenceList(user.getFollows(), entityId, expectedFollowing);
  }

  // TODO remove this
  public static void validateUpdate(Double previousVersion, Double newVersion, UpdateType updateType) {
    if (updateType == UpdateType.CREATED) {
      assertEquals(0.1, newVersion); // New version of entity created
    } else if (updateType == UpdateType.NO_CHANGE) {
      assertEquals(previousVersion, newVersion); // No change in the version
    } else if (updateType == UpdateType.MINOR_UPDATE) {
      assertEquals(EntityUtil.nextVersion(previousVersion), newVersion); //
      // Minor version change
    } else if (updateType == UpdateType.MAJOR_UPDATE) {
      assertEquals(EntityUtil.nextMajorVersion(previousVersion), newVersion); // Major version change
    }
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
      assertNotNull(actual.stream().filter(entity -> entity.getId().equals(id)).findAny().orElse(null));
    }
    validateEntityReferences(actual);
  }

  public static void assertEntityReferences(List<EntityReference> expected, List<EntityReference> actual) {
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

  public static void assertEntityReferenceNames(List<String> expected, List<EntityReference> actual) {
    if (expected != null) {
      actual = listOrEmpty(actual);
      assertEquals(expected.size(), actual.size());
      for (String e : expected) {
        TestUtils.existsInEntityReferenceList(actual, e, true);
      }
    }
  }

  public static void existsInEntityReferenceList(List<EntityReference> list, UUID id, boolean expectedExistsInList) {
    EntityReference ref = null;
    for (EntityReference r : list) {
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
  public static void existsInEntityReferenceList(List<EntityReference> list, String fqn, boolean expectedExistsInList) {
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
      Assertions.assertFalse(value.isEmpty(), "List at index " + index + "is empty");
      index++;
    }
  }

  public static <T> boolean validateAlphabeticalOrdering(List<T> list, Comparator<T> comparator) {
    Iterator<T> iterator = listOrEmpty(list).iterator();
    if (!iterator.hasNext()) {
      return true;
    }
    T prev = iterator.next();
    while (iterator.hasNext()) {
      T next = iterator.next();
      if (comparator.compare(prev, next) > 0) {
        return false;
      }
      prev = next;
    }
    return true;
  }

  public static Long dateToTimestamp(String dateStr) throws ParseException {
    DateFormat formatter = new SimpleDateFormat("yyyy-MM-dd");
    Date date = formatter.parse(dateStr);
    return date.getTime();
  }

  public static <T> String getEntityNameLengthError(Class<T> clazz) {
    try {
      Field field = clazz.getDeclaredField("name");
      Size size = field.getAnnotation(Size.class);
      return String.format("[name size must be between %d and %d]", size.min(), size.max());
    } catch (NoSuchFieldException e) {
      LOG.warn("Failed to find constraints for the entity {}", clazz.getSimpleName(), e);
    }
    return null;
  }
}
