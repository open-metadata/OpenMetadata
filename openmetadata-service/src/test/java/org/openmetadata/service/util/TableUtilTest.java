package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.TagLabel;

class TableUtilTest {

  @Test
  void getColumnNameForProfilerFindsNestedColumnsByQualifiedName() {
    Column grandchild = new Column().withName("city");
    Column child = new Column().withName("address").withChildren(List.of(grandchild));
    Column parent = new Column().withName("customer").withChildren(List.of(child));

    Column result =
        TableUtil.getColumnNameForProfiler(
            List.of(parent), new ColumnProfile().withName("customer.address.city"), null);

    assertEquals("city", result.getName());
  }

  @Test
  void getColumnNameForProfilerReturnsNullWhenColumnIsMissing() {
    Column parent =
        new Column().withName("customer").withChildren(List.of(new Column().withName("name")));

    Column result =
        TableUtil.getColumnNameForProfiler(
            List.of(parent), new ColumnProfile().withName("customer.address.city"), null);

    assertNull(result);
  }

  // --- columnMatchesAnyTag tests ---

  @Test
  void columnMatchesAnyTag_directTagMatch() {
    TagLabel tag = new TagLabel().withTagFQN("PII.Sensitive");
    Column column = new Column().withName("email").withTags(List.of(tag));

    assertTrue(TableUtil.columnMatchesAnyTag(column, Set.of("PII.Sensitive")));
  }

  @Test
  void columnMatchesAnyTag_childTagMatch() {
    TagLabel childTag = new TagLabel().withTagFQN("PII.Email");
    Column child = new Column().withName("email").withTags(List.of(childTag));
    Column parent = new Column().withName("contact").withTags(new ArrayList<>());
    parent.setChildren(List.of(child));

    assertTrue(TableUtil.columnMatchesAnyTag(parent, Set.of("PII.Email")));
  }

  @Test
  void columnMatchesAnyTag_noMatch() {
    TagLabel tag = new TagLabel().withTagFQN("Tier.Tier1");
    Column column = new Column().withName("id").withTags(List.of(tag));

    assertFalse(TableUtil.columnMatchesAnyTag(column, Set.of("PII.Sensitive")));
  }

  @Test
  void columnMatchesAnyTag_nullTags() {
    Column column = new Column().withName("status");
    // tags is null by default

    assertFalse(TableUtil.columnMatchesAnyTag(column, Set.of("PII.Sensitive")));
  }

  @Test
  void columnMatchesAnyTag_emptyTags() {
    Column column = new Column().withName("status").withTags(Collections.emptyList());

    assertFalse(TableUtil.columnMatchesAnyTag(column, Set.of("PII.Sensitive")));
  }

  @Test
  void columnMatchesAnyTag_deepNestedMatch() {
    TagLabel deepTag = new TagLabel().withTagFQN("PII.Address");
    Column grandchild = new Column().withName("city").withTags(List.of(deepTag));
    Column child =
        new Column()
            .withName("address")
            .withTags(new ArrayList<>())
            .withChildren(List.of(grandchild));
    Column parent =
        new Column().withName("customer").withTags(new ArrayList<>()).withChildren(List.of(child));

    // Matches 3 levels deep
    assertTrue(TableUtil.columnMatchesAnyTag(parent, Set.of("PII.Address")));
    // Does not match non-existent tag
    assertFalse(TableUtil.columnMatchesAnyTag(parent, Set.of("PII.Phone")));
  }

  @Test
  void columnMatchesAnyTag_multipleTagsInSet() {
    TagLabel tag = new TagLabel().withTagFQN("Tier.Tier2");
    Column column = new Column().withName("revenue").withTags(List.of(tag));

    // One of the tags in the set matches
    assertTrue(TableUtil.columnMatchesAnyTag(column, Set.of("PII.Sensitive", "Tier.Tier2")));
  }
}
