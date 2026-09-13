package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.Test;

class PatchFieldSelectionTest {
  @Test
  void absentProjectionAndExactMatchesKeepComparisons() {
    assertTrue(PatchFieldSelection.shouldCompare(null, "description"));
    assertTrue(PatchFieldSelection.shouldCompare(Set.of(), null));
    assertTrue(PatchFieldSelection.shouldCompare(Set.of("description"), "description"));
  }

  @Test
  void nestedPathsMatchTheirAncestorsAndDescendants() {
    assertTrue(PatchFieldSelection.shouldCompare(Set.of("columns.first"), "columns"));
    assertTrue(
        PatchFieldSelection.shouldCompare(Set.of("columns.first"), "columns.first.description"));
    assertTrue(PatchFieldSelection.shouldCompare(Set.of("columns"), "columns.first.description"));
  }

  @Test
  void unrelatedFieldsAndPartialNamePrefixesDoNotMatch() {
    assertFalse(PatchFieldSelection.shouldCompare(Set.of(), "description"));
    assertFalse(PatchFieldSelection.shouldCompare(Set.of("owners"), "description"));
    assertFalse(PatchFieldSelection.shouldCompare(Set.of("columns.first"), "columns.second"));
    assertFalse(PatchFieldSelection.shouldCompare(Set.of("column"), "columns.first"));
  }
}
