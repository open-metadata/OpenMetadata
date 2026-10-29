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
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Executes the time-series listing SQL against the real migrated schema. A mocked test cannot
 * catch a listing whose WHERE references a column or join alias the table does not have (the
 * incident listing's testCaseEntityFQN alias, a deleted clause on a table without a deleted
 * column), so every listing shape runs here against a real database — the DAO paths directly, and
 * the incident listing also over REST, which is the contract the
 * ADR:2026-10-29-incident-listing-include-deprecated record changes.
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
   * a restful listing answers 500 ("does not have expected relationship parentOf"). */
  private static void seedRevision(
      Fixture fixture, UUID stateId, long timestamp, String statusType) {
    UUID recordId = UUID.randomUUID();
    Entity.getCollectionDAO()
        .testCaseResolutionStatusTimeSeriesDao()
        .insert(
            fixture.testCase().getFullyQualifiedName(),
            "testCaseResolutionStatus",
            seriesJson(
                recordId,
                timestamp,
                Map.of("stateId", stateId.toString(), "testCaseResolutionStatusType", statusType)));
    Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESOLUTION_STATUS)
        .addRelationship(
            fixture.testCase().getId(),
            recordId,
            Entity.TEST_CASE,
            Entity.TEST_CASE_RESOLUTION_STATUS,
            Relationship.PARENT_OF,
            null,
            false);
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

    // Over REST, the same shape: latest without a time range, page total matching the DAO count.
    String encodedFQN =
        URLEncoder.encode(fixture.testCase().getFullyQualifiedName(), StandardCharsets.UTF_8);
    Map<String, Object> latestPage =
        getJson(
            SdkClients.adminClient(),
            INCIDENT_LISTING_PATH + "?testCaseFQN=" + encodedFQN + "&latest=true&limit=10");
    assertEquals(1, data(latestPage).size());
    assertEquals(1, total(latestPage), "the REST listing's total is the partition count");
  }

  @Test
  void incidentListing_overRest_softDeletedTestCasesAreAlwaysExcluded(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Fixture fixture = createIncidentFixture(client, ns);
    UUID stateId = UUID.randomUUID();
    seedRevision(fixture, stateId, System.currentTimeMillis(), "Resolved");
    String encodedFQN =
        URLEncoder.encode(fixture.testCase().getFullyQualifiedName(), StandardCharsets.UTF_8);

    Map<String, Object> defaultListing =
        getJson(client, INCIDENT_LISTING_PATH + "?testCaseFQN=" + encodedFQN + "&latest=true");
    assertEquals(1, total(defaultListing));

    // The deprecated include parameter has no effect: an explicit include=deleted answers the
    // same listing (ADR:2026-10-29-incident-listing-include-deprecated).
    Map<String, Object> includeDeleted =
        getJson(
            client,
            INCIDENT_LISTING_PATH + "?testCaseFQN=" + encodedFQN + "&latest=true&include=deleted");
    assertEquals(total(defaultListing), total(includeDeleted), "include has no effect here");

    // A soft-deleted test case keeps its records, but the join's tc.deleted scoping hides them
    // by default — the same scoping the incidentGroups summary SQL hardcodes.
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/dataQuality/testCases/"
                + fixture.testCase().getId()
                + "?recursive=true&hardDelete=false",
            null,
            RequestOptions.builder().build());
    Map<String, Object> afterDelete =
        getJson(client, INCIDENT_LISTING_PATH + "?testCaseFQN=" + encodedFQN + "&latest=true");
    // The case is genuinely soft-deleted, so the exclusion is the scoping, not a vanished row.
    Boolean deletedProbe =
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                h ->
                    h.createQuery("SELECT deleted FROM test_case WHERE id = :id")
                        .bind("id", fixture.testCase().getId().toString())
                        .mapTo(Boolean.class)
                        .findOne()
                        .orElse(null));
    assertEquals(Boolean.TRUE, deletedProbe, "the test case is soft-deleted");
    assertEquals(0, total(afterDelete), "incidents of a soft-deleted test case are excluded");
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
