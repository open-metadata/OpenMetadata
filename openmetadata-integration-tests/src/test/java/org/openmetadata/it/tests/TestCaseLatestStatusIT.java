package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * A test case's current status (stored on the test case and copied into its search document) must
 * follow its newest result by timestamp, whatever order results are written or deleted in. Reads
 * here deliberately avoid {@code fields=testCaseResult}: that field is rebuilt from the results
 * table on read, so it looks right even when the stored status is stale.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class TestCaseLatestStatusIT {

  private static final Duration SEARCH_TIMEOUT = Duration.ofSeconds(120);
  private static final Duration HOLD = Duration.ofSeconds(5);
  private static final long MINUTE = 60_000L;

  private final OpenMetadataClient client = SdkClients.adminClient();

  @Test
  void anOlderSuccessPostedLateKeepsTheNewerFailureAndItsIncident(TestNamespace ns) {
    Fixture f = fixture(ns, "late_success");
    long now = System.currentTimeMillis();

    postResult(f, now, TestCaseStatus.Failed);
    UUID incident = awaitOpenIncident(f);
    postResult(f, now - MINUTE, TestCaseStatus.Success);

    awaitCurrentStatus(f, TestCaseStatus.Failed);
    await().during(HOLD).atMost(HOLD.plusSeconds(10)).until(() -> incident.equals(incidentId(f)));
  }

  @Test
  void anOlderFailurePostedLateKeepsTheNewerSuccessAndOpensNoIncident(TestNamespace ns) {
    Fixture f = fixture(ns, "late_failure");
    long now = System.currentTimeMillis();

    postResult(f, now, TestCaseStatus.Success);
    postResult(f, now - MINUTE, TestCaseStatus.Failed);

    awaitCurrentStatus(f, TestCaseStatus.Success);
    await().during(HOLD).atMost(HOLD.plusSeconds(10)).until(() -> incidentId(f) == null);
  }

  @Test
  void deletingTheNewestResultFallsBackToThePreviousOne(TestNamespace ns) {
    Fixture f = fixture(ns, "delete_newest");
    long now = System.currentTimeMillis();
    postResult(f, now - MINUTE, TestCaseStatus.Failed);
    postResult(f, now, TestCaseStatus.Success);
    awaitCurrentStatus(f, TestCaseStatus.Success);

    client.testCaseResults().delete(f.fqn(), now);

    awaitCurrentStatus(f, TestCaseStatus.Failed);
  }

  @Test
  void deletingTheOnlyResultClearsTheStatus(TestNamespace ns) {
    Fixture f = fixture(ns, "delete_only");
    long now = System.currentTimeMillis();
    postResult(f, now, TestCaseStatus.Failed);
    awaitCurrentStatus(f, TestCaseStatus.Failed);

    client.testCaseResults().delete(f.fqn(), now);

    await()
        .atMost(SEARCH_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              assertNull(storedStatus(f));
              TestCase indexed = indexedTestCase(f).orElseThrow();
              assertNull(indexed.getTestCaseStatus());
              assertNull(indexed.getTestCaseResult());
            });
  }

  @Test
  void deletingOrPatchingAnOlderResultChangesNothing(TestNamespace ns) {
    Fixture f = fixture(ns, "older_edits");
    long now = System.currentTimeMillis();
    postResult(f, now - MINUTE, TestCaseStatus.Failed);
    postResult(f, now, TestCaseStatus.Success);
    awaitCurrentStatus(f, TestCaseStatus.Success);
    Double version = client.testCases().getByName(f.fqn()).getVersion();

    client
        .testCaseResults()
        .patch(
            f.fqn(),
            now - MINUTE,
            JsonUtils.readTree("[{\"op\":\"replace\",\"path\":\"/result\",\"value\":\"edited\"}]"));
    client.testCaseResults().delete(f.fqn(), now - MINUTE);

    awaitCurrentStatus(f, TestCaseStatus.Success);
    await()
        .during(HOLD)
        .atMost(HOLD.plusSeconds(10))
        .until(() -> version.equals(client.testCases().getByName(f.fqn()).getVersion()));
  }

  @Test
  void aNewerResultWithTheSameStatusStillRefreshesTheSearchDocument(TestNamespace ns) {
    Fixture f = fixture(ns, "same_status");
    long now = System.currentTimeMillis();
    postResult(f, now - MINUTE, TestCaseStatus.Success);
    postResult(f, now, TestCaseStatus.Success);

    await()
        .atMost(SEARCH_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              TestCaseResult indexed = indexedTestCase(f).orElseThrow().getTestCaseResult();
              assertNotNull(indexed);
              assertEquals(now, indexed.getTimestamp());
            });
  }

  private record Fixture(Table table, TestCase testCase) {
    String fqn() {
      return testCase.getFullyQualifiedName();
    }
  }

  private Fixture fixture(TestNamespace ns, String name) {
    Table table = ShortStackFactory.table(ns);
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix(name))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();
    return new Fixture(table, testCase);
  }

  private void postResult(Fixture f, long timestamp, TestCaseStatus status) {
    client
        .testCaseResults()
        .create(
            f.fqn(),
            new CreateTestCaseResult()
                .withTimestamp(timestamp)
                .withTestCaseStatus(status)
                .withResult(status.value()));
  }

  /** The status in the entity row and in the search document must both match. */
  private void awaitCurrentStatus(Fixture f, TestCaseStatus expected) {
    await()
        .atMost(SEARCH_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              assertEquals(expected, storedStatus(f));
              assertEquals(expected, indexedTestCase(f).orElseThrow().getTestCaseStatus());
              assertEquals(
                  List.of(f.testCase().getName()), namesListedWithStatus(f, expected.value()));
            });
  }

  private TestCaseStatus storedStatus(Fixture f) {
    return client.testCases().getByName(f.fqn()).getTestCaseStatus();
  }

  private Optional<TestCase> indexedTestCase(Fixture f) {
    return searchTestCases(f, null).stream()
        .filter(tc -> tc.getName().equals(f.testCase().getName()))
        .findFirst();
  }

  private List<String> namesListedWithStatus(Fixture f, String status) {
    return searchTestCases(f, status).stream().map(TestCase::getName).toList();
  }

  private List<TestCase> searchTestCases(Fixture f, String status) {
    RequestOptions.Builder options =
        RequestOptions.builder()
            .queryParam("entityLink", "<#E::table::" + f.table().getFullyQualifiedName() + ">")
            .queryParam("includeAllTests", "true")
            .queryParam("limit", "100");
    if (status != null) {
      options.queryParam("testCaseStatus", status);
    }
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/dataQuality/testCases/search/list", null, options.build());
    return JsonUtils.readValue(response, new TypeReference<ResultList<TestCase>>() {}).getData();
  }

  private UUID incidentId(Fixture f) {
    return client.testCases().getByName(f.fqn(), "incidentId").getIncidentId();
  }

  private UUID awaitOpenIncident(Fixture f) {
    await()
        .atMost(SEARCH_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(() -> incidentId(f) != null);
    return incidentId(f);
  }
}
