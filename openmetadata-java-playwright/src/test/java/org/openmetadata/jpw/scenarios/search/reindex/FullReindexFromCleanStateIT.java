package org.openmetadata.jpw.scenarios.search.reindex;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.DisabledIfEnvironmentVariable;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.jpw.search.ReindexHelpers;
import org.openmetadata.jpw.search.SearchAssertions;
import org.openmetadata.jpw.server.ServerHandle;
import org.openmetadata.jpw.util.OssTestServer;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.fluent.Apps;

/**
 * Verifies that triggering SearchIndexingApplication from a known-clean state indexes every
 * seeded entity, every per-entity alias resolves to exactly one index, and the umbrella
 * {@code dataAsset} alias contains tables and glossary terms.
 *
 * <p>Covers EPIC #3731 sub-issues: #3735 (alias swap leaves stale indices), #3745
 * (alias/index name collision), #3742 (per-entity promotion).
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
@DisabledIfEnvironmentVariable(named = "JPW_MODE", matches = "external")
class FullReindexFromCleanStateIT {

  private static final String TABLE_ALIAS = "table_search_index";
  private static final String GLOSSARY_TERM_ALIAS = "glossary_term_search_index";
  private static final String DATA_ASSET_ALIAS = "dataAsset";

  private static ServerHandle server;
  private static SearchAssertions searchAssertions;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    searchAssertions = new SearchAssertions(server);
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void reindexFromCleanStateIndexesAllSeededEntities(final TestNamespace ns) {
    final SeededDataset seeded = seed(ns);

    final AppRunRecord run = ReindexHelpers.triggerSearchIndexAndWait(server);
    assertThat(run.getStatus().value())
        .as("SearchIndexingApplication should complete successfully")
        .isIn("SUCCESS", "COMPLETED");

    searchAssertions.assertEntityIndexed(
        TABLE_ALIAS, "table", seeded.table().getFullyQualifiedName());
    searchAssertions.assertEntityIndexed(
        GLOSSARY_TERM_ALIAS, "glossaryTerm", seeded.glossaryTerm().getFullyQualifiedName());
    searchAssertions.assertEntityIndexed(
        DATA_ASSET_ALIAS, "table", seeded.table().getFullyQualifiedName());
    searchAssertions.assertEntityIndexed(
        DATA_ASSET_ALIAS, "glossaryTerm", seeded.glossaryTerm().getFullyQualifiedName());

    assertThat(searchAssertions.indicesForAlias(TABLE_ALIAS))
        .as("Per-entity alias should resolve to exactly one index after reindex")
        .hasSize(1);
    assertThat(searchAssertions.indicesForAlias(GLOSSARY_TERM_ALIAS)).hasSize(1);
  }

  @Test
  void reindexLeavesNoOrphanedIndices(final TestNamespace ns) {
    seed(ns);

    ReindexHelpers.triggerSearchIndexAndWait(server);

    searchAssertions.assertNoOrphanedIndices(TABLE_ALIAS);
    searchAssertions.assertNoOrphanedIndices(GLOSSARY_TERM_ALIAS);
  }

  private SeededDataset seed(final TestNamespace ns) {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    final GlossaryTerm term = GlossaryTermTestFactory.createSimple(ns, glossary);
    return new SeededDataset(table, term);
  }

  private record SeededDataset(Table table, GlossaryTerm glossaryTerm) {}
}
