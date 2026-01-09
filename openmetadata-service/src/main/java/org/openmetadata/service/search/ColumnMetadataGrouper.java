/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.search;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.binary.Hex;
import org.openmetadata.schema.api.data.ColumnChild;
import org.openmetadata.schema.api.data.ColumnGridItem;
import org.openmetadata.schema.api.data.ColumnMetadataGroup;
import org.openmetadata.schema.api.data.ColumnOccurrenceRef;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;

@Slf4j
public class ColumnMetadataGrouper {

  public static List<ColumnGridItem> groupColumns(
      Map<String, List<ColumnWithContext>> columnsByName) {
    List<ColumnGridItem> gridItems = new ArrayList<>();

    for (Map.Entry<String, List<ColumnWithContext>> entry : columnsByName.entrySet()) {
      String columnName = entry.getKey();
      List<ColumnWithContext> occurrences = entry.getValue();

      Map<String, ColumnMetadataGroup> groups = new HashMap<>();

      for (ColumnWithContext columnCtx : occurrences) {
        String groupId = generateMetadataHash(columnCtx.column);

        ColumnMetadataGroup group =
            groups.computeIfAbsent(
                groupId,
                k -> {
                  ColumnMetadataGroup newGroup = new ColumnMetadataGroup();
                  newGroup.setGroupId(groupId);
                  newGroup.setDisplayName(columnCtx.column.getDisplayName());
                  newGroup.setDescription(columnCtx.column.getDescription());
                  newGroup.setTags(columnCtx.column.getTags());
                  newGroup.setDataType(
                      columnCtx.column.getDataType() != null
                          ? columnCtx.column.getDataType().toString()
                          : null);
                  newGroup.setOccurrenceCount(0);
                  newGroup.setOccurrences(new ArrayList<>());
                  // Set children for STRUCT, MAP, or UNION types
                  if (columnCtx.column.getChildren() != null
                      && !columnCtx.column.getChildren().isEmpty()) {
                    newGroup.setChildren(convertToColumnChildren(columnCtx.column.getChildren()));
                  }
                  return newGroup;
                });

        ColumnOccurrenceRef occurrence = new ColumnOccurrenceRef();
        occurrence.setColumnFQN(columnCtx.column.getFullyQualifiedName());
        occurrence.setEntityType(columnCtx.entityType);
        occurrence.setEntityFQN(columnCtx.entityFQN);
        occurrence.setEntityDisplayName(columnCtx.entityDisplayName);
        occurrence.setServiceName(columnCtx.serviceName);
        occurrence.setDatabaseName(columnCtx.databaseName);
        occurrence.setSchemaName(columnCtx.schemaName);

        group.getOccurrences().add(occurrence);
        group.setOccurrenceCount(group.getOccurrenceCount() + 1);
      }

      ColumnGridItem gridItem = new ColumnGridItem();
      gridItem.setColumnName(columnName);
      gridItem.setTotalOccurrences(occurrences.size());
      gridItem.setHasVariations(groups.size() > 1);
      gridItem.setGroups(new ArrayList<>(groups.values()));

      gridItems.add(gridItem);
    }

    return gridItems;
  }

  private static List<ColumnChild> convertToColumnChildren(List<Column> columns) {
    List<ColumnChild> children = new ArrayList<>();
    for (Column col : columns) {
      ColumnChild child = new ColumnChild();
      child.setName(col.getName());
      child.setFullyQualifiedName(col.getFullyQualifiedName());
      child.setDisplayName(col.getDisplayName());
      child.setDescription(col.getDescription());
      child.setDataType(col.getDataType() != null ? col.getDataType().toString() : null);
      child.setTags(col.getTags());
      // Recursively convert nested children
      if (col.getChildren() != null && !col.getChildren().isEmpty()) {
        child.setChildren(convertToColumnChildren(col.getChildren()));
      }
      children.add(child);
    }
    return children;
  }

  private static String generateMetadataHash(Column column) {
    try {
      StringBuilder sb = new StringBuilder();

      sb.append(column.getDisplayName() != null ? column.getDisplayName() : "");
      sb.append("|");
      sb.append(column.getDescription() != null ? column.getDescription() : "");
      sb.append("|");

      if (column.getTags() != null) {
        String tagString =
            column.getTags().stream()
                .map(TagLabel::getTagFQN)
                .sorted()
                .collect(Collectors.joining(","));
        sb.append(tagString);
      }

      MessageDigest md = MessageDigest.getInstance("MD5");
      byte[] digest = md.digest(sb.toString().getBytes());
      return Hex.encodeHexString(digest);

    } catch (NoSuchAlgorithmException e) {
      LOG.error("Failed to generate metadata hash", e);
      return "default";
    }
  }

  public static class ColumnWithContext {
    public Column column;
    public String entityType;
    public String entityFQN;
    public String entityDisplayName;
    public String serviceName;
    public String databaseName;
    public String schemaName;

    public ColumnWithContext(
        Column column,
        String entityType,
        String entityFQN,
        String entityDisplayName,
        String serviceName,
        String databaseName,
        String schemaName) {
      this.column = column;
      this.entityType = entityType;
      this.entityFQN = entityFQN;
      this.entityDisplayName = entityDisplayName;
      this.serviceName = serviceName;
      this.databaseName = databaseName;
      this.schemaName = schemaName;
    }
  }
}
