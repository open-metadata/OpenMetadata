package org.openmetadata.jpw.scenarios.search.reindex;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.DisabledIfEnvironmentVariable;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.jpw.search.ReindexHelpers;
import org.openmetadata.jpw.search.SearchAssertions;
import org.openmetadata.jpw.server.ServerHandle;
import org.openmetadata.jpw.util.OssTestServer;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.Tables;

/**
 * Verifies that hard-deleted entities are removed from the index after a reindex, and that
 * the orphan cleaner does not leave prefixed/temporary indices behind.
 *
 * <p>Covers EPIC #3731 sub-issues: #3736 (recreate leaves prefixed indices), #3742
 * (per-entity promotion), #3750 (orphan cleaner racing with in-flight rebuild).
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
@DisabledIfEnvironmentVariable(named = "JPW_MODE", matches = "external")
class OrphanedIndexCleanupAfterDeleteIT {

  private static final String TABLE_ALIAS = "table_search_index";

  private static ServerHandle server;
  private static SearchAssertions searchAssertions;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    searchAssertions = new SearchAssertions(server);
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void hardDeletedEntityIsRemovedFromIndexAfterReindex(final TestNamespace ns) {
    final Table table = seedTable(ns);
    ReindexHelpers.triggerSearchIndexAndWait(server);
    searchAssertions.assertEntityIndexed(TABLE_ALIAS, "table", table.getFullyQualifiedName());

    Tables.delete(
        table.getId().toString(), java.util.Map.of("hardDelete", "true", "recursive", "true"));

    ReindexHelpers.triggerSearchIndexAndWait(server);

    searchAssertions.assertEntityNotIndexed(TABLE_ALIAS, "table", table.getFullyQualifiedName());
  }

  @Test
  void reindexLeavesNoPrefixedOrTempIndicesBehind(final TestNamespace ns) {
    seedTable(ns);

    ReindexHelpers.triggerSearchIndexAndWait(server);
    ReindexHelpers.triggerSearchIndexAndWait(server);

    final var indices = searchAssertions.listIndices(TABLE_ALIAS + "*");
    assertThat(indices)
        .as("After two reindex cycles, only alias-owned indices should remain")
        .containsExactlyInAnyOrderElementsOf(searchAssertions.indicesForAlias(TABLE_ALIAS));
  }

  private Table seedTable(final TestNamespace ns) {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    return TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
  }
}
