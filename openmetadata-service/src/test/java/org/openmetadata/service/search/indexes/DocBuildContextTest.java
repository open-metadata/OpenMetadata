package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class DocBuildContextTest {

  @Test
  void emptyReturnsSingletonWithNullUpstreamLineage() {
    DocBuildContext first = DocBuildContext.empty();
    DocBuildContext second = DocBuildContext.empty();

    assertSame(first, second);
    assertNull(first.prefetchedUpstreamLineage());
    assertNull(first.relationshipRevision());
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

  @Test
  void carriesPrefetchedTestSuiteRelationshipRevision() {
    DocBuildContext ctx =
        DocBuildContext.of(null, DocBuildContext.ServiceStylePrefetch.notPrefetched(), 42L);

    assertEquals(42L, ctx.relationshipRevision());
  }

  @Test
  void relationshipRevisionFactorySkipsOtherPrefetches() {
    DocBuildContext ctx = DocBuildContext.withRelationshipRevision(43L);

    assertEquals(43L, ctx.relationshipRevision());
    assertNull(ctx.prefetchedUpstreamLineage());
    assertFalse(ctx.serviceStylePrefetch().prefetched());
    assertNull(ctx.prefetchedDomains());
  }

  @Test
  void withDomainsCarriesPrefetchedDomainsWithoutSettingOtherFields() {
    List<EntityReference> domains =
        List.of(new EntityReference().withId(UUID.randomUUID()).withType(Entity.DOMAIN));

    DocBuildContext ctx = DocBuildContext.withDomains(domains);

    assertSame(domains, ctx.prefetchedDomains());
    assertNull(ctx.prefetchedUpstreamLineage());
    assertNull(ctx.relationshipRevision());
    assertFalse(ctx.serviceStylePrefetch().prefetched());
  }

  @Test
  void fourArgFactoryCarriesAllPrefetchedFields() {
    List<EsLineageData> edges = List.of(new EsLineageData());
    Style style = new Style().withColor("#abcdef");
    List<EntityReference> domains = List.of();

    DocBuildContext ctx =
        DocBuildContext.of(
            edges,
            DocBuildContext.ServiceStylePrefetch.prefetched(Optional.of(style)),
            7L,
            domains);

    assertSame(edges, ctx.prefetchedUpstreamLineage());
    assertSame(style, ctx.serviceStylePrefetch().style().orElseThrow());
    assertEquals(7L, ctx.relationshipRevision());
    assertSame(domains, ctx.prefetchedDomains());
  }
}
