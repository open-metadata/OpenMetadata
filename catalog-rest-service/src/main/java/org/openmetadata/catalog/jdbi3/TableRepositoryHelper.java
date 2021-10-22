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
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.databases.TableResource;
import org.openmetadata.catalog.resources.databases.TableResource.TableList;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.ColumnJoin;
import org.openmetadata.catalog.type.ColumnProfile;
import org.openmetadata.catalog.type.DailyCount;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.JoinedWith;
import org.openmetadata.catalog.type.TableConstraint;
import org.openmetadata.catalog.type.TableData;
import org.openmetadata.catalog.type.TableJoins;
import org.openmetadata.catalog.type.TableProfile;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater3;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.EventUtils;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.common.utils.CommonUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.ListIterator;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import static org.openmetadata.catalog.jdbi3.Relationship.JOINED_WITH;
import static org.openmetadata.common.utils.CommonUtil.parseDate;

public class TableRepositoryHelper implements EntityRepository<Table> {
  static final Logger LOG = LoggerFactory.getLogger(TableRepositoryHelper.class);
  // Table fields that can be patched in a PATCH request
  static final Fields TABLE_PATCH_FIELDS = new Fields(TableResource.FIELD_LIST,
          "owner,columns,database,tags,tableConstraints");
  // Table fields that can be updated in a PUT request
  static final Fields TABLE_UPDATE_FIELDS = new Fields(TableResource.FIELD_LIST,
          "owner,columns,database,tags,tableConstraints");

  public TableRepositoryHelper(TableRepository3 repo3) { this.repo3 = repo3; }

  private final TableRepository3 repo3;

  @Override
  public List<String> listAfter(String fqnPrefix, int limitParam, String after) {
    return repo3.tableDAO().listAfter(fqnPrefix, limitParam, after);
  }

  @Override
  public List<String> listBefore(String fqnPrefix, int limitParam, String after) {
    return repo3.tableDAO().listBefore(fqnPrefix, limitParam, after);
  }

  @Override
  public int listCount(String fqnPrefix) {
    return repo3.tableDAO().listCount(fqnPrefix);
  }

  @Override
  public String getFullyQualifiedName(Table entity) {
    return entity.getFullyQualifiedName();
  }

