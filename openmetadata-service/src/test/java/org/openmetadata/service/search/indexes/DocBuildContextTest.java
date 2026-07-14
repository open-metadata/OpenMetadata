package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.entity.type.Style;

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

  @Test
  void emptyUsesExplicitNotPrefetchedServiceStyleState() {
    DocBuildContext ctx = DocBuildContext.empty();

    assertTrue(ctx.serviceStylePrefetch().style().isEmpty());
    assertFalse(ctx.serviceStylePrefetch().prefetched());
  }

  @Test
  void constructorNormalizesNullServiceStyleState() {
    DocBuildContext ctx = new DocBuildContext(null, null);

    assertTrue(ctx.serviceStylePrefetch().style().isEmpty());
    assertFalse(ctx.serviceStylePrefetch().prefetched());
  }

  @Test
  void serviceStylePrefetchCarriesPresentStyle() {
    Style style = new Style().withColor("#123456");

    DocBuildContext ctx =
        DocBuildContext.of(
            null, DocBuildContext.ServiceStylePrefetch.prefetched(Optional.of(style)));

    assertTrue(ctx.serviceStylePrefetch().prefetched());
    assertSame(style, ctx.serviceStylePrefetch().style().orElseThrow());
  }
}
