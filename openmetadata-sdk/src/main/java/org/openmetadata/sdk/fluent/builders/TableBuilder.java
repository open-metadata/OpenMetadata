package org.openmetadata.sdk.fluent.builders;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating Table entities following Stripe SDK patterns.
 *
 * <pre>
 * Table table = TableBuilder.create(client)
 *     .name("customers")
 *     .description("Customer data")
 *     .schemaFQN("mysql.sales.public")
 *     .columns(
 *         column("id", "BIGINT").primaryKey(),
 *         column("email", "VARCHAR(255)").unique()
 *     )
 *     .tags("PII", "Critical")
 *     .owner(user)
 *     .create();
 * </pre>
 */
public class TableBuilder {
  private final OpenMetadataClient client;
  private final CreateTable request;
  private final List<Column> columns = new ArrayList<>();
  private final List<TableConstraint> constraints = new ArrayList<>();
  private final List<TagLabel> tags = new ArrayList<>();
  private EntityReference databaseSchemaRef;
  private EntityReference ownerRef;

  /**
   * Create a new TableBuilder with the given client.
   */
  public static TableBuilder create(OpenMetadataClient client) {
    return new TableBuilder(client);
  }

  public TableBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateTable();
    this.request.setTableType(TableType.Regular); // Default
  }

  /**
   * Set the table name (required).
   */
  public TableBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the table display name.
   */
  public TableBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the table description.
   */
  public TableBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set the table type (Regular, External, View, etc.).
   */
  public TableBuilder tableType(TableType type) {
    request.setTableType(type);
    return this;
  }

  /**
   * Set the database schema by direct reference.
   */
  public TableBuilder databaseSchema(DatabaseSchema schema) {
    this.databaseSchemaRef = toEntityReference(schema);
    request.setDatabaseSchema(
        this.databaseSchemaRef.getFullyQualifiedName() != null
            ? this.databaseSchemaRef.getFullyQualifiedName()
            : this.databaseSchemaRef.getName());
    return this;
  }

  /**
   * Set the database schema by ID.
   */
  public TableBuilder databaseSchemaId(UUID schemaId) {
    this.databaseSchemaRef = new EntityReference().withId(schemaId).withType("databaseSchema");
    request.setDatabaseSchema(
        this.databaseSchemaRef.getFullyQualifiedName() != null
            ? this.databaseSchemaRef.getFullyQualifiedName()
            : schemaId.toString());
    return this;
  }

  /**
   * Set the database schema by fully qualified name.
   */
  public TableBuilder schemaFQN(String fqn) {
    // The SDK will resolve this FQN to get the actual schema reference
    // For now, we'll set a placeholder that the backend will resolve
    this.databaseSchemaRef =
        new EntityReference().withFullyQualifiedName(fqn).withType("databaseSchema");
    request.setDatabaseSchema(fqn);
    return this;
  }

  /**
   * Add a single column to the table.
   */
  public TableBuilder column(Column column) {
    this.columns.add(column);
    return this;
  }

  /**
   * Add a column using a ColumnBuilder.
   */
  public TableBuilder column(ColumnBuilder builder) {
    this.columns.add(builder.build());
    return this;
  }

  /**
   * Add multiple columns at once.
   */
  public TableBuilder columns(Column... columns) {
    this.columns.addAll(Arrays.asList(columns));
    return this;
  }

  /**
   * Add multiple columns using builders.
   */
  public TableBuilder columns(ColumnBuilder... builders) {
    for (ColumnBuilder builder : builders) {
      this.columns.add(builder.build());
    }
    return this;
  }

  /**
   * Add columns from a list.
   */
  public TableBuilder columns(List<Column> columns) {
    this.columns.addAll(columns);
    return this;
  }

  /**
   * Add a column using name and type.
   */
  public TableBuilder addColumn(String name, String dataType) {
    Column col = new Column().withName(name);
    // Try to parse the data type
    try {
      String cleanType = dataType.replaceAll("\\(.*\\)", "").toUpperCase();
      col.setDataType(ColumnDataType.fromValue(cleanType));
    } catch (Exception e) {
      col.setDataType(ColumnDataType.UNKNOWN);
    }
    this.columns.add(col);
    return this;
  }

  /**
   * Add a column with description.
   */
  public TableBuilder addColumn(String name, String dataType, String description) {
    Column col = new Column().withName(name).withDescription(description);
    // Try to parse the data type
    try {
      String cleanType = dataType.replaceAll("\\(.*\\)", "").toUpperCase();
      col.setDataType(ColumnDataType.fromValue(cleanType));
    } catch (Exception e) {
      col.setDataType(ColumnDataType.UNKNOWN);
    }
    this.columns.add(col);
    return this;
  }

  /**
   * Add table-level constraints.
   */
  public TableBuilder constraint(TableConstraint constraint) {
    this.constraints.add(constraint);
    return this;
  }

  /**
   * Add multiple constraints.
   */
  public TableBuilder constraints(TableConstraint... constraints) {
    this.constraints.addAll(Arrays.asList(constraints));
    return this;
  }

  /**
   * Add a tag to the table.
   */
  public TableBuilder tag(String tagFQN) {
    this.tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
    return this;
  }

  /**
   * Add multiple tags.
   */
  public TableBuilder tags(String... tagFQNs) {
    for (String tagFQN : tagFQNs) {
      tag(tagFQN);
    }
    return this;
  }

  /**
   * Add a tag with label state.
   */
  public TableBuilder tag(String tagFQN, TagLabel.State state) {
    this.tags.add(
        new TagLabel()
            .withTagFQN(tagFQN)
            .withState(state)
            .withSource(TagLabel.TagSource.CLASSIFICATION));
    return this;
  }

  /**
   * Set the table owner by User object.
   */
  public TableBuilder owner(User user) {
    this.ownerRef =
        new EntityReference().withId(user.getId()).withName(user.getName()).withType("user");
    // TODO: Map owner
    return this;
  }

  /**
   * Set the table owner by user ID.
   */
  public TableBuilder ownerId(UUID userId) {
    this.ownerRef = new EntityReference().withId(userId).withType("user");
    // TODO: Map owner
    return this;
  }

  /**
   * Set the table owner by username.
   */
  public TableBuilder ownerName(String username) {
    this.ownerRef = new EntityReference().withName(username).withType("user");
    // TODO: Map owner
    return this;
  }

  /**
   * Set custom extension data.
   */
  public TableBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateTable request without executing it.
   */
  public CreateTable build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Table name is required");
    }
    if (databaseSchemaRef == null) {
      throw new IllegalStateException("Database schema reference is required");
    }

    // Set columns
    if (!columns.isEmpty()) {
      request.setColumns(columns);
    }

    // Set constraints
    if (!constraints.isEmpty()) {
      request.setTableConstraints(constraints);
    }

    // Set tags
    if (!tags.isEmpty()) {
      request.setTags(tags);
    }

    return request;
  }

  /**
   * Create the table and return the created entity.
   */
  public Table create() {
    return client.tables().create(build());
  }

  // ==================== Helper Methods ====================

  private EntityReference toEntityReference(DatabaseSchema schema) {
    return new EntityReference()
        .withId(schema.getId())
        .withName(schema.getName())
        .withFullyQualifiedName(schema.getFullyQualifiedName())
        .withType("databaseSchema");
  }

  private EntityReference toEntityReference(User user) {
    return new EntityReference()
        .withId(user.getId())
        .withName(user.getName())
        .withFullyQualifiedName(user.getFullyQualifiedName())
        .withType("user");
  }
}
