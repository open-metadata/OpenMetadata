package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.entity.read.EntityPageReader.KeysetPage;
import org.openmetadata.service.entity.read.EntityPageReader.OffsetPage;
import org.openmetadata.service.entity.read.EntityPageReader.OffsetSource;
import org.openmetadata.service.entity.read.EntityPageReader.Projection;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;
import software.amazon.awssdk.utils.Either;

class EntityPageReaderTest {
  private final EntityDAO<Table> dao = mock(EntityDAO.class);
  private final ListFilter filter = new ListFilter(Include.NON_DELETED);
  private final Projection projection = new Projection(null, new Fields(Set.of()), filter);
  private final EntityPageReader<Table> reader =
      new EntityPageReader<>(dao, new Source(), ignored -> 3);
  private final Table first = table("a");
  private final Table middle = table("b");
  private final Table last = table("c");

  @Test
  void forwardPageRetainsOrderingAndUsesLookaheadForNextCursor() {
    forward(List.of(json(first), json(middle), json(last)));

    final var page = reader.after(projection, 2, null);

    assertEquals(List.of(first, middle), page.getData());
    assertNull(page.getPaging().getBefore());
    assertEquals(cursor(middle), RestUtil.decodeCursor(page.getPaging().getAfter()));
    assertEquals(3, page.getPaging().getTotal());
  }

  @Test
  void backwardPageDropsTheLeadingLookaheadRow() {
    when(dao.listBefore(eq(filter), anyInt(), anyString(), anyString()))
        .thenReturn(List.of(json(first), json(middle), json(last)));

    final var page = reader.before(projection, 2, RestUtil.encodeCursor(cursor(last)));

    assertEquals(List.of(middle, last), page.getData());
    assertEquals(cursor(middle), RestUtil.decodeCursor(page.getPaging().getBefore()));
    assertEquals(cursor(last), RestUtil.decodeCursor(page.getPaging().getAfter()));
  }

  @Test
  void emptyPagesKeepExistingCursorEchoBehavior() {
    forward(List.of());
    when(dao.listBefore(eq(filter), anyInt(), anyString(), anyString())).thenReturn(List.of());
    final String supplied = RestUtil.encodeCursor(cursor(middle));

    assertEquals(
        supplied,
        RestUtil.decodeCursor(reader.after(projection, 2, supplied).getPaging().getBefore()));
    assertEquals(
        supplied,
        RestUtil.decodeCursor(reader.before(projection, 2, supplied).getPaging().getAfter()));
  }

  @Test
  void countOnlyPagesDoNotParseCursorsOrReadRows() {
    final EntityDAO<Table> unreadable =
        mock(
            EntityDAO.class,
            invocation -> {
              throw new AssertionError("Count-only pagination must not read rows");
            });
    final var counts = new EntityPageReader<>(unreadable, new Source(), ignored -> 17);

    assertEquals(17, counts.after(projection, 0, "invalid").getPaging().getTotal());
    assertEquals(17, counts.before(projection, 0, "invalid").getPaging().getTotal());
    assertTrue(
        counts.keyset(new KeysetPage(projection, 0, "invalid", 17, false)).getData().isEmpty());
  }

  @Test
  void keysetPagesReportMalformedRowsAndKeepTheLastReturnedCursor() {
    forward(List.of(json(first), "invalid json", json(last)));

    final var page = reader.keyset(new KeysetPage(projection, 2, null, 3, true));

    assertEquals(List.of(first), page.getData());
    assertEquals(1, page.getErrors().size());
    assertEquals(cursor(first), RestUtil.decodeCursor(page.getPaging().getAfter()));
    assertThrows(
        RuntimeException.class, () -> reader.keyset(new KeysetPage(projection, 2, null, 3, false)));
  }

  @Test
  void offsetPagesPreserveOffsetMetadataAndErrorHandling() {
    when(dao.listAfter(filter, 2, 1)).thenReturn(List.of(json(middle), json(last)));
    final var direct = reader.offset(projection, 2, 1);
    assertEquals(List.of(middle, last), direct.getData());
    assertEquals(1, direct.getPaging().getOffset());

    final OffsetSource queries =
        new OffsetSource(
            (request, limit, offset) -> List.of(json(middle), "invalid json"), request -> 6);
    final String offset = RestUtil.encodeCursor("2");
    final var page = reader.offset(new OffsetPage(projection, 2, offset, true), queries);
    assertEquals(List.of(middle), page.getData());
    assertEquals(1, page.getErrors().size());
    assertEquals("4", RestUtil.decodeCursor(page.getPaging().getAfter()));
    assertEquals("0", RestUtil.decodeCursor(page.getPaging().getBefore()));
    assertThrows(
        RuntimeException.class,
        () -> reader.offset(new OffsetPage(projection, 2, offset, false), queries));
  }

  private void forward(final List<String> rows) {
    when(dao.listAfter(eq(filter), anyInt(), anyString(), anyString())).thenReturn(rows);
  }

