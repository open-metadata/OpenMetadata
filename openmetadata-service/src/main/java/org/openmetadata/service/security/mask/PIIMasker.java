package org.openmetadata.service.security.mask;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.service.jdbi3.ColumnUtil;

public class PIIMasker {

  public static final String SENSITIVE_PII_TAG = "PII.Sensitive";
  public static final String MASKED_VALUE = "********";
  public static final String MASKED_NAME = "[MASKED]";

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

    // Mask rows
    sampleData.setRows(
        sampleData.getRows().stream()
            .map(r -> maskSampleDataRow(r, columnsPositionToBeMasked))
            .collect(Collectors.toList()));

    List<String> sampleDataColumns = sampleData.getColumns();

    // Flag column names as masked
    columnsPositionToBeMasked.forEach(
        position -> sampleDataColumns.set(position, flagMaskedName(sampleDataColumns.get(position))));

    table.setSampleData(sampleData);
    return table;
  }

  public static Table getTableProfile(Table table, boolean authorized) {
    if (authorized) return table;
    for (Column column : table.getColumns()) {
      if (hasPiiSensitiveTag(column)) {
        column.setProfile(null);
        column.setName(flagMaskedName(column.getName()));
      }
    }
    return table;
  }

  public static TestCase getTestCase(Column column, TestCase testCase, boolean authorized) {
    if (authorized || !hasPiiSensitiveTag(column)) return testCase;

    testCase.setTestCaseResult(null);
    testCase.setParameterValues(null);
    testCase.setDescription(null);
    testCase.setName(flagMaskedName(testCase.getName()));

    return testCase;
  }

  private static boolean hasPiiSensitiveTag(Column column) {
    return ColumnUtil.getAllTags(column).stream().anyMatch(SENSITIVE_PII_TAG::equals);
  }

  private static List<Object> maskSampleDataRow(List<Object> row, List<Integer> columnsPositionToBeMasked) {
    columnsPositionToBeMasked.forEach(position -> row.set(position, MASKED_VALUE));
    return row;
  }

  private static String flagMaskedName(String name) {
    return String.format("%s %s", name, MASKED_NAME);
  }
}
