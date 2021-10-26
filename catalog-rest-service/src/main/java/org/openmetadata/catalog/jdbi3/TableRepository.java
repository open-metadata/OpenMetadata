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

import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.databases.TableResource;
import org.openmetadata.catalog.type.ChangeDescription;
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
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.common.utils.CommonUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URI;
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

public class TableRepository extends EntityRepository<Table> {
  static final Logger LOG = LoggerFactory.getLogger(TableRepository.class);
  // Table fields that can be patched in a PATCH request
  static final Fields TABLE_PATCH_FIELDS = new Fields(TableResource.FIELD_LIST,
          "owner,columns,database,tags,tableConstraints");
  // Table fields that can be updated in a PUT request
  static final Fields TABLE_UPDATE_FIELDS = new Fields(TableResource.FIELD_LIST,
          "owner,columns,database,tags,tableConstraints");

  private final CollectionDAO dao;

  public TableRepository(CollectionDAO dao) {
    super(Table.class, dao.tableDAO(), dao, TABLE_PATCH_FIELDS, TABLE_UPDATE_FIELDS);
    this.dao = dao;
  }

  @Override
  public Table setFields(Table table, Fields fields) throws IOException, ParseException {
    table.setColumns(table.getColumns());
    table.setTableConstraints(fields.contains("tableConstraints") ? table.getTableConstraints() : null);
    table.setOwner(fields.contains("owner") ? getOwner(table) : null);
    table.setFollowers(fields.contains("followers") ? getFollowers(table) : null);
    table.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(dao.usageDAO(), table.getId()) :
            null);
    table.setDatabase(fields.contains("database") ? getDatabase(table.getId()) : null);
    table.setTags(fields.contains("tags") ? getTags(table.getFullyQualifiedName()) : null);
    getColumnTags(fields.contains("tags"), table.getColumns());
    table.setJoins(fields.contains("joins") ? getJoins(table) : null);
    table.setSampleData(fields.contains("sampleData") ? getSampleData(table) : null);
    table.setViewDefinition(fields.contains("viewDefinition") ? table.getViewDefinition() : null);
    table.setTableProfile(fields.contains("tableProfile") ? getTableProfile(table) : null);
    return table;
  }

  @Override
  public void restorePatchAttributes(Table original, Table updated) throws IOException, ParseException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withDatabase(original.getDatabase()).withId(original.getId());
  }

  @Override
  public EntityInterface<Table> getEntityInterface(Table entity) {
    return new TableEntityInterface(entity);
  }

  public static String getFQN(Table table) {
    return (table.getDatabase().getName() + "." + table.getName());
  }

  @Transaction
  public void delete(UUID id) {
    dao.tableDAO().delete(id);
    dao.relationshipDAO().deleteAll(id.toString()); // Remove all relationships
  }

  @Transaction
  public Status addFollower(UUID tableId, UUID userId) throws IOException {
    dao.tableDAO().findEntityById(tableId);
    return EntityUtil.addFollower(dao.relationshipDAO(), dao.userDAO(), tableId, Entity.TABLE, userId,
            Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void addJoins(UUID tableId, TableJoins joins) throws IOException, ParseException {
    // Validate the request content
    Table table = dao.tableDAO().findEntityById(tableId);
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
  public void addSampleData(UUID tableId, TableData tableData) throws IOException {
    // Validate the request content
    Table table = dao.tableDAO().findEntityById(tableId);

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

    dao.entityExtensionDAO().insert(tableId.toString(), "table.sampleData", "tableData",
            JsonUtils.pojoToJson(tableData));
  }

  @Transaction
  public void addTableProfileData(UUID tableId, TableProfile tableProfile) throws IOException {
    // Validate the request content
    Table table = dao.tableDAO().findEntityById(tableId);

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

    dao.entityExtensionDAO().insert(tableId.toString(), "table.tableProfile", "tableProfile",
            JsonUtils.pojoToJson(updatedProfiles));
  }

  @Transaction
  public void deleteFollower(UUID tableId, UUID userId) {
    EntityUtil.validateUser(dao.userDAO(), userId);
    EntityUtil.removeFollower(dao.relationshipDAO(), tableId, userId);
  }

  @Transaction
  public EntityReference getOwnerReference(Table table) throws IOException {
    return EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), table.getOwner());
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
      column.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), column.getTags()));
      if (column.getChildren() != null) {
        addDerivedTags(column.getChildren());
      }
    }
  }

  @Override
  public void validate(Table table) throws IOException {
    table.setDatabase(dao.databaseDAO().findEntityReferenceById(table.getDatabase().getId()));

    // Set data in table entity based on database relationship
    table.setFullyQualifiedName(getFQN(table));
    setColumnFQN(table.getFullyQualifiedName(), table.getColumns());

    // Check if owner is valid and set the relationship
    table.setOwner(EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), table.getOwner()));

    // Validate table tags and add derived tags to the list
    table.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), table.getTags()));

    // Validate column tags
    addDerivedTags(table.getColumns());
  }

  @Override
  public void store(Table table, boolean update) throws IOException {
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
      dao.tableDAO().update(table.getId(), JsonUtils.pojoToJson(table));
    } else {
      dao.tableDAO().insert(table);
    }

    // Restore the relationships
    table.withOwner(owner).withDatabase(database).withTags(tags);
    table.setColumns(columnWithTags);
  }

  @Override
  public void storeRelationships(Table table) throws IOException {
    // Add relationship from database to table
    String databaseId = table.getDatabase().getId().toString();
    dao.relationshipDAO().insert(databaseId, table.getId().toString(), Entity.DATABASE, Entity.TABLE,
            Relationship.CONTAINS.ordinal());

    // Add table owner relationship
    EntityUtil.setOwner(dao.relationshipDAO(), table.getId(), Entity.TABLE, table.getOwner());

    // Add tag to table relationship
    applyTags(table);
  }

  @Override
  public EntityUpdater getUpdater(Table original, Table updated, boolean patchOperation) throws IOException {
    return new TableUpdater(original, updated, patchOperation);
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

  // TODO remove this
  private void applyTags(List<Column> columns) throws IOException {
    // Add column level tags by adding tag to column relationship
    for (Column column : columns) {
      EntityUtil.applyTags(dao.tagDAO(), column.getTags(), column.getFullyQualifiedName());
      column.setTags(getTags(column.getFullyQualifiedName())); // Update tag list to handle derived tags
      if (column.getChildren() != null) {
        applyTags(column.getChildren());
      }
    }
  }

  private void applyTags(Table table) throws IOException {
    // Add table level tags by adding tag to table relationship
    EntityUtil.applyTags(dao.tagDAO(), table.getTags(), table.getFullyQualifiedName());
    table.setTags(getTags(table.getFullyQualifiedName())); // Update tag to handle additional derived tags
    applyTags(table.getColumns());
  }

  private EntityReference getDatabase(UUID tableId) throws IOException {
    // Find database for the table
    List<String> result = dao.relationshipDAO().findFrom(tableId.toString(),
            Relationship.CONTAINS.ordinal(), Entity.DATABASE);
    if (result.size() != 1) {
      throw EntityNotFoundException.byMessage(String.format("Database for table %s Not found", tableId));
    }
    return dao.databaseDAO().findEntityReferenceById(UUID.fromString(result.get(0)));
  }

  private EntityReference getOwner(Table table) throws IOException {
    return table == null ? null : EntityUtil.populateOwner(table.getId(), dao.relationshipDAO(), dao.userDAO(),
            dao.teamDAO());
  }

  private List<EntityReference> getFollowers(Table table) throws IOException {
    return table == null ? null : EntityUtil.getFollowers(table.getId(), dao.relationshipDAO(), dao.userDAO());
  }

  private List<TagLabel> getTags(String fqn) {
    return dao.tagDAO().getTags(fqn);
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
      Table joinedWithTable = dao.tableDAO().findEntityByName(tableFQN);

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
      String json = dao.fieldRelationshipDAO().find(fromColumnFQN, toColumnFQN, "table.columns.column",
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

      dao.fieldRelationshipDAO().upsert(fromColumnFQN, toColumnFQN, "table.columns.column",
              "table.columns.column", JOINED_WITH.ordinal(), "dailyCount", json);
    }
  }

  private TableJoins getJoins(Table table) throws ParseException, IOException {
    String today = RestUtil.DATE_FORMAT.format(new Date()); // today
    String todayMinus30Days = CommonUtil.getDateStringByOffset(RestUtil.DATE_FORMAT, today, -30);
    TableJoins tableJoins = new TableJoins().withStartDate(todayMinus30Days).withDayCount(30)
            .withColumnJoins(Collections.emptyList());

    List<List<String>> list = dao.fieldRelationshipDAO().listToByPrefix(table.getFullyQualifiedName(),
            "table.columns.column", "table.columns.column", JOINED_WITH.ordinal());
    list.addAll(dao.fieldRelationshipDAO().listFromByPrefix(table.getFullyQualifiedName(), "table.columns.column",
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
    return JsonUtils.readValue(dao.entityExtensionDAO().getExtension(table.getId().toString(), "table.sampleData"),
            TableData.class);
  }

  private List<TableProfile> getTableProfile(Table table) throws IOException {
    List<TableProfile> tableProfiles =
            JsonUtils.readObjects(dao.entityExtensionDAO().getExtension(table.getId().toString(),
                    "table.tableProfile"),
                    TableProfile.class);
    if (tableProfiles != null) {
      tableProfiles.sort(Comparator.comparing(p -> parseDate(p.getProfileDate(), RestUtil.DATE_FORMAT),
              Comparator.reverseOrder()));
    }
    return tableProfiles;
  }

  public static class TableEntityInterface implements EntityInterface<Table> {
    private final Table entity;

    public TableEntityInterface(Table entity) {
      this.entity = entity;
    }


    @Override
    public UUID getId() { return entity.getId(); }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public EntityReference getOwner() {
      return entity.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return entity.getTags();
    }

    @Override
    public Double getVersion() { return entity.getVersion(); }

    @Override
    public String getUpdatedBy() { return entity.getUpdatedBy(); }

    @Override
    public Date getUpdatedAt() { return entity.getUpdatedAt(); }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.TABLE);
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public Table getEntity() { return entity; }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public void setId(UUID id) { entity.setId(id); }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setUpdateDetails(String updatedBy, Date updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class TableUpdater extends EntityUpdater {
    public TableUpdater(Table original, Table updated, boolean patchOperation) {
      super(original, updated, patchOperation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      Table origTable = original.getEntity();
      Table updatedTable = updated.getEntity();
      updateConstraints(origTable, updatedTable);
      updateTableType(origTable, updatedTable);
      updateColumns(origTable.getColumns(), updated.getEntity().getColumns());
    }

    private void updateConstraints(Table origTable, Table updatedTable) {
      List<TableConstraint> origConstraints = origTable.getTableConstraints();
      List<TableConstraint> updatedConstraints = updatedTable.getTableConstraints();
      if (origConstraints != null) {
        origConstraints.sort(Comparator.comparing(TableConstraint::getConstraintType));
        origConstraints.stream().map(TableConstraint::getColumns).forEach(Collections::sort);
      }
      if (updatedConstraints != null) {
        updatedConstraints.sort(Comparator.comparing(TableConstraint::getConstraintType));
        updatedConstraints.stream().map(TableConstraint::getColumns).forEach(Collections::sort);
      }

      recordChange("tableConstraints", origConstraints, updatedConstraints);
    }

    private void updateTableType(Table origTable, Table updatedTable) {
      recordChange("tableType", origTable.getTableType(), updatedTable.getTableType());
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
          changeDescription.getFieldsAdded().add(getColumnField(updated));
          EntityUtil.applyTags(dao.tagDAO(), updated.getTags(), updated.getFullyQualifiedName());
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
          changeDescription.getFieldsDeleted().add(getColumnField(stored));
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
      recordChange(getColumnField(origColumn, "description"),
              origColumn.getDescription(), updatedColumn.getDescription());
    }

    private void updateColumnConstraint(Column origColumn, Column updatedColumn) {
      recordChange(getColumnField(origColumn, "constraint"),
                      origColumn.getConstraint(), updatedColumn.getConstraint());
    }

    private void updateColumnTags(Column origColumn, Column updatedColumn) throws IOException {
      if (!patchOperation) {
        // PUT operation merges tags in the request with what already exists
        updatedColumn.setTags(EntityUtil.mergeTags(updatedColumn.getTags(), origColumn.getTags()));
      }
      recordTagChange(getColumnField(origColumn, "tags"), origColumn.getTags(), updatedColumn.getTags());
      EntityUtil.applyTags(dao.tagDAO(), updatedColumn.getTags(), updatedColumn.getFullyQualifiedName());
    }

    private String getColumnField(Column column) {
      return getColumnField(column, null);
    }

    private String getColumnField(Column column, String columnField) {
      // Remove table FQN from column FQN to get the local name
      String localColumnName = EntityUtil.getLocalColumnName(column.getFullyQualifiedName());
      System.out.println("Local name " + column.getFullyQualifiedName());
      return "column:" + localColumnName + (columnField == null ? "" : "." + columnField);
    }
  }
}
