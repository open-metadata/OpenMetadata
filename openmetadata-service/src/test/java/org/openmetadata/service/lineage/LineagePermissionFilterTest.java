package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * The filter's decision paths, asserted through what survives in the graph rather than through
 * interactions with the authorizer.
 *
 * <p>The table repository is registered here rather than borrowed from whatever else ran first:
 * {@code Entity}'s type map is static, so a test that relies on another class having populated it
 * passes or fails on execution order.
 */
class LineagePermissionFilterTest {

  private static final UUID ROOT = UUID.randomUUID();

  private Authorizer authorizer;
  private SecurityContext securityContext;
  private LineagePermissionFilter filter;

  @BeforeAll
  static void registerRepository() {
    TableRepository tableRepository = mock(TableRepository.class);
    when(tableRepository.getEntityType()).thenReturn(Entity.TABLE);
    when(tableRepository.getFields(anyString())).thenReturn(Fields.EMPTY_FIELDS);
    when(tableRepository.get(isNull(), anyList(), any(Fields.class), any(Include.class)))
        .thenAnswer(
            invocation -> {
              List<UUID> ids = invocation.getArgument(1);
              List<Table> tables = new ArrayList<>();
              ids.forEach(id -> tables.add(table(id)));
              return tables;
            });
    Entity.registerEntity(Table.class, Entity.TABLE, tableRepository);
  }

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
   * A bot is not exempt. {@code DefaultAuthorizer} short-circuits admins alone, so its root entity
   * is policy-evaluated in full; exempting it here would let a tag-scoped bot read neighbours that a
   * direct entity read denies it.
   */
  @Test
  void botIsNotExemptFromFiltering() {
    EntityLineage lineage = graphWithNodes(2);
    SubjectContext bot = mock(SubjectContext.class);
    when(bot.isAdmin()).thenReturn(false);
    when(bot.isBot()).thenReturn(true);
    denyEverything();

    filter.filter(securityContext, bot, lineage);

    assertTrue(lineage.getNodes().isEmpty(), "a bot's neighbours must still be filtered");
  }

  @Test
  void allowedNodesSurvive() {
    EntityLineage lineage = graphWithNodes(3);

    LineagePermissionFilter.Result result = filter.filter(securityContext, nonAdmin(), lineage);

    assertEquals(0, result.hiddenNodes());
    assertEquals(3, lineage.getNodes().size());
  }

  @Test
  void deniedNodesAreRemovedWithTheirEdges() {
    EntityLineage lineage = graphWithNodes(3);
    denyEverything();

    LineagePermissionFilter.Result result = filter.filter(securityContext, nonAdmin(), lineage);

    assertEquals(3, result.hiddenNodes());
    assertEquals(0, result.uncheckedNodes(), "these were checked and denied, not skipped");
    assertTrue(lineage.getNodes().isEmpty());
    assertTrue(lineage.getUpstreamEdges().isEmpty(), "their edges must go with them");
  }

  /** Fail closed on an unexpected error, and contain it to the one node. */
  @Test
  void nodesWhoseCheckThrowsUnexpectedlyAreRemoved() {
    EntityLineage lineage = graphWithNodes(2);
    doThrow(new IllegalStateException("malformed policy"))
        .when(authorizer)
        .authorize(any(), any(), any());

    LineagePermissionFilter.Result result = filter.filter(securityContext, nonAdmin(), lineage);

    assertEquals(2, result.hiddenNodes());
    assertTrue(lineage.getNodes().isEmpty());
  }

  /**
   * The point of the ceiling: it must not become a way to ask for the unfiltered graph. Depth is
   * caller-controlled, so a caller who can grow the graph past the limit would otherwise receive
   * every denied node's identity.
   */
  @Test
  void graphOverTheCeilingHidesTheRemainderRatherThanReturningIt() {
    int overCeiling = 501;
    EntityLineage lineage = graphWithNodes(overCeiling);

    LineagePermissionFilter.Result result = filter.filter(securityContext, nonAdmin(), lineage);

    assertTrue(result.hiddenUnchecked(), "the ceiling must be reported");
    assertEquals(
        1,
        result.uncheckedNodes(),
        "exactly the one node past the ceiling was never checked, and it must not be returned");
    assertEquals(
        overCeiling - 1,
        lineage.getNodes().size(),
        "the nodes that were checked and allowed still come back");
  }

  @Test
  void emptyAndNullGraphsArePassedThrough() {
    LineagePermissionFilter.Result nullResult = filter.filter(securityContext, nonAdmin(), null);
    assertEquals(0, nullResult.hiddenNodes());
    assertSame(null, nullResult.lineage());

    EntityLineage empty = new EntityLineage().withEntity(ref(ROOT)).withNodes(new ArrayList<>());
    assertSame(empty, filter.filter(securityContext, nonAdmin(), empty).lineage());
  }

  @Test
  void canViewIsTrueOnlyWhenAuthorizeSucceeds() {
    assertTrue(filter.canView(securityContext, ref(UUID.randomUUID())));

    denyEverything();
    assertFalse(filter.canView(securityContext, ref(UUID.randomUUID())));
  }

  @Test
  void canViewRejectsUnusableReferences() {
    assertFalse(filter.canView(securityContext, null));
    assertFalse(filter.canView(securityContext, new EntityReference().withId(UUID.randomUUID())));
  }

  private void denyEverything() {
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());
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

  private static Table table(UUID id) {
    return new Table().withId(id).withName("t_" + id).withFullyQualifiedName("svc.db.sch.t_" + id);
  }

  private static EntityReference ref(UUID id) {
    return new EntityReference()
        .withId(id)
        .withType(Entity.TABLE)
        .withFullyQualifiedName("svc.db.sch." + id);
  }
}
