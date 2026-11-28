package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.DomainLineageSteps.assertEdgeAbsent;
import static org.openmetadata.it.tests.DomainLineageSteps.assetEdges;
import static org.openmetadata.it.tests.DomainLineageSteps.awaitPlatformLineage;
import static org.openmetadata.it.tests.DomainLineageSteps.client;
import static org.openmetadata.it.tests.DomainLineageSteps.deleteEdge;
import static org.openmetadata.it.tests.DomainLineageSteps.domain;
import static org.openmetadata.it.tests.DomainLineageSteps.edge;
import static org.openmetadata.it.tests.DomainLineageSteps.putEdge;
import static org.openmetadata.it.tests.DomainLineageSteps.setDomains;
import static org.openmetadata.it.tests.DomainLineageSteps.setTableDomains;
import static org.openmetadata.it.tests.DomainLineageSteps.table;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.ForkedOperations;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.MigrationConfiguration;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.migration.utils.v212.DomainLineageRebuild;
import org.openmetadata.service.migration.utils.v212.DomainLineageRebuild.Change;

/**
 * Covers the 2.1.2 repair that recounts domain lineage from the asset edges, and the ops command
 * that runs it. Before #33961 was fixed, domains given to services after their tables' lineage
 * existed were never counted, and re-sending an edge created the domain edge at one asset edge. A
 * server with the fix keeps the count, so these tests delete the domain edge a container's domain
 * change wrote, which leaves the store as an older server did.
 */
@Isolated(
    "invokes the v212 repair, which recounts and rewrites domain edges across the whole"
        + " entity_relationship table, not just this class's own domains")
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
public class DomainLineageRebuildIT {

  private static final int UPSTREAM = Relationship.UPSTREAM.ordinal();
  private static final String UNRELEASED_VERSION = "2.1.2";
  private static final String LAST_RELEASED_VERSION = "2.1.1";
  private static final List<String> DISCOVERY_INDEXES =
      List.of(
          "idx_stored_procedure_entity_fqnhash_pattern",
          "idx_pipeline_entity_fqnhash_pattern",
          "idx_llm_model_entity_fqnhash_pattern",
          "idx_mcp_server_entity_fqnhash_pattern",
          "idx_test_suite_fqnhash_pattern",
          "idx_tag_fqnhash_pattern",
          "idx_ai_framework_control_entity_fqnhash_pattern");

  @Test
  void rebuildCreatesTheDomainEdgeTheServicesDomainsNeverGot(TestNamespace ns) {
    IssueTopology issue = IssueTopology.create(ns);
    assertEdgeAbsent(issue.d1(), issue.d2());

    DomainLineageRebuild.rebuild(dao());

    LineageDetails rebuilt = edge(issue.d1(), issue.d2());
    assertEquals(3, rebuilt.getAssetEdges());
    assertEquals(LineageDetails.Source.CHILD_ASSETS, rebuilt.getSource());
  }

  /**
   * 2.1.0 and 2.1.1 have shipped, so a database upgraded to 2.1.1 never reads their folders again.
   * The migration log is set back to that state (2.1.1 the last version applied, nothing of 2.1.2
   * recorded) and the migration workflow, with the real native migration folders, recounts the
   * domain edge such a database is missing.
   */
  @Test
  void anUpgradeFrom211RunsTheRebuild(TestNamespace ns) {
    IssueTopology issue = IssueTopology.create(ns);
    assertEdgeAbsent(issue.d1(), issue.d2());
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    forgetVersion(jdbi, UNRELEASED_VERSION);
    assertEquals(LAST_RELEASED_VERSION, lastAppliedVersion(jdbi));

    upgrade(jdbi);

    assertEquals(3, assetEdges(issue.d1(), issue.d2()));
    assertEquals(UNRELEASED_VERSION, lastAppliedVersion(jdbi));
    assertTrue(
        isRecorded(jdbi, "data-migration-step:2.1.2:" + DomainLineageRebuild.STEP_NAME),
        "the rebuild step is recorded under 2.1.2");
    if (TestSuiteBootstrap.getConnectionType() == ConnectionType.POSTGRES) {
      DISCOVERY_INDEXES.forEach(
          index -> assertTrue(isValidIndex(jdbi, index), index + " is built and valid"));
    }
  }

