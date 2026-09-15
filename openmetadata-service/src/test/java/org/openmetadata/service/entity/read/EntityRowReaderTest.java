package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.read.EntityPageReader.Projection;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;
import software.amazon.awssdk.utils.Either;

class EntityRowReaderTest {
  private static final URI HREF = URI.create("http://localhost/api/v1/tables/fixture");
  private final Hydration hydration = new Hydration();
  private final EntityRowReader<Table> reader =
      new EntityRowReader<>(Table.class, hydration, Table::getName);
  private final Projection projection =
      new Projection(
          mock(UriInfo.class), new Fields(Set.of("description")), new ListFilter(Include.ALL));

  @Test
  void strictRowsHaveRequestedFieldsAndHrefInTheirOriginalOrder() {
    final List<Table> tables = reader.hydrate(List.of(json("first"), json("last")), projection);

    assertEquals(List.of("first", "last"), tables.stream().map(Table::getName).toList());
    assertEquals("bulk", tables.getFirst().getDescription());
    assertEquals(HREF, tables.getFirst().getHref());
    assertEquals("last", reader.cursor(tables.getLast()));
    assertThrows(RuntimeException.class, () -> reader.hydrate(List.of("invalid"), projection));
  }

  @Test
  void tolerantRowsKeepParseErrorsAheadOfHydratedEntities() {
    final var results =
        results(reader.deserialize(List.of(json("first"), "invalid", json("last")), projection));

    assertEquals(3, results.size());
    assertTrue(
        results.getFirst().right().orElseThrow().getMessage().startsWith("Failed to deserialize"));
    assertNull(results.getFirst().right().orElseThrow().getEntity());
    assertEquals("first", results.get(1).left().orElseThrow().getName());
    assertEquals("bulk", results.get(1).left().orElseThrow().getDescription());
    assertEquals(HREF, results.getLast().left().orElseThrow().getHref());
  }

  @Test
  void bulkFailureFallsBackPerEntityAndClearsUnrequestedFieldsOnErrors() {
    hydration.bulkFailure = true;
    final var results =
        results(
            reader.deserialize(List.of(json("first"), json("missing"), json("last")), projection));

    assertEquals(3, results.size());
    assertEquals("single", results.getFirst().left().orElseThrow().getDescription());
    assertEquals(HREF, results.getFirst().left().orElseThrow().getHref());
    final EntityError error = results.get(1).right().orElseThrow();
    assertEquals("Missing relationship", error.getMessage());
    assertNull(((Table) error.getEntity()).getOwners());
    assertEquals("last", results.getLast().left().orElseThrow().getName());
  }

  @Test
  void tolerantEmptyRowsAndNullUriDoNotManufactureEntitiesOrHref() {
    assertTrue(results(reader.deserialize(List.of(), projection)).isEmpty());
    assertEquals(1, results(reader.deserialize(List.of("invalid"), projection)).size());
    final var withoutUri = new Projection(null, projection.fields(), projection.filter());

    final var results = results(reader.deserialize(List.of(json("first")), withoutUri));

    assertNull(results.getFirst().left().orElseThrow().getHref());
    hydration.bulkFailure = true;
    final var fallback = results(reader.deserialize(List.of(json("first")), withoutUri));
    assertNull(fallback.getFirst().left().orElseThrow().getHref());
  }

  @Test
  void strictRowsPropagateHydrationFailure() {
    hydration.bulkFailure = true;

    assertThrows(
        IllegalStateException.class, () -> reader.hydrate(List.of(json("first")), projection));
  }

  private List<Either<Table, EntityError>> results(
      final Iterator<Either<Table, EntityError>> rows) {
    final List<Either<Table, EntityError>> results = new ArrayList<>();
    rows.forEachRemaining(results::add);
    return results;
  }

  private String json(final String name) {
    return JsonUtils.pojoToJson(new Table().withId(UUID.randomUUID()).withName(name));
  }

  private static final class Hydration implements EntityRowReader.Hydration<Table> {
    private boolean bulkFailure;

    @Override
    public void bulk(final List<Table> entities, final Projection projection) {
      if (bulkFailure) {
        throw new IllegalStateException("Bulk relationship read failed");
      }
      entities.forEach(entity -> entity.setDescription("bulk"));
    }

    @Override
    public void single(final Table entity, final Fields fields) {
      if (entity.getName().equals("missing")) {
        entity.setOwners(List.of(new EntityReference().withName("unrequested")));
        throw new IllegalStateException("Missing relationship");
      }
      entity.setDescription("single");
    }

    @Override
    public void clear(final Table entity, final Fields fields) {
      entity.setOwners(null);
    }

    @Override
    public Table withHref(final Table entity, final UriInfo uriInfo) {
      return entity.withHref(HREF);
    }
  }
}
