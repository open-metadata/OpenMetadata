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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ColumnGridItem;
import org.openmetadata.schema.api.data.ColumnMetadataGroup;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;

class ColumnMetadataGrouperTest {

  @Test
  void testGroupColumns_singleColumn_noVariations() {
    Map<String, List<ColumnMetadataGrouper.ColumnWithContext>> columnsByName = new HashMap<>();

    Column column = new Column();
    column.setName("user_id");
    column.setDisplayName("User ID");
    column.setDescription("Unique identifier for user");
    column.setDataType(ColumnDataType.BIGINT);
    column.setFullyQualifiedName("sample_data.db.schema.table1.user_id");

    List<ColumnMetadataGrouper.ColumnWithContext> occurrences = new ArrayList<>();
    occurrences.add(
        new ColumnMetadataGrouper.ColumnWithContext(
            column,
            "table",
            "sample_data.db.schema.table1",
            "Table 1",
            "sample_data",
            "db",
            "schema"));
    columnsByName.put("user_id", occurrences);

    List<ColumnGridItem> result = ColumnMetadataGrouper.groupColumns(columnsByName);

    assertEquals(1, result.size());
    ColumnGridItem item = result.get(0);
    assertEquals("user_id", item.getColumnName());
    assertEquals(1, item.getTotalOccurrences());
    assertFalse(item.getHasVariations());
    assertEquals(1, item.getGroups().size());

    ColumnMetadataGroup group = item.getGroups().get(0);
    assertEquals("User ID", group.getDisplayName());
    assertEquals("Unique identifier for user", group.getDescription());
    assertEquals(1, group.getOccurrenceCount());
  }

  @Test
  void testGroupColumns_multipleOccurrences_sameMetadata() {
    Map<String, List<ColumnMetadataGrouper.ColumnWithContext>> columnsByName = new HashMap<>();

    Column column1 = new Column();
    column1.setName("order_id");
    column1.setDisplayName("Order ID");
    column1.setDescription("Order identifier");
    column1.setDataType(ColumnDataType.BIGINT);
    column1.setFullyQualifiedName("sample_data.db.schema.orders.order_id");

    Column column2 = new Column();
    column2.setName("order_id");
    column2.setDisplayName("Order ID");
    column2.setDescription("Order identifier");
    column2.setDataType(ColumnDataType.BIGINT);
    column2.setFullyQualifiedName("sample_data.db.schema.orders_archive.order_id");

    List<ColumnMetadataGrouper.ColumnWithContext> occurrences = new ArrayList<>();
    occurrences.add(
        new ColumnMetadataGrouper.ColumnWithContext(
            column1,
            "table",
            "sample_data.db.schema.orders",
            "Orders",
            "sample_data",
            "db",
            "schema"));
    occurrences.add(
        new ColumnMetadataGrouper.ColumnWithContext(
            column2,
            "table",
            "sample_data.db.schema.orders_archive",
            "Orders Archive",
            "sample_data",
            "db",
            "schema"));
    columnsByName.put("order_id", occurrences);

    List<ColumnGridItem> result = ColumnMetadataGrouper.groupColumns(columnsByName);

    assertEquals(1, result.size());
    ColumnGridItem item = result.get(0);
    assertEquals("order_id", item.getColumnName());
    assertEquals(2, item.getTotalOccurrences());
    assertFalse(item.getHasVariations());
    assertEquals(1, item.getGroups().size());

    ColumnMetadataGroup group = item.getGroups().get(0);
    assertEquals(2, group.getOccurrenceCount());
    assertEquals(2, group.getOccurrences().size());
  }

  @Test
  void testGroupColumns_multipleOccurrences_differentDescriptions() {
    Map<String, List<ColumnMetadataGrouper.ColumnWithContext>> columnsByName = new HashMap<>();

    Column column1 = new Column();
    column1.setName("status");
    column1.setDisplayName("Status");
    column1.setDescription("Order status");
    column1.setDataType(ColumnDataType.STRING);
    column1.setFullyQualifiedName("sample_data.db.schema.orders.status");

    Column column2 = new Column();
    column2.setName("status");
    column2.setDisplayName("Status");
    column2.setDescription("User status");
    column2.setDataType(ColumnDataType.STRING);
    column2.setFullyQualifiedName("sample_data.db.schema.users.status");

    List<ColumnMetadataGrouper.ColumnWithContext> occurrences = new ArrayList<>();
    occurrences.add(
        new ColumnMetadataGrouper.ColumnWithContext(
            column1,
            "table",
            "sample_data.db.schema.orders",
            "Orders",
            "sample_data",
            "db",
            "schema"));
    occurrences.add(
        new ColumnMetadataGrouper.ColumnWithContext(
            column2,
            "table",
            "sample_data.db.schema.users",
            "Users",
            "sample_data",
            "db",
            "schema"));
    columnsByName.put("status", occurrences);

    List<ColumnGridItem> result = ColumnMetadataGrouper.groupColumns(columnsByName);

    assertEquals(1, result.size());
    ColumnGridItem item = result.get(0);
    assertEquals("status", item.getColumnName());
    assertEquals(2, item.getTotalOccurrences());
    assertTrue(item.getHasVariations());
    assertEquals(2, item.getGroups().size());

    assertEquals(1, item.getGroups().get(0).getOccurrenceCount());
    assertEquals(1, item.getGroups().get(1).getOccurrenceCount());
  }

