package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Regression coverage for the Incident Manager listing RBAC gap: {@code
 * EntityTimeSeriesRepository#listFromSearchWithOffset} and {@code #listLatestFromSearch} used to
 * search without a {@code SubjectContext}, so {@code RuleEvaluator#hasDomain}'s list-operation
 * short-circuit was never backed by search-side filtering and a domain-restricted user saw
 * incidents from every domain (1.13 backport of the upstream fix for #31740).
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IncidentManagerDomainIsolationIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Column COLUMN = new Column().withName("id").withDataType(ColumnDataType.INT);

  @Test
  @ResourceLock(value = SharedResourceLocks.SEARCH_SETTINGS, mode = ResourceAccessMode.READ_WRITE)
  void test_incidentListing_restrictedUserSeesOnlyOwnDomainIncidents(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain ownDomain = createDomain(admin, p + "_d1", cleanup);
      Domain foreignDomain = createDomain(admin, p + "_d2", cleanup);
      DatabaseSchema schema = createShortNamedSchema(admin, p, cleanup);
      Table ownTable = createTableInDomain(admin, p + "_own", schema, ownDomain, cleanup);
      Table foreignTable =
          createTableInDomain(admin, p + "_foreign", schema, foreignDomain, cleanup);

      String testDefinitionFqn =
          admin
              .testDefinitions()
              .list(new ListParams().withLimit(1))
              .getData()
              .get(0)
              .getFullyQualifiedName();
      String ownIncidentFqn = createIncident(admin, ownTable, p + "_own_tc", testDefinitionFqn);
      String foreignIncidentFqn =
          createIncident(admin, foreignTable, p + "_foreign_tc", testDefinitionFqn);

      OpenMetadataClient restricted = createRestrictedUserClient(admin, p, ownDomain, cleanup);

      // Incident listing isolation is driven through search RBAC, which is gated on the global
      // enableAccessControl setting.
      boolean originalAccessControl = enableSearchAccessControl(admin);
      cleanup.push(() -> restoreSearchAccessControl(admin, originalAccessControl));

      Awaitility.await("Incident manager listing honours domain isolation")
          // Bumped from 90s: mysql-es retry-queue lane needs more headroom for RBAC + search
          // propagation.
          .atMost(Duration.ofMinutes(3))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                for (boolean latest : new boolean[] {false, true}) {
                  Set<String> visible = incidentTestCaseFqns(restricted, latest);
                  assertTrue(
                      visible.contains(ownIncidentFqn),
                      "Own-domain incident visible (latest=" + latest + "). Saw: " + visible);
                  assertFalse(
                      visible.contains(foreignIncidentFqn),
                      "Foreign-domain incident hidden (latest=" + latest + "). Saw: " + visible);
                }
              });
    } finally {
      drain(cleanup);
    }
  }

  /** Creates a column-level test case on {@code table} plus an open incident for it. */
  private String createIncident(
      OpenMetadataClient admin, Table table, String name, String testDefinitionFqn) {
    TestCase testCase =
        admin
            .testCases()
            .create(
                new CreateTestCase()
                    .withName(name)
                    .withEntityLink(
                        "<#E::table::" + table.getFullyQualifiedName() + "::columns::id>")
                    .withTestDefinition(testDefinitionFqn));
    admin
        .testCaseResolutionStatuses()
        .create(
            new CreateTestCaseResolutionStatus()
                .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New)
                .withTestCaseReference(testCase.getFullyQualifiedName())
                .withSeverity(Severity.Severity2));
    return testCase.getFullyQualifiedName();
  }

  /**
   * @param latest {@code true} exercises the aggregation branch of the listing, which picks the
   *     latest status per test case through a different server path than the plain search
   *     listing. Both must enforce the caller's policies, otherwise {@code latest=true} is a
   *     trivial bypass.
   */
  private Set<String> incidentTestCaseFqns(OpenMetadataClient client, boolean latest)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/dataQuality/testCases/testCaseIncidentStatus/search/list",
                null,
                RequestOptions.builder()
                    .queryParam("limit", "1000")
                    .queryParam("latest", String.valueOf(latest))
                    .build());
    Set<String> fqns = new HashSet<>();
    for (JsonNode incident : MAPPER.readTree(response).path("data")) {
      JsonNode reference = incident.path("testCaseReference");
      if (reference.hasNonNull("fullyQualifiedName")) {
        fqns.add(reference.get("fullyQualifiedName").asText());
      }
    }
    return fqns;
  }

  private Domain createDomain(OpenMetadataClient admin, String name, Deque<Runnable> cleanup) {
    CreateDomain create =
        new CreateDomain()
            .withName(name)
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Incident manager domain isolation test domain");
    Domain domain = admin.domains().create(create);
    cleanup.push(() -> admin.domains().delete(domain.getId().toString()));
    return domain;
  }

  /**
   * Creating a test case implicitly creates a test suite whose name is the table's FQN plus a
   * suffix. Building directly under the shared MySQL service with a short, namespace-derived
   * prefix keeps the resulting test suite name well inside its column limit.
   */
  private DatabaseSchema createShortNamedSchema(
      OpenMetadataClient admin, String prefix, Deque<Runnable> cleanup) {
    Database database =
        admin
            .databases()
            .create(
                new CreateDatabase()
                    .withName(prefix + "_db")
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    cleanup.push(
        () ->
            admin
                .databases()
                .delete(
                    database.getId().toString(),
                    Map.of("recursive", "true", "hardDelete", "true")));
    return admin
        .databaseSchemas()
        .create(
            new CreateDatabaseSchema()
                .withName(prefix + "_sch")
                .withDatabase(database.getFullyQualifiedName()));
  }

  private Table createTableInDomain(
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
      OpenMetadataClient admin, String prefix, Domain allowedDomain, Deque<Runnable> cleanup) {
    Role domainOnlyRole = admin.roles().getByName("DomainOnlyAccessRole");
    String name = prefix + "_restricted";
    String email = name + "@test.openmetadata.org";
    CreateUser request =
        new CreateUser()
            .withName(name)
            .withEmail(email)
            .withDomains(List.of(allowedDomain.getFullyQualifiedName()))
            .withRoles(List.of(domainOnlyRole.getId()));
    User user = admin.users().create(request);
    cleanup.push(() -> admin.users().delete(user.getId()));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private boolean enableSearchAccessControl(OpenMetadataClient admin) throws Exception {
    String settingsJson =
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());
    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings searchConfig =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);
    boolean original =
        Boolean.TRUE.equals(searchConfig.getGlobalSettings().getEnableAccessControl());
    searchConfig.getGlobalSettings().setEnableAccessControl(true);
    Settings updated =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    admin
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/system/settings",
            MAPPER.writeValueAsString(updated),
            RequestOptions.builder().build());
    return original;
  }

  private void restoreSearchAccessControl(OpenMetadataClient admin, boolean original) {
    if (!original) {
      try {
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/settings/reset/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());
      } catch (Exception ignored) {
        // Best-effort restore.
      }
    }
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
