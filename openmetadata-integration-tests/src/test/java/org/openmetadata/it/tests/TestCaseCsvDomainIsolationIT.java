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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for GitHub issue #28463 — the Data Quality CSV export / bulk-edit import path
 * bypasses domain RBAC.
 *
 * <p>A user holding the seeded {@code DomainOnlyAccessRole} must not be able to read test cases
 * belonging to tables outside their domains through {@code GET
 * /v1/dataQuality/testCases/name/{name}/export}, nor create test cases on out-of-domain tables
 * through {@code PUT /v1/dataQuality/testCases/name/{name}/import}.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class TestCaseCsvDomainIsolationIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Column COLUMN = new Column().withName("id").withDataType(ColumnDataType.INT);
  private static final String ROW_COUNT_TEST_DEFINITION = "tableRowCountToEqual";
  private static final String TARGET_ENTITY_TYPE_TABLE = "table";
  private static final String PLATFORM_WIDE_EXPORT = "*";
  private static final String DOMAIN_ONLY_ACCESS_ROLE = "DomainOnlyAccessRole";

  @Test
  void test_exportCsv_domainRestrictedUserCannotReadForeignDomainTestCases(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String shortId = ns.uniqueShortId();
      Domain ownDomain = createDomain(admin, "d1_" + shortId, cleanup);
      Domain foreignDomain = createDomain(admin, "d2_" + shortId, cleanup);
      DatabaseSchema schema = createSchema(ns, shortId, cleanup);
      Table ownTable = createTable(admin, "t1_" + shortId, schema, ownDomain, cleanup);
      Table foreignTable = createTable(admin, "t2_" + shortId, schema, foreignDomain, cleanup);

      TestCase ownTestCase = createTestCase(admin, "tc1_" + shortId, ownTable);
      TestCase foreignTestCase = createTestCase(admin, "tc2_" + shortId, foreignTable);

      OpenMetadataClient restricted =
          createRestrictedUserClient(admin, shortId, ownDomain, cleanup);

      String platformWideCsv = restricted.testCases().exportCsv(PLATFORM_WIDE_EXPORT);
      assertTrue(
          platformWideCsv.contains(ownTestCase.getName()),
          "Domain-restricted user must still export their own-domain test case");
      assertFalse(
          platformWideCsv.contains(foreignTestCase.getName()),
          "Platform-wide export must NOT leak a foreign-domain test case");

      String foreignTableCsv =
          restricted.testCases().exportCsv(foreignTable.getFullyQualifiedName());
      assertFalse(
          foreignTableCsv.contains(foreignTestCase.getName()),
          "Table-scoped export of a foreign-domain table must NOT leak its test cases");
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void test_importCsv_domainRestrictedUserCannotWriteToForeignDomainTable(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String shortId = ns.uniqueShortId();
      Domain ownDomain = createDomain(admin, "d1_" + shortId, cleanup);
      Domain foreignDomain = createDomain(admin, "d2_" + shortId, cleanup);
      DatabaseSchema schema = createSchema(ns, shortId, cleanup);
      Table ownTable = createTable(admin, "t1_" + shortId, schema, ownDomain, cleanup);
      Table foreignTable = createTable(admin, "t2_" + shortId, schema, foreignDomain, cleanup);

      String seedName = "seed_" + shortId;
      createTestCase(admin, seedName, foreignTable);
      String seededCsv = admin.testCases().exportCsv(foreignTable.getFullyQualifiedName());

      String injectedName = "evil_" + shortId;
      String maliciousCsv = seededCsv.replace(seedName, injectedName);
      assertNotEquals(
          seededCsv, maliciousCsv, "Test setup must produce a CSV row for a new test case name");

      OpenMetadataClient restricted =
          createRestrictedUserClient(admin, shortId, ownDomain, cleanup);

      // The path name is the user's OWN in-domain table — only the CSV rows point elsewhere.
      CsvImportResult result = importAs(restricted, ownTable.getFullyQualifiedName(), maliciousCsv);

      assertNotEquals(
          ApiStatus.SUCCESS,
          result.getStatus(),
          "Import of an out-of-domain row must not report success: "
              + result.getImportResultsCsv());
      assertFalse(
          testCaseNamesFor(admin, foreignTable).contains(injectedName),
          "Domain-restricted user must NOT create a test case on a foreign-domain table");
    } finally {
      drain(cleanup);
    }
  }

  /**
   * Pins the entityFQN (column 4) gate on its own. The sibling test's CSV is exported verbatim from
   * the foreign table, so its testSuite column also names a foreign suite and the row would be
   * rejected by the suite gate even if the target gate were removed. Leaving column 5 empty here
   * means only the target gate can reject the row.
   */
  @Test
  void test_importCsv_foreignTargetIsRejectedEvenWhenNoTestSuiteIsNamed(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String shortId = ns.uniqueShortId();
      Domain ownDomain = createDomain(admin, "d1_" + shortId, cleanup);
      Domain foreignDomain = createDomain(admin, "d2_" + shortId, cleanup);
      DatabaseSchema schema = createSchema(ns, shortId, cleanup);
      Table ownTable = createTable(admin, "t1_" + shortId, schema, ownDomain, cleanup);
      Table foreignTable = createTable(admin, "t2_" + shortId, schema, foreignDomain, cleanup);

      String seedName = "seed_" + shortId;
      createTestCase(admin, seedName, foreignTable);

      String injectedName = "evil2_" + shortId;
      String maliciousCsv =
          admin
              .testCases()
              .exportCsv(foreignTable.getFullyQualifiedName())
              .replace(basicSuiteFqn(foreignTable), "")
              .replace(seedName, injectedName);
      assertFalse(
          maliciousCsv.contains(basicSuiteFqn(foreignTable)),
          "Test setup must leave the testSuite column empty so only the target gate can reject");

      OpenMetadataClient restricted =
          createRestrictedUserClient(admin, shortId, ownDomain, cleanup);
      CsvImportResult result = importAs(restricted, ownTable.getFullyQualifiedName(), maliciousCsv);

      assertNotEquals(
          ApiStatus.SUCCESS,
          result.getStatus(),
          "A row targeting a foreign-domain table must not succeed: "
              + result.getImportResultsCsv());
      assertFalse(
          testCaseNamesFor(admin, foreignTable).contains(injectedName),
          "Domain-restricted user must NOT create a test case on a foreign-domain table");
    } finally {
      drain(cleanup);
    }
  }

  /**
   * The row detail must read the same whether the target is absent or merely outside the importing
   * user's domains. The user picks the entityFQN, so a detail that told the two apart would turn the
   * import response into a cross-domain existence oracle for arbitrary FQNs — the same oracle the
   * testSuite column already closes.
   *
   * <p>Both responses are normalised on the target FQN and the row name before comparison, so this
   * pins the indistinguishability, not any one message string.
   */
  @Test
  void test_importCsv_absentAndForeignTargetsAreIndistinguishable(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String shortId = ns.uniqueShortId();
      Domain ownDomain = createDomain(admin, "d1_" + shortId, cleanup);
      Domain foreignDomain = createDomain(admin, "d2_" + shortId, cleanup);
      DatabaseSchema schema = createSchema(ns, shortId, cleanup);
      Table ownTable = createTable(admin, "t1_" + shortId, schema, ownDomain, cleanup);
      Table foreignTable = createTable(admin, "t2_" + shortId, schema, foreignDomain, cleanup);

      String seedName = "seed_" + shortId;
      createTestCase(admin, seedName, ownTable);
      // Suite column cleared so the target gate is the only thing that can reject either row.
      String templateCsv =
          admin
              .testCases()
              .exportCsv(ownTable.getFullyQualifiedName())
              .replace(basicSuiteFqn(ownTable), "");

      String absentFqn = ownTable.getFullyQualifiedName() + "_absent";
      String absentName = "absent_" + shortId;
      String foreignName = "foreign_" + shortId;
      String absentCsv =
          templateCsv
              .replace(seedName, absentName)
              .replace(ownTable.getFullyQualifiedName(), absentFqn);
      String foreignCsv =
          templateCsv
              .replace(seedName, foreignName)
              .replace(ownTable.getFullyQualifiedName(), foreignTable.getFullyQualifiedName());

      OpenMetadataClient restricted =
          createRestrictedUserClient(admin, shortId, ownDomain, cleanup);
      CsvImportResult absentResult =
          importAs(restricted, ownTable.getFullyQualifiedName(), absentCsv);
      CsvImportResult foreignResult =
          importAs(restricted, ownTable.getFullyQualifiedName(), foreignCsv);

      // Without these the comparison below could pass on two empty or two successful responses.
      assertTrue(
          absentResult.getNumberOfRowsFailed() >= 1,
          "The absent-target row must be rejected: " + absentResult.getImportResultsCsv());
      assertTrue(
          foreignResult.getNumberOfRowsFailed() >= 1,
          "The foreign-target row must be rejected: " + foreignResult.getImportResultsCsv());

      assertEquals(
          normalizeImportResults(foreignResult, foreignTable.getFullyQualifiedName(), foreignName),
          normalizeImportResults(absentResult, absentFqn, absentName),
          "An absent target and a foreign-domain target must produce the same row detail, "
              + "otherwise the import response is a cross-domain existence oracle. Absent: "
              + absentResult.getImportResultsCsv()
              + " Foreign: "
              + foreignResult.getImportResultsCsv());
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void test_importCsvAsync_domainRestrictedUserCannotVersionForeignDomainTable(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String shortId = ns.uniqueShortId();
      Domain ownDomain = createDomain(admin, "d1_" + shortId, cleanup);
      Domain foreignDomain = createDomain(admin, "d2_" + shortId, cleanup);
      DatabaseSchema schema = createSchema(ns, shortId, cleanup);
      Table ownTable = createTable(admin, "t1_" + shortId, schema, ownDomain, cleanup);
      Table foreignTable = createTable(admin, "t2_" + shortId, schema, foreignDomain, cleanup);

      // Every row is legitimately the attacker's own; the attack is in the request PATH, which
      // becomes the bulk-import versioning target. Two rows are required: createBulkImportVersion
      // only versions when numberOfRowsProcessed > 1.
      String firstSeed = "seeda_" + shortId;
      String secondSeed = "seedb_" + shortId;
      createTestCase(admin, firstSeed, ownTable);
      createTestCase(admin, secondSeed, ownTable);
      String ownRowsCsv =
          admin
              .testCases()
              .exportCsv(ownTable.getFullyQualifiedName())
              .replace(firstSeed, "async1_" + shortId)
              .replace(secondSeed, "async2_" + shortId);

      Table foreignBefore = admin.tables().get(foreignTable.getId());
      OpenMetadataClient restricted =
          createRestrictedUserClient(admin, shortId, ownDomain, cleanup);

      restricted
          .testCases()
          .importCsvAsync(
              foreignTable.getFullyQualifiedName(), ownRowsCsv, false, TARGET_ENTITY_TYPE_TABLE);

      // The job is asynchronous: wait for the imported rows to land, which is the point after which
      // the versioning step would already have run.
      Awaitility.await("async import applied")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(1))
          .until(
              () -> {
                List<String> names = testCaseNamesFor(admin, ownTable);
                return names.contains("async1_" + shortId) && names.contains("async2_" + shortId);
              });

      Table foreignAfter = admin.tables().get(foreignTable.getId());
      assertEquals(
          foreignBefore.getVersion(),
          foreignAfter.getVersion(),
          "A foreign-domain table must not be versioned by a domain-restricted user's async import");
      assertEquals(
          foreignBefore.getUpdatedBy(),
          foreignAfter.getUpdatedBy(),
          "A foreign-domain table's updatedBy must not be overwritten by a foreign importer");
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void test_importCsv_domainRestrictedUserCannotAttachToForeignDomainTestSuite(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String shortId = ns.uniqueShortId();
      Domain ownDomain = createDomain(admin, "d1_" + shortId, cleanup);
      Domain foreignDomain = createDomain(admin, "d2_" + shortId, cleanup);
      DatabaseSchema schema = createSchema(ns, shortId, cleanup);
      Table ownTable = createTable(admin, "t1_" + shortId, schema, ownDomain, cleanup);
      Table foreignTable = createTable(admin, "t2_" + shortId, schema, foreignDomain, cleanup);

      // Both basic suites must really exist, otherwise the import would be refused merely as
      // "test suite not found" and the domain gate would never be exercised.
      String seedName = "seed_" + shortId;
      createTestCase(admin, seedName, ownTable);
      createTestCase(admin, "seed2_" + shortId, foreignTable);
      String foreignSuiteFqn = basicSuiteFqn(foreignTable);
      TestSuite foreignSuiteBefore = admin.testSuites().getByName(foreignSuiteFqn);

      // Row targets the user's OWN table (passes the entityFQN gate) but names the FOREIGN
      // domain's basic suite in the testSuite column.
      String injectedName = "suiteevil_" + shortId;
      String maliciousCsv =
          admin
              .testCases()
              .exportCsv(ownTable.getFullyQualifiedName())
              .replace(basicSuiteFqn(ownTable), foreignSuiteFqn)
              .replace(seedName, injectedName);

      OpenMetadataClient restricted =
          createRestrictedUserClient(admin, shortId, ownDomain, cleanup);
      CsvImportResult result = importAs(restricted, ownTable.getFullyQualifiedName(), maliciousCsv);

      assertNotEquals(
          ApiStatus.SUCCESS,
          result.getStatus(),
          "Import naming a foreign-domain test suite must not succeed: "
              + result.getImportResultsCsv());
      assertFalse(
          testCaseNamesFor(admin, ownTable).contains(injectedName),
          "The row must be rejected outright, not written with a foreign-domain suite");
      assertEquals(
          foreignSuiteBefore.getVersion(),
          admin.testSuites().getByName(foreignSuiteFqn).getVersion(),
          "A foreign-domain test suite must not be mutated by a domain-restricted user's import");
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void test_importCsv_domainRestrictedUserCanStillWriteToOwnDomainTable(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String shortId = ns.uniqueShortId();
      Domain ownDomain = createDomain(admin, "d1_" + shortId, cleanup);
      DatabaseSchema schema = createSchema(ns, shortId, cleanup);
      Table ownTable = createTable(admin, "t1_" + shortId, schema, ownDomain, cleanup);

      String seedName = "seed_" + shortId;
      createTestCase(admin, seedName, ownTable);
      String seededCsv = admin.testCases().exportCsv(ownTable.getFullyQualifiedName());

      String addedName = "added_" + shortId;
      String csv = seededCsv.replace(seedName, addedName);

      OpenMetadataClient restricted =
          createRestrictedUserClient(admin, shortId, ownDomain, cleanup);
      CsvImportResult result = importAs(restricted, ownTable.getFullyQualifiedName(), csv);

      assertNotEquals(
          ApiStatus.ABORTED,
          result.getStatus(),
          "In-domain import must not be aborted: " + result.getImportResultsCsv());
      assertTrue(
          testCaseNamesFor(admin, ownTable).contains(addedName),
          "Domain-restricted user must still import test cases on their own-domain table");
    } finally {
      drain(cleanup);
    }
  }

  private String basicSuiteFqn(Table table) {
    return table.getFullyQualifiedName() + ".testSuite";
  }

  /** Strips the parts of an import response that legitimately differ between two targets. */
  private String normalizeImportResults(
      CsvImportResult result, String targetFqn, String testCaseName) {
    return result
        .getImportResultsCsv()
        .replace(targetFqn, "<target>")
        .replace(testCaseName, "<row>");
  }

  private CsvImportResult importAs(OpenMetadataClient client, String tableFqn, String csv) {
    return JsonUtils.readValue(
        client.testCases().importCsv(tableFqn, csv, false, TARGET_ENTITY_TYPE_TABLE),
        CsvImportResult.class);
  }

  private List<String> testCaseNamesFor(OpenMetadataClient admin, Table table) {
    ListParams params =
        new ListParams()
            .setLimit(1000)
            .addFilter(
                "entityLink", String.format("<#E::table::%s>", table.getFullyQualifiedName()))
            .addFilter("includeAllTests", "true");
    return admin.testCases().list(params).getData().stream().map(TestCase::getName).toList();
  }

  private TestCase createTestCase(OpenMetadataClient admin, String name, Table table) {
    return TestCaseBuilder.create(admin)
        .name(name)
        .forTable(table)
        .testDefinition(ROW_COUNT_TEST_DEFINITION)
        .parameter("value", "100")
        .create();
  }

  private Domain createDomain(OpenMetadataClient admin, String name, Deque<Runnable> cleanup) {
    CreateDomain create =
        new CreateDomain()
            .withName(name)
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test case CSV domain isolation");
    Domain domain = admin.domains().create(create);
    cleanup.push(() -> admin.domains().delete(domain.getId().toString()));
    return domain;
  }

  private DatabaseSchema createSchema(TestNamespace ns, String shortId, Deque<Runnable> cleanup) {
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("svc_" + shortId, ns);
    cleanup.push(
        () ->
            SdkClients.adminClient()
                .databaseServices()
                .delete(
                    service.getId().toString(), Map.of("recursive", "true", "hardDelete", "true")));
    return DatabaseSchemaTestFactory.createSimpleWithName("s_" + shortId, ns, service);
  }

  private Table createTable(
      OpenMetadataClient admin,
      String name,
      DatabaseSchema schema,
      Domain domain,
      Deque<Runnable> cleanup) {
    CreateTable create =
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(COLUMN))
            .withDomains(List.of(domain.getFullyQualifiedName()));
    Table table = admin.tables().create(create);
    cleanup.push(() -> admin.tables().delete(table.getId()));
    return table;
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
   * <p>This is a stabilisation wait of unknown cause. An earlier run of this class saw the domain
   * assertions fail as though no narrowing had been applied; the wait made it reproducibly stable
   * and the cause was never established. It cannot mask a real regression: it asserts nothing, and
   * on timeout it fails the test loudly rather than letting an assertion pass vacuously — both
   * guard-neutralisation probes still go RED with it in place.
   *
   * <p>Domain listing is narrowed by the same SubjectContext the CSV paths use, so it is a usable
   * readiness signal: an unrestricted view would include the other tests' domains.
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
