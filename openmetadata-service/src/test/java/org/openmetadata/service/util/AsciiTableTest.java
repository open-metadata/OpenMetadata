package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class AsciiTableTest {

  @Test
  void renderPrintsHeadersAndNormalizesMissingValues() {
    AsciiTable table =
        new AsciiTable(
            Arrays.asList("Name", null),
            Arrays.asList(Arrays.asList("alpha", null), List.of("beta")),
            true,
            "(null)",
            "(empty)");

    String rendered = table.render();

    assertTrue(rendered.contains("| Name  | (No column name) |"));
    assertTrue(rendered.contains("| alpha | (null)           |"));
    assertTrue(rendered.contains("| beta  | -                |"));
  }

  @Test
  void renderUsesEmptyTextAndCanOmitHeader() {
    AsciiTable table = new AsciiTable(List.of("Only"), List.of(), false, "(null)", "none");

    String rendered = table.render();

    assertTrue(rendered.contains("none"));
    assertEquals(3, rendered.lines().count());
  }

  @Test
  void renderTrimsLongValuesAndExposesLogo() {
    AsciiTable table =
        new AsciiTable(
            List.of("Column"),
            List.of(List.of("value-that-is-longer-than-column-width")),
            true,
            "(null)",
            "(empty)");

    String rendered = table.render();

    assertTrue(rendered.contains("value-that-is-longer-than-column-width"));
    assertTrue(AsciiTable.printOpenMetadataText().contains("|||||||"));
  }
}
