package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;

/**
 * Fluent wrapper for Table entity to enable method chaining for updates.
 *
 * Usage:
 * <pre>
 * Table updatedTable = new FluentTable(table, client)
 *     .withDescription("Updated description")
 *     .addTags("PII", "Critical")
 *     .addColumn("new_column", "VARCHAR(100)")
 *     .save()
 *     .get();
 * </pre>
 */
public class FluentTable {
  private Table table;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentTable(Table table, OpenMetadataClient client) {
    this.table = table;
    this.client = client;
  }

  /**
   * Update the table description.
   */
  public FluentTable withDescription(String description) {
    table.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the table display name.
   */
  public FluentTable withDisplayName(String displayName) {
    table.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a tag to the table.
   */
  public FluentTable addTag(String tagFQN) {
    List<TagLabel> tags = table.getTags();
    if (tags == null) {
      tags = new ArrayList<>();
      table.setTags(tags);
    }
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    modified = true;
    return this;
  }

  /**
   * Add multiple tags to the table.
   */
  public FluentTable addTags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      addTag(tagFQN);
    }
    return this;
  }

  /**
   * Remove a tag from the table.
   */
  public FluentTable removeTag(String tagFQN) {
    List<TagLabel> tags = table.getTags();
    if (tags != null) {
      tags.removeIf(tag -> tagFQN.equals(tag.getTagFQN()));
      modified = true;
    }
    return this;
  }

  /**
   * Set all tags (replaces existing) from tag FQN strings.
   */
  public FluentTable withTags(String... tagFQNs) {
    List<TagLabel> tags = new ArrayList<>();
    for (String tagFQN : tagFQNs) {
      tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    }
    table.setTags(tags);
    modified = true;
    return this;
  }

  /**
   * Set all tags (replaces existing) from TagLabel list.
   */
  public FluentTable withTags(List<TagLabel> tags) {
    table.setTags(tags);
    modified = true;
    return this;
  }

  /**
   * Add a column to the table.
   */
  public FluentTable addColumn(Column column) {
    List<Column> columns = table.getColumns();
    if (columns == null) {
      columns = new ArrayList<>();
      table.setColumns(columns);
    }
    columns.add(column);
    modified = true;
    return this;
  }

  /**
   * Add a column using name and type.
   */
  public FluentTable addColumn(String name, String dataType) {
    Column col = new Column().withName(name);
    // Try to parse the data type
    try {
      String cleanType = dataType.replaceAll("\\(.*\\)", "").toUpperCase();
      col.setDataType(ColumnDataType.fromValue(cleanType));
    } catch (Exception e) {
      col.setDataType(ColumnDataType.UNKNOWN);
    }
    return addColumn(col);
  }

  /**
   * Add a column using a builder.
   */
  public FluentTable addColumn(ColumnBuilder builder) {
    return addColumn(builder.build());
  }

  /**
   * Remove a column by name.
   */
  public FluentTable removeColumn(String columnName) {
    List<Column> columns = table.getColumns();
    if (columns != null) {
      columns.removeIf(col -> columnName.equals(col.getName()));
      modified = true;
    }
    return this;
  }

  /**
   * Update a column's description.
   */
  public FluentTable updateColumnDescription(String columnName, String description) {
    List<Column> columns = table.getColumns();
    if (columns != null) {
      columns.stream()
          .filter(col -> columnName.equals(col.getName()))
          .findFirst()
          .ifPresent(
              col -> {
                col.setDescription(description);
                modified = true;
              });
    }
    return this;
  }

  /**
   * Add a tag to a specific column.
   */
  public FluentTable addColumnTag(String columnName, String tagFQN) {
    List<Column> columns = table.getColumns();
    if (columns != null) {
      columns.stream()
          .filter(col -> columnName.equals(col.getName()))
          .findFirst()
          .ifPresent(
              col -> {
                List<TagLabel> tags = col.getTags();
                if (tags == null) {
                  tags = new ArrayList<>();
                  col.setTags(tags);
                }
                tags.add(
                    new TagLabel()
                        .withTagFQN(tagFQN)
                        .withSource(TagLabel.TagSource.CLASSIFICATION));
                modified = true;
              });
    }
    return this;
  }

  /**
   * Get the underlying table entity (alias for get()).
   */
  public Table getTable() {
    return table;
  }

  /**
   * Set owners on the table.
   */
  public FluentTable withOwners(List<EntityReference> owners) {
    table.setOwners(owners);
    modified = true;
    return this;
  }

  /**
   * Set domains on the table.
   */
  public FluentTable withDomains(List<EntityReference> domains) {
    table.setDomains(domains);
    modified = true;
    return this;
  }

  /**
   * Set data products on the table.
   */
  public FluentTable withDataProducts(List<EntityReference> dataProducts) {
    table.setDataProducts(dataProducts);
    modified = true;
    return this;
  }

  /**
   * Replace all columns on the table.
   */
  public FluentTable withColumns(List<Column> columns) {
    table.setColumns(columns);
    modified = true;
    return this;
  }

  /**
   * Delete this table.
   */
  public Tables.TableDeleter delete() {
    if (table.getId() == null) {
      throw new IllegalStateException("Table must have an ID to delete");
    }
    return new Tables.TableDeleter(client, table.getId().toString());
  }

  /**
   * Set custom extension data.
   */
  public FluentTable withExtension(Object extension) {
    table.setExtension(extension);
    modified = true;
    return this;
  }

  /**
   * Save the changes to the server.
   */
  public FluentTable save() {
    if (!modified) {
      return this;
    }

    if (table.getId() == null) {
      throw new IllegalStateException("Table must have an ID to update");
    }

    this.table = client.tables().update(table.getId().toString(), table);
    modified = false;
    return this;
  }

  /**
   * Get the underlying table entity.
   */
  public Table get() {
    return table;
  }

  /**
   * Check if the table has been modified.
   */
  public boolean isModified() {
    return modified;
  }

  /**
   * Apply a custom transformation to the table.
   */
  public FluentTable apply(java.util.function.Consumer<Table> transformer) {
    transformer.accept(table);
    modified = true;
    return this;
  }

  /**
   * Conditionally apply a transformation.
   */
  public FluentTable applyIf(boolean condition, java.util.function.Consumer<Table> transformer) {
    if (condition) {
      transformer.accept(table);
      modified = true;
    }
    return this;
  }
}
