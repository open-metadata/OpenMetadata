/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.search.HighlightFieldClassifier.HighlightSupport;

/**
 * The classifier reads the real index-mapping resources, so these assertions are statements about
 * the shipped mappings — if a mapping changes shape, the test that names it is meant to fail.
 */
class HighlightFieldClassifierTest {

  @BeforeAll
  static void setup() throws IOException {
    IndexMappingLoader.init();
  }

  @Test
  void nonIndexedSubtreeIsNotHighlightable() {
    // `extension` is {"type":"object","enabled":false} in table_index_mapping.json — kept in
    // _source, never indexed, so a highlight on it can never match.
    assertEquals(
        HighlightSupport.NOT_INDEXED, HighlightFieldClassifier.classify("table", "extension"));
  }

  @Test
  void subfieldInheritsTheVerdictOfItsUnsupportedParent() {
    // The custom property itself is never named in the mapping; it is unsupported because the
    // `extension` node above it is. This is the case the UI can produce (FieldConfiguration renders
    // `extension.*` search fields with a highlight toggle).
    assertEquals(
        HighlightSupport.NOT_INDEXED,
        HighlightFieldClassifier.classify("table", "extension.someCustomProperty"));
    assertEquals(
        HighlightSupport.NOT_INDEXED,
        HighlightFieldClassifier.classify("table", "columns.children.name"));
  }

  @Test
  void flattenedFieldIsNotAnalyzable() {
    // aiGovernance.complianceStatus is the one genuinely `flattened` field left in the mappings.
    // OsUtils rewrites it to flat_object, which has no analyzer and fails the highlight shard.
    // The previous extension-only guard did not cover it.
    assertEquals(
        HighlightSupport.NOT_ANALYZABLE,
        HighlightFieldClassifier.classify("aiApplication", "aiGovernance.complianceStatus"));
    assertTrue(HighlightFieldClassifier.isHighlightUnsafeField("aiGovernance.complianceStatus"));
  }

  @Test
  void analyzedTextFieldsAreHighlightable() {
    assertEquals(HighlightSupport.SUPPORTED, HighlightFieldClassifier.classify("table", "name"));
    assertEquals(
        HighlightSupport.SUPPORTED, HighlightFieldClassifier.classify("table", "description"));
    assertEquals(
        HighlightSupport.SUPPORTED, HighlightFieldClassifier.classify("table", "columns.name"));
  }

  @Test
  void unmappedFieldIsTreatedAsSupported() {
    // The highlighter skips unmapped fields without erroring, so rejecting them would break
    // configurations that merely name a field this index does not carry.
    assertEquals(
        HighlightSupport.SUPPORTED,
        HighlightFieldClassifier.classify("table", "noSuchFieldAnywhere"));
    assertFalse(HighlightFieldClassifier.isHighlightUnsafeField("noSuchFieldAnywhere"));
  }

  @Test
  void unknownAssetTypeIsNotValidated() {
    assertEquals(
        HighlightSupport.SUPPORTED,
        HighlightFieldClassifier.classify("notAnEntityType", "extension"));
  }

  @Test
  void queryTimeGuardStillDropsExtensionAsBefore() {
    // Behaviour preserved from the guard this replaces (isFlattenedExtensionField): clusters whose
    // indexes were created while `extension` was still mapped `flattened` keep that mapping until a
    // reindex, so the drop must survive the mapping's move to enabled:false.
    assertTrue(HighlightFieldClassifier.isHighlightUnsafeField("extension"));
    assertTrue(HighlightFieldClassifier.isHighlightUnsafeField("extension.anything"));
  }

  @Test
  void crossIndexCollisionsStayLimitedToKnownNonHighlightablePaths() {
    // The query-time guard classifies without knowing the target index, so it uses the union of
    // unsupported paths. A path that is enabled:false in one mapping but a normal analyzed field in
    // another is therefore dropped everywhere. Three such collisions exist today and none is a
    // plausible highlight field; this pins that set so a mapping change that would newly swallow a
    // real field fails here rather than silently removing highlights in production.
    Set<String> knownCollisions =
        Set.of("changeDescription", "incrementalChangeDescription", "users");

    for (String field : knownCollisions) {
      assertTrue(
          HighlightFieldClassifier.isHighlightUnsafeField(field),
          field + " is expected to be dropped by the union guard");
    }
    assertFalse(
        HighlightFieldClassifier.isHighlightUnsafeField("description"),
        "a field analyzed in every index must never collide");
    assertFalse(
        HighlightFieldClassifier.isHighlightUnsafeField("name"),
        "a field analyzed in every index must never collide");
  }

  @Test
  void nullFieldIsNotUnsafe() {
    assertFalse(HighlightFieldClassifier.isHighlightUnsafeField(null));
  }
}
