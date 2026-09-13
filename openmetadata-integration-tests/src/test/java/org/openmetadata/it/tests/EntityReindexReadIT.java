package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class EntityReindexReadIT {
  private static final String SCHEMA_DEFINITION = "CREATE TABLE fixture (id BIGINT)";

  @Test
  void reindexPagesIsolateCorruptMetadataAndClearUnrequestedFields(TestNamespace ns)
      throws Exception {
    SdkClients.adminClient();
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final var healthy = table(ns, schema, "a");
    final var damaged = table(ns, schema, "b");
    assertEquals(
        SCHEMA_DEFINITION,
        SdkClients.adminClient()
            .tables()
            .get(damaged.getId().toString(), "schemaDefinition")
            .getSchemaDefinition());
    final var extensions = Entity.getCollectionDAO().entityExtensionDAO();
    final String key =
        TableRepository.CUSTOM_METRICS_EXTENSION + TableRepository.TABLE_EXTENSION + ".broken";
    try {
      extensions.insert(damaged.getId(), key, "customMetric", "\"invalid-metric\"");
      assertPartialPage(metricSource(schema).readNext(Map.of()), healthy, damaged);
    } finally {
      extensions.delete(damaged.getId(), key);
    }
    final var recovered = metricSource(schema).readNext(Map.of());
    assertTrue(recovered.getErrors().isEmpty());
    assertEquals(
        List.of(healthy.getId(), damaged.getId()),
        recovered.getData().stream().map(EntityInterface::getId).toList());
  }

  private void assertPartialPage(
      ResultList<? extends EntityInterface> page, Table healthy, Table damaged) {
    assertEquals(
        List.of(healthy.getId()), page.getData().stream().map(EntityInterface::getId).toList());
    assertEquals(2, page.getPaging().getTotal());
    assertEquals(1, page.getErrors().size());
    final var error = page.getErrors().getFirst();
    assertFalse(nullOrEmpty(error.getMessage()));
    final Table failed = assertInstanceOf(Table.class, error.getEntity());
    assertEquals(damaged.getId(), failed.getId());
    assertNull(failed.getSchemaDefinition());
    assertFalse(nullOrEmpty(failed.getColumns()));
    assertNull(assertInstanceOf(Table.class, page.getData().getFirst()).getSchemaDefinition());
  }

  private Table table(TestNamespace ns, DatabaseSchema schema, String name) {
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix(name))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withSchemaDefinition(SCHEMA_DEFINITION)
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private PaginatedEntitiesSource metricSource(DatabaseSchema schema) {
    return new PaginatedEntitiesSource(
        Entity.TABLE,
        2,
        List.of("customMetrics"),
        2,
        new ListFilter(Include.ALL)
            .addQueryParam("databaseSchema", schema.getFullyQualifiedName()));
  }
}
