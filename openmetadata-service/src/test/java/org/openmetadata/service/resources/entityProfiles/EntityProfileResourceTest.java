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

package org.openmetadata.service.resources.entityProfiles;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.dateToTimestamp;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URISyntaxException;
import java.text.ParseException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateEntityProfile;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.DmlOperationType;
import org.openmetadata.schema.type.EntityProfile;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.SystemProfile;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableConstraint.ConstraintType;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Execution(ExecutionMode.SAME_THREAD)
public class EntityProfileResourceTest extends OpenMetadataApplicationTest {

  public static Table TEST_TABLE;
  public static Table PII_TEST_TABLE;
  public static final String COLLECTION_PATH = "entity/profiles";

  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test); // Ensure tableResourceTest is set up

    // Create test table without PII
    CreateTable createTable = tableResourceTest.createRequest("testTable", "", "", null);
    createTable.setColumns(
        listOf(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(50),
            new Column().withName("age").withDataType(ColumnDataType.INT)));
    // Set table constraints to match the new columns
    createTable.setTableConstraints(
        listOf(
            new TableConstraint()
                .withConstraintType(ConstraintType.UNIQUE)
                .withColumns(listOf("id"))));
    TEST_TABLE = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Create test table with PII column
    CreateTable createPiiTable = tableResourceTest.createRequest("piiTestTable", "", "", null);
    Column piiColumn =
        new Column()
            .withName("email")
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(100)
            .withTags(listOf(new TagLabel().withTagFQN("PII.Sensitive")));

    createPiiTable.setColumns(
        listOf(
            new Column().withName("userId").withDataType(ColumnDataType.BIGINT),
            piiColumn,
            new Column().withName("lastLogin").withDataType(ColumnDataType.TIMESTAMP)));
    // Set table constraints to match the new columns for PII table
    createPiiTable.setTableConstraints(
        listOf(
            new TableConstraint()
                .withConstraintType(ConstraintType.UNIQUE)
                .withColumns(listOf("userId"))));
    PII_TEST_TABLE = tableResourceTest.createEntity(createPiiTable, ADMIN_AUTH_HEADERS);
  }

  @Test
  @Order(1)
  void post_tableProfile_200() throws HttpResponseException, ParseException {
    TableProfile tableProfile = new TableProfile().withRowCount(1000.0).withColumnCount(3.0);

    CreateEntityProfile createProfile =
        new CreateEntityProfile()
            .withTimestamp(dateToTimestamp("2023-10-15"))
            .withProfileData(tableProfile)
            .withProfileType(CreateEntityProfile.ProfileTypeEnum.TABLE);

    EntityProfile profile =
        createEntityProfile(TEST_TABLE.getId(), createProfile, ADMIN_AUTH_HEADERS);
    assertNotNull(profile);
    assertEquals(CreateEntityProfile.ProfileTypeEnum.TABLE, profile.getProfileType());
    assertEquals(TEST_TABLE.getEntityReference().getId(), profile.getEntityReference().getId());

    // Verify the profile was correctly written by fetching it back
    ResultList<EntityProfile> profiles =
        getEntityProfiles(
            TEST_TABLE.getFullyQualifiedName(),
            "table",
            dateToTimestamp("2023-10-15"),
            dateToTimestamp("2023-10-15"),
            CreateEntityProfile.ProfileTypeEnum.TABLE,
            ADMIN_AUTH_HEADERS);
    assertNotNull(profiles);
    assertFalse(profiles.getData().isEmpty());
    EntityProfile fetchedProfile = profiles.getData().get(0);
    assertEquals(CreateEntityProfile.ProfileTypeEnum.TABLE, fetchedProfile.getProfileType());
    HashMap fetchedTableProfile = (LinkedHashMap) fetchedProfile.getProfileData();
    assertEquals(1000.0, fetchedTableProfile.get("rowCount"));
    assertEquals(3.0, fetchedTableProfile.get("columnCount"));
  }

  @Test
  @Order(2)
  void post_columnProfile_200() throws HttpResponseException, ParseException {
    ColumnProfile columnProfile =
        new ColumnProfile()
            .withName("name")
            .withValuesCount(950.0)
            .withNullCount(50.0)
            .withDistinctCount(800.0)
            .withUniqueCount(750.0);

    CreateEntityProfile createProfile =
        new CreateEntityProfile()
            .withTimestamp(dateToTimestamp("2023-10-15"))
            .withProfileData(columnProfile)
            .withProfileType(CreateEntityProfile.ProfileTypeEnum.COLUMN);

    EntityProfile profile =
        createEntityProfile(TEST_TABLE.getId(), createProfile, ADMIN_AUTH_HEADERS);
    assertNotNull(profile);
    assertEquals(CreateEntityProfile.ProfileTypeEnum.COLUMN, profile.getProfileType());
    assertEquals(TEST_TABLE.getEntityReference().getId(), profile.getEntityReference().getId());

    // Verify the profile was correctly written by fetching it back
    ResultList<EntityProfile> profiles =
        getEntityProfiles(
            TEST_TABLE.getFullyQualifiedName(),
            "table",
            dateToTimestamp("2023-10-15"),
            dateToTimestamp("2023-10-15"),
            CreateEntityProfile.ProfileTypeEnum.COLUMN,
            ADMIN_AUTH_HEADERS);
    assertNotNull(profiles);
    assertFalse(profiles.getData().isEmpty());

    // Find the "name" column profile
    EntityProfile nameProfile =
        profiles.getData().stream()
            .filter(p -> p.getProfileType() == CreateEntityProfile.ProfileTypeEnum.COLUMN)
            .filter(p -> ((HashMap) p.getProfileData()).get("name").equals("name"))
            .findFirst()
            .orElse(null);

    assertNotNull(nameProfile);
    HashMap fetchedColumnProfile = (LinkedHashMap) nameProfile.getProfileData();
    assertEquals("name", fetchedColumnProfile.get("name"));
    assertEquals(950.0, fetchedColumnProfile.get("valuesCount"));
    assertEquals(50.0, fetchedColumnProfile.get("nullCount"));
    assertEquals(800.0, fetchedColumnProfile.get("distinctCount"));
    assertEquals(750.0, fetchedColumnProfile.get("uniqueCount"));
  }

  @Test
  @Order(3)
  void post_systemProfile_200() throws HttpResponseException, ParseException {
    SystemProfile systemProfile =
        new SystemProfile()
            .withOperation(DmlOperationType.INSERT)
            .withRowsAffected(100)
            .withTimestamp(dateToTimestamp("2023-10-15"));

    CreateEntityProfile createProfile =
        new CreateEntityProfile()
            .withTimestamp(dateToTimestamp("2023-10-15"))
            .withProfileData(systemProfile)
            .withProfileType(CreateEntityProfile.ProfileTypeEnum.SYSTEM);

    EntityProfile profile =
        createEntityProfile(TEST_TABLE.getId(), createProfile, ADMIN_AUTH_HEADERS);
    assertNotNull(profile);
    assertEquals(CreateEntityProfile.ProfileTypeEnum.SYSTEM, profile.getProfileType());
    assertEquals(TEST_TABLE.getEntityReference().getId(), profile.getEntityReference().getId());

    // Verify the profile was correctly written by fetching it back
    ResultList<EntityProfile> profiles =
        getEntityProfiles(
            TEST_TABLE.getFullyQualifiedName(),
            "table",
            dateToTimestamp("2023-10-15"),
            dateToTimestamp("2023-10-15"),
            CreateEntityProfile.ProfileTypeEnum.SYSTEM,
            ADMIN_AUTH_HEADERS);
    assertNotNull(profiles);
    assertFalse(profiles.getData().isEmpty());
    EntityProfile fetchedProfile = profiles.getData().get(0);
    assertEquals(CreateEntityProfile.ProfileTypeEnum.SYSTEM, fetchedProfile.getProfileType());
    HashMap fetchedSystemProfile = (LinkedHashMap) fetchedProfile.getProfileData();
    assertEquals(DmlOperationType.INSERT.toString(), fetchedSystemProfile.get("operation"));
    assertEquals(100, fetchedSystemProfile.get("rowsAffected"));
    assertEquals(dateToTimestamp("2023-10-15"), fetchedSystemProfile.get("timestamp"));
  }

  @Test
  @Order(4)
  void get_profileData_withoutPII_200() throws HttpResponseException, ParseException {
    // Add some profile data first
    addSampleProfileData(TEST_TABLE.getId());

    ResultList<EntityProfile> profiles =
        getEntityProfiles(
            TEST_TABLE.getFullyQualifiedName(),
            "table",
            dateToTimestamp("2023-10-10"),
            dateToTimestamp("2023-10-20"),
            null,
            ADMIN_AUTH_HEADERS);

    assertNotNull(profiles);
    assertFalse(profiles.getData().isEmpty());
  }

  @Test
  @Order(5)
  void get_profileData_withPII_adminUser_200() throws HttpResponseException, ParseException {
    // Add PII column profile data
    ColumnProfile piiColumnProfile =
        new ColumnProfile()
            .withName("email")
            .withValuesCount(1000.0)
            .withNullCount(0.0)
            .withDistinctCount(1000.0)
            .withUniqueCount(1000.0);

    CreateEntityProfile createProfile =
        new CreateEntityProfile()
            .withTimestamp(dateToTimestamp("2023-10-15"))
            .withProfileData(piiColumnProfile)
            .withProfileType(CreateEntityProfile.ProfileTypeEnum.COLUMN);

    createEntityProfile(PII_TEST_TABLE.getId(), createProfile, ADMIN_AUTH_HEADERS);

    // Admin user should see unmasked PII data
    ResultList<EntityProfile> profiles =
        getEntityProfiles(
            PII_TEST_TABLE.getFullyQualifiedName(),
            "table",
            dateToTimestamp("2023-10-10"),
            dateToTimestamp("2023-10-20"),
            CreateEntityProfile.ProfileTypeEnum.COLUMN,
            ADMIN_AUTH_HEADERS);

    assertNotNull(profiles);
    assertFalse(profiles.getData().isEmpty());

    // Find the email column profile
    EntityProfile emailProfile =
        profiles.getData().stream()
            .filter(p -> p.getProfileType() == CreateEntityProfile.ProfileTypeEnum.COLUMN)
            .filter(p -> ((HashMap) p.getProfileData()).get("name").equals("email"))
            .findFirst()
            .orElse(null);

    assertNotNull(emailProfile);
    HashMap fetchedEmailProfile = (LinkedHashMap) emailProfile.getProfileData();
    assertEquals("email", fetchedEmailProfile.get("name"));
    assertEquals(1000.0, fetchedEmailProfile.get("valuesCount"));
  }

  @Test
  @Order(6)
  void get_profileData_withPII_regularUser_masked() throws HttpResponseException, ParseException {
    ColumnProfile piiColumnProfile =
        new ColumnProfile()
            .withName("email")
            .withValuesCount(1000.0)
            .withNullCount(0.0)
            .withDistinctCount(1000.0)
            .withUniqueCount(1000.0);

    CreateEntityProfile createProfile =
        new CreateEntityProfile()
            .withTimestamp(dateToTimestamp("2023-10-11"))
            .withProfileData(piiColumnProfile)
            .withProfileType(CreateEntityProfile.ProfileTypeEnum.COLUMN);

    createEntityProfile(PII_TEST_TABLE.getId(), createProfile, ADMIN_AUTH_HEADERS);

    // Regular user should see masked PII data
    ResultList<EntityProfile> profiles =
        getEntityProfiles(
            PII_TEST_TABLE.getFullyQualifiedName(),
            "table",
            dateToTimestamp("2023-10-10"),
            dateToTimestamp("2023-10-20"),
            CreateEntityProfile.ProfileTypeEnum.COLUMN,
            TEST_AUTH_HEADERS);

    assertNotNull(profiles);

    EntityProfile emailProfile =
        profiles.getData().stream()
            .filter(p -> p.getProfileType() == CreateEntityProfile.ProfileTypeEnum.COLUMN)
            .filter(p -> ((HashMap) p.getProfileData()).get("name").equals("email"))
            .findFirst()
            .orElse(null);

    assertNotNull(emailProfile);
    HashMap fetchedEmailProfile = (LinkedHashMap) emailProfile.getProfileData();
    assertNull(fetchedEmailProfile.get("valuesCount"));
  }

  @Test
  @Order(7)
  void get_profileData_byProfileType_200() throws HttpResponseException, ParseException {
    // Test filtering by profile type
    ResultList<EntityProfile> columnProfiles =
        getEntityProfiles(
            TEST_TABLE.getFullyQualifiedName(),
            "table",
            dateToTimestamp("2023-10-10"),
            dateToTimestamp("2023-10-20"),
            CreateEntityProfile.ProfileTypeEnum.COLUMN,
            ADMIN_AUTH_HEADERS);

    assertNotNull(columnProfiles);
    for (EntityProfile profile : columnProfiles.getData()) {
      assertEquals(CreateEntityProfile.ProfileTypeEnum.COLUMN, profile.getProfileType());
    }
  }

  @Test
  @Order(8)
  void post_entityProfile_unauthorizedUser_403() throws ParseException {
    ColumnProfile columnProfile =
        new ColumnProfile().withName("unauthorized_column").withValuesCount(100.0);

    CreateEntityProfile createProfile =
        new CreateEntityProfile()
            .withTimestamp(dateToTimestamp("2023-10-15"))
            .withProfileData(columnProfile)
            .withProfileType(CreateEntityProfile.ProfileTypeEnum.COLUMN);

    assertResponse(
        () -> createEntityProfile(TEST_TABLE.getId(), createProfile, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.EDIT_DATA_PROFILE)));
  }

  @Test
  @Order(9)
  void post_entityProfile_invalidTimestamp_400() throws ParseException {
    ColumnProfile columnProfile =
        new ColumnProfile().withName("test_column").withValuesCount(100.0);

    CreateEntityProfile createProfile =
        new CreateEntityProfile()
            .withTimestamp(-1L) // Invalid timestamp
            .withProfileData(columnProfile)
            .withProfileType(CreateEntityProfile.ProfileTypeEnum.COLUMN);

    assertResponse(
        () -> createEntityProfile(TEST_TABLE.getId(), createProfile, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Timestamp -1 is not valid, it should be in milliseconds since epoch");
  }

  @Test
  @Order(10)
  void delete_entityProfile_200() throws HttpResponseException, ParseException {
    // First create a profile to delete
    TableProfile tableProfile = new TableProfile().withRowCount(500.0).withColumnCount(3.0);

    CreateEntityProfile createProfile =
        new CreateEntityProfile()
            .withTimestamp(dateToTimestamp("2023-10-16"))
            .withProfileData(tableProfile)
            .withProfileType(CreateEntityProfile.ProfileTypeEnum.TABLE);

    createEntityProfile(TEST_TABLE.getId(), createProfile, ADMIN_AUTH_HEADERS);

    // Now delete it
    deleteEntityProfile(
        TEST_TABLE.getFullyQualifiedName(),
        dateToTimestamp("2023-10-16"),
        null,
        ADMIN_AUTH_HEADERS);
  }

  @Test
  @Order(11)
  void delete_entityProfile_byType_200() throws HttpResponseException, ParseException {
    // First create a column profile to delete
    ColumnProfile columnProfile =
        new ColumnProfile().withName("age").withValuesCount(800.0).withNullCount(200.0);

    CreateEntityProfile createProfile =
        new CreateEntityProfile()
            .withTimestamp(dateToTimestamp("2023-10-17"))
            .withProfileData(columnProfile)
            .withProfileType(CreateEntityProfile.ProfileTypeEnum.COLUMN);

    createEntityProfile(TEST_TABLE.getId(), createProfile, ADMIN_AUTH_HEADERS);

    // Now delete by type
    deleteEntityProfile(
        TEST_TABLE.getFullyQualifiedName(),
        dateToTimestamp("2023-10-17"),
        CreateEntityProfile.ProfileTypeEnum.COLUMN,
        ADMIN_AUTH_HEADERS);
  }

  @Test
  @Order(12)
  void get_entityProfile_notFound_404() {
    assertResponse(
        () ->
            getEntityProfiles(
                "nonexistent.table",
                "table",
                0L,
                System.currentTimeMillis(),
                null,
                ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "table instance for nonexistent.table not found");
  }

  @Test
  @Order(9999)
  void delete_profileData_verifyDeletionByTimestamp() throws HttpResponseException, ParseException {
    long baseTimestamp = dateToTimestamp("2024-02-01");
    long dayInMs = 24 * 60 * 60 * 1000L;

    for (int i = 0; i < 5; i++) {
      ColumnProfile columnProfile =
          new ColumnProfile().withName("age").withValuesCount(100.0 + i).withNullCount(10.0);

      CreateEntityProfile createProfile =
          new CreateEntityProfile()
              .withTimestamp(baseTimestamp + (i * dayInMs))
              .withProfileData(columnProfile)
              .withProfileType(CreateEntityProfile.ProfileTypeEnum.COLUMN);

      createEntityProfile(TEST_TABLE.getId(), createProfile, ADMIN_AUTH_HEADERS);
    }

    long cutoffTs = baseTimestamp + (3 * dayInMs);
    int limit = 10000;

    Entity.getCollectionDAO()
        .profilerDataTimeSeriesDao()
        .deleteRecordsBeforeCutOff(cutoffTs, limit);

    ResultList<EntityProfile> remainingProfiles =
        getEntityProfiles(
            TEST_TABLE.getFullyQualifiedName(),
            "table",
            baseTimestamp,
            baseTimestamp + (5 * dayInMs),
            CreateEntityProfile.ProfileTypeEnum.COLUMN,
            ADMIN_AUTH_HEADERS);

    assertNotNull(remainingProfiles);

    for (EntityProfile profile : remainingProfiles.getData()) {
      long profileTimestamp = profile.getTimestamp();
      assertTrue(
          profileTimestamp >= cutoffTs, "All remaining profiles should have timestamps >= cutoff");
    }
  }

  private void addSampleProfileData(UUID tableId) throws HttpResponseException, ParseException {
    // Add table profile
    TableProfile tableProfile = new TableProfile().withRowCount(1000.0).withColumnCount(3.0);

    CreateEntityProfile tableCreateProfile =
        new CreateEntityProfile()
            .withTimestamp(dateToTimestamp("2023-10-15"))
            .withProfileData(tableProfile)
            .withProfileType(CreateEntityProfile.ProfileTypeEnum.TABLE);

    createEntityProfile(tableId, tableCreateProfile, ADMIN_AUTH_HEADERS);

    // Add column profiles
    String[] columnNames = {"id", "name", "age"};
    for (String columnName : columnNames) {
      ColumnProfile columnProfile =
          new ColumnProfile()
              .withName(columnName)
              .withValuesCount(1000.0)
              .withNullCount(0.0)
              .withDistinctCount(800.0);

      CreateEntityProfile columnCreateProfile =
          new CreateEntityProfile()
              .withTimestamp(dateToTimestamp("2023-10-15"))
              .withProfileData(columnProfile)
              .withProfileType(CreateEntityProfile.ProfileTypeEnum.COLUMN);

      createEntityProfile(tableId, columnCreateProfile, ADMIN_AUTH_HEADERS);
    }
  }

  private EntityProfile createEntityProfile(
      UUID entityId, CreateEntityProfile create, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.post(
        getProfileResource("id/table/" + entityId), create, EntityProfile.class, authHeaders);
  }

  private ResultList<EntityProfile> getEntityProfiles(
      String fqn,
      String entityType,
      Long startTs,
      Long endTs,
      CreateEntityProfile.ProfileTypeEnum profileType,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getProfileResource(entityType + "/" + fqn)
            .queryParam("startTs", startTs)
            .queryParam("endTs", endTs);

    if (profileType != null) {
      target = target.queryParam("profileType", profileType.value());
    }

    return TestUtils.get(target, EntityProfileList.class, authHeaders);
  }

  private void deleteEntityProfile(
      String fqn,
      Long timestamp,
      CreateEntityProfile.ProfileTypeEnum profileType,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getProfileResource("name/table/" + fqn + "/" + timestamp);

    if (profileType != null) {
      target = target.queryParam("profileType", profileType);
    }
    TestUtils.delete(target, authHeaders);
  }

  private WebTarget getProfileResource(String path) {
    return getResource(COLLECTION_PATH).path("/" + path);
  }

  public static class EntityProfileList extends ResultList<EntityProfile> {
    // Required for serde
  }
}
