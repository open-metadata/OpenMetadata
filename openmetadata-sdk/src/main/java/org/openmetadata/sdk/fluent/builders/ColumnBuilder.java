package org.openmetadata.sdk.fluent.builders;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;

/**
 * Fluent builder for creating Column definitions following Stripe SDK patterns.
 *
 * <pre>
 * Column idColumn = column("id", "BIGINT")
 *     .primaryKey()
 *     .notNull()
 *     .description("Primary key")
 *     .build();
 *
 * Column emailColumn = column("email", "VARCHAR(255)")
 *     .unique()
 *     .notNull()
 *     .description("User email address")
 *     .tag("PII")
 *     .build();
 * </pre>
 */
public class ColumnBuilder {
  private final Column column;
  private final List<TagLabel> tags = new ArrayList<>();

  public ColumnBuilder(String name, String dataType) {
    this.column = new Column();
    this.column.setName(name);
    // Convert string to ColumnDataType enum
    try {
      this.column.setDataType(ColumnDataType.fromValue(dataType));
    } catch (IllegalArgumentException e) {
      // If not a valid enum value, try to set it as custom type
      this.column.setDataType(ColumnDataType.fromValue("UNKNOWN"));
      this.column.setDataTypeDisplay(dataType);
    }
  }

  /**
   * Static factory method for cleaner syntax.
   */
  public static ColumnBuilder of(String name, String dataType) {
    return new ColumnBuilder(name, dataType);
  }