  /** {@code openmetadata-ops.sh rebuild-domain-lineage}, run in its own JVM as an operator would. */
  @Test
  void theOpsCommandRebuildsTheDomainEdgesAndIsAFixedPoint(TestNamespace ns) {
    IssueTopology issue = IssueTopology.create(ns);
    assertEdgeAbsent(issue.d1(), issue.d2());

    assertEquals(
        0,
        ForkedOperations.run("rebuild-domain-lineage"),
        "the ops command failed, see target/forked-ops-*.log");
    String rebuilt = storedJson(issue.d1(), issue.d2());
    assertEquals(3, assetEdges(issue.d1(), issue.d2()));
    assertEquals(0, ForkedOperations.run("rebuild-domain-lineage"), "second run");

    assertEquals(rebuilt, storedJson(issue.d1(), issue.d2()));
  }

  /**
   * The documented recovery, run as an operator would, makes the repaired edge show in the domain
   * view. The reindex runs with --force: without it a reindex skips mappings it finds unchanged.
   */
  @Test
  void theDocumentedRecoveryShowsTheRepairedEdgeInTheDomainView(TestNamespace ns) {
    IssueTopology issue = IssueTopology.create(ns);
    awaitPlatformLineage(issue.d1(), issue.d2(), false);

    assertEquals(
        0,
        ForkedOperations.run("rebuild-domain-lineage"),
        "the ops command failed, see target/forked-ops-*.log");
    assertEquals(
        0,
        ForkedOperations.run("reindex", "--force", "--entities=domain,dataProduct"),
        "the reindex failed, see target/forked-ops-*.log");

    assertEquals(3, assetEdges(issue.d1(), issue.d2()));
    awaitPlatformLineage(issue.d1(), issue.d2(), true);
  }

  /** An operator's script must see the command fail, here on a database it cannot log in to. */
  @Test
  void theOpsCommandExitsNonZeroWhenItCannotConnectToTheDatabase() {
    int exitCode =
        ForkedOperations.run(
            config -> ((ObjectNode) config.path("database")).put("password", "not-the-password"),
            "rebuild-domain-lineage");

    assertEquals(1, exitCode, "see target/forked-ops-*.log");
  }

  @Test
  void rebuildCountsInheritedDomainsAndIsAFixedPoint(TestNamespace ns) {
    IssueTopology issue = IssueTopology.create(ns);
    putEdge(issue.t1(), issue.t2());
    putEdge(issue.d1(), issue.d2());
    assertEquals(LineageDetails.Source.MANUAL, edge(issue.d1(), issue.d2()).getSource());
    Domain orphanFrom = domain(ns, "orphan_from");
    Domain orphanTo = domain(ns, "orphan_to");
    seed(orphanFrom, orphanTo, "{\"source\":\"ChildAssets\",\"assetEdges\":5}");
    Domain looped = domain(ns, "looped");
    seed(looped, looped, "{\"source\":\"ChildAssets\",\"assetEdges\":2}");
    Domain manualFrom = domain(ns, "manual_from");
    Domain manualTo = domain(ns, "manual_to");
    seed(manualFrom, manualTo, "{\"source\":\"Manual\",\"createdBy\":\"admin\"}");
    String manualBefore = storedJson(manualFrom, manualTo);
    Domain detailsFreeFrom = domain(ns, "details_free_from");
    Domain detailsFreeTo = domain(ns, "details_free_to");
    seed(detailsFreeFrom, detailsFreeTo, "null");
    String detailsFreeBefore = storedJson(detailsFreeFrom, detailsFreeTo);
    Domain countlessFrom = domain(ns, "countless_from");
    Domain countlessTo = domain(ns, "countless_to");
    DatabaseSchema schema = DomainLineageSteps.newSchema(ns);
    Table countlessSource = table(ns, schema, "countless_source");
    Table countlessTarget = table(ns, schema, "countless_target");
    setTableDomains(countlessSource, countlessFrom);
    setTableDomains(countlessTarget, countlessTo);
    putEdge(countlessSource, countlessTarget);
    seed(countlessFrom, countlessTo, "{\"source\":\"ChildAssets\"}");

    DomainLineageRebuild.rebuild(dao());

    LineageDetails rebuilt = edge(issue.d1(), issue.d2());
    assertEquals(3, rebuilt.getAssetEdges(), "the three asset edges, not the service edge");
    assertEquals(LineageDetails.Source.MANUAL, rebuilt.getSource());
    assertEdgeAbsent(orphanFrom, orphanTo);
    assertEdgeAbsent(looped, looped);
    assertEquals(manualBefore, storedJson(manualFrom, manualTo));
    assertEquals(detailsFreeBefore, storedJson(detailsFreeFrom, detailsFreeTo));
    assertEquals(1, assetEdges(countlessFrom, countlessTo));
    String issueEdgeBefore = storedJson(issue.d1(), issue.d2());

    Map<Change, Long> secondRun = DomainLineageRebuild.rebuild(dao());

    assertEquals(Set.of(Change.NONE), secondRun.keySet(), secondRun.toString());
    assertEquals(issueEdgeBefore, storedJson(issue.d1(), issue.d2()));
  }

