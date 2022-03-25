package org.openmetadata.catalog.dropwizard.metrics;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

public class DimensionedNameTest {
  @Test
  public void canDecodeDimensionedString() {
    final String dimensioned = "test[key1:val1,key2:val2,key3:val3]";

    final DimensionedName dimensionedName = DimensionedName.decode(dimensioned);

    assertEquals("test", dimensionedName.getName());
    assertEquals(3, dimensionedName.getDimensions().size());
  }

  @Test
  public void canEncodeDimensionedNameToString() {
    final DimensionedName dimensionedName =
        DimensionedName.withName("test")
            .withDimension("key1", "val1")
            .withDimension("key2", "val2")
            .withDimension("key3", "val3")
            .build();

    assertEquals("test[key1:val1,key2:val2,key3:val3]", dimensionedName.encode());
  }

  @Test
  public void canDeriveDimensionedNameFromCurrent() {
    final DimensionedName dimensionedName =
        DimensionedName.withName("test")
            .withDimension("key1", "val1")
            .withDimension("key2", "val2")
            .withDimension("key3", "val3")
            .build();

    final DimensionedName derivedDimensionedName =
        dimensionedName.withDimension("key3", "new_value").withDimension("key4", "val4").build();

    assertEquals("test[key1:val1,key2:val2,key3:val3]", dimensionedName.encode());
    assertEquals("test[key1:val1,key2:val2,key3:new_value,key4:val4]", derivedDimensionedName.encode());
  }
}