  @Test
  void testGroupColumns_multipleOccurrences_differentTags() {
    Map<String, List<ColumnMetadataGrouper.ColumnWithContext>> columnsByName = new HashMap<>();

    TagLabel piiTag = new TagLabel();
    piiTag.setTagFQN("PII.Sensitive");
    piiTag.setSource(TagLabel.TagSource.CLASSIFICATION);

    TagLabel personalTag = new TagLabel();
    personalTag.setTagFQN("PersonalData.Personal");
    personalTag.setSource(TagLabel.TagSource.CLASSIFICATION);

    Column column1 = new Column();
    column1.setName("email");
    column1.setDisplayName("Email");
    column1.setDescription("Email address");
    column1.setDataType(ColumnDataType.STRING);
    column1.setFullyQualifiedName("sample_data.db.schema.users.email");
    column1.setTags(List.of(piiTag));

    Column column2 = new Column();
    column2.setName("email");
    column2.setDisplayName("Email");
    column2.setDescription("Email address");
    column2.setDataType(ColumnDataType.STRING);
    column2.setFullyQualifiedName("sample_data.db.schema.contacts.email");
    column2.setTags(List.of(personalTag));

    List<ColumnMetadataGrouper.ColumnWithContext> occurrences = new ArrayList<>();
    occurrences.add(
        new ColumnMetadataGrouper.ColumnWithContext(
            column1,
            "table",
            "sample_data.db.schema.users",
            "Users",
            "sample_data",
            "db",
            "schema"));
    occurrences.add(
        new ColumnMetadataGrouper.ColumnWithContext(
            column2,
            "table",
            "sample_data.db.schema.contacts",
            "Contacts",
            "sample_data",
            "db",
            "schema"));
    columnsByName.put("email", occurrences);

    List<ColumnGridItem> result = ColumnMetadataGrouper.groupColumns(columnsByName);

    assertEquals(1, result.size());
    ColumnGridItem item = result.get(0);
    assertEquals("email", item.getColumnName());
    assertEquals(2, item.getTotalOccurrences());
    assertTrue(item.getHasVariations());
    assertEquals(2, item.getGroups().size());
  }

  @Test
  void testGroupColumns_multipleColumns() {
    Map<String, List<ColumnMetadataGrouper.ColumnWithContext>> columnsByName = new HashMap<>();

    Column userIdCol = new Column();
    userIdCol.setName("user_id");
    userIdCol.setDisplayName("User ID");
    userIdCol.setDescription("User identifier");
    userIdCol.setDataType(ColumnDataType.BIGINT);
    userIdCol.setFullyQualifiedName("sample_data.db.schema.users.user_id");

    Column orderIdCol = new Column();
    orderIdCol.setName("order_id");
    orderIdCol.setDisplayName("Order ID");
    orderIdCol.setDescription("Order identifier");
    orderIdCol.setDataType(ColumnDataType.BIGINT);
    orderIdCol.setFullyQualifiedName("sample_data.db.schema.orders.order_id");

    List<ColumnMetadataGrouper.ColumnWithContext> userIdOccurrences = new ArrayList<>();
    userIdOccurrences.add(
        new ColumnMetadataGrouper.ColumnWithContext(
            userIdCol,
            "table",
            "sample_data.db.schema.users",
            "Users",
            "sample_data",
            "db",
            "schema"));

    List<ColumnMetadataGrouper.ColumnWithContext> orderIdOccurrences = new ArrayList<>();
    orderIdOccurrences.add(
        new ColumnMetadataGrouper.ColumnWithContext(
            orderIdCol,
            "table",
            "sample_data.db.schema.orders",
            "Orders",
            "sample_data",
            "db",
            "schema"));

    columnsByName.put("user_id", userIdOccurrences);
    columnsByName.put("order_id", orderIdOccurrences);

    List<ColumnGridItem> result = ColumnMetadataGrouper.groupColumns(columnsByName);

    assertEquals(2, result.size());
    assertTrue(result.stream().anyMatch(item -> "user_id".equals(item.getColumnName())));
    assertTrue(result.stream().anyMatch(item -> "order_id".equals(item.getColumnName())));
  }

  @Test
  void testGroupColumns_nullMetadata() {
    Map<String, List<ColumnMetadataGrouper.ColumnWithContext>> columnsByName = new HashMap<>();

    Column column1 = new Column();
    column1.setName("test_col");
    column1.setDataType(ColumnDataType.STRING);
    column1.setFullyQualifiedName("sample_data.db.schema.table1.test_col");

    Column column2 = new Column();
    column2.setName("test_col");
    column2.setDataType(ColumnDataType.STRING);
    column2.setFullyQualifiedName("sample_data.db.schema.table2.test_col");

    List<ColumnMetadataGrouper.ColumnWithContext> occurrences = new ArrayList<>();
    occurrences.add(
        new ColumnMetadataGrouper.ColumnWithContext(
            column1,
            "table",
            "sample_data.db.schema.table1",
            "Table 1",
            "sample_data",
            "db",
            "schema"));
    occurrences.add(
        new ColumnMetadataGrouper.ColumnWithContext(
            column2,
            "table",
            "sample_data.db.schema.table2",
            "Table 2",
            "sample_data",
            "db",
            "schema"));
    columnsByName.put("test_col", occurrences);

    List<ColumnGridItem> result = ColumnMetadataGrouper.groupColumns(columnsByName);

    assertEquals(1, result.size());
    ColumnGridItem item = result.get(0);
    assertEquals("test_col", item.getColumnName());
    assertEquals(2, item.getTotalOccurrences());
    assertFalse(item.getHasVariations());
    assertEquals(1, item.getGroups().size());
  }

  @Test
  void testGroupColumns_emptyMap() {
    Map<String, List<ColumnMetadataGrouper.ColumnWithContext>> columnsByName = new HashMap<>();

    List<ColumnGridItem> result = ColumnMetadataGrouper.groupColumns(columnsByName);

    assertNotNull(result);
    assertEquals(0, result.size());
  }
}
