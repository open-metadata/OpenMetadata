package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
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
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.service.Entity;

/**
 * Builds a 10-level deep parent→child chain of glossary terms and asserts that:
 *
 * <ul>
 *   <li>The reindex completes (no stack overflow or OOM walking the hierarchy);
 *   <li>The deepest descendant is indexed and findable;
 *   <li>{@code StepStats.failedRecords} is zero (graceful handling of deep parent
 *       reference chains).
 * </ul>
 *
 * <p>This catches regressions where parent-chain resolution recurses without a
 * depth guard or blows the doc shape with per-level fields.
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class NestedHierarchyIndexIT {

  private static final int DEPTH = 10;

  private static ServerHandle server;
  private static SearchAssertions search;
  private static String glossaryTermAlias;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    search = new SearchAssertions(server);
    Apps.setDefaultClient(SdkClients.adminClient());
    glossaryTermAlias = new IndexAliasInspector(server).indexNameFor(Entity.GLOSSARY_TERM);
  }

  @Test
  void deepGlossaryChainReindexesWithoutFailure(final TestNamespace ns) {
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm cursor = GlossaryTermTestFactory.createWithName(ns, glossary, "lvl_0");
    for (int level = 1; level < DEPTH; level++) {
      cursor = GlossaryTermTestFactory.createChild(ns, glossary, cursor, "lvl_" + level);
    }
    final GlossaryTerm leaf = cursor;

    final AppRunRecord run = ReindexHelpers.triggerSearchIndexAndWait(server);
    assertThat(run.getStatus().value()).isIn("success", "completed");
    final Integer failed = run.getSuccessContext().getStats().getSinkStats().getFailedRecords();
    assertThat(failed == null ? 0 : failed)
        .as("deep glossary chain must not produce failed records")
        .isZero();

    search.assertEntityIndexed(
        glossaryTermAlias, Entity.GLOSSARY_TERM, leaf.getFullyQualifiedName());
  }
}
