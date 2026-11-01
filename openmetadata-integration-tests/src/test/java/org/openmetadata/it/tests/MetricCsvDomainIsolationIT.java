/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.MetricExpressionLanguage;
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for advisory ANT-2026-3CSN88IX (CWE-863) — the metric CSV export and import
 * paths skipped per-metric authorization (the metric twin of issue #28463, fixed for test cases in
 * #31147).
 *
 * <p>A user holding the seeded {@code DomainOnlyAccessRole} must not read metrics of other domains
 * through the platform-wide CSV export ({@code GET /v1/metrics/name/{name}/export} with {@code
 * name = *}), nor update or create them through {@code PUT /v1/metrics/name/{name}/import}, even
 * though {@code GET /v1/metrics} hides those metrics and the direct read, {@code PATCH} and
 * {@code POST} are refused with 403.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class MetricCsvDomainIsolationIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String PLATFORM_WIDE_EXPORT = "*";
  private static final String DOMAIN_ONLY_ACCESS_ROLE = "DomainOnlyAccessRole";
  private static final String FOREIGN_EXPRESSION =
      "SELECT SUM(bonus) FROM hr.board_compensation WHERE fy = 2026";

  @Test
  void test_exportCsv_domainRestrictedUserCannotReadForeignDomainMetrics(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String shortId = ns.uniqueShortId();
      Domain ownDomain = createDomain(admin, "d1_" + shortId, cleanup);
      Domain foreignDomain = createDomain(admin, "d2_" + shortId, cleanup);
      Metric ownMetric =
          createMetric(admin, "m1_" + shortId, ownDomain, "Clicks per campaign", null, cleanup);
      Metric foreignMetric =
          createMetric(
              admin,
              "m2_" + shortId,
              foreignDomain,
              "Bonus pool of the executive board, 4.2M in FY26",
              FOREIGN_EXPRESSION,
              cleanup);

      OpenMetadataClient restricted =
          createRestrictedUserClient(admin, shortId, ownDomain, cleanup);

      String platformWideCsv = restricted.metrics().exportCsv(PLATFORM_WIDE_EXPORT);
      assertTrue(
          platformWideCsv.contains(ownMetric.getName()),
          "Domain-restricted user must still export their own-domain metric");
      assertFalse(
          platformWideCsv.contains(foreignMetric.getName()),
          "Platform-wide export must NOT leak a foreign-domain metric");
      assertFalse(
          platformWideCsv.contains(FOREIGN_EXPRESSION),
          "Platform-wide export must NOT leak a foreign-domain metric's expression code");

      // Control: the single-metric export is refused outright, as is the direct read.
      assertThrows(
          ForbiddenException.class,
          () -> restricted.metrics().getByName(foreignMetric.getFullyQualifiedName()));
      assertThrows(
          ForbiddenException.class,
          () -> restricted.metrics().exportCsv(foreignMetric.getFullyQualifiedName()));
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void test_importCsv_domainRestrictedUserCannotUpdateForeignDomainMetric(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String shortId = ns.uniqueShortId();
      Domain ownDomain = createDomain(admin, "d1_" + shortId, cleanup);
      Domain foreignDomain = createDomain(admin, "d2_" + shortId, cleanup);
      createMetric(admin, "m1_" + shortId, ownDomain, "Clicks per campaign", null, cleanup);
      Metric foreignMetric =
          createMetric(
              admin,
              "m2_" + shortId,
              foreignDomain,
              "Bonus pool of the executive board, 4.2M in FY26",
              FOREIGN_EXPRESSION,
              cleanup);

      // The row names the foreign metric; only the path name ("*") is the user's own to use.
      String seededCsv = admin.metrics().exportCsv(foreignMetric.getFullyQualifiedName());
      String tamperedCsv =
          seededCsv.replace(
              "Bonus pool of the executive board, 4.2M in FY26", "Tampered by import " + shortId);
      assertNotEquals(
          seededCsv, tamperedCsv, "Test setup must produce a row with a changed description");

      OpenMetadataClient restricted =
          createRestrictedUserClient(admin, shortId, ownDomain, cleanup);
      CsvImportResult result = importAs(restricted, PLATFORM_WIDE_EXPORT, tamperedCsv);

      assertNotEquals(
          ApiStatus.SUCCESS,
          result.getStatus(),
          "Import of an out-of-domain row must not report success: "
              + result.getImportResultsCsv());
      assertTrue(
          result.getNumberOfRowsFailed() >= 1,
          "The foreign-domain row must fail: " + result.getImportResultsCsv());
      assertEquals(
          "Bonus pool of the executive board, 4.2M in FY26",
          admin.metrics().getByName(foreignMetric.getFullyQualifiedName()).getDescription(),
          "The foreign-domain metric must be unchanged");
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void test_importCsv_domainRestrictedUserCannotCreateForeignDomainMetric(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String shortId = ns.uniqueShortId();
      Domain ownDomain = createDomain(admin, "d1_" + shortId, cleanup);
      Domain foreignDomain = createDomain(admin, "d2_" + shortId, cleanup);
      createMetric(admin, "m1_" + shortId, ownDomain, "Clicks per campaign", null, cleanup);
      Metric foreignMetric =
          createMetric(
              admin,
              "m2_" + shortId,
              foreignDomain,
              "Bonus pool of the executive board, 4.2M in FY26",
              FOREIGN_EXPRESSION,
              cleanup);

      // Same foreign row, renamed: the create must be denied even though every column other than
      // the name is a verbatim copy of a metric the admin could create.
      String injectedName = "evil_" + shortId;
      String maliciousCsv =
          admin
              .metrics()
              .exportCsv(foreignMetric.getFullyQualifiedName())
              .replace(foreignMetric.getName(), injectedName);
      assertFalse(
          maliciousCsv.contains("m2_" + shortId),
          "Test setup must produce a row for a new metric name");

      OpenMetadataClient restricted =
          createRestrictedUserClient(admin, shortId, ownDomain, cleanup);
      CsvImportResult result = importAs(restricted, PLATFORM_WIDE_EXPORT, maliciousCsv);

      assertNotEquals(
          ApiStatus.SUCCESS,
          result.getStatus(),
          "Import creating an out-of-domain metric must not report success: "
              + result.getImportResultsCsv());
      List<String> names =
          admin.metrics().list(new ListParams().setLimit(1000)).getData().stream()
              .map(Metric::getName)
              .toList();
      assertFalse(
          names.contains(injectedName),
          "Domain-restricted user must NOT create a metric in a foreign domain");
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void test_importCsv_domainRestrictedUserCanStillWriteOwnDomainMetric(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String shortId = ns.uniqueShortId();
      Domain ownDomain = createDomain(admin, "d1_" + shortId, cleanup);
      Metric ownMetric =
          createMetric(admin, "m1_" + shortId, ownDomain, "Clicks per campaign", null, cleanup);

      String updatedDescription = "Clicks per campaign updated by import " + shortId;
      String csv =
          admin
              .metrics()
              .exportCsv(ownMetric.getFullyQualifiedName())
              .replace("Clicks per campaign", updatedDescription);

      OpenMetadataClient restricted =
          createRestrictedUserClient(admin, shortId, ownDomain, cleanup);
      CsvImportResult result = importAs(restricted, PLATFORM_WIDE_EXPORT, csv);

      assertEquals(
          1,
          result.getNumberOfRowsPassed(),
          "In-domain import must pass: " + result.getImportResultsCsv());
      assertEquals(
          updatedDescription,
          admin.metrics().getByName(ownMetric.getFullyQualifiedName()).getDescription(),
          "Domain-restricted user must still update their own-domain metric by import");
    } finally {
      drain(cleanup);
    }
  }

  private Domain createDomain(OpenMetadataClient admin, String name, Deque<Runnable> cleanup) {
    CreateDomain create =
        new CreateDomain()
            .withName(name)
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Metric CSV domain isolation");
    Domain domain = admin.domains().create(create);
    cleanup.push(() -> admin.domains().delete(domain.getId().toString()));
    return domain;
  }

  private Metric createMetric(
      OpenMetadataClient admin,
      String name,
      Domain domain,
      String description,
      String expression,
      Deque<Runnable> cleanup) {
    CreateMetric create =
        new CreateMetric()
            .withName(name)
            .withDescription(description)
            .withMetricType(MetricType.COUNT)
            .withDomains(List.of(domain.getFullyQualifiedName()));
    if (expression != null) {
      create.withMetricExpression(
          new MetricExpression().withLanguage(MetricExpressionLanguage.SQL).withCode(expression));
    }
    Metric metric = admin.metrics().create(create);
    cleanup.push(() -> admin.metrics().delete(metric.getId()));
    return metric;
  }

  private CsvImportResult importAs(OpenMetadataClient client, String name, String csv) {
    return JsonUtils.readValue(client.metrics().importCsv(name, csv, false), CsvImportResult.class);
  }

  private OpenMetadataClient createRestrictedUserClient(
      OpenMetadataClient admin, String shortId, Domain allowedDomain, Deque<Runnable> cleanup) {
    Role domainOnlyRole = admin.roles().getByName(DOMAIN_ONLY_ACCESS_ROLE);
    String name = "u_" + shortId;
    String email = name + "@test.openmetadata.org";
    CreateUser request =
        new CreateUser()
            .withName(name)
            .withEmail(email)
            .withDomains(List.of(allowedDomain.getFullyQualifiedName()))
            .withRoles(List.of(domainOnlyRole.getId()));
    User user = admin.users().create(request);
    cleanup.push(() -> admin.users().delete(user.getId()));
    // Precondition: without the role and the domain actually attached, every domain assertion in
    // this class would pass vacuously. Fail loudly here instead.
    User stored = admin.users().get(user.getId().toString(), "roles,domains");
    assertTrue(
        listOrEmpty(stored.getRoles()).stream()
            .anyMatch(role -> DOMAIN_ONLY_ACCESS_ROLE.equals(role.getName())),
        "Restricted user must carry DomainOnlyAccessRole, got: " + stored.getRoles());
    assertTrue(
        listOrEmpty(stored.getDomains()).stream()
            .anyMatch(d -> allowedDomain.getId().equals(d.getId())),
        "Restricted user must carry the allowed domain, got: " + stored.getDomains());
    OpenMetadataClient client = SdkClients.createClient(email, email, new String[] {});
    awaitDomainRestrictionActive(client, allowedDomain);
    return client;
  }

  /**
   * Blocks until the server resolves this principal as domain-restricted, then returns.
   *
   * <p>Same stabilisation wait as {@code TestCaseCsvDomainIsolationIT}: an earlier run saw the
   * domain assertions fail as though no narrowing had been applied, and waiting for the domain
   * listing to narrow made it reproducibly stable. It cannot mask a real regression: it asserts
   * nothing, and on timeout it fails the test loudly rather than letting an assertion pass
   * vacuously.
   */
  private void awaitDomainRestrictionActive(OpenMetadataClient client, Domain allowedDomain) {
    Awaitility.await("domain restriction active")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(() -> onlyOwnDomainsVisible(client, allowedDomain));
  }

  private boolean onlyOwnDomainsVisible(OpenMetadataClient client, Domain allowedDomain)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/domains?limit=1000", null, RequestOptions.builder().build());
    JsonNode data = MAPPER.readTree(response).path("data");
    boolean sawOwn = false;
    for (JsonNode domain : data) {
      String fqn = domain.path("fullyQualifiedName").asText("");
      if (fqn.equals(allowedDomain.getFullyQualifiedName())) {
        sawOwn = true;
      } else if (!fqn.startsWith(allowedDomain.getFullyQualifiedName() + ".")) {
        return false;
      }
    }
    return sawOwn;
  }

  private void drain(Deque<Runnable> cleanup) {
    while (!cleanup.isEmpty()) {
      try {
        cleanup.pop().run();
      } catch (Exception ignored) {
        // Best-effort teardown; concurrent namespaces keep tests isolated regardless.
      }
    }
  }
}
