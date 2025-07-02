package org.openmetadata.service.util;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ColumnLineage;

/**
 * Unit tests for {@link ColumnLineageUtil}.
 */
public class ColumnLineageUtilTest {

  @Test
  public void testRemoval() {
    ColumnLineage cl = new ColumnLineage();
    cl.setToColumn("service.db.schema.table.col1");
    cl.setFromColumns(List.of("service.db.schema.up1", "service.db.schema.up2"));

    List<ColumnLineage> result =
        ColumnLineageUtil.transform(
            List.of(cl), Set.of("service.db.schema.table.col1", "service.db.schema.up1"), Map.of());

    // Expect the entire mapping to disappear because toColumn was removed
    Assertions.assertTrue(
        result.isEmpty(), "Column lineage should be removed when toColumn deleted");
  }

  @Test
  public void testRename() {
    ColumnLineage cl = new ColumnLineage();
    cl.setToColumn("t.col_old");
    cl.setFromColumns(List.of("u.col1"));

    List<ColumnLineage> result =
        ColumnLineageUtil.transform(
            List.of(cl), Set.of(), Map.of("t.col_old", "t.col_new", "u.col1", "u.colOne"));

    Assertions.assertEquals(1, result.size());
    ColumnLineage updated = result.get(0);
    Assertions.assertEquals("t.col_new", updated.getToColumn());
    Assertions.assertEquals(List.of("u.colOne"), updated.getFromColumns());
  }
}
