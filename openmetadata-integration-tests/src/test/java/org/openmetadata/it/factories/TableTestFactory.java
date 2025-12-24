package org.openmetadata.it.factories;

import java.util.List;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.fluent.Tables;

/**
 * Factory for creating Table entities in integration tests using fluent API.
 *
 * <p>Uses the static fluent API from {@link Tables}. Ensure
 * {@code Tables.setDefaultClient(client)} is called before using these methods.
 */
public class TableTestFactory {

  private static final List<Column> DEFAULT_COLUMNS =
      List.of(
          new Column().withName("id").withDataType(ColumnDataType.BIGINT),
          new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255));

  /**
   * Create a table with default settings using fluent API.
   */
  public static Table createSimple(TestNamespace ns, String schemaFqn) {
    return Tables.create()
        .name(ns.prefix("table"))
        .inSchema(schemaFqn)
        .withColumns(DEFAULT_COLUMNS)
        .execute();
  }

  /**
   * Create table with custom name using fluent API.
   */
  public static Table createWithName(TestNamespace ns, String schemaFqn, String baseName) {
    return Tables.create()
        .name(ns.prefix(baseName))
        .inSchema(schemaFqn)
        .withColumns(DEFAULT_COLUMNS)
        .execute();
  }

  /**
   * Create table with description using fluent API.
   */
  public static Table createWithDescription(
      TestNamespace ns, String schemaFqn, String description) {
    return Tables.create()
        .name(ns.prefix("table"))
        .inSchema(schemaFqn)
        .withDescription(description)
        .withColumns(DEFAULT_COLUMNS)
        .execute();
  }

  /**
   * Create table with a direct name (no namespace prefix) using fluent API.
   * Useful for tests that need short names to avoid FQN length limits.
   */
  public static Table createSimpleWithName(String name, TestNamespace ns, String schemaFqn) {
    return Tables.create().name(name).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
  }
}
