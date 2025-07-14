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
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrDefault;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addGlossaryTerms;
import static org.openmetadata.csv.CsvUtil.addTagLabels;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.Entity.getEntities;
import static org.openmetadata.service.Entity.getEntityReferenceById;
import static org.openmetadata.service.Entity.populateEntityFieldTags;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.util.EntityUtil.getLocalColumnName;
import static org.openmetadata.service.util.FullyQualifiedName.getColumnName;
import static org.openmetadata.service.util.LambdaExceptionUtil.ignoringComparator;
import static org.openmetadata.service.util.LambdaExceptionUtil.rethrowFunction;

import com.google.common.collect.Streams;
import jakarta.json.JsonPatch;
import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.commons.lang3.tuple.Triple;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Suggestion;
import org.openmetadata.schema.tests.CustomMetric;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnJoin;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.ColumnProfilerConfig;
import org.openmetadata.schema.type.DailyCount;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.JoinedWith;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.SuggestionType;
import org.openmetadata.schema.type.SystemProfile;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TableJoins;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TableProfilerConfig;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.EntitySpecViolationException;
import org.openmetadata.sdk.exception.SuggestionException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.ExtensionRecord;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.databases.DatabaseUtil;
import org.openmetadata.service.resources.databases.TableResource;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.security.mask.PIIMasker;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.ValidatorUtil;

@Slf4j
public class TableRepository extends EntityRepository<Table> {

  // Table fields that can be patched in a PATCH request
  static final String PATCH_FIELDS = "tableConstraints,tablePartition,columns";
  // Table fields that can be updated in a PUT request
  static final String UPDATE_FIELDS = "tableConstraints,tablePartition,dataModel,sourceUrl,columns";

  public static final String FIELD_RELATION_COLUMN_TYPE = "table.columns.column";
  public static final String FIELD_RELATION_TABLE_TYPE = "table";
  public static final String TABLE_PROFILE_EXTENSION = "table.tableProfile";
  public static final String SYSTEM_PROFILE_EXTENSION = "table.systemProfile";
  public static final String TABLE_COLUMN_PROFILE_EXTENSION = "table.columnProfile";

  public static final String TABLE_SAMPLE_DATA_EXTENSION = "table.sampleData";
  public static final String TABLE_PROFILER_CONFIG_EXTENSION = "table.tableProfilerConfig";
  public static final String TABLE_COLUMN_EXTENSION = "table.column";
  public static final String TABLE_EXTENSION = "table.table";
  public static final String CUSTOM_METRICS_EXTENSION = "customMetrics.";
  public static final String TABLE_PROFILER_CONFIG = "tableProfilerConfig";

  public static final String COLUMN_FIELD = "columns";
  public static final String CUSTOM_METRICS = "customMetrics";
  private static final Set<String> CHANGE_SUMMARY_FIELDS =
      Set.of("description", "owners", "columns.description");

  public TableRepository() {
    super(
        TableResource.COLLECTION_PATH,
        TABLE,
        Table.class,
        Entity.getCollectionDAO().tableDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS,
        CHANGE_SUMMARY_FIELDS);
    supportsSearch = true;

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put("usageSummary", this::fetchAndSetUsageSummaries);
    fieldFetchers.put("testSuite", this::fetchAndSetTestSuites);
    fieldFetchers.put("queries", this::fetchAndSetQueries);
    fieldFetchers.put(TABLE_PROFILER_CONFIG, this::fetchAndSetTableProfilerConfigs);
    fieldFetchers.put("joins", this::fetchAndSetJoins);
    fieldFetchers.put(CUSTOM_METRICS, this::fetchAndSetCustomMetrics);
    fieldFetchers.put(FIELD_TAGS, this::fetchAndSetColumnTags);
  }

