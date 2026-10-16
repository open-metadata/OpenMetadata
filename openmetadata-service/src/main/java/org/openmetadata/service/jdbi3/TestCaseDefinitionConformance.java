package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

/**
 * What a new test case must agree with in its definition
 * (ADR:2026-10-12-test-cases-are-checked-against-their-definition-at-create).
 */
final class TestCaseDefinitionConformance {
  private TestCaseDefinitionConformance() {}

  static void validate(
      TestCase test, TestDefinition definition, Table table, EntityLink entityLink) {
    validateOptionValues(
        listOrEmpty(test.getParameterValues()), listOrEmpty(definition.getParameterDefinition()));
    validateColumnType(definition, table, entityLink);
  }

  private static void validateOptionValues(
      List<TestCaseParameterValue> values, List<TestCaseParameter> parameters) {
    Map<String, List<Object>> options = optionsByParameter(parameters);
    values.stream()
        .filter(value -> options.containsKey(value.getName()) && !isUnset(value.getValue()))
        .filter(value -> !isOption(value.getValue(), options.get(value.getName())))
        .findFirst()
        .ifPresent(
            value -> {
              throw new IllegalArgumentException(
                  String.format(
                      "Parameter '%s' must be one of %s, but was '%s'.",
                      value.getName(), options.get(value.getName()), value.getValue()));
            });
  }

  private static Map<String, List<Object>> optionsByParameter(List<TestCaseParameter> parameters) {
    return parameters.stream()
        .filter(parameter -> !nullOrEmpty(parameter.getOptionValues()))
        .collect(
            Collectors.toMap(
                TestCaseParameter::getName,
                TestCaseParameter::getOptionValues,
                (first, duplicate) -> first));
  }

  /** A blank value is unset, as the test generator reads it, so it is not checked here. */
  private static boolean isUnset(String value) {
    return nullOrEmpty(value) || value.isBlank();
  }

  // Case-insensitive, as TestCaseThresholdValidator already reads thresholdUnit.
  private static boolean isOption(String value, List<Object> options) {
    return options.stream().anyMatch(option -> String.valueOf(option).equalsIgnoreCase(value));
  }

  private static void validateColumnType(
      TestDefinition definition, Table table, EntityLink entityLink) {
    List<ColumnDataType> supported = listOrEmpty(definition.getSupportedDataTypes());
    Optional<ColumnDataType> type =
        column(table, entityLink.getArrayFieldName()).map(Column::getDataType);
    boolean unsupported =
        !supported.isEmpty() && type.isPresent() && !supported.contains(type.get());
    if (unsupported) {
      throw new IllegalArgumentException(
          String.format(
              "Test definition '%s' does not support column type %s. Supported types are: %s",
              definition.getName(), type.get(), supported));
    }
  }

  // validateColumnTestCase matches the column name case-insensitively; this must find the same one.
  private static Optional<Column> column(Table table, String name) {
    return Optional.ofNullable(name)
        .flatMap(
            columnName ->
                listOrEmpty(table.getColumns()).stream()
                    .filter(Objects::nonNull)
                    .filter(candidate -> candidate.getName().equalsIgnoreCase(columnName))
                    .findFirst());
  }
}
