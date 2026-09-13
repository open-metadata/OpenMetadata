package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.PartitionColumnDetails;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TablePartition;
import org.openmetadata.service.resources.databases.DatabaseUtil;

class ColumnDefinitionValidationTest {
  @Test
  void primaryKeyValidationRejectsConflictingColumnAndTableDeclarations() {
    final Column first = column("first").withConstraint(ColumnConstraint.PRIMARY_KEY);
    final Column second = column("second").withConstraint(ColumnConstraint.PRIMARY_KEY);
    assertFalse(DatabaseUtil.validateSinglePrimaryColumn(List.of(column("plain"))));
    assertTrue(DatabaseUtil.validateSinglePrimaryColumn(List.of(first)));
    assertThrows(
        IllegalArgumentException.class,
        () -> DatabaseUtil.validateSinglePrimaryColumn(List.of(first, second)));
    final TableConstraint constraint =
        new TableConstraint()
            .withConstraintType(TableConstraint.ConstraintType.PRIMARY_KEY)
            .withColumns(List.of("first"));
    assertThrows(
        IllegalArgumentException.class,
        () -> DatabaseUtil.validateConstraints(List.of(first), List.of(constraint)));
  }

  @Test
  void tableConstraintsMustReferenceAnExistingColumn() {
    final List<Column> columns = List.of(column("id"));
    assertDoesNotThrow(() -> DatabaseUtil.validateConstraints(columns, null));
    final TableConstraint valid =
        new TableConstraint()
            .withConstraintType(TableConstraint.ConstraintType.UNIQUE)
            .withColumns(List.of("id"));
    assertDoesNotThrow(() -> DatabaseUtil.validateConstraints(columns, List.of(valid)));
    final TableConstraint invalid =
        new TableConstraint()
            .withConstraintType(TableConstraint.ConstraintType.UNIQUE)
            .withColumns(List.of("ID"));
    assertThrows(
        IllegalArgumentException.class,
        () -> DatabaseUtil.validateConstraints(columns, List.of(invalid)));
  }

  @Test
  void partitionValidationKeepsTheBigQueryPseudoColumns() {
    final List<Column> columns = List.of(column("id"));
    assertDoesNotThrow(() -> DatabaseUtil.validateTablePartition(columns, null));
    assertDoesNotThrow(() -> DatabaseUtil.validateTablePartition(columns, new TablePartition()));
    assertDoesNotThrow(
        () ->
            DatabaseUtil.validateTablePartition(
                columns,
                new TablePartition()
                    .withColumns(
                        List.of(
                            partition("id"),
                            partition("_PARTITIONDATE"),
                            partition("_PARTITIONTIME")))));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            DatabaseUtil.validateTablePartition(
                columns, new TablePartition().withColumns(List.of(partition("missing")))));
  }

  @Test
  void validColumnsNormalizeTheTypeDisplayWithoutChangingTheirType() {
    final Column implicit = column("id");
    final Column explicit =
        column("amount").withDataTypeDisplay("NUMERIC(20,4)").withPrecision(20).withScale(4);
    DatabaseUtil.validateColumns(List.of(implicit, explicit));
    assertEquals("bigint", implicit.getDataTypeDisplay());
    assertEquals("numeric(20,4)", explicit.getDataTypeDisplay());
    assertEquals(ColumnDataType.BIGINT, explicit.getDataType());
  }

  @ParameterizedTest
  @EnumSource(
      value = ColumnDataType.class,
      names = {"CHAR", "VARCHAR", "BINARY", "VARBINARY"})
  void boundedTypesRequireADataLength(final ColumnDataType type) {
    final Column column = column("value").withDataType(type);
    assertThrows(
        IllegalArgumentException.class, () -> DatabaseUtil.validateColumns(List.of(column)));
    column.setDataLength(20);
    assertDoesNotThrow(() -> DatabaseUtil.validateColumns(List.of(column)));
  }

  @Test
  void arrayTypeValidationRejectsMissingTypesAndClearsIrrelevantOnes() {
    final Column array = column("values").withDataType(ColumnDataType.ARRAY);
    assertThrows(IllegalArgumentException.class, () -> DatabaseUtil.validateArrayColumn(array));
    array.setArrayDataType(ColumnDataType.BIGINT);
    assertDoesNotThrow(() -> DatabaseUtil.validateArrayColumn(array));
    final Column scalar = column("value").withArrayDataType(ColumnDataType.TEXT);
    DatabaseUtil.validateArrayColumn(scalar);
    assertNull(scalar.getArrayDataType());
  }

  @Test
  void structsRequireChildrenWithUniqueNames() {
    final Column struct = column("nested").withDataType(ColumnDataType.STRUCT).withChildren(null);
    assertThrows(IllegalArgumentException.class, () -> DatabaseUtil.validateStructColumn(struct));
    struct.setChildren(List.of(column("child"), column("child")));
    assertThrows(IllegalArgumentException.class, () -> DatabaseUtil.validateStructColumn(struct));
    struct.setChildren(List.of(column("child"), column("CHILD")));
    assertDoesNotThrow(() -> DatabaseUtil.validateStructColumn(struct));
  }

  @Test
  void scaleRequiresSufficientPrecision() {
    final Column column = column("amount");
    assertDoesNotThrow(() -> DatabaseUtil.validatePrecisionAndScale(column));
    column.setPrecision(10);
    assertDoesNotThrow(() -> DatabaseUtil.validatePrecisionAndScale(column));
    column.setScale(10);
    assertDoesNotThrow(() -> DatabaseUtil.validatePrecisionAndScale(column));
    column.setScale(11);
    assertThrows(
        IllegalArgumentException.class, () -> DatabaseUtil.validatePrecisionAndScale(column));
    column.setPrecision(null);
    assertThrows(
        IllegalArgumentException.class, () -> DatabaseUtil.validatePrecisionAndScale(column));
  }

  private Column column(final String name) {
    return new Column().withName(name).withDataType(ColumnDataType.BIGINT);
  }

  private PartitionColumnDetails partition(final String name) {
    return new PartitionColumnDetails().withColumnName(name);
  }
}
