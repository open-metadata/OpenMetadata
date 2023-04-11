/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toUnmodifiableList;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_OWNER;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.util.LambdaExceptionUtil.ignoringComparator;
import static org.openmetadata.service.util.LambdaExceptionUtil.rethrowFunction;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.google.common.collect.Streams;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.commons.lang3.tuple.Triple;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.CustomMetric;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnJoin;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.ColumnProfilerConfig;
import org.openmetadata.schema.type.DailyCount;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.JoinedWith;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.SystemProfile;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TableJoins;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TableProfilerConfig;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.databases.DatabaseUtil;
import org.openmetadata.service.resources.databases.TableResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class TableRepository extends EntityRepository<Table> {

  // Table fields that can be patched in a PATCH request
  static final String TABLE_PATCH_FIELDS = "owner,tags,tableConstraints,tablePartition,extension,followers";
  // Table fields that can be updated in a PUT request
  static final String TABLE_UPDATE_FIELDS = "owner,tags,tableConstraints,tablePartition,dataModel,extension,followers";

  public static final String FIELD_RELATION_COLUMN_TYPE = "table.columns.column";
  public static final String FIELD_RELATION_TABLE_TYPE = "table";
  public static final String TABLE_PROFILE_EXTENSION = "table.tableProfile";
  public static final String SYSTEM_PROFILE_EXTENSION = "table.systemProfile";
  public static final String TABLE_COLUMN_PROFILE_EXTENSION = "table.columnProfile";

  public static final String TABLE_SAMPLE_DATA_EXTENSION = "table.sampleData";
  public static final String TABLE_PROFILER_CONFIG_EXTENSION = "table.tableProfilerConfig";
  public static final String TABLE_COLUMN_EXTENSION = "table.column.";
  public static final String CUSTOM_METRICS_EXTENSION = ".customMetrics";

  public TableRepository(CollectionDAO daoCollection) {
    super(
        TableResource.COLLECTION_PATH,
        TABLE,
        Table.class,
        daoCollection.tableDAO(),
        daoCollection,
        TABLE_PATCH_FIELDS,
        TABLE_UPDATE_FIELDS);
  }

  @Override
  public Table setFields(Table table, Fields fields) throws IOException {
    setDefaultFields(table);
    table.setTableConstraints(fields.contains("tableConstraints") ? table.getTableConstraints() : null);
    table.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(table) : null);
    table.setUsageSummary(
        fields.contains("usageSummary") ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), table.getId()) : null);
    getColumnTags(fields.contains(FIELD_TAGS), table.getColumns());
    table.setJoins(fields.contains("joins") ? getJoins(table) : null);
    table.setViewDefinition(fields.contains("viewDefinition") ? table.getViewDefinition() : null);
    table.setTableProfilerConfig(fields.contains("tableProfilerConfig") ? getTableProfilerConfig(table) : null);
    getCustomMetrics(fields.contains("customMetrics"), table);
    return table;
  }

  private void setDefaultFields(Table table) throws IOException {
    EntityReference schemaRef = getContainer(table.getId());
    DatabaseSchema schema = Entity.getEntity(schemaRef, "", ALL);
    table.withDatabaseSchema(schemaRef).withDatabase(schema.getDatabase()).withService(schema.getService());
  }

  @Override
  public void restorePatchAttributes(Table original, Table updated) {
    // Patch can't make changes to following fields. Ignore the changes.
    updated
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withName(original.getName())
        .withDatabase(original.getDatabase())
        .withService(original.getService())
        .withId(original.getId());
  }

  @Override
  public void setFullyQualifiedName(Table table) {
    table.setFullyQualifiedName(
        FullyQualifiedName.add(table.getDatabaseSchema().getFullyQualifiedName(), table.getName()));
    ColumnUtil.setColumnFQN(table.getFullyQualifiedName(), table.getColumns());
  }

  @Transaction
  public Table addJoins(UUID tableId, TableJoins joins) throws IOException {
    // Validate the request content
    Table table = dao.findEntityById(tableId);

    if (!CommonUtil.dateInRange(RestUtil.DATE_FORMAT, joins.getStartDate(), 0, 30)) {
      throw new IllegalArgumentException("Date range can only include past 30 days starting today");
    }

    // Validate joined columns
    for (ColumnJoin join : joins.getColumnJoins()) {
      validateColumn(table, join.getColumnName());
      validateColumnFQNs(join.getJoinedWith());
    }

    // Validate direct table joins
    for (JoinedWith join : joins.getDirectTableJoins()) {
      validateTableFQN(join.getFullyQualifiedName());
    }

    // With all validation done, add new joins
    for (ColumnJoin join : joins.getColumnJoins()) {
      String columnFQN = FullyQualifiedName.add(table.getFullyQualifiedName(), join.getColumnName());
      addJoinedWith(joins.getStartDate(), columnFQN, FIELD_RELATION_COLUMN_TYPE, join.getJoinedWith());
    }

    addJoinedWith(
        joins.getStartDate(), table.getFullyQualifiedName(), FIELD_RELATION_TABLE_TYPE, joins.getDirectTableJoins());

    return table.withJoins(getJoins(table));
  }

  @Transaction
  public Table addSampleData(UUID tableId, TableData tableData) throws IOException {
    // Validate the request content
    Table table = dao.findEntityById(tableId);

    // Validate all the columns
    for (String columnName : tableData.getColumns()) {
      validateColumn(table, columnName);
    }
    // Make sure each row has number values for all the columns
    for (List<Object> row : tableData.getRows()) {
      if (row.size() != tableData.getColumns().size()) {
        throw new IllegalArgumentException(
            String.format(
                "Number of columns is %d but row has %d sample values", tableData.getColumns().size(), row.size()));
      }
    }

    daoCollection
        .entityExtensionDAO()
        .insert(tableId.toString(), TABLE_SAMPLE_DATA_EXTENSION, "tableData", JsonUtils.pojoToJson(tableData));
    setFieldsInternal(table, Fields.EMPTY_FIELDS);
    return table.withSampleData(tableData);
  }

  @Transaction
  public Table getSampleData(UUID tableId) throws IOException {
    // Validate the request content
    Table table = dao.findEntityById(tableId);

    TableData sampleData =
        JsonUtils.readValue(
            daoCollection.entityExtensionDAO().getExtension(table.getId().toString(), TABLE_SAMPLE_DATA_EXTENSION),
            TableData.class);
    table.setSampleData(sampleData);
    setFieldsInternal(table, Fields.EMPTY_FIELDS);
    return table;
  }

  @Transaction
  public Table deleteSampleData(UUID tableId) throws IOException {
    // Validate the request content
    Table table = dao.findEntityById(tableId);

    daoCollection.entityExtensionDAO().delete(tableId.toString(), TABLE_SAMPLE_DATA_EXTENSION);
    setFieldsInternal(table, Fields.EMPTY_FIELDS);
    return table;
  }

  @Transaction
  public TableProfilerConfig getTableProfilerConfig(Table table) throws IOException {
    return JsonUtils.readValue(
        daoCollection.entityExtensionDAO().getExtension(table.getId().toString(), TABLE_PROFILER_CONFIG_EXTENSION),
        TableProfilerConfig.class);
  }

  @Transaction
  public Table addTableProfilerConfig(UUID tableId, TableProfilerConfig tableProfilerConfig) throws IOException {
    // Validate the request content
    Table table = dao.findEntityById(tableId);

    // Validate all the columns
    if (tableProfilerConfig.getExcludeColumns() != null) {
      for (String columnName : tableProfilerConfig.getExcludeColumns()) {
        validateColumn(table, columnName);
      }
    }

    if (tableProfilerConfig.getIncludeColumns() != null) {
      for (ColumnProfilerConfig columnProfilerConfig : tableProfilerConfig.getIncludeColumns()) {
        validateColumn(table, columnProfilerConfig.getColumnName());
      }
    }

    daoCollection
        .entityExtensionDAO()
        .insert(
            tableId.toString(),
            TABLE_PROFILER_CONFIG_EXTENSION,
            "tableProfilerConfig",
            JsonUtils.pojoToJson(tableProfilerConfig));
    setFieldsInternal(table, Fields.EMPTY_FIELDS);
    return table.withTableProfilerConfig(tableProfilerConfig);
  }

  @Transaction
  public Table deleteTableProfilerConfig(UUID tableId) throws IOException {
    // Validate the request content
    Table table = dao.findEntityById(tableId);

    daoCollection.entityExtensionDAO().delete(tableId.toString(), TABLE_PROFILER_CONFIG_EXTENSION);
    setFieldsInternal(table, Fields.EMPTY_FIELDS);
    return table;
  }

  private Column getColumnNameForProfiler(List<Column> columnList, ColumnProfile columnProfile, String parentName) {
    for (Column col : columnList) {
      String columnName;
      if (parentName != null) {
        columnName = String.format("%s.%s", parentName, col.getName());
      } else {
        columnName = col.getName();
      }
      if (columnName.equals(columnProfile.getName())) {
        return col;
      }
      if (col.getChildren() != null) {
        Column childColumn = getColumnNameForProfiler(col.getChildren(), columnProfile, columnName);
        if (childColumn != null) {
          return childColumn;
        }
      }
    }
    return null;
  }

  @Transaction
  public Table addTableProfileData(UUID tableId, CreateTableProfile createTableProfile) throws IOException {
    // Validate the request content
    Table table = dao.findEntityById(tableId);
    TableProfile storedTableProfile =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getExtensionAtTimestamp(
                    table.getFullyQualifiedName(),
                    TABLE_PROFILE_EXTENSION,
                    createTableProfile.getTableProfile().getTimestamp()),
            TableProfile.class);
    if (storedTableProfile != null) {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .update(
              table.getFullyQualifiedName(),
              TABLE_PROFILE_EXTENSION,
              JsonUtils.pojoToJson(createTableProfile.getTableProfile()),
              createTableProfile.getTableProfile().getTimestamp());
    } else {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .insert(
              table.getFullyQualifiedName(),
              TABLE_PROFILE_EXTENSION,
              "tableProfile",
              JsonUtils.pojoToJson(createTableProfile.getTableProfile()));
    }

    for (ColumnProfile columnProfile : createTableProfile.getColumnProfile()) {
      // Validate all the columns
      Column column = getColumnNameForProfiler(table.getColumns(), columnProfile, null);
      if (column == null) {
        throw new IllegalArgumentException("Invalid column name " + columnProfile.getName());
      }
      ColumnProfile storedColumnProfile =
          JsonUtils.readValue(
              daoCollection
                  .entityExtensionTimeSeriesDao()
                  .getExtensionAtTimestamp(
                      column.getFullyQualifiedName(), TABLE_COLUMN_PROFILE_EXTENSION, columnProfile.getTimestamp()),
              ColumnProfile.class);

      if (storedColumnProfile != null) {
        daoCollection
            .entityExtensionTimeSeriesDao()
            .update(
                column.getFullyQualifiedName(),
                TABLE_COLUMN_PROFILE_EXTENSION,
                JsonUtils.pojoToJson(columnProfile),
                storedColumnProfile.getTimestamp());
      } else {
        daoCollection
            .entityExtensionTimeSeriesDao()
            .insert(
                column.getFullyQualifiedName(),
                TABLE_COLUMN_PROFILE_EXTENSION,
                "columnProfile",
                JsonUtils.pojoToJson(columnProfile));
      }
    }

    List<SystemProfile> systemProfiles = createTableProfile.getSystemProfile();
    if (systemProfiles != null && !systemProfiles.isEmpty()) {
      for (SystemProfile systemProfile : createTableProfile.getSystemProfile()) {
        SystemProfile storedSystemProfile =
            JsonUtils.readValue(
                daoCollection
                    .entityExtensionTimeSeriesDao()
                    .getExtensionAtTimestamp(
                        table.getFullyQualifiedName(), SYSTEM_PROFILE_EXTENSION, systemProfile.getTimestamp()),
                SystemProfile.class);
        if (storedSystemProfile != null) {
          daoCollection
              .entityExtensionTimeSeriesDao()
              .update(
                  table.getFullyQualifiedName(),
                  SYSTEM_PROFILE_EXTENSION,
                  JsonUtils.pojoToJson(systemProfile),
                  storedSystemProfile.getTimestamp());
        } else {
          daoCollection
              .entityExtensionTimeSeriesDao()
              .insert(
                  table.getFullyQualifiedName(),
                  SYSTEM_PROFILE_EXTENSION,
                  "systemProfile",
                  JsonUtils.pojoToJson(systemProfile));
        }
      }
    }

    setFieldsInternal(table, Fields.EMPTY_FIELDS);
    return table.withProfile(createTableProfile.getTableProfile());
  }

  @Transaction
  public void deleteTableProfile(String fqn, String entityType, Long timestamp) throws IOException {
    // Validate the request content
    String extension;
    if (entityType.equalsIgnoreCase(Entity.TABLE)) {
      extension = TABLE_PROFILE_EXTENSION;
    } else if (entityType.equalsIgnoreCase("column")) {
      extension = TABLE_COLUMN_PROFILE_EXTENSION;
    } else {
      throw new IllegalArgumentException("entityType must be table or column");
    }

    TableProfile storedTableProfile =
        JsonUtils.readValue(
            daoCollection.entityExtensionTimeSeriesDao().getExtensionAtTimestamp(fqn, extension, timestamp),
            TableProfile.class);
    if (storedTableProfile == null) {
      throw new EntityNotFoundException(String.format("Failed to find table profile for %s at %s", fqn, timestamp));
    }
    daoCollection.entityExtensionTimeSeriesDao().deleteAtTimestamp(fqn, extension, timestamp);
  }

  @Transaction
  public ResultList<TableProfile> getTableProfiles(String fqn, Long startTs, Long endTs) throws IOException {
    List<TableProfile> tableProfiles;
    tableProfiles =
        JsonUtils.readObjects(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .listBetweenTimestamps(fqn, TABLE_PROFILE_EXTENSION, startTs, endTs),
            TableProfile.class);
    return new ResultList<>(tableProfiles, startTs.toString(), endTs.toString(), tableProfiles.size());
  }

  @Transaction
  public ResultList<ColumnProfile> getColumnProfiles(String fqn, Long startTs, Long endTs) throws IOException {
    List<ColumnProfile> columnProfiles;
    columnProfiles =
        JsonUtils.readObjects(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .listBetweenTimestamps(fqn, TABLE_COLUMN_PROFILE_EXTENSION, startTs, endTs),
            ColumnProfile.class);
    return new ResultList<>(columnProfiles, startTs.toString(), endTs.toString(), columnProfiles.size());
  }

  @Transaction
  public ResultList<SystemProfile> getSystemProfiles(String fqn, Long startTs, Long endTs) throws IOException {
    List<SystemProfile> systemProfiles;
    systemProfiles =
        JsonUtils.readObjects(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .listBetweenTimestamps(fqn, SYSTEM_PROFILE_EXTENSION, startTs, endTs),
            SystemProfile.class);
    return new ResultList<>(systemProfiles, startTs.toString(), endTs.toString(), systemProfiles.size());
  }

  private void setColumnProfile(List<Column> columnList) throws IOException {
    for (Column column : columnList) {
      ColumnProfile columnProfile =
          JsonUtils.readValue(
              daoCollection
                  .entityExtensionTimeSeriesDao()
                  .getLatestExtension(column.getFullyQualifiedName(), TABLE_COLUMN_PROFILE_EXTENSION),
              ColumnProfile.class);
      column.setProfile(columnProfile);
      if (column.getChildren() != null) {
        setColumnProfile(column.getChildren());
      }
    }
  }

  @Transaction
  public Table getLatestTableProfile(String fqn) throws IOException {
    Table table = dao.findEntityByName(fqn);
    TableProfile tableProfile =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getLatestExtension(table.getFullyQualifiedName(), TABLE_PROFILE_EXTENSION),
            TableProfile.class);
    table.setProfile(tableProfile);
    setColumnProfile(table.getColumns());
    return table;
  }

  @Transaction
  public Table addCustomMetric(UUID tableId, CustomMetric customMetric) throws IOException {
    // Validate the request content
    Table table = dao.findEntityById(tableId);
    String columnName = customMetric.getColumnName();
    validateColumn(table, columnName);

    // Override any custom metric definition with the same name
    List<CustomMetric> storedCustomMetrics = getCustomMetrics(table, columnName);
    Map<String, CustomMetric> storedMapCustomMetrics = new HashMap<>();
    if (storedCustomMetrics != null) {
      for (CustomMetric cm : storedCustomMetrics) {
        storedMapCustomMetrics.put(cm.getName(), cm);
      }
    }

    // existing metric use the previous UUID
    if (storedMapCustomMetrics.containsKey(customMetric.getName())) {
      CustomMetric prevMetric = storedMapCustomMetrics.get(customMetric.getName());
      customMetric.setId(prevMetric.getId());
    }

    storedMapCustomMetrics.put(customMetric.getName(), customMetric);
    List<CustomMetric> updatedMetrics = new ArrayList<>(storedMapCustomMetrics.values());
    String extension = TABLE_COLUMN_EXTENSION + columnName + CUSTOM_METRICS_EXTENSION;
    daoCollection
        .entityExtensionDAO()
        .insert(table.getId().toString(), extension, "customMetric", JsonUtils.pojoToJson(updatedMetrics));
    setFieldsInternal(table, Fields.EMPTY_FIELDS);
    // return the newly created/updated custom metric only
    for (Column column : table.getColumns()) {
      if (column.getName().equals(columnName)) {
        column.setCustomMetrics(List.of(customMetric));
      }
    }
    return table;
  }

  @Transaction
  public Table deleteCustomMetric(UUID tableId, String columnName, String metricName) throws IOException {
    // Validate the request content
    Table table = dao.findEntityById(tableId);
    validateColumn(table, columnName);

    // Override any custom metric definition with the same name
    List<CustomMetric> storedCustomMetrics = getCustomMetrics(table, columnName);
    Map<String, CustomMetric> storedMapCustomMetrics = new HashMap<>();
    if (storedCustomMetrics != null) {
      for (CustomMetric cm : storedCustomMetrics) {
        storedMapCustomMetrics.put(cm.getName(), cm);
      }
    }

    if (!storedMapCustomMetrics.containsKey(metricName)) {
      throw new EntityNotFoundException(String.format("Failed to find %s for %s", metricName, table.getName()));
    }

    CustomMetric deleteCustomMetric = storedMapCustomMetrics.get(metricName);
    storedMapCustomMetrics.remove(metricName);
    List<CustomMetric> updatedMetrics = new ArrayList<>(storedMapCustomMetrics.values());
    String extension = TABLE_COLUMN_EXTENSION + columnName + CUSTOM_METRICS_EXTENSION;
    daoCollection
        .entityExtensionDAO()
        .insert(table.getId().toString(), extension, "customMetric", JsonUtils.pojoToJson(updatedMetrics));
    // return the newly created/updated custom metric test only
    for (Column column : table.getColumns()) {
      if (column.getName().equals(columnName)) {
        column.setCustomMetrics(List.of(deleteCustomMetric));
      }
    }
    return table;
  }

  @Transaction
  public Table addDataModel(UUID tableId, DataModel dataModel) throws IOException {
    Table table = dao.findEntityById(tableId);
    table.withDataModel(dataModel);

    // Carry forward the table owner from the model to table entity, if empty
    if (table.getOwner() == null) {
      storeOwner(table, dataModel.getOwner());
    }

    table.setTags(dataModel.getTags());
    applyTags(table);

    // Carry forward the column description from the model to table columns, if empty
    for (Column modelColumn : listOrEmpty(dataModel.getColumns())) {
      Column stored =
          table.getColumns().stream()
              .filter(c -> EntityUtil.columnNameMatch.test(c, modelColumn))
              .findAny()
              .orElse(null);
      if (stored == null) {
        continue;
      }
      stored.setTags(modelColumn.getTags());
    }
    applyTags(table.getColumns());
    dao.update(table.getId(), JsonUtils.pojoToJson(table));

    setFieldsInternal(table, new Fields(List.of(FIELD_OWNER), FIELD_OWNER));
    setFieldsInternal(table, new Fields(List.of(FIELD_TAGS), FIELD_TAGS));

    return table;
  }

  private void addDerivedColumnTags(List<Column> columns) {
    if (nullOrEmpty(columns)) {
      return;
    }

    for (Column column : columns) {
      column.setTags(addDerivedTags(column.getTags()));
      if (column.getChildren() != null) {
        addDerivedColumnTags(column.getChildren());
      }
    }
  }

  @Override
  public void prepare(Table table) throws IOException {
    DatabaseSchema schema = Entity.getEntity(table.getDatabaseSchema(), "owner", ALL);
    table
        .withDatabaseSchema(schema.getEntityReference())
        .withDatabase(schema.getDatabase())
        .withService(schema.getService())
        .withServiceType(schema.getServiceType());

    // Carry forward ownership from database schema
    if (table.getOwner() == null && schema.getOwner() != null) {
      table.setOwner(schema.getOwner().withDescription("inherited"));
    }

    // Validate column tags
    addDerivedColumnTags(table.getColumns());
    table.getColumns().forEach(column -> checkMutuallyExclusive(column.getTags()));
  }

  @Override
  public void storeEntity(Table table, boolean update) throws IOException {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference service = table.getService();
    table.withService(null);

    // Don't store column tags as JSON but build it on the fly based on relationships
    List<Column> columnWithTags = table.getColumns();
    table.setColumns(ColumnUtil.cloneWithoutTags(columnWithTags));
    table.getColumns().forEach(column -> column.setTags(null));

    store(table, update);

    // Restore the relationships
    table.withColumns(columnWithTags).withService(service);
  }

  @Override
  public void storeRelationships(Table table) {
    // Add relationship from database to table
    addRelationship(table.getDatabaseSchema().getId(), table.getId(), DATABASE_SCHEMA, TABLE, Relationship.CONTAINS);

    // Add table owner relationship
    storeOwner(table, table.getOwner());

    // Add tag to table relationship
    applyTags(table);
  }

  @Override
  public EntityUpdater getUpdater(Table original, Table updated, Operation operation) {
    return new TableUpdater(original, updated, operation);
  }

  private void applyTags(List<Column> columns) {
    // Add column level tags by adding tag to column relationship
    for (Column column : columns) {
      applyTags(column.getTags(), column.getFullyQualifiedName());
      if (column.getChildren() != null) {
        applyTags(column.getChildren());
      }
    }
  }

  @Override
  public void applyTags(Table table) {
    // Add table level tags by adding tag to table relationship
    super.applyTags(table);
    applyTags(table.getColumns());
  }

  @Override
  public List<TagLabel> getAllTags(EntityInterface entity) {
    List<TagLabel> allTags = new ArrayList<>();
    Table table = (Table) entity;
    EntityUtil.mergeTags(allTags, table.getTags());
    table.getColumns().forEach(column -> EntityUtil.mergeTags(allTags, column.getTags()));
    if (table.getDataModel() != null) {
      EntityUtil.mergeTags(allTags, table.getDataModel().getTags());
      for (Column column : listOrEmpty(table.getDataModel().getColumns())) {
        EntityUtil.mergeTags(allTags, column.getTags());
      }
    }
    return allTags;
  }

  private void getColumnTags(boolean setTags, List<Column> columns) {
    for (Column c : listOrEmpty(columns)) {
      c.setTags(setTags ? getTags(c.getFullyQualifiedName()) : null);
      getColumnTags(setTags, c.getChildren());
    }
  }

  private void validateTableFQN(String fqn) {
    try {
      dao.existsByName(fqn);
    } catch (EntityNotFoundException e) {
      throw new IllegalArgumentException("Invalid table name " + fqn, e);
    }
  }

  // Validate if a given column exists in the table
  public static void validateColumn(Table table, String columnName) {
    boolean validColumn = table.getColumns().stream().anyMatch(col -> col.getName().equals(columnName));
    if (!validColumn) {
      throw new IllegalArgumentException("Invalid column name " + columnName);
    }
  }

  private void validateColumnFQNs(List<JoinedWith> joinedWithList) {
    for (JoinedWith joinedWith : joinedWithList) {
      // Validate table
      String tableFQN = FullyQualifiedName.getTableFQN(joinedWith.getFullyQualifiedName());
      Table joinedWithTable = dao.findEntityByName(tableFQN);

      // Validate column
      ColumnUtil.validateColumnFQN(joinedWithTable.getColumns(), joinedWith.getFullyQualifiedName());
    }
  }

  /**
   * Updates join data in the database for an entity and a relation type. Currently, used pairs of ({@code entityFQN},
   * {@code entityRelationType}) are ({@link Table#getFullyQualifiedName()}, "table") and ({@link
   * Column#getFullyQualifiedName()}, "table.columns.column").
   *
   * <p>If for a field relation (any relation between {@code entityFQN} and a FQN from {@code joinedWithList}), after
   * combining the existing list of {@link DailyCount} with join data from {@code joinedWithList}, there are multiple
   * {@link DailyCount} with the {@link DailyCount#getDate()}, these will <bold>NOT</bold> be merged - the value of
   * {@link JoinedWith#getJoinCount()} will override the current value.
   */
  private void addJoinedWith(String date, String entityFQN, String entityRelationType, List<JoinedWith> joinedWithList)
      throws IOException {
    // Use the column that comes alphabetically first as the from field and the other as to field.
    // This helps us keep the bidirectional relationship to a single row instead one row for
    // capturing relationship in each direction.
    //
    // One row like this     - fromColumn <--- joinedWith --> toColumn
    // Instead of additional - toColumn <--- joinedWith --> fromColumn
    for (JoinedWith joinedWith : joinedWithList) {
      String fromEntityFQN;
      String toEntityFQN;
      if (entityFQN.compareTo(joinedWith.getFullyQualifiedName()) < 0) {
        fromEntityFQN = entityFQN;
        toEntityFQN = joinedWith.getFullyQualifiedName();
      } else {
        fromEntityFQN = joinedWith.getFullyQualifiedName();
        toEntityFQN = entityFQN;
      }

      List<DailyCount> currentDailyCounts =
          Optional.ofNullable(
                  daoCollection
                      .fieldRelationshipDAO()
                      .find(
                          fromEntityFQN,
                          toEntityFQN,
                          entityRelationType,
                          entityRelationType,
                          Relationship.JOINED_WITH.ordinal()))
              .map(rethrowFunction(j -> JsonUtils.readObjects(j, DailyCount.class)))
              .orElse(List.of());

      DailyCount receivedDailyCount = new DailyCount().withCount(joinedWith.getJoinCount()).withDate(date);

      List<DailyCount> newDailyCounts = aggregateAndFilterDailyCounts(currentDailyCounts, receivedDailyCount);

      daoCollection
          .fieldRelationshipDAO()
          .upsert(
              fromEntityFQN,
              toEntityFQN,
              entityRelationType,
              entityRelationType,
              Relationship.JOINED_WITH.ordinal(),
              "dailyCount",
              JsonUtils.pojoToJson(newDailyCounts));
    }
  }

  /**
   * Pure function that creates a new list of {@link DailyCount} by either adding the {@code newDailyCount} to the list
   * or, if there is already data for the date {@code newDailyCount.getDate()}, replace older count with the new one.
   * Ensures the following properties: all elements in the list have unique dates, all dates are not older than 30 days
   * from today, the list is ordered by date.
   */
  private List<DailyCount> aggregateAndFilterDailyCounts(
      List<DailyCount> currentDailyCounts, DailyCount newDailyCount) {
    Map<String, List<DailyCount>> joinCountByDay =
        Streams.concat(currentDailyCounts.stream(), Stream.of(newDailyCount)).collect(groupingBy(DailyCount::getDate));

    return joinCountByDay.entrySet().stream()
        .map(
            e -> {
              if (e.getKey().equals(newDailyCount.getDate())) return newDailyCount;
              else
                return new DailyCount()
                    .withDate(e.getKey())
                    .withCount(
                        e.getValue().stream()
                            .findFirst()
                            .orElseThrow(
                                () -> new IllegalStateException("Collector.groupingBy created an empty grouping"))
                            .getCount());
            })
        .filter(inLast30Days())
        .sorted(ignoringComparator((dc1, dc2) -> RestUtil.compareDates(dc1.getDate(), dc2.getDate())))
        .collect(Collectors.toList());
  }

  private TableJoins getJoins(Table table) {
    String today = RestUtil.DATE_FORMAT.format(new Date());
    String todayMinus30Days = CommonUtil.getDateStringByOffset(RestUtil.DATE_FORMAT, today, -30);
    return new TableJoins()
        .withStartDate(todayMinus30Days)
        .withDayCount(30)
        .withColumnJoins(getColumnJoins(table))
        .withDirectTableJoins(getDirectTableJoins(table));
  }

  private List<JoinedWith> getDirectTableJoins(Table table) {
    // Pair<toTableFQN, List<DailyCount>>
    List<Pair<String, List<DailyCount>>> entityRelations =
        daoCollection.fieldRelationshipDAO()
            .listBidirectional(
                table.getFullyQualifiedName(),
                FIELD_RELATION_TABLE_TYPE,
                FIELD_RELATION_TABLE_TYPE,
                Relationship.JOINED_WITH.ordinal())
            .stream()
            .map(rethrowFunction(er -> Pair.of(er.getMiddle(), JsonUtils.readObjects(er.getRight(), DailyCount.class))))
            .collect(toUnmodifiableList());

    return entityRelations.stream()
        .map(
            er ->
                new JoinedWith()
                    .withFullyQualifiedName(er.getLeft())
                    .withJoinCount(er.getRight().stream().filter(inLast30Days()).mapToInt(DailyCount::getCount).sum()))
        .collect(Collectors.toList());
  }

  private List<ColumnJoin> getColumnJoins(Table table) {
    // Triple<fromRelativeColumnName, toFQN, List<DailyCount>>
    List<Triple<String, String, List<DailyCount>>> entityRelations =
        daoCollection.fieldRelationshipDAO()
            .listBidirectionalByPrefix(
                table.getFullyQualifiedName(),
                FIELD_RELATION_COLUMN_TYPE,
                FIELD_RELATION_COLUMN_TYPE,
                Relationship.JOINED_WITH.ordinal())
            .stream()
            .map(
                rethrowFunction(
                    er ->
                        Triple.of(
                            FullyQualifiedName.getColumnName(er.getLeft()),
                            er.getMiddle(),
                            JsonUtils.readObjects(er.getRight(), DailyCount.class))))
            .collect(toUnmodifiableList());

    return entityRelations.stream()
        .collect(groupingBy(Triple::getLeft))
        .entrySet()
        .stream()
        .map(
            e ->
                new ColumnJoin()
                    .withColumnName(e.getKey())
                    .withJoinedWith(
                        e.getValue().stream()
                            .map(
                                er ->
                                    new JoinedWith()
                                        .withFullyQualifiedName(er.getMiddle())
                                        .withJoinCount(
                                            er.getRight().stream()
                                                .filter(inLast30Days())
                                                .mapToInt(DailyCount::getCount)
                                                .sum()))
                            .collect(toUnmodifiableList())))
        .collect(toUnmodifiableList());
  }

  private Predicate<DailyCount> inLast30Days() {
    return dc -> CommonUtil.dateInRange(RestUtil.DATE_FORMAT, dc.getDate(), 0, 30);
  }

  private List<CustomMetric> getCustomMetrics(Table table, String columnName) throws IOException {
    String extension = TABLE_COLUMN_EXTENSION + columnName + CUSTOM_METRICS_EXTENSION;
    return JsonUtils.readObjects(
        daoCollection.entityExtensionDAO().getExtension(table.getId().toString(), extension), CustomMetric.class);
  }

  private void getCustomMetrics(boolean setMetrics, Table table) throws IOException {
    // Add custom metrics info to columns if requested
    List<Column> columns = table.getColumns();
    for (Column c : listOrEmpty(columns)) {
      c.setCustomMetrics(setMetrics ? getCustomMetrics(table, c.getName()) : null);
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class TableUpdater extends ColumnEntityUpdater {
    public TableUpdater(Table original, Table updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      Table origTable = original;
      Table updatedTable = updated;
      DatabaseUtil.validateColumns(updatedTable.getColumns());
      recordChange("tableType", origTable.getTableType(), updatedTable.getTableType());
      updateConstraints(origTable, updatedTable);
      updateColumns("columns", origTable.getColumns(), updated.getColumns(), EntityUtil.columnMatch);
    }

    private void updateConstraints(Table origTable, Table updatedTable) throws JsonProcessingException {
      List<TableConstraint> origConstraints = listOrEmpty(origTable.getTableConstraints());
      List<TableConstraint> updatedConstraints = listOrEmpty(updatedTable.getTableConstraints());

      origConstraints.sort(EntityUtil.compareTableConstraint);
      origConstraints.stream().map(TableConstraint::getColumns).forEach(Collections::sort);

      updatedConstraints.sort(EntityUtil.compareTableConstraint);
      updatedConstraints.stream().map(TableConstraint::getColumns).forEach(Collections::sort);

      List<TableConstraint> added = new ArrayList<>();
      List<TableConstraint> deleted = new ArrayList<>();
      recordListChange(
          "tableConstraints", origConstraints, updatedConstraints, added, deleted, EntityUtil.tableConstraintMatch);
    }
  }
}
