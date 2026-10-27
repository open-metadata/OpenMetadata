package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;

class ColumnUtilTest {

  private Column column(String name, ColumnDataType dataType, Column... children) {
    return new Column()
        .withName(name)
        .withDataType(dataType)
        .withChildren(List.of(children))
        .withTags(List.of());
  }

  @Test
  void resolveColumnByPathReturnsTheNestedColumnForADottedPath() {
    List<Column> columns =
        List.of(
            column("id", ColumnDataType.NUMERIC),
            column("address", ColumnDataType.STRUCT, column("city", ColumnDataType.STRING)));
    assertEquals("city", ColumnUtil.resolveColumnByPath(columns, "address.city").getName());
  }

  @Test
  void resolveColumnByPathWalksMultipleNestingLevels() {
    Column leaf = column("name", ColumnDataType.STRING);
    List<Column> columns =
        List.of(
            column(
                "party",
                ColumnDataType.STRUCT,
                column(
                    "contact",
                    ColumnDataType.STRUCT,
                    column("address", ColumnDataType.STRUCT, leaf))));
    assertEquals(
        "name", ColumnUtil.resolveColumnByPath(columns, "party.contact.address.name").getName());
  }

  @Test
  void resolveColumnByPathMatchesSegmentsCaseInsensitively() {
    List<Column> columns =
        List.of(column("Address", ColumnDataType.STRUCT, column("City", ColumnDataType.STRING)));
    assertEquals("City", ColumnUtil.resolveColumnByPath(columns, "address.city").getName());
  }

  @Test
  void resolveColumnByPathPrefersTheExactCaseMatch() {
    List<Column> columns =
        List.of(
            column("address", ColumnDataType.STRUCT, column("city", ColumnDataType.STRING)),
            column("address", ColumnDataType.STRUCT, column("CITY", ColumnDataType.STRING)));
    assertEquals("city", ColumnUtil.resolveColumnByPath(columns, "address.city").getName());
  }

  @Test
  void resolveColumnByPathReturnsTheTopLevelColumnForAPlainName() {
    List<Column> columns = List.of(column("id", ColumnDataType.NUMERIC));
    assertEquals("id", ColumnUtil.resolveColumnByPath(columns, "id").getName());
  }

  @Test
  void resolveColumnByPathReturnsNullWhenASegmentIsMissing() {
    List<Column> columns =
        List.of(column("address", ColumnDataType.STRUCT, column("city", ColumnDataType.STRING)));
    assertNullPath(columns, "address.state");
    assertNullPath(columns, "street.city");
  }

  private void assertNullPath(List<Column> columns, String path) {
    assertTrue(
        ColumnUtil.resolveColumnByPath(columns, path) == null, "expected no match for " + path);
  }

  @Test
  void resolveColumnByPathTreatsAQuotedDottedSegmentAsASingleColumnName() {
    // A column literally named "a.b" arrives quoted in the entityLink path; the path must not be
    // split into two segments.
    List<Column> columns = List.of(column("a.b", ColumnDataType.STRING));
    assertEquals("a.b", ColumnUtil.resolveColumnByPath(columns, "\"a.b\"").getName());
  }

  @Test
  void resolveColumnByPathMatchesAnUnquotedDottedNameOfALiteralColumn() {
    // Legacy entityLinks carry a dotted column name unquoted; when it is not a nested path it
    // must still resolve to the literal column.
    List<Column> columns = List.of(column("a.b", ColumnDataType.STRING));
    assertEquals("a.b", ColumnUtil.resolveColumnByPath(columns, "a.b").getName());
  }

  @Test
  void resolveColumnByPathKeepsUnquotedSegmentsSeparate() {
    List<Column> columns =
        List.of(
            column("a", ColumnDataType.STRUCT, column("b", ColumnDataType.STRING)),
            column("c", ColumnDataType.STRING));
    assertEquals("b", ColumnUtil.resolveColumnByPath(columns, "a.b").getName());
    assertNotNull(ColumnUtil.resolveColumnByPath(columns, "c"));
  }

  @Test
  void validateColumnPathAcceptsAllAndValidLeafSegments() {
    List<Column> columns =
        List.of(column("address", ColumnDataType.STRUCT, column("city", ColumnDataType.STRING)));
    ColumnUtil.validateColumnPath(columns, "all");
    ColumnUtil.validateColumnPath(columns, "address");
    ColumnUtil.validateColumnPath(columns, "address.city");
  }

  @Test
  void validateColumnPathRejectsAnUnknownPath() {
    List<Column> columns =
        List.of(column("address", ColumnDataType.STRUCT, column("city", ColumnDataType.STRING)));
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> ColumnUtil.validateColumnPath(columns, "address.state"));
    assertEquals("Invalid column name address.state", exception.getMessage());
  }
}
