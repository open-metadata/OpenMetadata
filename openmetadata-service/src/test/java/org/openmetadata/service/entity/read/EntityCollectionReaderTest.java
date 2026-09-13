package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

class EntityCollectionReaderTest {
  private static final Fields FIELDS = new Fields(Set.of("description"));
  private final CollectionDAO.TableDAO dao = mock(CollectionDAO.TableDAO.class);

  @Test
  void idAndNameBatchesKeepLookupOrderingIncludeAndIndependentResults() {
    final Table first = table("first");
    final Table second = table("second");
    final var reader = reader(List.of(second, first), Include.ALL);
    final var projection = new EntityCollectionReader.Projection(null, FIELDS, Include.ALL);
    final List<Table> byId = reader.byIds(List.of(second.getId(), first.getId()), projection);
    final List<Table> byName =
        reader.byNames(List.of(second.getName(), first.getName()), projection);
    assertEquals(List.of("second", "first"), byId.stream().map(Table::getName).toList());
    assertEquals(byId, byName);
    assertNotSame(byId.getFirst(), byName.getFirst());
    assertEquals("list", byId.getFirst().getDescription());
    assertEquals(URI.create("http://localhost/second"), byId.getFirst().getHref());
    byId.clear();
    assertEquals(2, byName.size());
  }

  @Test
  void fullListsUseTheirFilterAndDoNotApplyHrefOrCsvHydration() {
    final Table stored = table("all");
    final ListFilter filter = new ListFilter(Include.DELETED);
    when(dao.listAfter(filter, Integer.MAX_VALUE, "", ""))
        .thenReturn(List.of(JsonUtils.pojoToJson(stored)));
    final var result = reader(List.of(), Include.ALL).all(FIELDS, filter);
    assertEquals("filtered:deleted", result.getFirst().getDescription());
    assertEquals(stored.getId(), result.getFirst().getId());
    assertEquals(null, result.getFirst().getHref());
  }

  @Test
  void csvReadsUseNonDeletedChildrenAndTheirDedicatedHydrationPolicy() {
    final String parent = "service.\"schema.with.dots\"";
    final String hash = FullyQualifiedName.buildHash(parent);
    when(dao.listAll(eq(first(hash)), eq(last(hash)), any(ListFilter.class)))
        .thenAnswer(
            call -> {
              final ListFilter filter = call.getArgument(2);
              assertEquals(Include.NON_DELETED, filter.getInclude());
              return List.of(JsonUtils.pojoToJson(table("csv")));
            });
    final List<Table> result = reader(List.of(), Include.ALL).forCsv(FIELDS, parent);
    assertEquals("csv", result.getFirst().getDescription());
    assertEquals(null, result.getFirst().getHref());
  }

  @Test
  void rawChildRowsPreserveUnfilteredAndFilteredDaoResults() {
    final String parent = "service.parent";
    final String hash = FullyQualifiedName.buildHash(parent);
    final List<String> unfiltered = new ArrayList<>(List.of("unfiltered"));
    final List<String> filtered = new ArrayList<>(List.of("filtered"));
    final ListFilter filter = new ListFilter(Include.ALL);
    when(dao.listAll(first(hash), last(hash))).thenReturn(unfiltered);
    when(dao.listAll(first(hash), last(hash), filter)).thenReturn(filtered);
    final var reader = reader(List.of(), Include.ALL);
    assertSame(unfiltered, reader.rowsUnder(parent));
    assertSame(filtered, reader.rowsUnder(parent, filter));
  }

  @Test
  void emptyListsStayMutableAndMalformedRowsRetainTheirFailure() {
    final ListFilter filter = new ListFilter(Include.NON_DELETED);
    when(dao.listAfter(filter, Integer.MAX_VALUE, "", ""))
        .thenReturn(List.of())
        .thenReturn(List.of("invalid JSON"));
    final var reader = reader(List.of(), Include.NON_DELETED);
    final List<Table> empty = reader.all(FIELDS, filter);
    assertTrue(empty.isEmpty());
    empty.add(table("new"));
    assertEquals(1, empty.size());
    assertThrows(RuntimeException.class, () -> reader.all(FIELDS, filter));
  }

  private EntityCollectionReader<Table> reader(List<Table> found, Include expected) {
    return new EntityCollectionReader<>(
        new EntityReadFactory.Schema<>("table", Table.class, dao),
        new EntityCollectionReader.Lookup<>(
            (ids, include) -> {
              assertEquals(expected, include);
              assertEquals(found.stream().map(Table::getId).toList(), ids);
              return copies(found);
            },
            (names, include) -> {
              assertEquals(expected, include);
              assertEquals(found.stream().map(Table::getName).toList(), names);
              return copies(found);
            }),
        new EntityCollectionReader.Hydration<>(
            (fields, entities) -> entities.forEach(entity -> entity.setDescription("list")),
            (fields, entities, filter) ->
                entities.forEach(
                    entity -> entity.setDescription("filtered:" + filter.getInclude().value())),
            (fields, entities) -> entities.forEach(entity -> entity.setDescription("csv")),
            (uri, entity) -> entity.withHref(URI.create("http://localhost/" + entity.getName()))));
  }

  private static List<Table> copies(List<Table> tables) {
    final List<Table> copies = new ArrayList<>();
    tables.forEach(table -> copies.add(JsonUtils.deepCopy(table, Table.class)));
    return copies;
  }

  private static Table table(String name) {
    return new Table().withId(UUID.randomUUID()).withName(name);
  }

  private static String first(String hash) {
    return hash + ".00000000000000000000000000000000";
  }

  private static String last(String hash) {
    return hash + ".ffffffffffffffffffffffffffffffff";
  }
}
