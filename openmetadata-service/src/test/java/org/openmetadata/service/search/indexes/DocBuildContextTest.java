package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;

class DocBuildContextTest {

  @Test
  void emptyReturnsSingletonWithNullUpstreamLineage() {
    DocBuildContext first = DocBuildContext.empty();
    DocBuildContext second = DocBuildContext.empty();

    assertSame(first, second);
    assertNull(first.prefetchedUpstreamLineage());
  }

  @Test
  void withUpstreamLineageCarriesNonEmptyList() {
    List<EsLineageData> edges = List.of(new EsLineageData());

    DocBuildContext ctx = DocBuildContext.withUpstreamLineage(edges);

    assertSame(edges, ctx.prefetchedUpstreamLineage());
  }

  @Test
  void withUpstreamLineageCarriesEmptyList() {
    DocBuildContext ctx = DocBuildContext.withUpstreamLineage(Collections.emptyList());

    assertTrue(ctx.prefetchedUpstreamLineage().isEmpty());
  }
}