  /**
   * Set the column display name.
   */
  public ColumnBuilder displayName(String displayName) {
    column.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the column description.
   */
  public ColumnBuilder description(String description) {
    column.setDescription(description);
    return this;
  }

  /**
   * Set the data type display (formatted version).
   */
  public ColumnBuilder dataTypeDisplay(String dataTypeDisplay) {
    column.setDataTypeDisplay(dataTypeDisplay);
    return this;
  }

  /**
   * Set the array data type for array columns.
   */
  public ColumnBuilder arrayDataType(String arrayDataType) {
    try {
      column.setArrayDataType(ColumnDataType.fromValue(arrayDataType));
    } catch (IllegalArgumentException e) {
      column.setArrayDataType(ColumnDataType.fromValue("UNKNOWN"));
    }
    return this;
  }

  /**
   * Set the column length (for VARCHAR, CHAR, etc.).
   */
  public ColumnBuilder dataLength(Integer length) {
    column.setDataLength(length);
    return this;
  }

  /**
   * Set the column precision (for DECIMAL, etc.).
   */
  public ColumnBuilder precision(Integer precision) {
    column.setPrecision(precision);
    return this;
  }

  /**
   * Set the column scale (for DECIMAL, etc.).
   */
  public ColumnBuilder scale(Integer scale) {
    column.setScale(scale);
    return this;
  }

  /**
   * Mark this column as a primary key.
   */
  public ColumnBuilder primaryKey() {
    column.setConstraint(ColumnConstraint.PRIMARY_KEY);
    return this;
  }

  /**
   * Mark this column as unique.
   */
  public ColumnBuilder unique() {
    column.setConstraint(ColumnConstraint.UNIQUE);
    return this;
  }

  /**
   * Mark this column as not null.
   */
  public ColumnBuilder notNull() {
    column.setConstraint(ColumnConstraint.NOT_NULL);
    return this;
  }

  /**
   * Mark this column as nullable (default).
   */
  public ColumnBuilder nullable() {
    column.setConstraint(ColumnConstraint.NULL);
    return this;
  }

  /**
   * Set a custom constraint.
   */
  public ColumnBuilder constraint(ColumnConstraint constraint) {
    column.setConstraint(constraint);
    return this;
  }

  /**
   * Set a custom constraint by string value.
   */
  public ColumnBuilder constraint(String constraint) {
    column.setConstraint(ColumnConstraint.fromValue(constraint));
    return this;
  }

  /**
   * Set the column ordinal position.
   */
  public ColumnBuilder ordinalPosition(Integer position) {
    column.setOrdinalPosition(position);
    return this;
  }

  /**
   * Set the JSON schema for JSON columns.
   */
  public ColumnBuilder jsonSchema(String jsonSchema) {
    column.setJsonSchema(jsonSchema);
    return this;
  }

  /**
   * Add a tag to the column.
   */
  public ColumnBuilder tag(String tagFQN) {
    tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    return this;
  }

  /**
   * Add a tag with state.
   */
  public ColumnBuilder tag(String tagFQN, TagLabel.State state) {
    tags.add(
        new TagLabel()
            .withTagFQN(tagFQN)
            .withState(state)
            .withSource(TagLabel.TagSource.CLASSIFICATION));
    return this;
  }

  /**
   * Add multiple tags.
   */
  public ColumnBuilder tags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      tag(tagFQN);
    }
    return this;
  }

  /**
   * Mark column as indexed (custom property).
   */
  public ColumnBuilder indexed() {
    // This would typically set a custom property or extension
    // For now, we'll add it to the description as a marker
    if (column.getDescription() == null) {
      column.setDescription("[INDEXED]");
    } else {
      column.setDescription(column.getDescription() + " [INDEXED]");
    }
    return this;
  }

  /**
   * Set a default value for the column.
   */
  public ColumnBuilder defaultValue(String defaultValue) {
    // Default value might be stored in custom properties
    // For now, add to description
    if (column.getDescription() == null) {
      column.setDescription("DEFAULT: " + defaultValue);
    } else {
      column.setDescription(column.getDescription() + " DEFAULT: " + defaultValue);
    }
    return this;
  }

  /**
   * Set custom properties/extension data.
   */
  public ColumnBuilder customProperty(String key, Object value) {
    // Custom properties would typically be stored in an extension field
    // This is a placeholder for future implementation
    return this;
  }

  /**
   * Build the Column object.
   */
  public Column build() {
    // Apply tags if any
    if (!tags.isEmpty()) {
      column.setTags(tags);
    }

    // Validate required fields
    if (column.getName() == null || column.getName().isEmpty()) {
      throw new IllegalStateException("Column name is required");
    }
    if (column.getDataType() == null) {
      throw new IllegalStateException("Column data type is required");
    }

    return column;
  }

  // ==================== Convenience Methods ====================

  /**
   * Create a VARCHAR column with specified length.
   */
  public static ColumnBuilder varchar(String name, int length) {
    return new ColumnBuilder(name, "VARCHAR")
        .dataLength(length)
        .dataTypeDisplay("VARCHAR(" + length + ")");
  }

  /**
   * Create a DECIMAL column with precision and scale.
   */
  public static ColumnBuilder decimal(String name, int precision, int scale) {
    return new ColumnBuilder(name, "DECIMAL")
        .precision(precision)
        .scale(scale)
        .dataTypeDisplay("DECIMAL(" + precision + "," + scale + ")");
  }

  /**
   * Create an INT column.
   */
  public static ColumnBuilder integer(String name) {
    return new ColumnBuilder(name, "INT");
  }

  /**
   * Create a BIGINT column.
   */
  public static ColumnBuilder bigint(String name) {
    return new ColumnBuilder(name, "BIGINT");
  }

  /**
   * Create a TIMESTAMP column.
   */
  public static ColumnBuilder timestamp(String name) {
    return new ColumnBuilder(name, "TIMESTAMP");
  }

  /**
   * Create a DATE column.
   */
  public static ColumnBuilder date(String name) {
    return new ColumnBuilder(name, "DATE");
  }

  /**
   * Create a BOOLEAN column.
   */
  public static ColumnBuilder bool(String name) {
    return new ColumnBuilder(name, "BOOLEAN");
  }

  /**
   * Create a JSON column.
   */
  public static ColumnBuilder json(String name) {
    return new ColumnBuilder(name, "JSON");
  }

  /**
   * Create a TEXT column.
   */
  public static ColumnBuilder text(String name) {
    return new ColumnBuilder(name, "TEXT");
  }

  /**
   * Create an ARRAY column.
   */
  public static ColumnBuilder array(String name, String elementType) {
    return new ColumnBuilder(name, "ARRAY").arrayDataType(elementType);
  }
}
