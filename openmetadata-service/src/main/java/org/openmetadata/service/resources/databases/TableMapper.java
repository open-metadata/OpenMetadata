package org.openmetadata.service.resources.databases;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import java.util.UUID;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateCustomMetric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.CustomMetric;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class TableMapper implements EntityMapper<Table, CreateTable> {
  @Override
  public Table createToEntity(CreateTable create, String user) {
    return validateNewTable(
            copy(new Table(), create, user)
                .withColumns(create.getColumns())
                .withSourceUrl(create.getSourceUrl())
                .withLocationPath(create.getLocationPath())
                .withTableConstraints(create.getTableConstraints())
                .withTablePartition(create.getTablePartition())
                .withTableType(create.getTableType())
                .withFileFormat(create.getFileFormat())
                .withSchemaDefinition(create.getSchemaDefinition())
                .withTableProfilerConfig(create.getTableProfilerConfig())
                .withDatabaseSchema(
                    getEntityReference(Entity.DATABASE_SCHEMA, create.getDatabaseSchema())))
        .withDatabaseSchema(getEntityReference(Entity.DATABASE_SCHEMA, create.getDatabaseSchema()))
        .withRetentionPeriod(create.getRetentionPeriod())
        .withSourceHash(create.getSourceHash());
  }

  public CustomMetric createCustomMetricToEntity(CreateCustomMetric create, String user) {
    return new CustomMetric()
        .withId(UUID.randomUUID())
        .withDescription(create.getDescription())
        .withName(create.getName())
        .withColumnName(create.getColumnName())
        .withOwners(create.getOwners())
        .withExpression(create.getExpression())
        .withUpdatedBy(user)
        .withUpdatedAt(System.currentTimeMillis());
  }

  public static Table validateNewTable(Table table) {
    table.setId(UUID.randomUUID());
    DatabaseUtil.validateConstraints(table.getColumns(), table.getTableConstraints());
    DatabaseUtil.validateTablePartition(table.getColumns(), table.getTablePartition());
    DatabaseUtil.validateColumns(table.getColumns());
    return table;
  }
}
