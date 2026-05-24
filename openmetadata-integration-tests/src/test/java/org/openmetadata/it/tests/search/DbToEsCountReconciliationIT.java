package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.search.DbCountQuerier;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.search.SearchClusterResetExtension;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.sdk.fluent.Apps;

/**
 * The umbrella correctness invariant: for every entity type that has both a
 * REST list endpoint and a search index alias, the post-reindex doc count in
 * the index must equal the DB count.
 *
 * <p>This is the canonical gate. If a regression breaks any indexer
 * (relationship resolution, tag join, custom property serialization,
 * vector embedding step, etc.), the reconciliation count for that entity
 * type drifts and this test fails with a per-entity-type table.
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class DbToEsCountReconciliationIT {

  private static ServerHandle server;
  private static IndexAliasInspector inspector;
  private static DbCountQuerier db;
  private static SearchAssertions search;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    inspector = new IndexAliasInspector(server);
    db = new DbCountQuerier(server);
    search = new SearchAssertions(server);
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void everyEntityIndexCountMatchesDbCount(final TestNamespace ns) {
    seedRepresentativeCohort(ns);

    final AppRunRecord run = ReindexHelpers.triggerSearchIndexAndWait(server);
    assertThat(run.getStatus().value()).isIn("success", "completed");

    final List<String> mismatches = new ArrayList<>();
    for (final String entityType : inspector.declaredEntityTypes()) {
      if (!db.canCount(entityType)) {
        continue;
      }
      final String alias = inspector.aliasFor(entityType);
      if (inspector.indicesForAlias(alias).isEmpty()) {
        continue;
      }
      final long dbCount = db.count(entityType);
      final long esCount = search.countByEntityType(alias, entityType);
      if (dbCount != esCount) {
        mismatches.add(
            String.format(
                "  %-25s db=%d  es=%d  diff=%+d", entityType, dbCount, esCount, esCount - dbCount));
      }
    }

    assertThat(mismatches)
        .as(
            "entity-type counts must reconcile DB ↔ ES post-reindex:%n%s",
            String.join("\n", mismatches))
        .isEmpty();
  }

  private static void seedRepresentativeCohort(final TestNamespace ns) {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    TopicTestFactory.createSimple(ns);
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTermTestFactory.createSimple(ns, glossary);
  }
}
