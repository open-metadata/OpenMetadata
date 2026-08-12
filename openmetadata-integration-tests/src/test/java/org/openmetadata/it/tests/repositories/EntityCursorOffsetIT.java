package org.openmetadata.it.tests.repositories;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.RestUtil;

/**
 * Verifies {@link org.openmetadata.service.jdbi3.EntityRepository#getCursorAtOffset} — the
 * OFFSET-based cursor lookup used by the distributed reindex coordinator/workers to seek to a
 * partition boundary.
 *
 * <p>The cursor computed at an absolute offset MUST equal the keyset cursor of the entity that
 * actually sits at that position in {@code ORDER BY name, id}, otherwise a partition would start
 * reading from the wrong row and silently skip or duplicate entities. The lookup must also select
 * only the bounded {@code name}/{@code id} columns rather than the {@code json} blob — selecting
 * {@code json} drags the full entity into MySQL's filesort and throws {@code ER_OUT_OF_SORTMEMORY}
 * on large catalogs regardless of {@code sort_buffer_size}.
 */
@ExtendWith(TestNamespaceExtension.class)
class EntityCursorOffsetIT {

  private static TableRepository tableRepository;

  @BeforeAll
  static void setupAll() {
    SdkClients.adminClient();
    tableRepository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
  }

  @Test
  void getCursorAtOffset_matchesKeysetOrderingAndHandlesBoundaries(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    // A token shared by every table this test creates, unique to this run, so a nameFilter
    // isolates exactly our rows even while other IT classes mutate table_entity in parallel.
    String token = "curoff" + ns.uniqueShortId();
    int count = 25;
    for (int i = 0; i < count; i++) {
      CreateTable request = new CreateTable();
      request.setName(token + "tbl" + String.format("%02d", i));
      request.setDatabaseSchema(schema.getFullyQualifiedName());
      request.setColumns(List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build()));
      client.tables().create(request);
    }

    ListFilter filter = new ListFilter(Include.NON_DELETED).addQueryParam("nameFilter", token);

    // Ground truth: the same ORDER BY name, id the cursor lookup uses, read via keyset.
    List<String> jsons = tableRepository.getDao().listAfter(filter, count + 5, "", "");
    List<Table> ordered = JsonUtils.readObjects(jsons, Table.class);
    assertEquals(count, ordered.size(), "nameFilter should isolate exactly the tables we created");

    for (int offset = 0; offset < count; offset++) {
      String expected = RestUtil.encodeCursor(tableRepository.getCursorValue(ordered.get(offset)));
      String actual = tableRepository.getCursorAtOffset(filter, offset);
      assertEquals(
          expected, actual, "cursor at offset " + offset + " must point at the offset-th row");
    }

    assertNull(
        tableRepository.getCursorAtOffset(filter, count),
        "offset at the row count must return null, not an error");
    assertNull(
        tableRepository.getCursorAtOffset(filter, count + 10),
        "offset past the end must return null, not an error");
  }
}