  @Test
  void deletingAnEdgeAfterTheRebuildKeepsTheDomainEdge(TestNamespace ns) {
    IssueTopology issue = IssueTopology.create(ns);
    putEdge(issue.t1(), issue.t2());
    assertEquals(1, assetEdges(issue.d1(), issue.d2()), "a re-sent edge creates it at one");

    DomainLineageRebuild.rebuild(dao());

    deleteEdge(issue.t5(), issue.t4());
    assertEquals(2, assetEdges(issue.d1(), issue.d2()));
    deleteEdge(issue.t1(), issue.t2());
    assertEquals(1, assetEdges(issue.d1(), issue.d2()));
    deleteEdge(issue.t3(), issue.t2());
    assertEdgeAbsent(issue.d1(), issue.d2());
  }

  /** The live delta subtracts what the store holds, so it needs the recount first. */
  @Test
  void rebuildThenMoveThenDeleteKeepsTheEdge(TestNamespace ns) {
    DatabaseService serviceA = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schemaA = DatabaseSchemaTestFactory.createSimple(ns, serviceA);
    DatabaseService serviceX = DatabaseServiceTestFactory.createPostgres(ns);
    Domain d0 = domain(ns, "d0");
    Domain d1 = domain(ns, "d1");
    Domain dx = domain(ns, "dx");
    setDomains(client().databaseServices(), serviceX.getId(), dx);
    Table x = table(ns, DatabaseSchemaTestFactory.createSimple(ns, serviceX), "x");
    Table t1 = table(ns, schemaA, "t1");
    Table t3 = table(ns, schemaA, "t3");
    Table t5 = table(ns, schemaA, "t5");
    putEdge(t1, x);
    setDomains(client().databaseServices(), serviceA.getId(), d0);
    forgetDomainEdge(d0, dx);
    putEdge(t3, x);
    putEdge(t5, x);
    assertEquals(2, assetEdges(d0, dx), "t1's edge predates its service's domain");

    DomainLineageRebuild.rebuild(dao());
    assertEquals(3, assetEdges(d0, dx));
    setTableDomains(t1, d1);
    assertEquals(2, assetEdges(d0, dx));
    assertEquals(1, assetEdges(d1, dx));
    deleteEdge(t3, x);

    assertEquals(1, assetEdges(d0, dx));
  }

