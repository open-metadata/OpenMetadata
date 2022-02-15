/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.LabelType;
import org.openmetadata.catalog.type.TagLabel.State;

/**
 * Enum ordinal number is stored in the database. New enums must be added at the end to ensure backward compatibility
 */
public class EnumBackwardCompatibilityTest {
  /**
   * Any time a new enum is added, this test will fail. Update the test with total number of enums and test the ordinal
   * number of the last enum. This will help catch new enum inadvertently being added in the middle.
   */
  @Test
  void testRelationshipEnumBackwardCompatible() {
    assertEquals(15, Relationship.values().length);
    assertEquals(14, Relationship.APPLIED_TO.ordinal());
  }

  /**
   * Any time a new enum is added, this test will fail. Update the test with total number of enums and test the ordinal
   * number of the last enum. This will help catch new enum inadvertently being added in the middle.
   */
  @Test
  void testTagLabelEnumBackwardCompatible() {
    assertEquals(4, LabelType.values().length);
    assertEquals(3, LabelType.DERIVED.ordinal());
  }

  /**
   * Any time a new enum is added, this test will fail. Update the test with total number of enums and test the ordinal
   * number of the last enum. This will help catch new enum inadvertently being added in the middle.
   */
  @Test
  void testTagStateEnumBackwardCompatible() {
    assertEquals(2, TagLabel.State.values().length);
    assertEquals(1, State.CONFIRMED.ordinal());
  }
}
