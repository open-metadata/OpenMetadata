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

package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.State;
import org.openmetadata.schema.type.TagLabel.TagSource;

/**
 * Enum ordinal number is stored in the database. New enums must be added at the end to ensure backward compatibility
 *
 * <p>Any time a new enum is added in the middle instead of at the end or enum ordinal value change, this test will
 * fail. Update the test with total number of enums and test the ordinal number of the last enum. This will help catch
 * new enum inadvertently being added in the middle.
 */
class EnumBackwardCompatibilityTest {
  /** */
  @Test
  void testRelationshipEnumBackwardCompatible() {
    assertEquals(23, Relationship.values().length);
    assertEquals(21, Relationship.DEFAULTS_TO.ordinal());
    assertEquals(20, Relationship.EDITED_BY.ordinal());
    assertEquals(19, Relationship.EXPERT.ordinal());
    assertEquals(18, Relationship.VOTED.ordinal());
    assertEquals(17, Relationship.REACTED_TO.ordinal());
    assertEquals(16, Relationship.REVIEWS.ordinal());
  }

  /**
   * Any time a new enum is added, this test will fail. Update the test with total number of enums and test the ordinal
   * number of the last enum. This will help catch new enum inadvertently being added in the middle.
   */
  @Test
  void testTagLabelEnumBackwardCompatible() {
    assertEquals(5, LabelType.values().length);
    assertEquals(0, LabelType.MANUAL.ordinal());
    assertEquals(1, LabelType.PROPAGATED.ordinal());
    assertEquals(2, LabelType.AUTOMATED.ordinal());
    assertEquals(3, LabelType.DERIVED.ordinal());
    assertEquals(4, LabelType.GENERATED.ordinal());
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

  /**
   * Any time a new enum is added, this test will fail. Update the test with total number of enums and test the ordinal
   * number of the last enum. This will help catch new enum inadvertently being added in the middle.
   */
  @Test
  void testTagSourceEnumBackwardCompatible() {
    assertEquals(0, TagSource.CLASSIFICATION.ordinal());
    assertEquals(1, TagSource.GLOSSARY.ordinal());
  }

  /**
   * Any time a new enum is added, this test will fail. Update the test with total number of enums and test the ordinal
   * number of the last enum. This will help catch new enum inadvertently being added in the middle.
   */
  @Test
  void testAccessCardinality() {
    // Don't change the ordinal values of the Access
    assertEquals(0, Access.DENY.ordinal());
    assertEquals(1, Access.ALLOW.ordinal());
    assertEquals(2, Access.CONDITIONAL_DENY.ordinal());
    assertEquals(3, Access.CONDITIONAL_ALLOW.ordinal());
    assertEquals(4, Access.NOT_ALLOW.ordinal());
  }
}