  /**
   * The issue's topology: tables t1, t3, t5 in service A and t2, t4 in service B, with the edges
   * t1→t2, t3→t2 and t5→t4 written before the services got domains D1 and D2. The domain edge is
   * then removed through the API, from the store and the domain view alike, as an older server
   * never wrote it there, so none exists until an asset edge is sent again.
   */
  private record IssueTopology(
      Domain d1, Domain d2, Table t1, Table t2, Table t3, Table t4, Table t5) {

    static IssueTopology create(TestNamespace ns) {
      DatabaseService serviceA = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseService serviceB = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schemaA = DatabaseSchemaTestFactory.createSimple(ns, serviceA);
      DatabaseSchema schemaB = DatabaseSchemaTestFactory.createSimple(ns, serviceB);
      IssueTopology issue =
          new IssueTopology(
              domain(ns, "d1"),
              domain(ns, "d2"),
              table(ns, schemaA, "t1"),
              table(ns, schemaB, "t2"),
              table(ns, schemaA, "t3"),
              table(ns, schemaB, "t4"),
              table(ns, schemaA, "t5"));
      putEdge(issue.t1(), issue.t2());
      putEdge(issue.t3(), issue.t2());
      putEdge(issue.t5(), issue.t4());
      setDomains(client().databaseServices(), serviceA.getId(), issue.d1());
      setDomains(client().databaseServices(), serviceB.getId(), issue.d2());
      deleteEdge(issue.d1(), issue.d2());
      return issue;
    }
  }

  private static void forgetDomainEdge(Domain from, Domain to) {
    dao()
        .relationshipDAO()
        .delete(from.getId(), Entity.DOMAIN, to.getId(), Entity.DOMAIN, UPSTREAM);
  }

  private static void seed(Domain from, Domain to, String lineageJson) {
    dao()
        .relationshipDAO()
        .insert(from.getId(), to.getId(), Entity.DOMAIN, Entity.DOMAIN, UPSTREAM, lineageJson);
  }

  private static String storedJson(Domain from, Domain to) {
    CollectionDAO.EntityRelationshipObject row =
        dao().relationshipDAO().getRecord(from.getId(), to.getId(), UPSTREAM);
    assertNotNull(row, "a stored domain edge is expected");
    return row.getJson();
  }

  private static void forgetVersion(Jdbi jdbi, String version) {
    jdbi.useHandle(
        handle -> {
          handle
              .createUpdate("DELETE FROM SERVER_MIGRATION_SQL_LOGS WHERE version = :version")
              .bind("version", version)
              .execute();
          handle
              .createUpdate("DELETE FROM SERVER_CHANGE_LOG WHERE version = :version")
              .bind("version", version)
              .execute();
        });
  }

  // The 2.x versions sort as strings the same way they sort as versions.
  private static String lastAppliedVersion(Jdbi jdbi) {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery("SELECT MAX(version) FROM SERVER_CHANGE_LOG WHERE version LIKE '2.%'")
                .mapTo(String.class)
                .one());
  }

  private static void upgrade(Jdbi jdbi) {
    OpenMetadataApplicationConfig config = TestSuiteBootstrap.createApplicationConfigCopy();
    MigrationConfiguration paths = config.getMigrationConfiguration();
    MigrationWorkflow workflow =
        new MigrationWorkflow(
            jdbi,
            paths.getNativePath(),
            TestSuiteBootstrap.getConnectionType(),
            "",
            paths.getFlywayPath(),
            config,
            false);
    workflow.loadMigrations();
    workflow.runMigrationWorkflows(false);
  }

  private static boolean isRecorded(Jdbi jdbi, String checksum) {
    return jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM SERVER_MIGRATION_SQL_LOGS WHERE checksum = :checksum")
                    .bind("checksum", checksum)
                    .mapTo(Integer.class)
                    .one())
        == 1;
  }

  private static boolean isValidIndex(Jdbi jdbi, String name) {
    return jdbi.withHandle(
        handle ->
            handle
                    .createQuery(
                        "SELECT COUNT(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid"
                            + " WHERE c.relname = :name AND i.indisvalid")
                    .bind("name", name)
                    .mapTo(Integer.class)
                    .one()
                == 1);
  }

  private static CollectionDAO dao() {
    return Entity.getCollectionDAO();
  }
}