  @Override
  public void setFields(Table table, Fields fields) {
    setDefaultFields(table);
    if (table.getUsageSummary() == null) {
      table.setUsageSummary(
          fields.contains("usageSummary")
              ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), table.getId())
              : table.getUsageSummary());
    }
    if (fields.contains(COLUMN_FIELD)) {
      populateEntityFieldTags(
          entityType,
          table.getColumns(),
          table.getFullyQualifiedName(),
          fields.contains(FIELD_TAGS));
    }
    table.setJoins(fields.contains("joins") ? getJoins(table) : table.getJoins());
    table.setTableProfilerConfig(
        fields.contains(TABLE_PROFILER_CONFIG)
            ? getTableProfilerConfig(table)
            : table.getTableProfilerConfig());
    table.setTestSuite(fields.contains("testSuite") ? getTestSuite(table) : table.getTestSuite());
    table.setCustomMetrics(
        fields.contains(CUSTOM_METRICS) ? getCustomMetrics(table, null) : table.getCustomMetrics());
    if ((fields.contains(COLUMN_FIELD)) && (fields.contains(CUSTOM_METRICS))) {
      for (Column column : table.getColumns()) {
        column.setCustomMetrics(getCustomMetrics(table, column.getName()));
      }
    }
    if (fields.contains("queries")) {
      List<Query> queriesEntity =
          getEntities(
              listOrEmpty(findTo(table.getId(), TABLE, Relationship.MENTIONED_IN, QUERY)),
              "id",
              ALL);
      List<String> queries = listOrEmpty(queriesEntity).stream().map(Query::getQuery).toList();
      table.setQueries(queries);
    }
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Table> entities) {
    // Bulk fetch and set default fields for all tables
    fetchAndSetDefaultFields(entities);

    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);

    // Handle table-specific fields that aren't in fetchAndSetFields
    entities.forEach(
        table -> {
          if (fields.contains(COLUMN_FIELD)) {
            populateEntityFieldTags(
                entityType,
                table.getColumns(),
                table.getFullyQualifiedName(),
                fields.contains(FIELD_TAGS));
          }

          clearFieldsInternal(table, fields);
        });
  }

  // Individual field fetchers registered in constructor
  private void fetchAndSetUsageSummaries(List<Table> tables, Fields fields) {
    if (!fields.contains("usageSummary") || tables == null || tables.isEmpty()) {
      return;
    }
    setFieldFromMap(
        true,
        tables,
        EntityUtil.getLatestUsageForEntities(daoCollection.usageDAO(), entityListToUUID(tables)),
        Table::setUsageSummary);
  }

  private void fetchAndSetTestSuites(List<Table> tables, Fields fields) {
    if (!fields.contains("testSuite") || tables == null || tables.isEmpty()) {
      return;
    }
    setFieldFromMap(true, tables, batchFetchTestSuites(tables), Table::setTestSuite);
  }

  private void fetchAndSetQueries(List<Table> tables, Fields fields) {
    if (!fields.contains("queries") || tables == null || tables.isEmpty()) {
      return;
    }
    setFieldFromMap(true, tables, batchFetchQueries(tables), Table::setQueries);
  }

  private void fetchAndSetTableProfilerConfigs(List<Table> tables, Fields fields) {
    if (!fields.contains(TABLE_PROFILER_CONFIG) || tables == null || tables.isEmpty()) {
      return;
    }
    setFieldFromMap(
        true, tables, batchFetchTableProfilerConfigs(tables), Table::setTableProfilerConfig);
  }

  private void fetchAndSetJoins(List<Table> tables, Fields fields) {
    if (!fields.contains("joins") || tables == null || tables.isEmpty()) {
      return;
    }
    setFieldFromMap(true, tables, batchFetchJoins(tables), Table::setJoins);
  }

  private void fetchAndSetCustomMetrics(List<Table> tables, Fields fields) {
    if (!fields.contains(CUSTOM_METRICS) || tables == null || tables.isEmpty()) {
      return;
    }
    setFieldFromMap(
        true,
        tables,
        batchFetchCustomMetrics(tables, fields.contains(COLUMN_FIELD)),
        Table::setCustomMetrics);
  }

  private void fetchAndSetColumnTags(List<Table> tables, Fields fields) {
    if (!fields.contains(FIELD_TAGS)
        || !fields.contains(COLUMN_FIELD)
        || tables == null
        || tables.isEmpty()) {
      return;
    }
    // Use bulk tag fetching to avoid N+1 queries
    bulkPopulateEntityFieldTags(
        tables, entityType, Table::getColumns, Table::getFullyQualifiedName);
  }

  @Override
  public void clearFields(Table table, Fields fields) {
    table.setTableConstraints(
        fields.contains("tableConstraints") ? table.getTableConstraints() : null);
    table.setUsageSummary(fields.contains("usageSummary") ? table.getUsageSummary() : null);
    table.setJoins(fields.contains("joins") ? table.getJoins() : null);
    table.setSchemaDefinition(
        fields.contains("schemaDefinition") ? table.getSchemaDefinition() : null);
    table.setTableProfilerConfig(
        fields.contains(TABLE_PROFILER_CONFIG) ? table.getTableProfilerConfig() : null);
    table.setTestSuite(fields.contains("testSuite") ? table.getTestSuite() : null);
  }

  @Override
  public void setInheritedFields(Table table, Fields fields) {
    DatabaseSchema schema =
        Entity.getEntity(DATABASE_SCHEMA, table.getDatabaseSchema().getId(), "owners,domain", ALL);
    inheritOwners(table, fields, schema);
    inheritDomain(table, fields, schema);
    // If table does not have retention period, then inherit it from parent databaseSchema
    table.withRetentionPeriod(
        table.getRetentionPeriod() == null
            ? schema.getRetentionPeriod()
            : table.getRetentionPeriod());
  }

  private void setDefaultFields(Table table) {
    EntityReference schemaRef = getContainer(table.getId(), DATABASE_SCHEMA);
    DatabaseSchema schema = Entity.getEntity(schemaRef, "", ALL);
    table
        .withDatabaseSchema(schemaRef)
        .withDatabase(schema.getDatabase())
        .withService(schema.getService())
        .withServiceType(schema.getServiceType());
  }

  private void fetchAndSetDefaultFields(List<Table> tables) {
    if (tables == null || tables.isEmpty()) {
      return;
    }

    var schemaRefsMap = batchFetchSchemas(tables);
    var uniqueSchemaIds =
        schemaRefsMap.values().stream().map(EntityReference::getId).distinct().toList();

    var schemaRepository = (DatabaseSchemaRepository) Entity.getEntityRepository(DATABASE_SCHEMA);
    var schemasList =
        schemaRepository.getDao().findEntitiesByIds(new ArrayList<>(uniqueSchemaIds), ALL);
    schemaRepository.setFieldsInBulk(Fields.EMPTY_FIELDS, schemasList);
    var schemas =
        schemasList.stream().collect(Collectors.toMap(DatabaseSchema::getId, schema -> schema));
    tables.forEach(
        table -> {
          var schemaRef = schemaRefsMap.get(table.getId());
          if (schemaRef != null) {
            var schema = schemas.get(schemaRef.getId());
            table
                .withDatabaseSchema(schemaRef)
                .withDatabase(schema.getDatabase())
                .withService(schema.getService())
                .withServiceType(schema.getServiceType());
          }
        });
  }

  private Map<UUID, EntityReference> batchFetchSchemas(List<Table> tables) {
    var schemaMap = new HashMap<UUID, EntityReference>();
    if (tables == null || tables.isEmpty()) {
      return schemaMap;
    }
    // Use Include.ALL to get all relationships including those for soft-deleted entities
    var relations =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(tables), Relationship.CONTAINS.ordinal(), ALL);

    // Collect all unique schema IDs first
    var schemaIds =
        relations.stream()
            .filter(rel -> DATABASE_SCHEMA.equals(rel.getFromEntity()))
            .map(rel -> UUID.fromString(rel.getFromId()))
            .distinct()
            .toList();

    // Batch fetch all schema entity references
    var schemaRefs = Entity.getEntityReferencesByIds(DATABASE_SCHEMA, schemaIds, ALL);
    var schemaRefMap =
        schemaRefs.stream().collect(Collectors.toMap(EntityReference::getId, ref -> ref));

    // Map tables to their schema references
    relations.forEach(
        rel -> {
          if (DATABASE_SCHEMA.equals(rel.getFromEntity())) {
            var tableId = UUID.fromString(rel.getToId());
            var schemaId = UUID.fromString(rel.getFromId());
            var schemaRef = schemaRefMap.get(schemaId);
            if (schemaRef != null) {
              schemaMap.put(tableId, schemaRef);
            }
          }
        });
    return schemaMap;
  }

  @Override
  public void restorePatchAttributes(Table original, Table updated) {
    // Patch can't make changes to following fields. Ignore the changes.
    super.restorePatchAttributes(original, updated);
    updated.withDatabase(original.getDatabase()).withService(original.getService());
  }

  @Override
  public void setFullyQualifiedName(Table table) {
    table.setFullyQualifiedName(
        FullyQualifiedName.add(table.getDatabaseSchema().getFullyQualifiedName(), table.getName()));
    ColumnUtil.setColumnFQN(table.getFullyQualifiedName(), table.getColumns());
  }

  @Transaction
  public Table addJoins(UUID tableId, TableJoins joins) {
    // Validate the request content
    Table table = find(tableId, NON_DELETED);
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
      String columnFQN =
          FullyQualifiedName.add(table.getFullyQualifiedName(), join.getColumnName());
      addJoinedWith(
          joins.getStartDate(), columnFQN, FIELD_RELATION_COLUMN_TYPE, join.getJoinedWith());
    }

    addJoinedWith(
        joins.getStartDate(),
        table.getFullyQualifiedName(),
        FIELD_RELATION_TABLE_TYPE,
        joins.getDirectTableJoins());

    return table.withJoins(getJoins(table));
  }

  @Transaction
  public Table addSampleData(UUID tableId, TableData tableData) {
    // Validate the request content
    Table table = find(tableId, NON_DELETED);

    // Validate all the columns
    for (String columnName : tableData.getColumns()) {
      validateColumn(table, columnName);
    }
    // Make sure each row has number values for all the columns
    for (List<Object> row : tableData.getRows()) {
      if (row.size() != tableData.getColumns().size()) {
        throw new IllegalArgumentException(
            String.format(
                "Number of columns is %d but row has %d sample values",
                tableData.getColumns().size(), row.size()));
      }
    }

    daoCollection
        .entityExtensionDAO()
        .insert(tableId, TABLE_SAMPLE_DATA_EXTENSION, "tableData", JsonUtils.pojoToJson(tableData));
    setFieldsInternal(table, Fields.EMPTY_FIELDS);
    return table.withSampleData(tableData);
  }

  public Table getSampleData(UUID tableId, boolean authorizePII) {
    // Validate the request content
    Table table = find(tableId, NON_DELETED);
    TableData sampleData =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionDAO()
                .getExtension(table.getId(), TABLE_SAMPLE_DATA_EXTENSION),
            TableData.class);
    table.setSampleData(sampleData);
    setFieldsInternal(table, Fields.EMPTY_FIELDS);

    // Set the column tags. Will be used to mask the sample data
    if (!authorizePII) {
      populateEntityFieldTags(entityType, table.getColumns(), table.getFullyQualifiedName(), true);
      table.setTags(getTags(table));
      return PIIMasker.getSampleData(table);
    }

    return table;
  }

  @Transaction
  public Table deleteSampleData(UUID tableId) {
    // Validate the request content
    Table table = find(tableId, NON_DELETED);
    daoCollection.entityExtensionDAO().delete(tableId, TABLE_SAMPLE_DATA_EXTENSION);
    setFieldsInternal(table, Fields.EMPTY_FIELDS);
    return table;
  }

  public TableProfilerConfig getTableProfilerConfig(Table table) {
    return JsonUtils.readValue(
        daoCollection
            .entityExtensionDAO()
            .getExtension(table.getId(), TABLE_PROFILER_CONFIG_EXTENSION),
        TableProfilerConfig.class);
  }

  public EntityReference getTestSuite(Table table) {
    return getToEntityRef(table.getId(), Relationship.CONTAINS, TEST_SUITE, false);
  }

  @Transaction
  public Table addTableProfilerConfig(UUID tableId, TableProfilerConfig tableProfilerConfig) {
    // Validate the request content
    Table table = find(tableId, NON_DELETED);

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
    if (tableProfilerConfig.getProfileSampleType() != null
        && tableProfilerConfig.getProfileSample() != null) {
      EntityUtil.validateProfileSample(
          tableProfilerConfig.getProfileSampleType().toString(),
          tableProfilerConfig.getProfileSample());
    }

    daoCollection
        .entityExtensionDAO()
        .insert(
            tableId,
            TABLE_PROFILER_CONFIG_EXTENSION,
            TABLE_PROFILER_CONFIG,
            JsonUtils.pojoToJson(tableProfilerConfig));
    clearFields(table, Fields.EMPTY_FIELDS);
    return table.withTableProfilerConfig(tableProfilerConfig);
  }

  @Transaction
  public Table deleteTableProfilerConfig(UUID tableId) {
    // Validate the request content
    Table table = find(tableId, NON_DELETED);
    daoCollection.entityExtensionDAO().delete(tableId, TABLE_PROFILER_CONFIG_EXTENSION);
    clearFieldsInternal(table, Fields.EMPTY_FIELDS);
    return table;
  }

  private Column getColumnNameForProfiler(
      List<Column> columnList, ColumnProfile columnProfile, String parentName) {
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

  public Table addTableProfileData(UUID tableId, CreateTableProfile createTableProfile) {
    // Validate the request content
    Table table = find(tableId, NON_DELETED);
    validateProfilerTimestamps(createTableProfile);
    daoCollection
        .profilerDataTimeSeriesDao()
        .insert(
            table.getFullyQualifiedName(),
            TABLE_PROFILE_EXTENSION,
            "tableProfile",
            JsonUtils.pojoToJson(createTableProfile.getTableProfile()));

    for (ColumnProfile columnProfile : createTableProfile.getColumnProfile()) {
      // Validate all the columns
      Column column = getColumnNameForProfiler(table.getColumns(), columnProfile, null);
      if (column == null) {
        throw new IllegalArgumentException("Invalid column name " + columnProfile.getName());
      }
      daoCollection
          .profilerDataTimeSeriesDao()
          .insert(
              column.getFullyQualifiedName(),
              TABLE_COLUMN_PROFILE_EXTENSION,
              "columnProfile",
              JsonUtils.pojoToJson(columnProfile));
    }

    List<SystemProfile> systemProfiles = createTableProfile.getSystemProfile();
    if (systemProfiles != null && !systemProfiles.isEmpty()) {
      for (SystemProfile systemProfile : createTableProfile.getSystemProfile()) {
        // system metrics timestamp is the one of the operation. We'll need to
        // update the entry if it already exists in the database
        String storedSystemProfile =
            daoCollection
                .profilerDataTimeSeriesDao()
                .getExtensionAtTimestampWithOperation(
                    table.getFullyQualifiedName(),
                    SYSTEM_PROFILE_EXTENSION,
                    systemProfile.getTimestamp(),
                    systemProfile.getOperation().value());
        daoCollection
            .profilerDataTimeSeriesDao()
            .storeTimeSeriesWithOperation(
                table.getFullyQualifiedName(),
                SYSTEM_PROFILE_EXTENSION,
                "systemProfile",
                JsonUtils.pojoToJson(systemProfile),
                systemProfile.getTimestamp(),
                systemProfile.getOperation().value(),
                storedSystemProfile != null);
      }
    }

    setFieldsInternal(table, Fields.EMPTY_FIELDS);
    return table.withProfile(createTableProfile.getTableProfile());
  }

  private void validateProfilerTimestamps(CreateTableProfile createTableProfile) {
    if (createTableProfile.getTableProfile() != null) {
      RestUtil.validateTimestampMilliseconds(createTableProfile.getTableProfile().getTimestamp());
    }
    if (createTableProfile.getColumnProfile() != null) {
      createTableProfile
          .getColumnProfile()
          .forEach(
              columnProfile ->
                  RestUtil.validateTimestampMilliseconds(columnProfile.getTimestamp()));
    }
    if (createTableProfile.getSystemProfile() != null) {
      createTableProfile
          .getSystemProfile()
          .forEach(
              systemProfile ->
                  RestUtil.validateTimestampMilliseconds(systemProfile.getTimestamp()));
    }
  }

  public void deleteTableProfile(String fqn, String entityType, Long timestamp) {
    // Validate the request content
    String extension;
    if (entityType.equalsIgnoreCase(Entity.TABLE)) {
      extension = TABLE_PROFILE_EXTENSION;
    } else if (entityType.equalsIgnoreCase("column")) {
      extension = TABLE_COLUMN_PROFILE_EXTENSION;
    } else if (entityType.equalsIgnoreCase("system")) {
      extension = SYSTEM_PROFILE_EXTENSION;
    } else {
      throw new IllegalArgumentException("entityType must be table, column or system");
    }
    daoCollection.profilerDataTimeSeriesDao().deleteAtTimestamp(fqn, extension, timestamp);
  }

  public ResultList<TableProfile> getTableProfiles(String fqn, Long startTs, Long endTs) {
    List<TableProfile> tableProfiles;
    tableProfiles =
        JsonUtils.readObjects(
            daoCollection
                .profilerDataTimeSeriesDao()
                .listBetweenTimestampsByOrder(
                    fqn, TABLE_PROFILE_EXTENSION, startTs, endTs, EntityTimeSeriesDAO.OrderBy.DESC),
            TableProfile.class);
    return new ResultList<>(
        tableProfiles, startTs.toString(), endTs.toString(), tableProfiles.size());
  }

  public ResultList<ColumnProfile> getColumnProfiles(
      String fqn, Long startTs, Long endTs, boolean authorizePII) {
    List<ColumnProfile> columnProfiles;
    columnProfiles =
        JsonUtils.readObjects(
            daoCollection
                .profilerDataTimeSeriesDao()
                .listBetweenTimestampsByOrder(
                    fqn,
                    TABLE_COLUMN_PROFILE_EXTENSION,
                    startTs,
                    endTs,
                    EntityTimeSeriesDAO.OrderBy.DESC),
            ColumnProfile.class);
    ResultList<ColumnProfile> columnProfileResultList =
        new ResultList<>(
            columnProfiles, startTs.toString(), endTs.toString(), columnProfiles.size());
    if (!authorizePII) {
      // Mask the PII data
      columnProfileResultList.setData(
          PIIMasker.getColumnProfile(fqn, columnProfileResultList.getData()));
    }
    return columnProfileResultList;
  }

  public ResultList<SystemProfile> getSystemProfiles(String fqn, Long startTs, Long endTs) {
    List<SystemProfile> systemProfiles;
    systemProfiles =
        JsonUtils.readObjects(
            daoCollection
                .profilerDataTimeSeriesDao()
                .listBetweenTimestampsByOrder(
                    fqn,
                    SYSTEM_PROFILE_EXTENSION,
                    startTs,
                    endTs,
                    EntityTimeSeriesDAO.OrderBy.DESC),
            SystemProfile.class);
    return new ResultList<>(
        systemProfiles, startTs.toString(), endTs.toString(), systemProfiles.size());
  }

  private void setColumnProfile(List<Column> columnList) {
    for (Column column : columnList) {
      ColumnProfile columnProfile =
          JsonUtils.readValue(
              daoCollection
                  .profilerDataTimeSeriesDao()
                  .getLatestExtension(
                      column.getFullyQualifiedName(), TABLE_COLUMN_PROFILE_EXTENSION),
              ColumnProfile.class);
      column.setProfile(columnProfile);
      if (column.getChildren() != null) {
        setColumnProfile(column.getChildren());
      }
    }
  }

  public Table getLatestTableProfile(
      String fqn, boolean authorizePII, boolean includeColumnProfile) {
    Table table = findByName(fqn, ALL);
    TableProfile tableProfile =
        JsonUtils.readValue(
            daoCollection
                .profilerDataTimeSeriesDao()
                .getLatestExtension(table.getFullyQualifiedName(), TABLE_PROFILE_EXTENSION),
            TableProfile.class);
    table.setProfile(tableProfile);
    if (includeColumnProfile) {
      setColumnProfile(table.getColumns());
    }

    // Set the column tags. Will be used to hide the data
    if (!authorizePII) {
      populateEntityFieldTags(entityType, table.getColumns(), table.getFullyQualifiedName(), true);
      table.setColumns(PIIMasker.getTableProfile(table.getColumns()));
    }

    return table;
  }

  public Table addCustomMetric(UUID tableId, CustomMetric customMetric) {
    // Validate the request content
    Table table = find(tableId, NON_DELETED);

    String customMetricName = customMetric.getName();
    String customMetricColumnName = customMetric.getColumnName();
    String extensionType =
        customMetricColumnName != null ? TABLE_COLUMN_EXTENSION : TABLE_EXTENSION;
    String extension = CUSTOM_METRICS_EXTENSION + extensionType + "." + customMetricName;

    // Validate the column name exists in the table
    if (customMetricColumnName != null) {
      validateColumn(table, customMetricColumnName);
    }

    CustomMetric storedCustomMetrics = getCustomMetric(table, extension);
    if (storedCustomMetrics != null) {
      storedCustomMetrics.setExpression(customMetric.getExpression());
    }

    daoCollection
        .entityExtensionDAO()
        .insert(table.getId(), extension, "customMetric", JsonUtils.pojoToJson(customMetric));
    // return the newly created/updated custom metric only
    setFieldsInternal(table, new Fields(Set.of(CUSTOM_METRICS, COLUMN_FIELD)));
    return table;
  }

  public Table deleteCustomMetric(UUID tableId, String columnName, String metricName) {
    // Validate the request content
    Table table = find(tableId, NON_DELETED);
    if (columnName != null) validateColumn(table, columnName);

    // Get unique entity extension and delete data from DB
    String extensionType = columnName != null ? TABLE_COLUMN_EXTENSION : TABLE_EXTENSION;
    String extension = CUSTOM_METRICS_EXTENSION + extensionType + "." + metricName;
    daoCollection.entityExtensionDAO().delete(tableId, extension);

    // return the newly created/updated custom metric only
    setFieldsInternal(table, new Fields(Set.of(CUSTOM_METRICS, COLUMN_FIELD)));
    return table;
  }

  public Table addDataModel(UUID tableId, DataModel dataModel) {
    Table table =
        get(null, tableId, getFields(Set.of(FIELD_OWNERS, FIELD_TAGS)), NON_DELETED, false);

    // Update the sql fields only if correct value is present
    if (dataModel.getRawSql() == null || dataModel.getRawSql().isBlank()) {
      if (table.getDataModel() != null
          && (table.getDataModel().getRawSql() != null
              && !table.getDataModel().getRawSql().isBlank())) {
        dataModel.setRawSql(table.getDataModel().getRawSql());
      }
    }

    if ((dataModel.getSql() == null || dataModel.getSql().isBlank())
        && table.getDataModel() != null
        && (table.getDataModel().getSql() != null && !table.getDataModel().getSql().isBlank())) {
      dataModel.setSql(table.getDataModel().getSql());
    }

    table.withDataModel(dataModel);

    // Carry forward the table owners from the model to table entity, if empty
    if (nullOrEmpty(table.getOwners())) {
      storeOwners(table, dataModel.getOwners());
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
    applyColumnTags(table.getColumns());
    dao.update(table.getId(), table.getFullyQualifiedName(), JsonUtils.pojoToJson(table));
    setFieldsInternal(table, new Fields(Set.of(FIELD_OWNERS), FIELD_OWNERS));
    setFieldsInternal(table, new Fields(Set.of(FIELD_TAGS), FIELD_TAGS));
    return table;
  }

  @Override
  public void prepare(Table table, boolean update) {
    DatabaseSchema schema = Entity.getEntity(table.getDatabaseSchema(), "", ALL);
    table
        .withDatabaseSchema(schema.getEntityReference())
        .withDatabase(schema.getDatabase())
        .withService(schema.getService())
        .withServiceType(schema.getServiceType());
    validateTableConstraints(table);
  }

  @Override
  public void storeEntity(Table table, boolean update) {
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
    // Store ER relationships based on table constraints
    addConstraintRelationship(table, table.getTableConstraints());
  }

  @Override
  public void storeRelationships(Table table) {
    // Add relationship from database to table
    addRelationship(
        table.getDatabaseSchema().getId(),
        table.getId(),
        DATABASE_SCHEMA,
        TABLE,
        Relationship.CONTAINS);
  }

  @Override
  public EntityUpdater getUpdater(
      Table original, Table updated, Operation operation, ChangeSource changeSource) {
    return new TableUpdater(original, updated, operation, changeSource);
  }

  @Override
  public void applyTags(Table table) {
    // Add table level tags by adding tag to table relationship
    super.applyTags(table);
    applyColumnTags(table.getColumns());
  }

  @Override
  public EntityInterface getParentEntity(Table entity, String fields) {
    return Entity.getEntity(entity.getDatabaseSchema(), fields, ALL);
  }

  @Override
  public void validateTags(Table entity) {
    super.validateTags(entity);
    validateColumnTags(entity.getColumns());
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

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    EntityLink entityLink = threadContext.getAbout();
    if (entityLink.getFieldName().equals(COLUMN_FIELD)) {
      TaskType taskType = threadContext.getThread().getTask().getType();
      if (EntityUtil.isDescriptionTask(taskType)) {
        return new ColumnDescriptionWorkflow(threadContext);
      } else if (EntityUtil.isTagTask(taskType)) {
        return new ColumnTagWorkflow(threadContext);
      } else {
        throw new IllegalArgumentException(String.format("Invalid task type %s", taskType));
      }
    }
    return super.getTaskWorkflow(threadContext);
  }

  @Override
  public String getSuggestionFields(Suggestion suggestion) {
    return suggestion.getType() == SuggestionType.SuggestTagLabel ? "columns,tags" : "";
  }

  @Override
  public Table applySuggestion(EntityInterface entity, String columnFQN, Suggestion suggestion) {
    Table table = (Table) entity;
    for (Column col : table.getColumns()) {
      if (col.getFullyQualifiedName().equals(columnFQN)) {
        applySuggestionToColumn(col, suggestion);
      }
      if (col.getChildren() != null && !col.getChildren().isEmpty()) {
        for (Column child : col.getChildren()) {
          if (child.getFullyQualifiedName().equals(columnFQN)) {
            applySuggestionToColumn(child, suggestion);
          }
        }
      }
    }
    return table;
  }

  public void applySuggestionToColumn(Column column, Suggestion suggestion) {
    if (suggestion.getType().equals(SuggestionType.SuggestTagLabel)) {
      List<TagLabel> tags = new ArrayList<>(column.getTags());
      tags.addAll(suggestion.getTagLabels());
      column.setTags(tags);
    } else if (suggestion.getType().equals(SuggestionType.SuggestDescription)) {
      column.setDescription(suggestion.getDescription());
    } else {
      throw new SuggestionException("Invalid suggestion Type");
    }
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    // Validate table
    Table table = getByName(null, name, new Fields(allowedFields, "owners,domain,tags,columns"));
    return new TableCsv(table, user).exportCsv(listOf(table));
  }

  /**
   * Export columns for a table, handling nested column structure
   */
  public void exportColumnsRecursively(Table table, CsvFile csvFile) {
    if (table.getColumns() != null && !table.getColumns().isEmpty()) {
      for (Column column : table.getColumns()) {
        addColumnRecord(csvFile, column, table.getFullyQualifiedName());
      }
    }
  }

  private void addColumnRecord(CsvFile csvFile, Column column, String tableFqn) {
    // Create a record with fields in the exact order matching headers in tableCsvDocumentation.json
    List<String> recordList = new ArrayList<>();

    // Basic entity fields
    addField(recordList, getLocalColumnName(tableFqn, column.getFullyQualifiedName())); // name
    addField(recordList, column.getDisplayName()); // displayName
    addField(recordList, column.getDescription()); // description

    // Fields that should be empty for columns
    addField(recordList, ""); // owner (empty for columns)

    // Column-specific fields that may have values
    addTagLabels(recordList, column.getTags()); // tags
    addGlossaryTerms(recordList, column.getTags()); // glossaryTerms

    // More fields that should be empty for columns
    addField(recordList, ""); // tiers (empty for columns)
    addField(recordList, ""); // certification (empty for columns)
    addField(recordList, ""); // retentionPeriod (empty for columns)
    addField(recordList, ""); // sourceUrl (empty for columns)
    addField(recordList, ""); // domain (empty for columns)
    addField(recordList, ""); // extension (empty for columns)

    // Metadata fields - IMPORTANT: These need to be in the same position for all entity types
    addField(recordList, "column"); // entityType
    addField(recordList, column.getFullyQualifiedName()); // fullyQualifiedName

    // Column data type fields - these should be added at the end
    addField(recordList, column.getDataTypeDisplay()); // column.dataTypeDisplay

    String dataTypeValue = column.getDataType() == null ? null : column.getDataType().value();
    String arrayDataTypeValue =
        column.getArrayDataType() == null ? null : column.getArrayDataType().value();

    if (ColumnDataType.ARRAY.value().equals(dataTypeValue) && arrayDataTypeValue == null) {
      throw new IllegalArgumentException(
          String.format(
              "Column %s has dataType=ARRAY but missing arrayDataType",
              column.getFullyQualifiedName()));
    }

    addField(recordList, dataTypeValue); // column.dataType
    addField(recordList, arrayDataTypeValue);
    addField(
        recordList,
        column.getDataLength() == null
            ? null
            : String.valueOf(column.getDataLength())); // column.dataLength

    // Add directly to the CSV file without using HierarchyCSVImporter
    // Since we've manually built the record in the correct order
    List<List<String>> records = csvFile.getRecords();
    if (records == null) {
      records = new ArrayList<>();
      csvFile.withRecords(records);
    }
    records.add(recordList);

    // Process child columns recursively
    if (column.getChildren() != null && !column.getChildren().isEmpty()) {
      for (Column childColumn : column.getChildren()) {
        addColumnRecord(csvFile, childColumn, tableFqn);
      }
    }
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    // Validate table
    Table table =
        getByName(
            null,
            name,
            new Fields(
                allowedFields, "owners,domain,tags,columns,database,service,databaseSchema"));
    return new TableCsv(table, user).importCsv(csv, dryRun);
  }

  static class ColumnDescriptionWorkflow extends DescriptionTaskWorkflow {
    private final Column column;

    ColumnDescriptionWorkflow(ThreadContext threadContext) {
      super(threadContext);
      Table table =
          Entity.getEntity(TABLE, threadContext.getAboutEntity().getId(), COLUMN_FIELD, ALL);
      threadContext.setAboutEntity(table);
      column =
          getColumn(
              (Table) threadContext.getAboutEntity(), threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      column.setDescription(resolveTask.getNewValue());
      return threadContext.getAboutEntity();
    }
  }

  static class ColumnTagWorkflow extends TagTaskWorkflow {
    private final Column column;

    ColumnTagWorkflow(ThreadContext threadContext) {
      super(threadContext);
      Table table =
          Entity.getEntity(TABLE, threadContext.getAboutEntity().getId(), "columns,tags", ALL);
      threadContext.setAboutEntity(table);
      column =
          getColumn(
              (Table) threadContext.getAboutEntity(), threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      List<TagLabel> tags = JsonUtils.readObjects(resolveTask.getNewValue(), TagLabel.class);
      column.setTags(tags);
      return threadContext.getAboutEntity();
    }
  }

  private static Column getColumn(Table table, String columnName) {
    String childrenName = "";
    if (columnName.contains(".")) {
      String fieldNameWithoutQuotes = columnName.substring(1, columnName.length() - 1);
      columnName = fieldNameWithoutQuotes.substring(0, fieldNameWithoutQuotes.indexOf("."));
      childrenName = fieldNameWithoutQuotes.substring(fieldNameWithoutQuotes.lastIndexOf(".") + 1);
    }

    Column column = EntityUtil.findColumn(table.getColumns(), columnName);
    if (!childrenName.isEmpty() && column != null) {
      column = getChildColumn(column.getChildren(), childrenName);
    }
    if (column == null) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidFieldName("column", columnName));
    }
    return column;
  }

  private static Column getChildColumn(List<Column> column, String childrenName) {
    Column childrenColumn = null;
    for (Column col : column) {
      if (col.getName().equals(childrenName)) {
        childrenColumn = col;
        break;
      }
    }
    if (childrenColumn == null) {
      for (Column value : column) {
        if (value.getChildren() != null) {
          childrenColumn = getChildColumn(value.getChildren(), childrenName);
          if (childrenColumn != null) {
            break;
          }
        }
      }
    }
    return childrenColumn;
  }

  private void validateTableFQN(String fqn) {
    try {
      dao.existsByName(fqn);
    } catch (EntityNotFoundException e) {
      throw new IllegalArgumentException("Invalid table name " + fqn, e);
    }
  }

  private void validateColumnFQNs(List<JoinedWith> joinedWithList) {
    for (JoinedWith joinedWith : joinedWithList) {
      // Validate table
      String tableFQN = FullyQualifiedName.getTableFQN(joinedWith.getFullyQualifiedName());
      Table joinedWithTable = findByName(tableFQN, NON_DELETED);

      // Validate column
      ColumnUtil.validateColumnFQN(
          joinedWithTable.getColumns(), joinedWith.getFullyQualifiedName());
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
  private void addJoinedWith(
      String date, String entityFQN, String entityRelationType, List<JoinedWith> joinedWithList) {
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

      DailyCount receivedDailyCount =
          new DailyCount().withCount(joinedWith.getJoinCount()).withDate(date);

      List<DailyCount> newDailyCounts =
          aggregateAndFilterDailyCounts(currentDailyCounts, receivedDailyCount);

      daoCollection
          .fieldRelationshipDAO()
          .upsert(
              fromEntityFQN,
              toEntityFQN,
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
        Streams.concat(currentDailyCounts.stream(), Stream.of(newDailyCount))
            .collect(groupingBy(DailyCount::getDate));

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
                                () ->
                                    new IllegalStateException(
                                        "Collector.groupingBy created an empty grouping"))
                            .getCount());
            })
        .filter(inLast30Days())
        .sorted(
            ignoringComparator((dc1, dc2) -> RestUtil.compareDates(dc1.getDate(), dc2.getDate())))
        .collect(Collectors.toList());
  }

  private TableJoins getJoins(Table table) {
    String today = RestUtil.DATE_FORMAT.format(LocalDate.now());
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
        daoCollection
            .fieldRelationshipDAO()
            .listBidirectional(
                table.getFullyQualifiedName(),
                FIELD_RELATION_TABLE_TYPE,
                FIELD_RELATION_TABLE_TYPE,
                Relationship.JOINED_WITH.ordinal())
            .stream()
            .map(
                rethrowFunction(
                    er ->
                        Pair.of(
                            er.getMiddle(),
                            JsonUtils.readObjects(er.getRight(), DailyCount.class))))
            .toList();

    return entityRelations.stream()
        .map(
            er ->
                new JoinedWith()
                    .withFullyQualifiedName(er.getLeft())
                    .withJoinCount(
                        er.getRight().stream()
                            .filter(inLast30Days())
                            .mapToInt(DailyCount::getCount)
                            .sum()))
        .collect(Collectors.toList());
  }

  private List<ColumnJoin> getColumnJoins(Table table) {
    // Triple<fromRelativeColumnName, toFQN, List<DailyCount>>
    List<Triple<String, String, List<DailyCount>>> entityRelations =
        daoCollection
            .fieldRelationshipDAO()
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
                            getColumnName(er.getLeft()),
                            er.getMiddle(),
                            JsonUtils.readObjects(er.getRight(), DailyCount.class))))
            .toList();

    return entityRelations.stream().collect(groupingBy(Triple::getLeft)).entrySet().stream()
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
                            .toList()))
        .toList();
  }

  private Predicate<DailyCount> inLast30Days() {
    return dc -> CommonUtil.dateInRange(RestUtil.DATE_FORMAT, dc.getDate(), 0, 30);
  }

  private CustomMetric getCustomMetric(Table table, String extension) {
    return JsonUtils.readValue(
        daoCollection.entityExtensionDAO().getExtension(table.getId(), extension),
        CustomMetric.class);
  }

  private List<CustomMetric> getCustomMetrics(Table table, String columnName) {
    String extension = columnName != null ? TABLE_COLUMN_EXTENSION : TABLE_EXTENSION;
    extension = CUSTOM_METRICS_EXTENSION + extension;

    List<ExtensionRecord> extensionRecords =
        daoCollection.entityExtensionDAO().getExtensions(table.getId(), extension);
    List<CustomMetric> customMetrics = new ArrayList<>();
    for (ExtensionRecord extensionRecord : extensionRecords) {
      customMetrics.add(JsonUtils.readValue(extensionRecord.extensionJson(), CustomMetric.class));
    }

    if (columnName != null) {
      // Filter custom metrics by column name
      customMetrics =
          customMetrics.stream()
              .filter(metric -> metric.getColumnName().equals(columnName))
              .collect(Collectors.toList());
    }

    return customMetrics;
  }

  private void validateTableConstraints(Table table) {
    if (!nullOrEmpty(table.getTableConstraints())) {
      Set<TableConstraint> constraintSet = new HashSet<>();
      for (TableConstraint constraint : table.getTableConstraints()) {
        if (!constraintSet.add(constraint)) {
          throw new EntitySpecViolationException(
              "Duplicate constraint found in request: " + constraint);
        }
        for (String column : constraint.getColumns()) {
          validateColumn(table, column);
        }
        if (!nullOrEmpty(constraint.getReferredColumns())) {
          for (String column : constraint.getReferredColumns()) {
            String toParent = FullyQualifiedName.getParentFQN(column);
            String columnName = FullyQualifiedName.getColumnName(column);
            try {
              Table toTable = findByName(toParent, ALL);
              validateColumn(toTable, columnName);
            } catch (EntityNotFoundException e) {
              throw new EntitySpecViolationException("Table not found: " + toParent);
            }
          }
        }
      }
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class TableUpdater extends ColumnEntityUpdater {
    public TableUpdater(
        Table original, Table updated, Operation operation, ChangeSource changeSource) {
      super(original, updated, operation, changeSource);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      Table origTable = original;
      Table updatedTable = updated;
      DatabaseUtil.validateColumns(updatedTable.getColumns());
      recordChange("tableType", origTable.getTableType(), updatedTable.getTableType());
      updateTableConstraints(origTable, updatedTable, operation);
      updateProcessedLineage(origTable, updatedTable);
      updateColumns(
          COLUMN_FIELD, origTable.getColumns(), updated.getColumns(), EntityUtil.columnMatch);
      recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl());
      recordChange("retentionPeriod", original.getRetentionPeriod(), updated.getRetentionPeriod());
      recordChange("sourceHash", original.getSourceHash(), updated.getSourceHash());
      recordChange("locationPath", original.getLocationPath(), updated.getLocationPath());
      recordChange(
          "processedLineage", original.getProcessedLineage(), updated.getProcessedLineage());
    }

    private void updateProcessedLineage(Table origTable, Table updatedTable) {
      // if schema definition changes make processed lineage false
      if (origTable.getProcessedLineage().booleanValue()
          && origTable.getSchemaDefinition() != null
          && !origTable.getSchemaDefinition().equals(updatedTable.getSchemaDefinition())) {
        updatedTable.setProcessedLineage(false);
      }
    }

    private void updateTableConstraints(Table origTable, Table updatedTable, Operation operation) {
      validateTableConstraints(updatedTable);
      if (operation.isPatch()
          && !nullOrEmpty(updatedTable.getTableConstraints())
          && !nullOrEmpty(origTable.getTableConstraints())) {
        List<TableConstraint> newConstraints = new ArrayList<>();
        for (TableConstraint constraint : updatedTable.getTableConstraints()) {
          TableConstraint existing =
              origTable.getTableConstraints().stream()
                  .filter(c -> EntityUtil.tableConstraintMatch.test(c, constraint))
                  .findAny()
                  .orElse(null);
          if (existing == null) {
            newConstraints.add(constraint);
          }
        }
        checkDuplicateTableConstraints(origTable, newConstraints);
      }
      List<TableConstraint> origConstraints = listOrEmpty(origTable.getTableConstraints());
      List<TableConstraint> updatedConstraints = listOrEmpty(updatedTable.getTableConstraints());
      origConstraints.sort(EntityUtil.compareTableConstraint);
      origConstraints.stream().map(TableConstraint::getColumns).forEach(Collections::sort);

      updatedConstraints.sort(EntityUtil.compareTableConstraint);
      updatedConstraints.stream().map(TableConstraint::getColumns).forEach(Collections::sort);

      List<TableConstraint> added = new ArrayList<>();
      List<TableConstraint> deleted = new ArrayList<>();
      recordListChange(
          "tableConstraints",
          origConstraints,
          updatedConstraints,
          added,
          deleted,
          EntityUtil.tableConstraintMatch);

      // manage table ER relationship based on table constraints
      addConstraintRelationship(origTable, added);
      deleteConstraintRelationship(origTable, deleted);
    }

    @Override
    protected void handleColumnLineageUpdates(
        List<String> deletedColumns,
        java.util.HashMap<String, String> originalUpdatedColumnFqnMap) {
      boolean hasRenames = !originalUpdatedColumnFqnMap.isEmpty();
      boolean hasDeletes = !deletedColumns.isEmpty();

      // Update lineage relationships stored in the database
      if (hasRenames || hasDeletes) {
        LineageRepository lineageRepository = Entity.getLineageRepository();
        if (lineageRepository != null) {
          lineageRepository.updateColumnLineage(
              updated.getId(),
              hasRenames ? originalUpdatedColumnFqnMap : java.util.Collections.emptyMap(),
              hasDeletes ? deletedColumns : java.util.Collections.emptyList(),
              updated.getSchemaDefinition(),
              updated.getUpdatedBy());
        }
      }

      if (hasRenames) {
        searchRepository
            .getSearchClient()
            .updateColumnsInUpstreamLineage(GLOBAL_SEARCH_ALIAS, originalUpdatedColumnFqnMap);
      }
      if (hasDeletes) {
        searchRepository
            .getSearchClient()
            .deleteColumnsInUpstreamLineage(GLOBAL_SEARCH_ALIAS, deletedColumns);
      }
    }
  }

  private void checkDuplicateTableConstraints(
      Table origTable, List<TableConstraint> newConstraints) {
    if (!nullOrEmpty(origTable.getTableConstraints()) && !nullOrEmpty(newConstraints)) {
      Set<TableConstraint> origConstraints =
          new HashSet<>(listOrEmpty(origTable.getTableConstraints()));
      for (TableConstraint constraint : newConstraints) {
        if (!origConstraints.add(constraint)) {
          throw new EntitySpecViolationException("Table Constraint is Duplicate: " + constraint);
        }
      }
    }
  }

  private void addConstraintRelationship(Table table, List<TableConstraint> constraints) {
    if (!nullOrEmpty(constraints)) {
      for (TableConstraint constraint : constraints) {
        if (!nullOrEmpty(constraint.getReferredColumns())) {
          for (String column : constraint.getReferredColumns()) {
            String toParent = FullyQualifiedName.getParentFQN(column);
            try {
              EntityReference toTable = Entity.getEntityReferenceByName(TABLE, toParent, ALL);
              addRelationship(
                  table.getId(), toTable.getId(), TABLE, TABLE, Relationship.RELATED_TO);
            } catch (EntityNotFoundException e) {
              throw EntityNotFoundException.byName(
                  String.format(
                      "Failed to add table constraint due to missing table %s", toParent));
            }
          }
        }
      }
    }
  }

  private void deleteConstraintRelationship(Table table, List<TableConstraint> constraints) {
    if (!nullOrEmpty(constraints)) {
      for (TableConstraint constraint : constraints) {
        if (!nullOrEmpty(constraint.getReferredColumns())) {
          for (String column : constraint.getReferredColumns()) {
            String toParent = FullyQualifiedName.getParentFQN(column);
            try {
              EntityReference toTable = Entity.getEntityReferenceByName(TABLE, toParent, ALL);
              deleteRelationship(
                  table.getId(), TABLE, toTable.getId(), TABLE, Relationship.RELATED_TO);
              searchRepository.deleteRelationshipFromSearch(table.getId(), toTable.getId());
            } catch (EntityNotFoundException e) {
              throw EntityNotFoundException.byName(
                  String.format(
                      "Failed to add table constraint due to missing table %s", toParent));
            }
          }
        }
      }
    }
  }

  public static class TableCsv extends EntityCsv<Table> {
    public static final CsvDocumentation DOCUMENTATION = getCsvDocumentation(TABLE, false);
    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();

    private final Table table;

    TableCsv(Table table, String user) {
      super(TABLE, HEADERS, user);
      this.table = table;
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      // Headers: column.fullyQualifiedName, column.displayName, column.description,
      // column.dataTypeDisplay,column.dataType, column.arrayDataType, column.dataLength,
      // column.tags, column.glossaryTerms
      Table originalEntity = JsonUtils.deepCopy(table, Table.class);
      while (recordIndex < csvRecords.size()) {
        CSVRecord csvRecord = getNextRecord(printer, csvRecords);
        if (csvRecord != null) {
          updateColumnsFromCsv(printer, csvRecord);
          String violations = ValidatorUtil.validate(table);
          if (violations != null) {
            // JSON schema based validation failed for the entity
            importFailure(printer, violations, csvRecord);
            return;
          }
        }
      }

      if (processRecord) {
        patchColumns(originalEntity, printer, csvRecords, table);
      }
    }

    private void patchColumns(
        Table originalTable, CSVPrinter resultsPrinter, List<CSVRecord> records, Table entity)
        throws IOException {
      EntityRepository<Table> repository =
          (EntityRepository<Table>) Entity.getEntityRepository(TABLE);
      if (Boolean.FALSE.equals(importResult.getDryRun())) { // If not dry run, create the entity
        try {
          JsonPatch jsonPatch = JsonUtils.getJsonPatch(originalTable, table);
          repository.patch(null, table.getId(), importedBy, jsonPatch);
        } catch (Exception ex) {
          for (int i = 1; i < records.size(); i++) {
            importFailure(resultsPrinter, ex.getMessage(), records.get(i));
            importResult.setStatus(ApiStatus.FAILURE);
          }
          return;
        }
      } else { // Dry run don't create the entity
        repository.setFullyQualifiedName(entity);
        repository.findByNameOrNull(entity.getFullyQualifiedName(), Include.NON_DELETED);
        // Track the dryRun created entities, as they may be referred by other entities being
        // created
        // during import
        dryRunCreatedEntities.put(entity.getFullyQualifiedName(), entity);
      }

      for (int i = 1; i < records.size(); i++) {
        importSuccess(resultsPrinter, records.get(i), ENTITY_UPDATED);
      }
    }

    public void updateColumnsFromCsv(CSVPrinter printer, CSVRecord csvRecord) throws IOException {
      String columnFqn = csvRecord.get(0);
      Column column = findColumn(table.getColumns(), columnFqn);
      boolean columnExists = column != null;
      if (!columnExists) {
        // Create Column, if not found
        column =
            new Column()
                .withName(getLocalColumnName(table.getFullyQualifiedName(), columnFqn))
                .withFullyQualifiedName(
                    table.getFullyQualifiedName() + Entity.SEPARATOR + columnFqn);
      }
      column.withDisplayName(csvRecord.get(1));
      column.withDescription(csvRecord.get(2));
      column.withDataTypeDisplay(csvRecord.get(3));
      column.withDataType(
          nullOrEmpty(csvRecord.get(4)) ? null : ColumnDataType.fromValue(csvRecord.get(4)));
      column.withArrayDataType(
          nullOrEmpty(csvRecord.get(5)) ? null : ColumnDataType.fromValue(csvRecord.get(5)));
      column.withDataLength(
          nullOrEmpty(csvRecord.get(6)) ? null : Integer.parseInt(csvRecord.get(6)));
      List<TagLabel> tagLabels =
          getTagLabels(
              printer,
              csvRecord,
              List.of(
                  Pair.of(7, TagLabel.TagSource.CLASSIFICATION),
                  Pair.of(8, TagLabel.TagSource.GLOSSARY)));
      column.withTags(nullOrEmpty(tagLabels) ? null : tagLabels);
      column.withOrdinalPosition(
          nullOrDefault(
              column.getOrdinalPosition(),
              Long.valueOf((csvRecord.getRecordNumber() - 1)).intValue()));

      // If Column Does not Exist add it to the table
      if (!columnExists) {
        String[] splitColumnName = FullyQualifiedName.split(columnFqn);
        // Parent Column
        if (splitColumnName.length == 1) {
          List<Column> tableColumns =
              table.getColumns() == null ? new ArrayList<>() : table.getColumns();
          tableColumns.add(column);
          table.withColumns(tableColumns);
        } else {
          String parentColumnFqn =
              String.join(
                  Entity.SEPARATOR, Arrays.copyOf(splitColumnName, splitColumnName.length - 1));
          Column parentColumn = findColumn(table.getColumns(), parentColumnFqn);
          if (parentColumn == null) {
            importFailure(
                printer,
                "Parent Column not found. Check the order of the columns in the CSV file.",
                csvRecord);
          }

          // Update Name And Ordinal position in the parent column
          column.withName(splitColumnName[splitColumnName.length - 1]);
          column.withOrdinalPosition(
              nullOrEmpty(parentColumn.getChildren()) ? 0 : parentColumn.getChildren().size());
          // Add this column to children of Parent
          List<Column> children =
              nullOrEmpty(parentColumn.getChildren())
                  ? new ArrayList<>()
                  : parentColumn.getChildren();
          children.add(column);
          parentColumn.withChildren(children);
        }
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, Table entity) {
      // Headers: column.fullyQualifiedName, column.displayName, column.description,
      // column.dataTypeDisplay,column.dataType, column.arrayDataType, column.dataLength,
      // column.tags, column.glossaryTerms
      for (int i = 0; i < listOrEmpty(entity.getColumns()).size(); i++) {
        addRecord(csvFile, new ArrayList<>(), table.getColumns().get(i));
      }
    }

    private void addRecord(CsvFile csvFile, List<String> recordList, Column column) {
      addField(
          recordList,
          getLocalColumnName(table.getFullyQualifiedName(), column.getFullyQualifiedName()));
      addField(recordList, column.getDisplayName());
      addField(recordList, column.getDescription());
      addField(recordList, column.getDataTypeDisplay());
      addField(recordList, column.getDataType() == null ? null : column.getDataType().value());
      addField(
          recordList, column.getArrayDataType() == null ? null : column.getArrayDataType().value());
      addField(
          recordList,
          column.getDataLength() == null ? null : String.valueOf(column.getDataLength()));
      addTagLabels(recordList, column.getTags());
      addGlossaryTerms(recordList, column.getTags());
      addRecord(csvFile, recordList);
      listOrEmpty(column.getChildren()).forEach(c -> addRecord(csvFile, new ArrayList<>(), c));
    }

    private Column findColumn(List<Column> columns, String columnFqn) {
      for (Column c : listOrEmpty(columns)) {
        String tableFqn = table.getFullyQualifiedName();
        Column column =
            getLocalColumnName(tableFqn, c.getFullyQualifiedName()).equals(columnFqn)
                ? c
                : findColumn(c.getChildren(), columnFqn);

        if (column != null) {
          return column;
        }
      }
      return null;
    }
  }

  public ResultList<Column> getTableColumns(
      UUID tableId, int limit, int offset, String fieldsParam, Include include) {
    Table table = find(tableId, include);
    return getTableColumnsInternal(table, limit, offset, fieldsParam);
  }

  public ResultList<Column> getTableColumnsByFQN(
      String fqn, int limit, int offset, String fieldsParam, Include include) {
    Table table = findByName(fqn, include);
    return getTableColumnsInternal(table, limit, offset, fieldsParam);
  }

  private org.openmetadata.service.util.ResultList<Column> getTableColumnsInternal(
      Table table, int limit, int offset, String fieldsParam) {
    // For paginated column access, we need to load the table with columns
    // but we'll optimize the field loading to only process what we need
    Table fullTable = get(null, table.getId(), getFields(Set.of(COLUMN_FIELD)), NON_DELETED, false);

    List<Column> allColumns = fullTable.getColumns();
    if (allColumns == null || allColumns.isEmpty()) {
      return new ResultList<>(new ArrayList<>(), "0", String.valueOf(offset + limit), 0);
    }

    // Apply pagination
    int total = allColumns.size();
    int fromIndex = Math.min(offset, total);
    int toIndex = Math.min(offset + limit, total);

    List<Column> paginatedColumns = allColumns.subList(fromIndex, toIndex);

    // Apply field processing if needed
    if (fieldsParam != null && fieldsParam.contains("tags")) {
      populateEntityFieldTags(entityType, paginatedColumns, table.getFullyQualifiedName(), true);
    }

    if (fieldsParam != null && fieldsParam.contains("customMetrics")) {
      for (Column column : paginatedColumns) {
        column.setCustomMetrics(getCustomMetrics(table, column.getName()));
      }
    }

    if (fieldsParam != null && fieldsParam.contains("profile")) {
      setColumnProfile(paginatedColumns);
      populateEntityFieldTags(entityType, paginatedColumns, table.getFullyQualifiedName(), true);
      paginatedColumns = PIIMasker.getTableProfile(paginatedColumns);
    }

    // Calculate pagination metadata
    String before = offset > 0 ? String.valueOf(Math.max(0, offset - limit)) : null;
    String after = toIndex < total ? String.valueOf(toIndex) : null;

    return new ResultList<>(paginatedColumns, before, after, total);
  }

  private static void validateTableColumns(List<Column> columns) {
    if (columns == null) return;

    for (Column column : columns) {
      if (column.getDataType() == ColumnDataType.VARCHAR) {
        if (column.getDataLength() == null || column.getDataLength() <= 0) {
          throw new IllegalArgumentException(
              "Data length is mandatory for VARCHAR columns: " + column.getName());
        }
      }
      if (column.getChildren() != null) {
        validateTableColumns(column.getChildren());
      }
    }
  }

  private Map<UUID, TableProfilerConfig> batchFetchTableProfilerConfigs(List<Table> tables) {
    Map<UUID, TableProfilerConfig> configMap = new HashMap<>();
    if (tables == null || tables.isEmpty()) {
      return configMap;
    }

    List<CollectionDAO.ExtensionRecordWithId> records =
        daoCollection
            .entityExtensionDAO()
            .getExtensionsBatch(entityListToStrings(tables), TABLE_PROFILER_CONFIG_EXTENSION);

    for (CollectionDAO.ExtensionRecordWithId record : records) {
      try {
        TableProfilerConfig config =
            JsonUtils.readValue(record.extensionJson(), TableProfilerConfig.class);
        configMap.put(record.id(), config);
      } catch (Exception e) {
        configMap.put(record.id(), null);
      }
    }

    for (Table table : tables) {
      if (!configMap.containsKey(table.getId())) {
        configMap.put(table.getId(), null);
      }
    }

    return configMap;
  }

  private Map<UUID, EntityReference> batchFetchTestSuites(List<Table> tables) {
    Map<UUID, EntityReference> testSuiteMap = new HashMap<>();
    if (tables == null || tables.isEmpty()) {
      return testSuiteMap;
    }

    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findToBatch(entityListToStrings(tables), Relationship.CONTAINS.ordinal(), TEST_SUITE);

    for (CollectionDAO.EntityRelationshipObject relRecord : records) {
      UUID tableId = UUID.fromString(relRecord.getFromId());
      EntityReference testSuiteRef =
          getEntityReferenceById(TEST_SUITE, UUID.fromString(relRecord.getToId()), NON_DELETED);
      testSuiteMap.put(tableId, testSuiteRef);
    }

    return testSuiteMap;
  }

  private Map<UUID, List<String>> batchFetchQueries(List<Table> tables) {
    Map<UUID, List<String>> queriesMap = new HashMap<>();
    if (tables == null || tables.isEmpty()) {
      return queriesMap;
    }

    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findToBatch(entityListToStrings(tables), Relationship.MENTIONED_IN.ordinal(), QUERY);

    Map<UUID, List<EntityReference>> queryRefsMap = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject relRecord : records) {
      UUID tableId = UUID.fromString(relRecord.getFromId());
      EntityReference queryRef =
          getEntityReferenceById(QUERY, UUID.fromString(relRecord.getToId()), NON_DELETED);
      queryRefsMap.computeIfAbsent(tableId, k -> new ArrayList<>()).add(queryRef);
    }

    for (UUID tableId : queryRefsMap.keySet()) {
      List<Query> queriesEntity = getEntities(queryRefsMap.get(tableId), "id", ALL);
      List<String> queries = queriesEntity.stream().map(Query::getQuery).toList();
      queriesMap.put(tableId, queries);
    }

    for (Table table : tables) {
      if (!queriesMap.containsKey(table.getId())) {
        queriesMap.put(table.getId(), List.of());
      }
    }

    return queriesMap;
  }

  private Map<UUID, TableJoins> batchFetchJoins(List<Table> tables) {
    Map<UUID, TableJoins> joinsMap = new HashMap<>();
    if (tables == null || tables.isEmpty()) {
      return joinsMap;
    }

    for (Table table : tables) {
      joinsMap.put(table.getId(), getJoins(table));
    }

    return joinsMap;
  }

  private Map<UUID, List<CustomMetric>> batchFetchCustomMetrics(
      List<Table> tables, boolean includeColumnFields) {
    Map<UUID, List<CustomMetric>> customMetricsMap = new HashMap<>();
    if (tables == null || tables.isEmpty()) {
      return customMetricsMap;
    }

    for (Table table : tables) {
      List<CustomMetric> tableMetrics = getCustomMetrics(table, null);
      if (includeColumnFields && table.getColumns() != null) {
        for (Column column : table.getColumns()) {
          column.setCustomMetrics(getCustomMetrics(table, column.getName()));
        }
      }
      customMetricsMap.put(table.getId(), tableMetrics);
    }

    return customMetricsMap;
  }

  public ResultList<Column> searchTableColumnsById(
      UUID id, String query, int limit, int offset, String fieldsParam, Include include) {
    Table table = get(null, id, getFields(fieldsParam), include, false);
    return searchTableColumnsInternal(table, query, limit, offset, fieldsParam);
  }

  public ResultList<Column> searchTableColumnsByFQN(
      String fqn, String query, int limit, int offset, String fieldsParam, Include include) {
    Table table = getByName(null, fqn, getFields(fieldsParam), include, false);
    return searchTableColumnsInternal(table, query, limit, offset, fieldsParam);
  }

  private ResultList<Column> searchTableColumnsInternal(
      Table table, String query, int limit, int offset, String fieldsParam) {
    List<Column> allColumns = table.getColumns();
    if (allColumns == null || allColumns.isEmpty()) {
      return new ResultList<>(List.of(), null, null, 0);
    }

    // Flatten nested columns for search
    List<Column> flattenedColumns = flattenTableColumns(allColumns);

    List<Column> matchingColumns;
    if (query == null || query.trim().isEmpty()) {
      matchingColumns = flattenedColumns;
    } else {
      String searchTerm = query.toLowerCase().trim();
      matchingColumns =
          flattenedColumns.stream()
              .filter(
                  column -> {
                    if (column.getName() != null
                        && column.getName().toLowerCase().contains(searchTerm)) {
                      return true;
                    }
                    return column.getDisplayName() != null
                        && column.getDisplayName().toLowerCase().contains(searchTerm);
                  })
              .toList();
    }

    int total = matchingColumns.size();
    int startIndex = Math.min(offset, total);
    int endIndex = Math.min(offset + limit, total);

    List<Column> paginatedResults =
        startIndex < total ? matchingColumns.subList(startIndex, endIndex) : List.of();

    Fields fields = getFields(fieldsParam);
    if (fields.contains("customMetrics") || fields.contains("*")) {
      for (Column column : paginatedResults) {
        column.setCustomMetrics(getCustomMetrics(table, column.getName()));
      }
    }

    if (fieldsParam != null && fieldsParam.contains("profile")) {
      setColumnProfile(matchingColumns);
      populateEntityFieldTags(entityType, matchingColumns, table.getFullyQualifiedName(), true);
      matchingColumns = PIIMasker.getTableProfile(matchingColumns);
    }

    String before = offset > 0 ? String.valueOf(Math.max(0, offset - limit)) : null;
    String after = endIndex < total ? String.valueOf(endIndex) : null;
    return new ResultList<>(paginatedResults, before, after, total);
  }

  private List<Column> flattenTableColumns(List<Column> columns) {
    List<Column> flattened = new ArrayList<>();
    for (Column column : columns) {
      flattened.add(column);
      if (column.getChildren() != null && !column.getChildren().isEmpty()) {
        flattened.addAll(flattenTableColumns(column.getChildren()));
      }
    }
    return flattened;
  }
}
