package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.core.type.TypeReference;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.TestCaseResolutionStatusTimeSeriesDAO;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Executes the time-series listing SQL against the real migrated schema. A mocked test cannot
 * catch a listing whose WHERE references a column or join alias the table does not have (the
 * incident listing's testCaseEntityFQN alias, a deleted clause on a table without a deleted
 * column), so every listing shape runs here against a real database — the DAO paths directly, and
 * the incident listing also over REST, which pins the deletion-scoping contract of
 * ADR:2026-10-29-incident-listing-test-case-deletion-scoping-is-qualified.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class TestCaseResolutionStatusTimeSeriesListingIT {

  private static final String INCIDENT_LISTING_PATH =
      "/v1/dataQuality/testCases/testCaseIncidentStatus";

  /** The workflow instance table, reached through the base EntityTimeSeriesDAO defaults. */
  public interface WorkflowInstanceSeriesDao extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "workflow_instance_time_series";
    }
  }

  private record Fixture(Table table, TestCase testCase) {}

  private static String seriesJson(UUID id, long timestamp, Map<String, Object> extra) {
    Map<String, Object> json = new HashMap<>();
    json.put("id", id.toString());
    json.put("timestamp", timestamp);
    json.putAll(extra);
    return JsonUtils.pojoToJson(json);
  }

  private static Map<String, Object> series(String json) {
    return JsonUtils.readValue(json, Map.class);
  }

  private static long timestamp(List<String> jsons, int index) {
    return ((Number) series(jsons.get(index)).get("timestamp")).longValue();
  }

  private static Fixture createIncidentFixture(OpenMetadataClient client, TestNamespace ns) {
    String id = ns.shortPrefix();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("sv" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("sc" + id, ns, service);
    Table table =
        TableTestFactory.createSimpleWithName("tbl" + id, ns, schema.getFullyQualifiedName());
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name("tc" + id)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();
    return new Fixture(table, testCase);
  }

  /** Seeds a resolution revision as production does: the record row (the DAO hashes the FQN it
   * is given) plus the PARENT_OF relationship the listing's field expansion requires — without it
   * a restful listing answers 500 ("does not have expected relationship parentOf") — and the
   * test_case_incident row the date-range filters' stateId subquery reads. */
  private static UUID seedRevision(
      Fixture fixture, UUID stateId, long timestamp, String statusType) {
    UUID recordId = UUID.randomUUID();
    TestCaseResolutionStatusTimeSeriesDAO dao =
        Entity.getCollectionDAO().testCaseResolutionStatusTimeSeriesDao();
    dao.insert(
        fixture.testCase().getFullyQualifiedName(),
        "testCaseResolutionStatus",
        seriesJson(
            recordId,
            timestamp,
            Map.of("stateId", stateId.toString(), "testCaseResolutionStatusType", statusType)));
    dao.upsertIncident(
        stateId.toString(),
        fixture.testCase().getFullyQualifiedName(),
        statusType,
        null,
        null,
        timestamp,
        recordId.toString());
    Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESOLUTION_STATUS)
        .addRelationship(
            fixture.testCase().getId(),
            recordId,
            Entity.TEST_CASE,
            Entity.TEST_CASE_RESOLUTION_STATUS,
            Relationship.PARENT_OF,
            null,
            false);
    return recordId;
  }

  private static void softDeleteTestCase(OpenMetadataClient client, TestCase testCase) {
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/dataQuality/testCases/" + testCase.getId() + "?recursive=true&hardDelete=false",
            null,
            RequestOptions.builder().build());
  }

  private static Boolean testCaseDeleted(UUID testCaseId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            h ->
                h.createQuery("SELECT deleted FROM test_case WHERE id = :id")
                    .bind("id", testCaseId.toString())
                    .mapTo(Boolean.class)
                    .findOne()
                    .orElse(null));
  }

  private static ListFilter originFilter(String tableFqn, Include include) {
    return new ListFilter(include).addQueryParam("originEntityFQN", tableFqn);
  }

  @Test
  void baseTimeSeries_latestWithoutRangeReturnsOneRowPerPartition(TestNamespace ns) {
    EntityTimeSeriesDAO dao =
        TestSuiteBootstrap.getJdbi().onDemand(WorkflowInstanceSeriesDao.class);
    String entityFQN = "ns-%s-wfInstances".formatted(ns.shortPrefix());
    long older = System.currentTimeMillis();
    long newer = older + 10_000;
    // BindFQN hashes the FQN it is given, so the seed inserts the FQN, not a hash. The
    // entityFQNHash param is pre-hashed in turn: the same hash the repository listings filter by.
    dao.insert(
        entityFQN,
        "workflowInstance",
        seriesJson(
            UUID.randomUUID(),
            older,
            Map.of(
                "status",
                "FINISHED",
                "workflowDefinitionId",
                "wfdef-" + ns.shortPrefix(),
                "startedAt",
                older)));
    dao.insert(
        entityFQN,
        "workflowInstance",
        seriesJson(
            UUID.randomUUID(),
            newer,
            Map.of(
                "status",
                "RUNNING",
                "workflowDefinitionId",
                "wfdef-" + ns.shortPrefix(),
                "startedAt",
                newer)));

    ListFilter filter =
        new ListFilter(Include.ALL)
            .addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(entityFQN));
    List<String> plain = dao.listWithOffset(filter, 10, 0);
    assertEquals(2, plain.size(), "the plain listing returns every revision");
    assertEquals(newer, timestamp(plain, 0), "revisions order by timestamp DESC");

    List<String> latest = dao.listWithOffset(filter, 10, 0, true);
    assertEquals(
        1, latest.size(), "latest must not be voided without a time range: one row per partition");
    assertEquals("RUNNING", series(latest.getFirst()).get("status"), "the latest revision wins");

    assertEquals(1, dao.listCount(filter, true), "total counts partitions, not revisions");
    assertEquals(2, dao.listCount(filter, false));

    List<String> rangedLatest = dao.listWithOffset(filter, 10, 0, older - 1, older + 1, true);
    assertEquals(1, rangedLatest.size());
    assertEquals("FINISHED", series(rangedLatest.getFirst()).get("status"));
    assertEquals(1, dao.listCount(filter, older - 1, older + 1, true));
  }

  @Test
  void incidentTimeSeries_latestWithoutRangeAppliesOriginJoinAndOuterFilter(TestNamespace ns) {
    Fixture fixture = createIncidentFixture(SdkClients.adminClient(), ns);
    UUID stateId = UUID.randomUUID();
    long older = System.currentTimeMillis();
    long newer = older + 10_000;
    seedRevision(fixture, stateId, older, "New");
    seedRevision(fixture, stateId, newer, "Resolved");
    String tableFqn = fixture.table().getFullyQualifiedName();

    ListFilter origin = new ListFilter(Include.ALL).addQueryParam("originEntityFQN", tableFqn);

    List<String> latest =
        Entity.getCollectionDAO()
            .testCaseResolutionStatusTimeSeriesDao()
            .listWithOffset(origin, 10, 0, true);
    assertEquals(1, latest.size(), "the origin join matched through the real test_case row");
    assertEquals(
        "Resolved",
        series(latest.getFirst()).get("testCaseResolutionStatusType"),
        "one row per incident, the chain's latest record");

    // The outer filter ranks on the record's own status fields: the incident's latest record is
    // Resolved, so asking for New finds nothing — it must not match through the earlier record.
    // Fresh filters per call: the listing trims the status params off the filter it is given.
    ListFilter newOnlyList =
        new ListFilter(Include.ALL)
            .addQueryParam("originEntityFQN", tableFqn)
            .addQueryParam("testCaseResolutionStatusType", "New");
    assertEquals(
        List.of(),
        Entity.getCollectionDAO()
            .testCaseResolutionStatusTimeSeriesDao()
            .listWithOffset(newOnlyList, 10, 0, true),
        "the outer cond ranks the latest record, not the records ranked from");

    ListFilter newOnlyCount =
        new ListFilter(Include.ALL)
            .addQueryParam("originEntityFQN", tableFqn)
            .addQueryParam("testCaseResolutionStatusType", "New");
    assertEquals(
        0,
        Entity.getCollectionDAO()
            .testCaseResolutionStatusTimeSeriesDao()
            .listCount(newOnlyCount, true));

    List<String> plain =
        Entity.getCollectionDAO()
            .testCaseResolutionStatusTimeSeriesDao()
            .listWithOffset(origin, 10, 0, false);
    assertEquals(2, plain.size(), "without latest, every revision of the chain is listed");

    List<String> ranged =
        Entity.getCollectionDAO()
            .testCaseResolutionStatusTimeSeriesDao()
            .listWithOffset(origin, 10, 0, older - 1, older + 1, true);
    assertEquals("New", series(ranged.getFirst()).get("testCaseResolutionStatusType"));
    assertEquals(
        1,
        Entity.getCollectionDAO()
            .testCaseResolutionStatusTimeSeriesDao()
            .listCount(origin, older - 1, older + 1, true));

    // The incident date-range filter rides the same condition path as a stateId subquery on
    // test_case_incident (seeded alongside the records): over the whole incident it answers its
    // latest record; past its updatedAt it answers none.
    ListFilter dateRanged =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam("originEntityFQN", tableFqn)
            .addQueryParam("incidentListDateField", "updatedAt")
            .addQueryParam("incidentListStartTs", "0")
            .addQueryParam("incidentListEndTs", String.valueOf(newer + 1_000));
    List<String> dateRangedLatest =
        Entity.getCollectionDAO()
            .testCaseResolutionStatusTimeSeriesDao()
            .listWithOffset(dateRanged, 10, 0, true);
    assertEquals(
        1,
        dateRangedLatest.size(),
        "the date filter's stateId subquery matched the seeded incident");

    // Over REST, the same shape: latest without a time range, page total matching the DAO count.
    String encodedFQN =
        URLEncoder.encode(fixture.testCase().getFullyQualifiedName(), StandardCharsets.UTF_8);
    Map<String, Object> latestPage =
        getJson(
            SdkClients.adminClient(),
            INCIDENT_LISTING_PATH + "?testCaseFQN=" + encodedFQN + "&latest=true&limit=10");
    assertEquals(1, data(latestPage).size());
    assertEquals(1, total(latestPage), "the REST listing's total is the partition count");

    // Over REST with the date filter: the subquery path answers the same incident.
    Map<String, Object> datePage =
        getJson(
            SdkClients.adminClient(),
            INCIDENT_LISTING_PATH
                + "?testCaseFQN="
                + encodedFQN
                + "&latest=true&dateField=updatedAt&startTs=0&endTs="
                + (newer + 1_000_000));
    assertEquals(1, total(datePage), "the date filter finds the seeded incident");
  }

  @Test
  void incidentListing_overRest_softDeletedTestCasesAreExcludedByDefault(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Fixture fixture = createIncidentFixture(client, ns);
    UUID stateId = UUID.randomUUID();
    seedRevision(fixture, stateId, System.currentTimeMillis(), "Resolved");
    String encodedFQN =
        URLEncoder.encode(fixture.testCase().getFullyQualifiedName(), StandardCharsets.UTF_8);

    Map<String, Object> defaultListing =
        getJson(client, INCIDENT_LISTING_PATH + "?testCaseFQN=" + encodedFQN + "&latest=true");
    assertEquals(1, total(defaultListing));

    // include is honored (ADR:2026-10-29-incident-listing-test-case-deletion-scoping-is-qualified):
    // deleted test cases carry no incidents while they live, all does.
    assertEquals(
        0,
        total(
            getJson(
                client,
                INCIDENT_LISTING_PATH
                    + "?testCaseFQN="
                    + encodedFQN
                    + "&latest=true&include=deleted")),
        "include=deleted finds no incidents while the test case lives");
    assertEquals(
        1,
        total(
            getJson(
                client,
                INCIDENT_LISTING_PATH
                    + "?testCaseFQN="
                    + encodedFQN
                    + "&latest=true&include=all")));

    // A soft-deleted test case keeps its records: the default hides them (the join's tc.deleted
    // scoping, or the indexed EXISTS without the join), include=deleted and include=all still
    // list them. The scoping is always a qualified predicate, never the unqualified clause the
    // old code parked on the implicit join.
    softDeleteTestCase(client, fixture.testCase());
    Map<String, Object> afterDelete =
        getJson(client, INCIDENT_LISTING_PATH + "?testCaseFQN=" + encodedFQN + "&latest=true");
    // The case is genuinely soft-deleted, so the exclusion is the scoping, not a vanished row.
    assertEquals(
        Boolean.TRUE, testCaseDeleted(fixture.testCase().getId()), "the test case is soft-deleted");
    assertEquals(0, total(afterDelete), "incidents of a soft-deleted test case are excluded");
    assertEquals(
        1,
        total(
            getJson(
                client,
                INCIDENT_LISTING_PATH
                    + "?testCaseFQN="
                    + encodedFQN
                    + "&latest=true&include=deleted")),
        "incidents of a soft-deleted test case are listed under include=deleted");
    assertEquals(
        1,
        total(
            getJson(
                client,
                INCIDENT_LISTING_PATH + "?testCaseFQN=" + encodedFQN + "&latest=true&include=all")),
        "incidents of a soft-deleted test case are listed under include=all");
  }

  /**
   * The originEntityFQN predicate needs the test_case join, so its deletion scoping rides that
   * join as a qualified tc.deleted clause instead of the indexed EXISTS the testCaseFQN path
   * uses. A soft-deleted test case keeps its test_case row and its incident records, so the join
   * still matches and only the include-derived clause filters.
   */
  @Test
  void incidentListing_originEntityFQNScopesDeletedTestCasesThroughTheJoin(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Fixture fixture = createIncidentFixture(client, ns);
    long timestamp = System.currentTimeMillis();
    seedRevision(fixture, UUID.randomUUID(), timestamp, "Resolved");
    String tableFqn = fixture.table().getFullyQualifiedName();

    softDeleteTestCase(client, fixture.testCase());
    assertEquals(
        Boolean.TRUE, testCaseDeleted(fixture.testCase().getId()), "the test case is soft-deleted");

    TestCaseResolutionStatusTimeSeriesDAO dao =
        Entity.getCollectionDAO().testCaseResolutionStatusTimeSeriesDao();

    // No-range latest listing: the join rider is the only deletion scope on the query.
    assertEquals(
        0,
        dao.listWithOffset(originFilter(tableFqn, Include.NON_DELETED), 10, 0, true).size(),
        "the default scope hides incidents of a soft-deleted test case");
    assertEquals(0, dao.listCount(originFilter(tableFqn, Include.NON_DELETED), true));
    assertEquals(
        1,
        dao.listWithOffset(originFilter(tableFqn, Include.DELETED), 10, 0, true).size(),
        "include=deleted lists incidents of the soft-deleted test case");
    assertEquals(1, dao.listCount(originFilter(tableFqn, Include.DELETED), true));
    assertEquals(1, dao.listWithOffset(originFilter(tableFqn, Include.ALL), 10, 0, true).size());
    assertEquals(1, dao.listCount(originFilter(tableFqn, Include.ALL), true));

    // The ranged shape shares incidentCondition, so it carries the same qualified scope.
    assertEquals(
        0,
        dao.listCount(
            originFilter(tableFqn, Include.NON_DELETED),
            timestamp - 1_000,
            timestamp + 1_000,
            true));
    assertEquals(
        1,
        dao.listCount(
            originFilter(tableFqn, Include.DELETED), timestamp - 1_000, timestamp + 1_000, true));

    // Over REST, originEntityFQN without testCaseFQN reaches the join rider too.
    String encodedTableFqn = URLEncoder.encode(tableFqn, StandardCharsets.UTF_8);
    Map<String, Object> nonDeleted =
        getJson(
            client,
            INCIDENT_LISTING_PATH
                + "?originEntityFQN="
                + encodedTableFqn
                + "&latest=true&include=non-deleted");
    assertEquals(0, data(nonDeleted).size());
    assertEquals(0, total(nonDeleted));
    Map<String, Object> deleted =
        getJson(
            client,
            INCIDENT_LISTING_PATH
                + "?originEntityFQN="
                + encodedTableFqn
                + "&latest=true&include=deleted");
    assertEquals(1, data(deleted).size());
    assertEquals(1, total(deleted), "include=deleted lists the soft-deleted test case's incidents");
    Map<String, Object> all =
        getJson(
            client,
            INCIDENT_LISTING_PATH
                + "?originEntityFQN="
                + encodedTableFqn
                + "&latest=true&include=all");
    assertEquals(1, data(all).size());
    assertEquals(1, total(all));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> getJson(OpenMetadataClient client, String pathWithQuery) {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, pathWithQuery, null, RequestOptions.builder().build());
    return JsonUtils.readValue(response, new TypeReference<Map<String, Object>>() {});
  }

  @SuppressWarnings("unchecked")
  private static List<Object> data(Map<String, Object> page) {
    return (List<Object>) page.get("data");
  }

  private static int total(Map<String, Object> page) {
    return ((Number) ((Map<String, Object>) page.get("paging")).get("total")).intValue();
  }
}
