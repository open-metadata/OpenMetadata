package org.openmetadata.catalog;

import org.openmetadata.catalog.jdbi3.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.LabelType;
import org.openmetadata.catalog.type.TagLabel.State;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Enum ordinal number is stored in the database. New enums must be added at the end to ensure
 * backward compatibility
 */
public class EnumBackwardCompatibilityTest {
  /**
   * Any time a new enum is added, this test will fail. Update the test with total number of enums and test the
   * ordinal number of the last enum. This will help catch new enum inadvertently being added in the middle.
   */
  @Test
  public void testRelationshipEnumBackwardCompatible() {
    assertEquals(13, Relationship.values().length);
    assertEquals(12, Relationship.JOINED_WITH.ordinal());
  }

  /**
   * Any time a new enum is added, this test will fail. Update the test with total number of enums and test the
   * ordinal number of the last enum. This will help catch new enum inadvertently being added in the middle.
   */
  @Test
  public void testTagLabelEnumBackwardCompatible() {
    assertEquals(4, LabelType.values().length);
    assertEquals(3, LabelType.DERIVED.ordinal());
  }

  /**
   * Any time a new enum is added, this test will fail. Update the test with total number of enums and test the
   * ordinal number of the last enum. This will help catch new enum inadvertently being added in the middle.
   */
  @Test
  public void testTagStateEnumBackwardCompatible() {
    assertEquals(2, TagLabel.State.values().length);
    assertEquals(1, State.CONFIRMED.ordinal());
  }
}
