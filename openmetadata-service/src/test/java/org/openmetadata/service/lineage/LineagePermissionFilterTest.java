package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * The filter's decision paths, asserted through what survives in the graph rather than through
 * interactions with the authorizer. The batch-load path needs a registered repository, so these
 * tests drive the single-reference {@code canView} and the short-circuit/ceiling branches, which is
 * where the fail-open risks live.
 */
class LineagePermissionFilterTest {

  private static final UUID ROOT = UUID.randomUUID();

  private Authorizer authorizer;
  private SecurityContext securityContext;
  private LineagePermissionFilter filter;

  @BeforeEach
  void setUp() {
    authorizer = mock(Authorizer.class);
    securityContext = mock(SecurityContext.class);
    filter = new LineagePermissionFilter(authorizer);
  }

  @Test
  void adminGraphIsReturnedUntouchedAndUnauthorized() {
    EntityLineage lineage = graphWithNodes(2);
    SubjectContext admin = mock(SubjectContext.class);
    when(admin.isAdmin()).thenReturn(true);

    LineagePermissionFilter.Result result = filter.filter(securityContext, admin, lineage);

    assertSame(lineage, result.lineage());
    assertEquals(0, result.hiddenNodes());
    assertFalse(result.hiddenUnchecked());
    assertEquals(2, lineage.getNodes().size());
    verify(authorizer, never()).authorize(any(), any(), any());
  }

  /**
   * A bot is not exempt. {@code DefaultAuthorizer} short-circuits admins only, so its root entity is
   * policy-evaluated in full; exempting it here would let a tag-scoped bot read neighbours that a
   * direct entity read denies it.
   */
  @Test
  void botIsNotExemptFromFiltering() {
    EntityLineage lineage = graphWithNodes(2);
    SubjectContext bot = mock(SubjectContext.class);
    when(bot.isAdmin()).thenReturn(false);
    when(bot.isBot()).thenReturn(true);

    filter.filter(securityContext, bot, lineage);

    // Nodes have no registered repository here, so every one fails closed and is removed.
    assertEquals(0, lineage.getNodes().size(), "a bot's neighbours must still be filtered");
  }

  @Test
  void nodesWithoutADecisionAreRemovedNotReturned() {
    EntityLineage lineage = graphWithNodes(3);

    LineagePermissionFilter.Result result = filter.filter(securityContext, nonAdmin(), lineage);

    assertEquals(3, result.hiddenNodes());
    assertTrue(lineage.getNodes().isEmpty(), "an unauthorizable node must never be returned");
    assertTrue(lineage.getUpstreamEdges().isEmpty(), "its edges must go with it");
  }

  /**
   * The whole point of the ceiling: it must not become a way to ask for the unfiltered graph. Depth
   * is caller-controlled, so a caller who can grow the graph past the limit would otherwise receive
   * every denied node's identity.
   */
  @Test
  void graphOverTheCeilingIsPrunedNotReturnedUnchecked() {
    int overCeiling = 501;
    EntityLineage lineage = graphWithNodes(overCeiling);

    LineagePermissionFilter.Result result = filter.filter(securityContext, nonAdmin(), lineage);

    assertTrue(result.hiddenUnchecked(), "the ceiling must be reported");
    assertEquals(overCeiling, result.hiddenNodes());
    assertTrue(
        lineage.getNodes().isEmpty(),
        "nodes past the ceiling must be hidden, never returned unchecked");
  }

  @Test
  void emptyAndNullGraphsArePassedThrough() {
    assertEquals(0, filter.filter(securityContext, nonAdmin(), null).hiddenNodes());
    assertEquals(null, filter.filter(securityContext, nonAdmin(), null).lineage());

    EntityLineage empty = new EntityLineage().withEntity(ref(ROOT)).withNodes(new ArrayList<>());
    assertSame(empty, filter.filter(securityContext, nonAdmin(), empty).lineage());
  }

  @Test
  void canViewIsTrueOnlyWhenAuthorizeSucceeds() {
    assertTrue(filter.canView(securityContext, ref(UUID.randomUUID())));

    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());
    assertFalse(filter.canView(securityContext, ref(UUID.randomUUID())));
  }

  /** Fail closed on an unexpected error, and contain it to the one reference. */
  @Test
  void canViewSwallowsUnexpectedRuntimeExceptions() {
    doAnswer(
            invocation -> {
              throw new IllegalStateException("malformed policy");
            })
        .when(authorizer)
        .authorize(any(), any(), any());

    assertFalse(filter.canView(securityContext, ref(UUID.randomUUID())));
  }

  @Test
  void canViewRejectsUnusableReferences() {
    assertFalse(filter.canView(securityContext, null));
    assertFalse(filter.canView(securityContext, new EntityReference().withId(UUID.randomUUID())));
  }

  private static SubjectContext nonAdmin() {
    SubjectContext subject = mock(SubjectContext.class);
    when(subject.isAdmin()).thenReturn(false);
    return subject;
  }

  /** Root plus {@code count} upstream nodes, each joined directly to the root. */
  private static EntityLineage graphWithNodes(int count) {
    List<EntityReference> nodes = new ArrayList<>();
    List<Edge> edges = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      UUID id = UUID.randomUUID();
      nodes.add(ref(id));
      edges.add(new Edge().withFromEntity(id).withToEntity(ROOT));
    }
    return new EntityLineage()
        .withEntity(ref(ROOT))
        .withNodes(nodes)
        .withUpstreamEdges(edges)
        .withDownstreamEdges(new ArrayList<>());
  }

  private static EntityReference ref(UUID id) {
    return new EntityReference()
        .withId(id)
        .withType(Entity.TABLE)
        .withFullyQualifiedName("svc.db.sch." + id);
  }
}
