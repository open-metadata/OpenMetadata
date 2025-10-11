package org.openmetadata.it.factories;

import java.util.List;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;

public class TableTestFactory {
  public static Table createSimple(OpenMetadataClient client, TestNamespace ns, String schemaFqn) {
    String name = ns.prefix("table");
    CreateTable req = new CreateTable();
    req.setName(name);
    req.setDatabaseSchema(schemaFqn);
    List<Column> columns =
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build());
    req.setColumns(columns);
    return client.tables().create(req);
  }
}
