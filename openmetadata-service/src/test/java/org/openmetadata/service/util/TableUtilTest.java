package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;

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
}
