package org.openmetadata.service.glossary;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.glossary.GlossaryTermPropertyTestFixtures.enumProperty;
import static org.openmetadata.service.glossary.GlossaryTermPropertyTestFixtures.property;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.GlossaryTermProperty;
import org.openmetadata.schema.type.GlossaryTermPropertyDatatype;

class GlossaryTermPropertyChangeTest {
  @Test
  void aNonEnumPropertyWithNoEnumValuesIsComparedWithoutFailing() {
    GlossaryTermProperty before = property("retention", GlossaryTermPropertyDatatype.INTEGER);
    GlossaryTermProperty after =
        property("retention", GlossaryTermPropertyDatatype.INTEGER).withUnit("days");

    GlossaryTermPropertyChange change =
        GlossaryTermPropertyChange.between(List.of(before), List.of(after));

    assertTrue(change.isEmpty());
  }

  @Test
  void droppingAnEnumValueIsAShapeChange() {
    GlossaryTermProperty before = enumProperty("scope", false, true, "A", "B");
    GlossaryTermProperty after = enumProperty("scope", false, true, "A");

    GlossaryTermPropertyChange change =
        GlossaryTermPropertyChange.between(List.of(before), List.of(after));

    assertEquals(List.of(after), change.shapeChanged());
  }
}
