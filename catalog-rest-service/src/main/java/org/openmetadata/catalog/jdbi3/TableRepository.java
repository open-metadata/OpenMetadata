/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.jdbi3;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.openmetadata.catalog.type.ColumnJoin;
import org.openmetadata.catalog.type.JoinedWith;
import org.openmetadata.catalog.type.TableData;
import org.openmetadata.catalog.type.TableJoins;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.DatabaseRepository.DatabaseDAO;
import org.openmetadata.catalog.jdbi3.TagRepository.TagDAO;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.UsageRepository.UsageDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.resources.databases.TableResource;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.DailyCount;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.EventUtils;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.common.utils.CipherText;
import org.openmetadata.common.utils.CommonUtil;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.ListIterator;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.jdbi3.Relationship.JOINED_WITH;

public abstract class TableRepository {
  private static final Logger LOG = LoggerFactory.getLogger(TableRepository.class);
  // Table that can be patched in a patch request

  private static final Fields TABLE_PATCH_FIELDS = new Fields(TableResource.FIELD_LIST,
          "owner,columns,database,tags,tableConstraints");
  private static final Fields TABLE_UPDATE_FIELDS = new Fields(TableResource.FIELD_LIST,
          "owner,columns,database,tags, tableConstraints");

  @CreateSqlObject
  abstract DatabaseDAO databaseDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract FieldRelationshipDAO fieldRelationshipDAO();

  @CreateSqlObject
  abstract EntityExtensionDAO entityExtensionDAO();

  @CreateSqlObject
  abstract TableDAO tableDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract UsageDAO usageDAO();

  @CreateSqlObject
  abstract TagDAO tagDAO();

