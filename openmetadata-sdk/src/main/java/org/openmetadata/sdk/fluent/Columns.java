package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

public final class Columns {
  private static OpenMetadataClient defaultClient;

  private Columns() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Columns.setDefaultClient() first.");
    }
    return defaultClient;
  }

  public static ColumnBuilder build(String name) {
    return new ColumnBuilder(name);
  }

  public static List<Column> defaultColumns() {
    return List.of(
        build("id").withType(ColumnDataType.BIGINT).create(),
        build("name").withType(ColumnDataType.VARCHAR).withLength(255).create(),
        build("created_at").withType(ColumnDataType.TIMESTAMP).create());
  }

  public static class ColumnBuilder {
    private final Column column = new Column();

    ColumnBuilder(String name) {
      column.setName(name);
    }

    public ColumnBuilder withType(ColumnDataType dataType) {
      column.setDataType(dataType);
      return this;
    }

    public ColumnBuilder withLength(Integer length) {
      column.setDataLength(length);
      return this;
    }

    public ColumnBuilder withDescription(String description) {
      column.setDescription(description);
      return this;
    }

    public ColumnBuilder withDisplayName(String displayName) {
      column.setDisplayName(displayName);
      return this;
    }

    public ColumnBuilder withTags(List<TagLabel> tags) {
      column.setTags(tags);
      return this;
    }

    public ColumnBuilder withPrecision(Integer precision) {
      column.setPrecision(precision);
      return this;
    }

    public ColumnBuilder withScale(Integer scale) {
      column.setScale(scale);
      return this;
    }

    public ColumnBuilder withChildren(List<Column> children) {
      column.setChildren(children);
      return this;
    }

    public ColumnBuilder withArrayDataType(ColumnDataType arrayDataType) {
      column.setArrayDataType(arrayDataType);
      return this;
    }

    public ColumnBuilder nullable() {
      column.setConstraint(ColumnConstraint.NULL);
      return this;
    }

    public ColumnBuilder notNull() {
      column.setConstraint(ColumnConstraint.NOT_NULL);
      return this;
    }

    public ColumnBuilder primaryKey() {
      column.setConstraint(ColumnConstraint.PRIMARY_KEY);
      return this;
    }

    public ColumnBuilder unique() {
      column.setConstraint(ColumnConstraint.UNIQUE);
      return this;
    }

    public Column create() {
      if (column.getDataType() == null) {
        column.setDataType(ColumnDataType.VARCHAR);
      }
      return column;
    }
  }
}
