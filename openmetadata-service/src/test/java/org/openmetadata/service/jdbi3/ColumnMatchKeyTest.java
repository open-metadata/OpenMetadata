package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.jdbi3.EntityRepository.ColumnEntityUpdater.ColumnKey;
import org.openmetadata.service.util.EntityUtil;

class ColumnMatchKeyTest {

  @ParameterizedTest
  @CsvSource({
    "column,COLUMN",
    "\u03c3,\u03c2",
    "\u0130,i",
    "I,\u0131",
    "\u00df,SS",
    "\uD801\uDC00,\uD801\uDC28"
  })
  void lookupMatchesTheColumnPredicate(String originalName, String updatedName) {
    for (ColumnDataType dataType :
        new ColumnDataType[] {ColumnDataType.INT, ColumnDataType.ARRAY}) {
      for (ColumnDataType arrayDataType : new ColumnDataType[] {null, ColumnDataType.INT}) {
        Column original =
            new Column()
                .withName(originalName)
                .withDataType(dataType)
                .withArrayDataType(arrayDataType);
        Column updated =
            new Column()
                .withName(updatedName)
                .withDataType(dataType)
                .withArrayDataType(arrayDataType);
        Map<ColumnKey, Column> columns = new HashMap<>();
        columns.put(new ColumnKey(originalName, dataType, arrayDataType), original);
        assertEquals(
            EntityUtil.columnMatch.test(original, updated),
            columns.containsKey(new ColumnKey(updatedName, dataType, arrayDataType)));
        assertFalse(
            columns.containsKey(new ColumnKey(updatedName, ColumnDataType.VARCHAR, arrayDataType)));
        assertFalse(
            columns.containsKey(new ColumnKey(updatedName, dataType, ColumnDataType.VARCHAR)));
      }
    }
  }
}
