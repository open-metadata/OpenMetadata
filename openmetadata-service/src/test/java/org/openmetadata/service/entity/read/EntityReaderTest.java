package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.entity.read.EntityReadService.Query;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityReaderTest {
  private final Query query =
      new Query(null, Fields.EMPTY_FIELDS, RelationIncludes.fromInclude(Include.ALL), false);

  @Test
  void optionalReadReturnsTheHydratedEntity() {
    final Table table = new Table().withName("found");
    final EntityReader<Table> reader = EntityReadFixture.byName((name, projection) -> table);
    assertSame(table, reader.optionalByName("found", query).orElseThrow());
  }

  @Test
  void optionalReadOnlySuppressesMissingEntities() {
    final EntityReader<Table> reader =
        EntityReadFixture.byName(
            (name, projection) -> {
              throw new EntityNotFoundException(name);
            });
    assertTrue(reader.optionalByName("missing", query).isEmpty());
    final var failure = new IllegalStateException("Database unavailable");
    final EntityReader<Table> unavailable =
        EntityReadFixture.byName(
            (name, projection) -> {
              throw failure;
            });
    assertSame(
        failure,
        assertThrows(
            IllegalStateException.class, () -> unavailable.optionalByName("found", query)));
  }
}
