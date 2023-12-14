package org.openmetadata.service.migration.utils.v130;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.json.JsonObject;
import javax.json.JsonString;
import lombok.extern.slf4j.Slf4j;
import org.apache.johnzon.core.JsonLongImpl;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Query;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.TestCaseFailureReasonType;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.JsonUtils;
import org.postgresql.util.PGobject;

@Slf4j
public class MigrationUtil {
  private static final String TEST_CASE_LIST_QUERY =
      "SELECT json FROM test_case ORDER BY name LIMIT :limit OFFSET :offset";

  private MigrationUtil() {
    /* Cannot create object  util class*/
  }

  /**
   * Migrate the latest test case incident status to the new API. The older ones will be deleted
   *
   * @param collectionDAO CollectionDAO object to interact with the database
   * @param limit Number of entities to be fetched in one go
   */
  public static void migrateTestCaseIncidentStatus(Handle handle, CollectionDAO collectionDAO, int limit) {
    boolean isNextPage = true;
    int offset = 0;
    JsonObject jsonObject;

    while (isNextPage) {
      try {
        Query query = handle.createQuery(TEST_CASE_LIST_QUERY).bind("offset", offset).bind("limit", limit);
        List<Map<String, Object>> jsons = query.mapToMap().list();
        for (int i = 0; i < jsons.size(); i++) {
          Map<String, Object> legacyTestCase = jsons.get(i);
          if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
            jsonObject = JsonUtils.readJson((String) legacyTestCase.get("json")).asJsonObject();
          } else {
            PGobject pgObject = (PGobject) legacyTestCase.get("json");
            jsonObject = JsonUtils.readJson(pgObject.getValue()).asJsonObject();
          }
          processTestIncidentStatusRow(jsonObject, collectionDAO);
        }

        if (jsons.size() < limit) { // If extra result exists, then next page exists - return after cursor
          isNextPage = false;
        } else {
          // If the size of the entities is less than or equal to the limit, then we reached the last page
          offset = offset + limit;
        }
      } catch (Exception e) {
        LOG.error("Error while migrating test case incident status", e);
        isNextPage = false;
      }
    }
  }

  private static void processTestIncidentStatusRow(@NotNull JsonObject row, CollectionDAO collectionDAO) {
    JsonObject testCaseResult = (JsonObject) row.get("testCaseResult");
    if (testCaseResult == null) return;
    JsonObject testCaseFailureStatus = (JsonObject) testCaseResult.get("testCaseFailureStatus");
    if (testCaseFailureStatus == null) return;
    insertTestCaseResolutionStatusRecord(row, testCaseFailureStatus, collectionDAO);
  }

  private static void insertTestCaseResolutionStatusRecord(
      @NotNull JsonObject row, JsonObject testCaseFailureStatus, CollectionDAO collectionDAO) {
    // Get Status
    TestCaseResolutionStatusTypes testCaseResolutionStatusType =
        TestCaseResolutionStatusTypes.valueOf(
            ((JsonString) testCaseFailureStatus.get("testCaseFailureStatusType")).getString());

    // Get UpdatedBy
    JsonString jsonString = ((JsonString) testCaseFailureStatus.get("updatedBy"));
    String updatedBy = jsonString != null ? jsonString.getString() : null;
    EntityReference updatedByEntityReference = null;
    if (updatedBy != null) {
      User user = collectionDAO.userDAO().findEntityByName(updatedBy, Include.ALL);
      if (user != null) updatedByEntityReference = user.getEntityReference();
    }

    EntityReference testCaseEntityReference =
        new EntityReference()
            .withId(UUID.fromString(((JsonString) row.get("id")).getString()))
            .withFullyQualifiedName(((JsonString) row.get("fullyQualifiedName")).getString())
            .withName(((JsonString) row.get("name")).getString())
            .withType("testCase");

    TestCaseResolutionStatus testCaseResolutionStatus =
        new TestCaseResolutionStatus()
            .withId(UUID.randomUUID())
            .withStateId(UUID.randomUUID())
            .withUpdatedAt(((JsonLongImpl) testCaseFailureStatus.get("updatedAt")).longValue())
            .withUpdatedBy(updatedByEntityReference)
            .withTestCaseResolutionStatusType(testCaseResolutionStatusType)
            .withTestCaseReference(testCaseEntityReference)
            .withTimestamp(((JsonLongImpl) testCaseFailureStatus.get("updatedAt")).longValue());

    if (testCaseResolutionStatusType.equals(TestCaseResolutionStatusTypes.Resolved)) {
      insertResolvedTestCaseResolutionStatusRecord(
          testCaseResolutionStatus,
          updatedByEntityReference,
          testCaseEntityReference.getFullyQualifiedName(),
          collectionDAO,
          testCaseFailureStatus);
    } else {
      collectionDAO
          .testCaseResolutionStatusTimeSeriesDao()
          .insert(
              testCaseEntityReference.getFullyQualifiedName(),
              "testCaseResolutionStatus",
              JsonUtils.pojoToJson(testCaseResolutionStatus));
    }
  }

  private static void insertResolvedTestCaseResolutionStatusRecord(
      TestCaseResolutionStatus testCaseResolutionStatus,
      EntityReference updatedByEntityReference,
      String testCaseFQN,
      CollectionDAO collectionDAO,
      JsonObject testCaseFailureStatus) {

    testCaseResolutionStatus.withTestCaseResolutionStatusDetails(
        new Resolved()
            .withTestCaseFailureComment(((JsonString) testCaseFailureStatus.get("testCaseFailureComment")).getString())
            .withTestCaseFailureReason(
                TestCaseFailureReasonType.valueOf(
                    ((JsonString) testCaseFailureStatus.get("testCaseFailureReason")).getString()))
            .withResolvedBy(updatedByEntityReference));

    collectionDAO
        .testCaseResolutionStatusTimeSeriesDao()
        .insert(testCaseFQN, "testCaseResolutionStatus", JsonUtils.pojoToJson(testCaseResolutionStatus));
  }
}