  @Override
  public Table setFields(Table table, Fields fields) throws IOException, ParseException {
    table.setColumns(fields.contains("columns") ? table.getColumns() : null);
    table.setTableConstraints(fields.contains("tableConstraints") ? table.getTableConstraints() : null);
    table.setOwner(fields.contains("owner") ? getOwner(table) : null);
    table.setFollowers(fields.contains("followers") ? getFollowers(table) : null);
    table.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(repo3.usageDAO(), table.getId()) :
            null);
    table.setDatabase(fields.contains("database") ? EntityUtil.getEntityReference(getDatabase(table)) : null);
    table.setTags(fields.contains("tags") ? getTags(table.getFullyQualifiedName()) : null);
    getColumnTags(fields.contains("tags"), table.getColumns());
    table.setJoins(fields.contains("joins") ? getJoins(table) : null);
    table.setSampleData(fields.contains("sampleData") ? getSampleData(table) : null);
    table.setViewDefinition(fields.contains("viewDefinition") ? table.getViewDefinition() : null);
    table.setTableProfile(fields.contains("tableProfile") ? getTableProfile(table) : null);
    return table;
  }

  @Override
  public ResultList<Table> getResultList(List<Table> entities, String beforeCursor, String afterCursor, int total)
          throws GeneralSecurityException, UnsupportedEncodingException {
    return new TableList(entities, beforeCursor, afterCursor, total);
  }

  public static String getFQN(Table table) {
    return (table.getDatabase().getName() + "." + table.getName());
  }

  @Transaction
  public ResultList<Table> listAfter(Fields fields, String databaseFQN, int limitParam, String after)
          throws IOException, ParseException, GeneralSecurityException {
    return EntityUtil.listAfter(this, Table.class, fields, databaseFQN, limitParam, after);
  }

  @Transaction
  public ResultList<Table> listBefore(Fields fields, String databaseFQN, int limitParam, String before)
          throws IOException, ParseException, GeneralSecurityException {
    return EntityUtil.listBefore(this, Table.class, fields, databaseFQN, limitParam, before);
  }

  @Transaction
  public Table get(String id, Fields fields) throws IOException, ParseException {
    return setFields(repo3.tableDAO().findEntityById(id), fields);
  }

  @Transaction
  public Table getByName(String fqn, Fields fields) throws IOException, ParseException {
    return setFields(repo3.tableDAO().findEntityByName(fqn), fields);
  }

  @Transaction
  public Table create(Table table, UUID databaseId) throws IOException {
    validateRelationships(table, databaseId);
    return createInternal(table);
  }

  @Transaction
  public Table patch(String id, String user, JsonPatch patch) throws IOException, ParseException {
    Table original = setFields(repo3.tableDAO().findEntityById(id), TABLE_PATCH_FIELDS);
    Table updated = JsonUtils.applyPatch(original, patch, Table.class);
    updated.withUpdatedBy(user).withUpdatedAt(new Date());
    patch(original, updated);
    return updated;
  }

  @Transaction
  public void delete(String id) {
    repo3.tableDAO().delete(id);
    repo3.relationshipDAO().deleteAll(id); // Remove all relationships
  }

  @Transaction
  public PutResponse<Table> createOrUpdate(Table updated, UUID databaseId) throws IOException, ParseException {
    validateRelationships(updated, databaseId);
    Table stored = JsonUtils.readValue(repo3.tableDAO().findJsonByFqn(updated.getFullyQualifiedName()),
            Table.class);
    if (stored == null) {
      return new PutResponse<>(Status.CREATED, createInternal(updated));
    }
    setFields(stored, TABLE_UPDATE_FIELDS);
    updated.setId(stored.getId());
    validateRelationships(updated);

    TableUpdater tableUpdater = new TableUpdater(stored, updated, false);
    tableUpdater.updateAll();
    tableUpdater.store();

//    if (updated) {
//      // TODO clean this up
//      EventUtils.publishEntityUpdatedEvent(Table.class.getName(),
//              tableUpdated.getFullyQualifiedName(),
//              JsonUtils.pojoToJson(tableStored),
//              JsonUtils.pojoToJson(tableUpdated));
//    }
    return new PutResponse<>(Status.OK, updated);
  }

  @Transaction
  public Status addFollower(String tableId, String userId) throws IOException {
    repo3.tableDAO().findEntityById(tableId);
    return EntityUtil.addFollower(repo3.relationshipDAO(), repo3.userDAO(), tableId, Entity.TABLE, userId,
            Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void addJoins(String tableId, TableJoins joins) throws IOException, ParseException {
    // Validate the request content
    Table table = repo3.tableDAO().findEntityById(tableId);
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
    Table table = repo3.tableDAO().findEntityById(tableId);

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

    repo3.entityExtensionDAO().insert(tableId, "table.sampleData", "tableData",
            JsonUtils.pojoToJson(tableData));
  }

  @Transaction
  public void addTableProfileData(String tableId, TableProfile tableProfile) throws IOException {
    // Validate the request content
    Table table = repo3.tableDAO().findEntityById(tableId);

    List<TableProfile> storedTableProfiles = getTableProfile(table);
    Map<String, TableProfile> storedMapTableProfiles = new HashMap<>();
    if (storedTableProfiles != null) {
      for (TableProfile profile : storedTableProfiles) {
        storedMapTableProfiles.put(profile.getProfileDate(), profile);
      }
    }
    //validate all the columns
    for (ColumnProfile columnProfile : tableProfile.getColumnProfile()) {
      validateColumn(table, columnProfile.getName());
    }
    storedMapTableProfiles.put(tableProfile.getProfileDate(), tableProfile);
    List<TableProfile> updatedProfiles = new ArrayList<>(storedMapTableProfiles.values());

    repo3.entityExtensionDAO().insert(tableId, "table.tableProfile", "tableProfile",
            JsonUtils.pojoToJson(updatedProfiles));
  }

  @Transaction
  public void deleteFollower(String tableId, String userId) {
    EntityUtil.validateUser(repo3.userDAO(), userId);
    EntityUtil.removeFollower(repo3.relationshipDAO(), tableId, userId);
  }

  @Transaction
  public EntityReference getOwnerReference(Table table) throws IOException {
    return EntityUtil.populateOwner(repo3.userDAO(), repo3.teamDAO(), table.getOwner());
  }


  // No @Transaction variation method to avoid nested transaction
  private Table createInternal(Table table) throws IOException {
    storeTable(table, false);
    addRelationships(table);

    EventUtils.publishEntityCreatedEvent(Table.class.getName(), table.getFullyQualifiedName(),
            JsonUtils.pojoToJson(table));
    return table;
  }

  private void validateRelationships(Table table, UUID databaseId) throws IOException {
    // Validate database
    Database db = repo3.databaseDAO().findEntityById(databaseId.toString());
    table.setDatabase(EntityUtil.getEntityReference(db));
    // Validate and set other relationships
    validateRelationships(table);
  }

  private void setColumnFQN(String parentFQN, List<Column> columns) {
    columns.forEach(c -> {
      String columnFqn = parentFQN + "." + c.getName();
      c.setFullyQualifiedName(columnFqn);
      if (c.getChildren() != null) {
        setColumnFQN(columnFqn, c.getChildren());
      }
    });
  }

  private void addDerivedTags(List<Column> columns) throws IOException {
    if (columns == null || columns.isEmpty()) {
      return;
    }

    for (Column column : columns) {
      column.setTags(EntityUtil.addDerivedTags(repo3.tagDAO(), column.getTags()));
      if (column.getChildren() != null) {
        addDerivedTags(column.getChildren());
      }
    }
  }

  private void validateRelationships(Table table) throws IOException {
    // Set data in table entity based on database relationship
    table.setFullyQualifiedName(getFQN(table));
    setColumnFQN(table.getFullyQualifiedName(), table.getColumns());

    // Check if owner is valid and set the relationship
    table.setOwner(EntityUtil.populateOwner(repo3.userDAO(), repo3.teamDAO(), table.getOwner()));

    // Validate table tags and add derived tags to the list
    table.setTags(EntityUtil.addDerivedTags(repo3.tagDAO(), table.getTags()));

    // Validate column tags
    addDerivedTags(table.getColumns());
  }

  private void storeTable(Table table, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = table.getOwner();
    EntityReference database = table.getDatabase();
    List<TagLabel> tags = table.getTags();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    table.withOwner(null).withDatabase(null).withHref(null).withTags(null);

    // Don't store column tags as JSON but build it on the fly based on relationships
    List<Column> columnWithTags = table.getColumns();
    table.setColumns(cloneWithoutTags(columnWithTags));
    table.getColumns().forEach(column -> column.setTags(null));

    if (update) {
      repo3.tableDAO().update(table.getId().toString(), JsonUtils.pojoToJson(table));
    } else {
      repo3.tableDAO().insert(JsonUtils.pojoToJson(table));
    }

    // Restore the relationships
    table.withOwner(owner).withDatabase(database).withTags(tags);
    table.setColumns(columnWithTags);
  }

  List<Column> cloneWithoutTags(List<Column> columns) {
    if (columns == null || columns.isEmpty()) {
      return columns;
    }
    List<Column> copy = new ArrayList<>();
    columns.forEach(c -> copy.add(cloneWithoutTags(c)));
    return copy;
  }

  private Column cloneWithoutTags(Column column) {
    List<Column> children = cloneWithoutTags(column.getChildren());
    return new Column().withDescription(column.getDescription()).withName(column.getName())
            .withFullyQualifiedName(column.getFullyQualifiedName())
            .withArrayDataType(column.getArrayDataType())
            .withConstraint(column.getConstraint())
            .withDataTypeDisplay(column.getDataTypeDisplay())
            .withDataType(column.getDataType())
            .withDataLength(column.getDataLength())
            .withOrdinalPosition(column.getOrdinalPosition())
            .withChildren(children);
  }

  private void addRelationships(Table table) throws IOException {
    // Add relationship from database to table
    String databaseId = table.getDatabase().getId().toString();
    repo3.relationshipDAO().insert(databaseId, table.getId().toString(), Entity.DATABASE, Entity.TABLE,
            Relationship.CONTAINS.ordinal());

    // Add table owner relationship
    EntityUtil.setOwner(repo3.relationshipDAO(), table.getId(), Entity.TABLE, table.getOwner());

    // Add tag to table relationship
    applyTags(table);
  }

  // TODO remove this
  private void applyTags(List<Column> columns) throws IOException {
    // Add column level tags by adding tag to column relationship
    for (Column column : columns) {
      EntityUtil.applyTags(repo3.tagDAO(), column.getTags(), column.getFullyQualifiedName());
      column.setTags(getTags(column.getFullyQualifiedName())); // Update tag list to handle derived tags
      if (column.getChildren() != null) {
        applyTags(column.getChildren());
      }
    }
  }

  private void applyTags(Table table) throws IOException {
    // Add table level tags by adding tag to table relationship
    EntityUtil.applyTags(repo3.tagDAO(), table.getTags(), table.getFullyQualifiedName());
    table.setTags(getTags(table.getFullyQualifiedName())); // Update tag to handle additional derived tags
    applyTags(table.getColumns());
  }

  /**
   * Update the backend database
   */
  private void patch(Table original, Table updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withDatabase(original.getDatabase()).withId(original.getId());

    // TODO checking database is unnecessary as it has not changed
    validateRelationships(updated, updated.getDatabase().getId());

    TableUpdater tableUpdater = new TableUpdater(original, updated, true);
    tableUpdater.updateAll();
    tableUpdater.store();
  }

  private Database getDatabase(Table table) throws IOException {
    // Find database for the table
    String id = table.getId().toString();
    List<String> result = repo3.relationshipDAO().findFrom(id, Relationship.CONTAINS.ordinal(), Entity.DATABASE);
    if (result.size() != 1) {
      throw EntityNotFoundException.byMessage(String.format("Database for table %s Not found", id));
    }
    String databaseId = result.get(0);
    return repo3.databaseDAO().findEntityById(databaseId);
  }

  private EntityReference getOwner(Table table) throws IOException {
    return table == null ? null : EntityUtil.populateOwner(table.getId(), repo3.relationshipDAO(), repo3.userDAO(),
            repo3.teamDAO());
  }

  private List<EntityReference> getFollowers(Table table) throws IOException {
    return table == null ? null : EntityUtil.getFollowers(table.getId(), repo3.relationshipDAO(), repo3.userDAO());
  }

  private List<TagLabel> getTags(String fqn) {
    return repo3.tagDAO().getTags(fqn);
  }

  private void getColumnTags(boolean setTags, List<Column> columns) {
    for (Column c : Optional.ofNullable(columns).orElse(Collections.emptyList())) {
      c.setTags(setTags ? getTags(c.getFullyQualifiedName()) : null);
      getColumnTags(setTags, c.getChildren());
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
      Table joinedWithTable = repo3.tableDAO().findEntityByName(tableFQN);

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
      String json = repo3.fieldRelationshipDAO().find(fromColumnFQN, toColumnFQN, "table.columns.column",
              "table.columns.column", JOINED_WITH.ordinal());

      DailyCount dailyCount = new DailyCount().withCount(joinedWith.getJoinCount()).withDate(date);
      List<DailyCount> dailyCountList;
      if (json == null) { // Create first entry
        dailyCountList = Collections.singletonList(dailyCount);
      } else { // Update the existing entry
        dailyCountList = JsonUtils.readObjects(json, DailyCount.class);
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
      }
      json = JsonUtils.pojoToJson(dailyCountList);

      repo3.fieldRelationshipDAO().upsert(fromColumnFQN, toColumnFQN, "table.columns.column",
              "table.columns.column", JOINED_WITH.ordinal(), "dailyCount", json);
    }
  }

  private TableJoins getJoins(Table table) throws ParseException, IOException {
    String today = RestUtil.DATE_FORMAT.format(new Date()); // today
    String todayMinus30Days = CommonUtil.getDateStringByOffset(RestUtil.DATE_FORMAT, today, -30);
    TableJoins tableJoins = new TableJoins().withStartDate(todayMinus30Days).withDayCount(30)
            .withColumnJoins(Collections.emptyList());

    List<List<String>> list = repo3.fieldRelationshipDAO().listToByPrefix(table.getFullyQualifiedName(),
            "table.columns.column", "table.columns.column", JOINED_WITH.ordinal());
    list.addAll(repo3.fieldRelationshipDAO().listFromByPrefix(table.getFullyQualifiedName(), "table.columns.column",
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
    return JsonUtils.readValue(repo3.entityExtensionDAO().getExtension(table.getId().toString(), "table.sampleData"),
            TableData.class);
  }

  private List<TableProfile> getTableProfile(Table table) throws IOException {
    List<TableProfile> tableProfiles =
            JsonUtils.readObjects(repo3.entityExtensionDAO().getExtension(table.getId().toString(),
            "table.tableProfile"),
            TableProfile.class);
    if (tableProfiles != null) {
      tableProfiles.sort(Comparator.comparing(p -> parseDate(p.getProfileDate(), RestUtil.DATE_FORMAT),
              Comparator.reverseOrder()));
    }
    return tableProfiles;
  }


  static class TableEntityInterface implements EntityInterface {
    private final Table table;

    TableEntityInterface(Table table) {
      this.table = table;
    }

    @Override
    public UUID getId() {
      return table.getId();
    }

    @Override
    public String getDescription() {
      return table.getDescription();
    }

    @Override
    public String getDisplayName() {
      return table.getDisplayName();
    }

    @Override
    public EntityReference getOwner() {
      return table.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return table.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return table.getTags();
    }

    @Override
    public void setDescription(String description) {
      table.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      table.setDisplayName(displayName);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      table.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class TableUpdater extends EntityUpdater3 {
    final Table orig;
    final Table updated;

    public TableUpdater(Table orig, Table updated, boolean patchOperation) {
      super(new TableEntityInterface(orig), new TableEntityInterface(updated), patchOperation, repo3.relationshipDAO(),
              repo3.tagDAO());
      this.orig = orig;
      this.updated = updated;
    }

    public void updateAll() throws IOException {
      super.updateAll();
      updateConstraints();
      updateColumns(orig.getColumns(), updated.getColumns());
    }

    private void updateColumns(List<Column> origColumns, List<Column> updatedColumns) throws IOException {
      // Carry forward the user generated metadata from existing columns to new columns
      for (Column updated : updatedColumns) {
        // Find stored column matching name, data type and ordinal position
        Column stored = origColumns.stream()
                .filter(s -> s.getName().equals(updated.getName()) &&
                        s.getDataType() == updated.getDataType() &&
                        s.getArrayDataType() == updated.getArrayDataType() &&
                        Objects.equals(s.getOrdinalPosition(), updated.getOrdinalPosition()))
                .findAny()
                .orElse(null);
        if (stored == null) {
          fieldsAdded.add("column:" + updated.getFullyQualifiedName());
          EntityUtil.applyTags(repo3.tagDAO(), updated.getTags(), updated.getFullyQualifiedName());
          continue;
        }

        updateColumnDescription(stored, updated);
        updateColumnTags(stored, updated);
        updateColumnConstraint(stored, updated);

        if (updated.getChildren() != null && stored.getChildren() != null) {
          updateColumns(stored.getChildren(), updated.getChildren());
        }
      }

      for (Column stored : origColumns) {
        // Find updated column matching name, data type and ordinal position
        Column updated = updatedColumns.stream()
                .filter(s -> s.getName().equals(stored.getName()) &&
                        s.getDataType() == stored.getDataType() &&
                        s.getArrayDataType() == stored.getArrayDataType() &&
                        Objects.equals(s.getOrdinalPosition(), stored.getOrdinalPosition()))
                .findAny()
                .orElse(null);
        if (updated == null) {
          fieldsDeleted.add("column:" + stored.getFullyQualifiedName());
          majorVersionChange = true;
        }
      }
    }

    private void updateColumnDescription(Column origColumn, Column updatedColumn) {
      if (!patchOperation
              && origColumn.getDescription() != null && !origColumn.getDescription().isEmpty()) {
        // Update description only when stored is empty to retain user authored descriptions
        updatedColumn.setDescription(origColumn.getDescription());
        return;
      }
      update("column:" + origColumn.getFullyQualifiedName() + ":description", origColumn.getDescription(),
              updatedColumn.getDescription());
    }

    private void updateColumnConstraint(Column origColumn, Column updatedColumn) {
      update("column:" + orig.getFullyQualifiedName() + ":description", origColumn.getConstraint(),
              updatedColumn.getConstraint());
    }

    private void updateConstraints() {
      List<TableConstraint> origConstraints = orig.getTableConstraints();
      List<TableConstraint> updatedConstraints = updated.getTableConstraints();
      if (origConstraints != null) {
        origConstraints.sort(Comparator.comparing(TableConstraint::getConstraintType));
        origConstraints.stream().map(TableConstraint::getColumns).forEach(Collections::sort);
      }
      if (updatedConstraints != null) {
        updatedConstraints.sort(Comparator.comparing(TableConstraint::getConstraintType));
        updatedConstraints.stream().map(TableConstraint::getColumns).forEach(Collections::sort);
      }

      update("tableConstraints", origConstraints, updatedConstraints);
    }

    private void updateColumnTags(Column origColumn, Column updatedColumn) throws IOException {
      if (!patchOperation) {
        // PUT operation merges tags in the request with what already exists
        updatedColumn.setTags(EntityUtil.mergeTags(updatedColumn.getTags(), origColumn.getTags()));
      }

      update("column:" + origColumn.getFullyQualifiedName() + ":tags",
              origColumn.getTags() == null ? 0 : origColumn.getTags().size(),
              updatedColumn.getTags() == null ? 0 : updatedColumn.getTags().size());
      EntityUtil.applyTags(repo3.tagDAO(), updatedColumn.getTags(), updatedColumn.getFullyQualifiedName());
    }

    public void store() throws IOException {
      updated.setVersion(getNewVersion(orig.getVersion()));
      storeTable(updated, true);
    }
  }
}
