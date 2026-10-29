package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.TestCaseResolutionStatusTimeSeriesDAO;

/**
 * Executes the time-series listing SQL against the real migrated schema. A mocked test cannot
 * catch a listing whose WHERE references a column or join alias the table does not have (the
 * incident listing's testCaseEntityFQN alias, a deleted clause on a table without a deleted
 * column), so every listing shape runs here against a real database.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class TestCaseResolutionStatusTimeSeriesListingIT {

  /** The workflow instance table, reached through the base EntityTimeSeriesDAO defaults. */
  public interface WorkflowInstanceSeriesDao extends EntityTimeSeriesDAO {
    @Override
    default String getTimeSeriesTableName() {
      return "workflow_instance_time_series";
    }
  }

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

  @Test
  void baseTimeSeries_latestWithoutRangeReturnsOneRowPerPartition(TestNamespace ns) {
    EntityTimeSeriesDAO dao =
        TestSuiteBootstrap.getJdbi().onDemand(WorkflowInstanceSeriesDao.class);
    String entityFQN = "ns-%s-wfInstances".formatted(ns.shortPrefix());
    long older = System.currentTimeMillis();
    long newer = older + 10_000;
    // BindFQN hashes the FQN it is given, so the seed inserts the FQN, not a hash.
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

    ListFilter filter = new ListFilter(Include.ALL);
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
    var client = SdkClients.adminClient();
    String id = ns.shortPrefix();

    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("sv" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("sc" + id, ns, service);
    Table table =
        TableTestFactory.createSimpleWithName("tbl" + id, ns, schema.getFullyQualifiedName());
    var testCase =
        TestCaseBuilder.create(client)
            .name("tc" + id)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    TestCaseResolutionStatusTimeSeriesDAO dao =
        TestSuiteBootstrap.getJdbi().onDemand(TestCaseResolutionStatusTimeSeriesDAO.class);
    UUID stateId = UUID.randomUUID();
    long older = System.currentTimeMillis();
    long newer = older + 10_000;
    dao.insert(
        testCase.getFullyQualifiedName(),
        "testCaseResolutionStatus",
        seriesJson(
            UUID.randomUUID(),
            older,
            Map.of("stateId", stateId.toString(), "testCaseResolutionStatusType", "New")));
    dao.insert(
        testCase.getFullyQualifiedName(),
        "testCaseResolutionStatus",
        seriesJson(
            UUID.randomUUID(),
            newer,
            Map.of("stateId", stateId.toString(), "testCaseResolutionStatusType", "Resolved")));

    ListFilter origin =
        new ListFilter(Include.ALL).addQueryParam("originEntityFQN", table.getFullyQualifiedName());

    List<String> latest = dao.listWithOffset(origin, 10, 0, true);
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
            .addQueryParam("originEntityFQN", table.getFullyQualifiedName())
            .addQueryParam("testCaseResolutionStatusType", "New");
    assertEquals(
        List.of(),
        dao.listWithOffset(newOnlyList, 10, 0, true),
        "the outer cond ranks the latest record, not the records ranked from");

    ListFilter newOnlyCount =
        new ListFilter(Include.ALL)
            .addQueryParam("originEntityFQN", table.getFullyQualifiedName())
            .addQueryParam("testCaseResolutionStatusType", "New");
    assertEquals(0, dao.listCount(newOnlyCount, true));

    List<String> plain = dao.listWithOffset(origin, 10, 0, false);
    assertEquals(2, plain.size(), "without latest, every revision of the chain is listed");

    List<String> ranged = dao.listWithOffset(origin, 10, 0, older - 1, older + 1, true);
    assertEquals("New", series(ranged.getFirst()).get("testCaseResolutionStatusType"));
    assertEquals(1, dao.listCount(origin, older - 1, older + 1, true));
  }
}
