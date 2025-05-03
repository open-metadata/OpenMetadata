package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.change.ChangeSummary;

public class ChangeSummarizerTest {

  private ChangeSummarizer<Table> changeSummarizer;

  @BeforeEach
  public void setUp() {
    changeSummarizer =
        new ChangeSummarizer<>(Table.class, Set.of("description", "columns.description"));
  }

  @Test
  public void test_tableDescription() {
    String fieldName = "description";
    ChangeSource changeSource = ChangeSource.MANUAL;
    long updatedAt = System.currentTimeMillis();
    String updatedBy = "testUser";
    List<FieldChange> changes = List.of(new FieldChange().withName(fieldName));

    Map<String, ChangeSummary> result =
        changeSummarizer.summarizeChanges(Map.of(), changes, changeSource, updatedBy, updatedAt);
    assert result.size() == 1;
    Assertions.assertTrue(result.containsKey(fieldName));

    result =
        changeSummarizer.summarizeChanges(
            result, changes, ChangeSource.AUTOMATED, "older-change", updatedAt - 100);
    assert result.size() == 0;
  }

  @Test
  public void test_duplicateEntriesConsolidation() {
    String fieldName = "description";
    ChangeSource changeSource = ChangeSource.MANUAL;
    long updatedAt = System.currentTimeMillis();
    String updatedBy = "testUser";
    List<FieldChange> changes =
        List.of(new FieldChange().withName(fieldName), new FieldChange().withName(fieldName));

    Map<String, ChangeSummary> result =
        changeSummarizer.summarizeChanges(Map.of(), changes, changeSource, updatedBy, updatedAt);
    assert result.size() == 1;
    Assertions.assertTrue(result.containsKey(fieldName));

    result =
        changeSummarizer.summarizeChanges(
            result, changes, ChangeSource.AUTOMATED, "older-change", updatedAt - 100);
    assert result.size() == 0;
  }

  @Test
  public void test_columnDescription() {
    String fieldName = "columns.column1.description";
    ChangeSource changeSource = ChangeSource.MANUAL;
    long updatedAt = System.currentTimeMillis();
    String updatedBy = "testUser";
    List<FieldChange> changes = List.of(new FieldChange().withName(fieldName));

    Map<String, ChangeSummary> result =
        changeSummarizer.summarizeChanges(Map.of(), changes, changeSource, updatedBy, updatedAt);
    assert result.size() == 1;
    Assertions.assertTrue(result.containsKey(fieldName));
  }

  @Test
  public void test_nonExistentField() {
    String fieldName = "nonExistentField";
    try {
      new ChangeSummarizer<>(Table.class, Set.of(fieldName));
      Assertions.fail("Expected IllegalArgumentException");
    } catch (IllegalArgumentException e) {
      assertEquals(
          String.format(
              "Trying to register non-existent field %s for class %s", fieldName, Table.class),
          e.getMessage());
    }

    fieldName = "columns.nonExistentField";
    try {
      new ChangeSummarizer<>(Table.class, Set.of(fieldName));
      Assertions.fail("Expected IllegalArgumentException");
    } catch (IllegalArgumentException e) {
      assertEquals(
          String.format(
              "Trying to register non-existent field %s for class %s", fieldName, Table.class),
          e.getMessage());
    }
  }

  @Test
  public void test_deleteColumn() {
    FieldChange fieldChange =
        new FieldChange()
            .withName("columns")
            .withOldValue(
                "[{\"name\":\"c'_+# 1\",\"dataType\":\"INT\",\"dataTypeDisplay\":\"int\",\"description\":\"c'_+# 1\",\"fullyQualifiedName\":\"\\\"databaseService_'-.&()[]쉛TableResourceTestb\\\".\\\"database_'+#- .()$\uD873\uDE40TableResourceTest\\\".\\\"databaseSchema_'+#- .()$\uD880\uDDB5TableResourceTest\\\".\\\"table_'+#- .()$䡶patch_withChangeContext\\\".c'_+# 1\",\"tags\":[]}]");
    Map<String, ChangeSummary> currentSummary =
        Map.of(
            "description",
            new ChangeSummary()
                .withChangedBy("testUser")
                .withChangeSource(ChangeSource.MANUAL)
                .withChangedAt(System.currentTimeMillis()),
            "columns.not_deleted.description",
            new ChangeSummary()
                .withChangedBy("testUser")
                .withChangeSource(ChangeSource.MANUAL)
                .withChangedAt(System.currentTimeMillis()),
            "columns.c'_+# 1.description",
            new ChangeSummary()
                .withChangedBy("testUser")
                .withChangeSource(ChangeSource.MANUAL)
                .withChangedAt(System.currentTimeMillis()));
    Set<String> result = changeSummarizer.processDeleted(List.of(fieldChange));
    assertEquals(1, result.size());
    assertEquals("columns.c'_+# 1.description", result.iterator().next());
  }
}
