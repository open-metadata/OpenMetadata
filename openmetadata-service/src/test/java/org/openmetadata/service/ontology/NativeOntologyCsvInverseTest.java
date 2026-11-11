package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.net.URI;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec.Column;

class NativeOntologyCsvInverseTest {
  private static final String EX = "https://example.org/";

  @Test
  void aCsvThatNamesTheInverseOnOneSideDeclaresBothSides() {
    final NativeOntologyDocument document =
        read(property("buys", "boughtBy"), property("boughtBy", ""));

    assertEquals(URI.create(EX + "boughtBy"), inverseOf(document, "buys"));
    assertEquals(URI.create(EX + "buys"), inverseOf(document, "boughtBy"));
  }

  @Test
  void aPartnerThatNamesADifferentInverseKeepsIt() {
    final NativeOntologyDocument document =
        read(property("buys", "boughtBy"), property("boughtBy", "sells"));

    assertEquals(URI.create(EX + "sells"), inverseOf(document, "boughtBy"));
  }

  @Test
  void aPartnerOutsideTheFileIsLeftAlone() {
    final NativeOntologyDocument document = read(property("buys", "boughtBy"));

    assertEquals(URI.create(EX + "boughtBy"), inverseOf(document, "buys"));
    assertEquals(1, document.properties().size());
  }

  @Test
  void aPropertyWithoutAnInverseStaysWithout() {
    assertNull(inverseOf(read(property("buys", "")), "buys"));
  }

  private static URI inverseOf(final NativeOntologyDocument document, final String name) {
    return document.properties().stream()
        .filter(property -> property.getIri().equals(URI.create(EX + name)))
        .findFirst()
        .orElseThrow()
        .getInverse();
  }

  private static NativeOntologyDocument read(final String... rows) {
    return NativeOntologyCsvCodec.read(
        NativeOntologyCsvCodec.HEADER + "\r\n" + String.join("\r\n", rows) + "\r\n");
  }

  private static String property(final String name, final String inverse) {
    final String[] cells = new String[Column.values().length];
    Arrays.fill(cells, "");
    cells[Column.KIND.ordinal()] = "PROPERTY";
    cells[Column.IRI.ordinal()] = EX + name;
    cells[Column.PROPERTY_KIND.ordinal()] = "OBJECT";
    cells[Column.INVERSE.ordinal()] = inverse.isEmpty() ? "" : EX + inverse;
    return NativeOntologyCsvCodec.ROW_FORMAT.format((Object[]) cells);
  }
}