 @Transaction
  public List<Table> listAfter(Fields fields, String databaseFQN, int limitParam, String after) throws IOException,
          ParseException, GeneralSecurityException {
    // Forward scrolling, either because after != null or first page is being asked
    List<String> jsons = tableDAO().listAfter(databaseFQN, limitParam, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<Table> tables = new ArrayList<>();
    for (String json : jsons) {
      tables.add(setFields(JsonUtils.readValue(json, Table.class), fields));
    }
    return tables;
  }

  @Transaction
  public List<Table> listBefore(Fields fields, String databaseFQN, int limitParam, String before) throws IOException,
          ParseException, GeneralSecurityException {
      // Reverse scrolling
    List<String> jsons = tableDAO().listBefore(databaseFQN, limitParam, CipherText.instance().decrypt(before));

    List<Table> tables = new ArrayList<>();
    for (String json : jsons) {
      tables.add(setFields(JsonUtils.readValue(json, Table.class), fields));
    }
    return tables;
  }

  @Transaction
  public Table get(String id, Fields fields) throws IOException, ParseException {
    return setFields(validateTable(id), fields);
  }

  @Transaction
  public Table getByName(String fqn, Fields fields) throws IOException, ParseException {
    Table table =  EntityUtil.validate(fqn, tableDAO().findByFQN(fqn), Table.class);
    return setFields(table, fields);
  }

  @Transaction
  public Table create(Table table, EntityReference owner, UUID databaseId) throws IOException {
    return createInternal(databaseId, table, owner);
  }

  @Transaction
  public Table patch(String id, JsonPatch patch) throws IOException, ParseException {
    Table original = setFields(validateTable(id), TABLE_PATCH_FIELDS);
    Table updated = JsonUtils.applyPatch(original, patch, Table.class);
    patch(original, updated);
    return updated;
  }

  @Transaction
  public void delete(String id) {
    if (tableDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.TABLE, id));
    }
    // Remove all relationships
    relationshipDAO().deleteAll(id);
  }

  @Transaction
  public PutResponse<Table> createOrUpdate(Table updatedTable, EntityReference newOwner, UUID databaseId) throws
          IOException, ParseException {
    Database database = EntityUtil.validate(databaseId.toString(), databaseDAO().findById(databaseId.toString()),
            Database.class);
    String tableFQName = database.getFullyQualifiedName() + "." + updatedTable.getName();
    Table storedTable = JsonUtils.readValue(tableDAO().findByFQN(tableFQName), Table.class);
    if (storedTable == null) {
      return new PutResponse<>(Status.CREATED, createInternal(database.getId(), updatedTable, newOwner));
    }
    updatedTable.setId(storedTable.getId());
    validateRelationships(updatedTable, database, newOwner);

    // Carry forward non empty description
    if (storedTable.getDescription() != null && !storedTable.getDescription().isEmpty()) {
      // Update description only when it is empty
      updatedTable.setDescription(storedTable.getDescription());
    }
    // Remove previous table tags. Merge table tags from the update and the existing tags.
    EntityUtil.removeTagsByPrefix(tagDAO(), storedTable.getFullyQualifiedName());
    updatedTable.setTags(EntityUtil.mergeTags(updatedTable.getTags(), storedTable.getTags()));

    updateColumns(storedTable, updatedTable);
    storeTable(updatedTable, true);

    updateRelationships(storedTable, updatedTable);
    setFields(storedTable, TABLE_UPDATE_FIELDS);

//    if (updated) {
//      // TODO clean this up
//      EventUtils.publishEntityUpdatedEvent(Table.class.getName(),
//              tableUpdated.getFullyQualifiedName(),
//              JsonUtils.pojoToJson(tableStored),
//              JsonUtils.pojoToJson(tableUpdated));
//    }
    return new PutResponse<>(Status.OK, updatedTable);
  }

  @Transaction
  public Status addFollower(String tableId, String userId) throws IOException {
    EntityUtil.validate(tableId, tableDAO().findById(tableId), Table.class);
    return EntityUtil.addFollower(relationshipDAO(), userDAO(), tableId, Entity.TABLE, userId, Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void addJoins(String tableId, TableJoins joins) throws IOException, ParseException {
    // Validate the request content
    Table table = EntityUtil.validate(tableId, tableDAO().findById(tableId), Table.class);
    if (!CommonUtil.dateInRange(RestUtil.DATE_FORMAT, joins.getStartDate(), 0, 30)) {
      throw new IllegalArgumentException("Date range can only include past 30 days starting today");
    }

    // Validate joined columns
    for (ColumnJoin join : joins.getColumnJoins()) {
      validateColumn(table, join.getColumnName());
      validateColumnFQNs(join.getJoinedWith());
    }

    // With all validation done, add new joins
    for (ColumnJoin join : joins.getColumnJoins()) {
      String columnFQN = table.getFullyQualifiedName() + "." + join.getColumnName();
      addJoin(joins.getStartDate(), columnFQN, join.getJoinedWith());
    }
  }

  @Transaction
  public void addSampleData(String tableId, TableData tableData) throws IOException {
    // Validate the request content
    Table table = EntityUtil.validate(tableId, tableDAO().findById(tableId), Table.class);

    // Validate all the columns
    for (String columnName : tableData.getColumns()) {
      validateColumn(table, columnName);
    }
    // Make sure each row has number values for all the columns
    for (List<Object> row : tableData.getRows()) {
      if (row.size() != tableData.getColumns().size()) {
        throw new IllegalArgumentException(String.format("Number of columns is %d but row has %d sample values",
                tableData.getColumns().size(), row.size()));
      }
    }

    entityExtensionDAO().insert(tableId, "table.sampleData", "tableData",
            JsonUtils.pojoToJson(tableData));
  }

  @Transaction
  public void deleteFollower(String tableId, String userId) {
    EntityUtil.validateUser(userDAO(), userId);
    EntityUtil.removeFollower(relationshipDAO(), tableId, userId);
  }

  @Transaction
  public EntityReference getOwnerReference(Table table) throws IOException {
    return EntityUtil.populateOwner(userDAO(), teamDAO(), table.getOwner());
  }


  // No @Transaction variation method to avoid nested transaction
  private Table createInternal(UUID databaseId, Table table, EntityReference owner) throws IOException {
    LOG.info("Creating table {} {}", table.getFullyQualifiedName(), table.getId());
    validateRelationships(table, databaseId, owner);
    storeTable(table, false);
    addRelationships(table);

    EventUtils.publishEntityCreatedEvent(Table.class.getName(), table.getFullyQualifiedName(),
            JsonUtils.pojoToJson(table));
    return table;
  }

  private void validateRelationships(Table table, UUID databaseId, EntityReference owner) throws IOException {
    // Validate database
    Database db = EntityUtil.validate(databaseId.toString(), databaseDAO().findById(databaseId.toString()),
            Database.class);
    // Validate and set other relationships
    validateRelationships(table, db, owner);
  }

  private void validateRelationships(Table table, Database database, EntityReference owner) throws IOException {
    // Set data in table entity based on database relationship
    table.setDatabase(EntityUtil.getEntityReference(database));
    table.setFullyQualifiedName(database.getFullyQualifiedName() + "." + table.getName());
    for (Column c : table.getColumns()) {
      c.setFullyQualifiedName(table.getFullyQualifiedName() + "." + c.getName());
    }

    // Check if owner is valid and set the relationship
    table.setOwner(EntityUtil.populateOwner(userDAO(), teamDAO(), owner));

    // Check table tags
    EntityUtil.validateTags(tagDAO(), table.getTags());

    // Check column tags
    table.getColumns().forEach(column -> EntityUtil.validateTags(tagDAO(), column.getTags()));
  }

  private void storeTable(Table table, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = table.getOwner();
    EntityReference database = table.getDatabase();
    List<TagLabel> tags = table.getTags();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    table.withOwner(null).withDatabase(null).withHref(null).withTags(null);

    // Don't store column tags as JSON but build it on the fly based on relationships
    Map<String, List<TagLabel>> columnTags = table.getColumns().stream()
            .filter(c -> c.getTags() != null).collect(Collectors.toMap(Column::getName, Column::getTags, (a, b) -> b));
    table.getColumns().forEach(column -> column.setTags(null));

    if (update) {
      tableDAO().update(table.getId().toString(), JsonUtils.pojoToJson(table));
    } else {
      tableDAO().insert(JsonUtils.pojoToJson(table));
    }

    // Restore the relatinships
    table.withOwner(owner).withDatabase(database).withTags(tags);
    table.getColumns().forEach(c -> c.withTags(columnTags.get(c.getName())));
  }

  private void addRelationships(Table table) throws IOException {
    // Add relationship from database to table
    String databaseId = table.getDatabase().getId().toString();
    relationshipDAO().insert(databaseId, table.getId().toString(), Entity.DATABASE, Entity.TABLE,
            Relationship.CONTAINS.ordinal());

    // Add owner relationship
    EntityUtil.setOwner(relationshipDAO(), table.getId(), Entity.TABLE, table.getOwner());

    // Add tag to table relationship
    applyTags(table);
  }

  private void updateRelationships(Table origTable, Table updatedTable) throws IOException {
    // Add owner relationship
    origTable.setOwner(getOwner(origTable));
    EntityUtil.updateOwner(relationshipDAO(), origTable.getOwner(), updatedTable.getOwner(), origTable.getId(),
            Entity.TABLE);
    applyTags(updatedTable);
  }

  private void applyTags(Table table) throws IOException {
    // Add table level tags by adding tag to table relationship
    EntityUtil.applyTags(tagDAO(), table.getTags(), table.getFullyQualifiedName());
    table.setTags(getTags(table.getFullyQualifiedName())); // Update tag to handle additional derived tags

    // Add column level tags by adding tag to column relationship
    for (Column column : table.getColumns()) {
      EntityUtil.applyTags(tagDAO(), column.getTags(), column.getFullyQualifiedName());
      column.setTags(getTags(column.getFullyQualifiedName())); // Update tag list to handle derived tags
    }
  }

  /**
   * Update the backend database
   */
  private void patch(Table original, Table updated) throws IOException {
    // TODO Patching field usageSummary is ignored
    if (!original.getId().equals(updated.getId())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.TABLE, "id"));
    }
    if (!original.getName().equals(updated.getName())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.TABLE, "name"));
    }
    if (updated.getDatabase() == null) {
      throw new IllegalArgumentException("Table relationship database can't be removed");
    }
    if (!updated.getDatabase().getId().equals(original.getDatabase().getId())) {
      throw new IllegalArgumentException("Table relationship database can't be replaced");
    }
    validateRelationships(updated, updated.getDatabase().getId(), updated.getOwner());

    // Remove previous tags. Merge tags from the update and the existing tags
    EntityUtil.removeTags(tagDAO(), original.getFullyQualifiedName());
    updated.setTags(EntityUtil.mergeTags(updated.getTags(), original.getTags()));

    storeTable(updated, true);
    updateRelationships(original, updated);
  }

  private Database getDatabase(Table table) throws IOException {
    // Find database for the table
    String id = table.getId().toString();
    List<String> result = relationshipDAO().findFrom(id, Relationship.CONTAINS.ordinal(), Entity.DATABASE);
    if (result.size() != 1) {
      throw EntityNotFoundException.byMessage(String.format("Database for table %s Not found", id));
    }
    String databaseId = result.get(0);
    return EntityUtil.validate(databaseId, databaseDAO().findById(databaseId), Database.class);
  }

  private Table validateTable(String tableId) throws IOException {
    return EntityUtil.validate(tableId, tableDAO().findById(tableId), Table.class);
  }

  private Table setFields(Table table, Fields fields) throws IOException, ParseException {
    table.setColumns(fields.contains("columns") ? table.getColumns() : null);
    table.setTableConstraints(fields.contains("tableConstraints") ? table.getTableConstraints() : null);
    table.setOwner(fields.contains("owner") ? getOwner(table) : null);
    table.setFollowers(fields.contains("followers") ? getFollowers(table) : null);
    table.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(usageDAO(), table.getId()) :
            null);
    table.setDatabase(fields.contains("database") ? EntityUtil.getEntityReference(getDatabase(table)) : null);
    table.setTags(fields.contains("tags") ? getTags(table.getFullyQualifiedName()) : null);
    getColumnTags(fields.contains("tags"), table);
    table.setJoins(fields.contains("joins") ? getJoins(table) : null);
    table.setSampleData(fields.contains("sampleData") ? getSampleData(table) : null);
    return table;
  }

  private EntityReference getOwner(Table table) throws IOException {
    return table == null ? null : EntityUtil.populateOwner(table.getId(), relationshipDAO(), userDAO(), teamDAO());
  }

  private List<EntityReference> getFollowers(Table table) throws IOException {
    return table == null ? null : EntityUtil.getFollowers(table.getId(), relationshipDAO(), userDAO());
  }

  private void updateColumns(Table storedTable, Table updatedTable) {
    List<Column> storedColumns = storedTable.getColumns();
    List<Column> updatedColumns = updatedTable.getColumns();
    // Carry forward the user generated metadata from existing columns to new columns
    for (Column updated : updatedColumns) {
      // Find stored column matching name, data type and ordinal position
      Column stored = storedColumns.stream()
              .filter(s -> s.getName().equals(updated.getName()) &&
                      s.getColumnDataType() == updated.getColumnDataType() &&
                      Objects.equals(s.getOrdinalPosition(), updated.getOrdinalPosition()))
              .findAny()
              .orElse(null);
      if (stored == null) {
        // TODO versioning of schema
        // TODO identify column that was deleted
        LOG.info("Table {} has new column {}", storedTable.getFullyQualifiedName(), updated.getName());
        continue;
      }

      // Carry forward user generated metadata to the columns from the update
      if (stored.getDescription() != null && !stored.getDescription().isEmpty()) {
        updated.setDescription(stored.getDescription()); // Carry forward non-empty description
      }
      // Combine all the tags (duplicates will be deduped)
      updated.setTags(EntityUtil.mergeTags(updated.getTags(), stored.getTags()));
    }
    storedTable.setColumns(updatedColumns);
  }

  private List<TagLabel> getTags(String fqn) {
    return tagDAO().getTags(fqn);
  }

  private void getColumnTags(boolean setTags, Table table) {
    for (Column c : Optional.ofNullable(table.getColumns()).orElse(Collections.emptyList())) {
      c.setTags(setTags ? getTags(c.getFullyQualifiedName()) : null);
    }
  }

  // Validate if a given column exists in the table
  private void validateColumn(Table table, String columnName) {
    boolean validColumn = false;
    for (Column column : table.getColumns()) {
      if (column.getName().equals(columnName)) {
        validColumn = true;
        break;
      }
    }
    if (!validColumn) {
      throw new IllegalArgumentException("Invalid column name " + columnName);
    }
  }

  // Validate if a given column exists in the table
  private void validateColumnFQN(Table table, String columnFQN) {
    boolean validColumn = false;
    for (Column column : table.getColumns()) {
      if (column.getFullyQualifiedName().equals(columnFQN)) {
        validColumn = true;
        break;
      }
    }
    if (!validColumn) {
      throw new IllegalArgumentException(CatalogExceptionMessage.invalidColumnFQN(columnFQN));
    }
  }

  private void validateColumnFQNs(List<JoinedWith> joinedWithList) throws IOException {
    for (JoinedWith joinedWith : joinedWithList) {
      // Validate table
      String tableFQN = getTableFQN(joinedWith.getFullyQualifiedName());
      Table joinedWithTable = EntityUtil.validate(tableFQN, tableDAO().findByFQN(tableFQN), Table.class);

      // Validate column
      validateColumnFQN(joinedWithTable, joinedWith.getFullyQualifiedName());
    }
  }

  private String getTableFQN(String columnFQN) {
    // Split columnFQN of format databaseServiceName.databaseName.tableName.columnName
    String[] split = columnFQN.split("\\.");
    if (split.length != 4) {
      throw new IllegalArgumentException("Invalid fully qualified column name " + columnFQN);
    }
    // Return table FQN of format databaseService.tableName
    return split[0] + "." + split[1] + "." + split[2];
  }

  private void addJoin(String date, String columnFQN, List<JoinedWith> joinedWithList) throws IOException,
          ParseException {
    for (JoinedWith joinedWith : joinedWithList) {
      // Use the column that comes alphabetically first as the from field and the other as to field.
      // This helps us keep the bidirectional relationship to a single row instead one row for
      // capturing relationship in each direction.
      //
      // One row like this     - fromColumn <--- joinedWith --> toColumn
      // Instead of additional - toColumn <--- joinedWith --> fromColumn
      String fromColumnFQN;
      String toColumnFQN;
      if (columnFQN.compareTo(joinedWith.getFullyQualifiedName()) < 0) {
        fromColumnFQN = columnFQN;
        toColumnFQN = joinedWith.getFullyQualifiedName();
      } else {
        fromColumnFQN = joinedWith.getFullyQualifiedName();
        toColumnFQN = columnFQN;
      }
      String json = fieldRelationshipDAO().find(fromColumnFQN, toColumnFQN, "table.columns.column",
              "table.columns.column", JOINED_WITH.ordinal());

      DailyCount dailyCount = new DailyCount().withCount(joinedWith.getJoinCount()).withDate(date);
      if (json == null) { // Create first entry
        List<DailyCount> dailyCountList = Collections.singletonList(dailyCount);
        json = JsonUtils.pojoToJson(dailyCountList);
      } else { // Update the existing entry
        List<DailyCount> dailyCountList = JsonUtils.readObjects(json, DailyCount.class);
        boolean foundDate = false;
        for (DailyCount d : dailyCountList) { // If the date already exists, update the count. Otherwise add a new entry
          if (d.getDate().equals(dailyCount.getDate())) {
            // Entry for date already exists. Update the count
            d.setCount(dailyCount.getCount());
            foundDate = true;
            break;
          }
        }
        if (!foundDate) {
          dailyCountList.add(dailyCount);
        }

        // Sort the dailyCount list by date
        dailyCountList.sort((d1, d2) -> {
          try {
            return RestUtil.compareDates(d1.getDate(), d2.getDate());
          } catch (ParseException ignored) {
            // This should never happen
          }
          return 0;
        });

        ListIterator<DailyCount> iterator = dailyCountList.listIterator();
        while (iterator.hasNext()) {
          String reportedOnDate = iterator.next().getDate();
          if (!CommonUtil.dateInRange(RestUtil.DATE_FORMAT, reportedOnDate, 0, 30)) {
            iterator.remove();
            LOG.info("Removed join entry for column {} with column {} on older date {}", columnFQN,
                    joinedWith.getFullyQualifiedName(), reportedOnDate);
          }
        }
        json = JsonUtils.pojoToJson(dailyCountList);
      }

      fieldRelationshipDAO().upsert(fromColumnFQN, toColumnFQN, "table.columns.column",
              "table.columns.column", JOINED_WITH.ordinal(), "dailyCount", json);
    }
  }

  private TableJoins getJoins(Table table) throws ParseException, IOException {
    String today = RestUtil.DATE_FORMAT.format(new Date()); // today
    String todayMinus30Days = CommonUtil.getDateStringByOffset(RestUtil.DATE_FORMAT, today, -30);
    TableJoins tableJoins = new TableJoins().withStartDate(todayMinus30Days).withDayCount(30)
            .withColumnJoins(Collections.emptyList());

    List<List<String>> list = fieldRelationshipDAO().listToByPrefix(table.getFullyQualifiedName(),
            "table.columns.column", "table.columns.column", JOINED_WITH.ordinal());
    list.addAll(fieldRelationshipDAO().listFromByPrefix(table.getFullyQualifiedName(), "table.columns.column",
            "table.columns.column", JOINED_WITH.ordinal()));

    if (list.size() == 0) { // No join information found. Return empty list
      return tableJoins;
    }

    // Map of <ColumnName> to List of <Fully Qualified Column names> it is joined with
    Map<String, List<JoinedWith>> map = new HashMap<>();

    // list [ [fromFQN, toFQN, json], ...] contains inner list [fromFQN, toFQN, json]
    for (List<String> innerList : list) {
      String columnName = innerList.get(0).split("\\.")[3]; // Get from column name from FQN
      List<JoinedWith> columnJoinList = map.computeIfAbsent(columnName, k -> new ArrayList<>());

      // Parse JSON to get daily counts and aggregate it
      List<DailyCount> dailyCountList = JsonUtils.readObjects(innerList.get(2), DailyCount.class);
      int aggregatedCount = 0;
      for (DailyCount d : dailyCountList) {
        if (CommonUtil.dateInRange(RestUtil.DATE_FORMAT, d.getDate(), 0, 30)) {
          aggregatedCount += d.getCount();
        }
      }
      columnJoinList.add(new JoinedWith().withFullyQualifiedName(innerList.get(1)).withJoinCount(aggregatedCount));
    }

    List<ColumnJoin> columnJoins = new ArrayList<>();
    for (Entry<String, List<JoinedWith>> entry : map.entrySet()) {
      columnJoins.add(new ColumnJoin().withColumnName(entry.getKey()).withJoinedWith(entry.getValue()));
    }
    return tableJoins.withColumnJoins(columnJoins);
  }

  private TableData getSampleData(Table table) throws IOException {
    return JsonUtils.readValue(entityExtensionDAO().getExtension(table.getId().toString(), "table.sampleData"),
            TableData.class);
  }

  public interface TableDAO {
    @SqlUpdate("INSERT INTO table_entity (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE table_entity SET  json = :json WHERE id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM table_entity WHERE id = :tableId")
    String findById(@Bind("tableId") String tableId);

    @SqlQuery("SELECT json FROM table_entity WHERE fullyQualifiedName = :tableFQN")
    String findByFQN(@Bind("tableFQN") String tableFQN);

    @SqlQuery(
            "SELECT json FROM (" +
              "SELECT fullyQualifiedName, json FROM table_entity WHERE " +
              "(fullyQualifiedName LIKE CONCAT(:databaseFQN, '.%') OR :databaseFQN IS NULL) AND " +
              "fullyQualifiedName < :before " + // Pagination by table fullyQualifiedName
              "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by table fullyQualifiedName
              "LIMIT :limit" +
            ") last_rows_subquery ORDER BY fullyQualifiedName")
    List<String> listBefore(@Bind("databaseFQN") String databseFQN, @Bind("limit") int limit,
                           @Bind("before") String before);

    @SqlQuery("SELECT json FROM table_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:databaseFQN, '.%') OR :databaseFQN IS NULL) AND "+//Filter by databaseName
            "fullyQualifiedName > :after " + // Pagination by table fullyQualifiedName
            "ORDER BY fullyQualifiedName " + // Pagination ordering by table fullyQualifiedName
            "LIMIT :limit")
    List<String> listAfter(@Bind("databaseFQN") String databseFQN, @Bind("limit") int limit,
                           @Bind("after") String after);

    @SqlQuery("SELECT EXISTS (SELECT * FROM table_entity WHERE id = :id)")
    boolean exists(@Bind("id") String id);

    @SqlUpdate("DELETE FROM table_entity WHERE id = :id")
    int delete(@Bind("id") String id);
  }
}