  @Test
  void directionalFilteringPrecedesBothCountingAndRowSelection() {
    final var policy =
        EntityPagePolicy.<Table>filtered(request -> request.addQueryParam("domain", "allowed"));
    final EntityPages<Table> filtered =
        new EntityPageReader<>(
            dao,
            new Source(),
            request -> "allowed".equals(request.getQueryParams().get("domain")) ? 1 : 3,
            policy);
    when(dao.listAfter(eq(filter), anyInt(), anyString(), anyString()))
        .thenAnswer(
            ignored ->
                filter.getQueryParams().containsKey("domain")
                    ? List.of(json(middle))
                    : List.of(json(first), json(middle), json(last)));
    when(dao.listBefore(eq(filter), anyInt(), anyString(), anyString()))
        .thenAnswer(
            ignored ->
                filter.getQueryParams().containsKey("domain")
                    ? List.of(json(middle))
                    : List.of(json(first), json(middle), json(last)));

    final var forward = filtered.after(projection, 3, null);
    assertEquals(List.of(middle), forward.getData());
    assertEquals(1, forward.getPaging().getTotal());
    filter.getQueryParams().clear();
    final var backward = filtered.before(projection, 3, RestUtil.encodeCursor(cursor(last)));
    assertEquals(List.of(middle), backward.getData());
    assertEquals(1, backward.getPaging().getTotal());
  }

  @Test
  void orderingPolicySelectsBothDirectionsAndRetainsDefaultFallback() {
    final var policy =
        EntityPagePolicy.<Table>ordered(
            request -> request.getSortField() != null,
            (request, limit, cursor) -> new ResultList<>(List.of(last), cursor, "forward", limit),
            (request, limit, cursor) ->
                new ResultList<>(List.of(first), "backward", cursor, limit));
    final EntityPages<Table> ordered =
        new EntityPageReader<>(dao, new Source(), ignored -> 3, policy);
    forward(List.of(json(middle)));
    when(dao.listBefore(eq(filter), anyInt(), anyString(), anyString()))
        .thenReturn(List.of(json(middle)));

    assertEquals(List.of(middle), ordered.after(projection, 1, null).getData());
    assertEquals(
        List.of(middle),
        ordered.before(projection, 1, RestUtil.encodeCursor(cursor(last))).getData());
    filter.withSort("displayName", "DESC");
    final var forward = ordered.after(projection, 2, "previous");
    assertEquals(List.of(last), forward.getData());
    assertEquals(2, forward.getPaging().getTotal());
    assertEquals("previous", RestUtil.decodeCursor(forward.getPaging().getBefore()));
    assertEquals("forward", RestUtil.decodeCursor(forward.getPaging().getAfter()));
    final var backward = ordered.before(projection, 4, "next");
    assertEquals(List.of(first), backward.getData());
    assertEquals(4, backward.getPaging().getTotal());
    assertEquals("backward", RestUtil.decodeCursor(backward.getPaging().getBefore()));
    assertEquals("next", RestUtil.decodeCursor(backward.getPaging().getAfter()));
  }

  @Test
  void directionalPolicyDoesNotChangeOffsetOrReindexQueries() {
    final var policy =
        EntityPagePolicy.<Table>filtered(request -> request.addQueryParam("domain", "allowed"));
    final EntityPages<Table> filtered =
        new EntityPageReader<>(dao, new Source(), ignored -> 3, policy);
    when(dao.listAfter(filter, 1, 0)).thenReturn(List.of(json(first)));
    forward(List.of(json(first), json(middle)));

    assertEquals(List.of(first), filtered.offset(projection, 1, 0).getData());
    assertEquals(
        List.of(first), filtered.keyset(new KeysetPage(projection, 1, null, 3, false)).getData());
    assertTrue(filter.getQueryParams().isEmpty());
  }

  private Table table(final String name) {
    return new Table().withId(UUID.randomUUID()).withName(name);
  }

  private static String json(final Table table) {
    return JsonUtils.pojoToJson(table);
  }

  private static String cursor(final Table table) {
    return JsonUtils.pojoToJson(Map.of("name", table.getName(), "id", table.getId().toString()));
  }

  private static final class Source implements EntityPageReader.Source<Table> {
    @Override
    public List<Table> hydrate(final List<String> rows, final Projection projection) {
      return new ArrayList<>(JsonUtils.readObjects(rows, Table.class));
    }

    @Override
    public Iterator<Either<Table, EntityError>> deserialize(
        final List<String> rows, final Projection projection) {
      return rows.stream()
          .map(
              row -> {
                try {
                  return Either.<Table, EntityError>left(JsonUtils.readValue(row, Table.class));
                } catch (RuntimeException exception) {
                  return Either.<Table, EntityError>right(
                      new EntityError().withMessage(exception.getMessage()));
                }
              })
          .iterator();
    }

    @Override
    public String cursor(final Table entity) {
      return EntityPageReaderTest.cursor(entity);
    }
  }
}
