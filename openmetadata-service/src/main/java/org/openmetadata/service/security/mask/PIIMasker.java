package org.openmetadata.service.security.mask;

import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.service.jdbi3.ColumnUtil;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

public class PIIMasker {

  public static final String SENSITIVE_PII_TAG = "PII.Sensitive";
  public static final String MASKED_VALUE = "********";

  public static Table getSampleData(Table table, boolean authorized) {
    if (authorized) return table;

    TableData sampleData = table.getSampleData();
    // get the list of positions to be masked
    List<Integer> columnsPositionToBeMasked =
        table.getColumns().stream()
            .collect(Collectors.toMap(Function.identity(), c -> sampleData.getColumns().indexOf(c.getName())))
            .entrySet()
            .stream()
            .filter(entry -> hasPiiSensitiveTag(entry.getKey()))
            .map(Map.Entry::getValue)
            .collect(Collectors.toList());

    sampleData.setRows(
        sampleData.getRows().stream()
            .map(r -> maskSampleDataRow(r, columnsPositionToBeMasked))
            .collect(Collectors.toList()));

    table.setSampleData(sampleData);
    return table;
  }

  private static boolean hasPiiSensitiveTag(Column column) {
    return ColumnUtil.getAllTags(column).stream().anyMatch(SENSITIVE_PII_TAG::equals);
  }

  private static List<Object> maskSampleDataRow(List<Object> row, List<Integer> columnsPositionToBeMasked) {
    columnsPositionToBeMasked.forEach(position -> row.set(position, MASKED_VALUE));
    return row;
  }
}
