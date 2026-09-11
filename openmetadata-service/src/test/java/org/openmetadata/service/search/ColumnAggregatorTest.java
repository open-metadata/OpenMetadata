/*
 *  Copyright 2025 Collate
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ColumnGridItem;
import org.openmetadata.schema.api.data.ColumnGridResponse;
import org.openmetadata.schema.api.data.ColumnMetadataGroup;
import org.openmetadata.schema.api.data.MetadataStatus;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.search.ColumnAggregator.ColumnAggregationRequest;

class ColumnAggregatorTest {

  @Test
  void toCaseInsensitiveRegex_simpleAlpha() {
    String regex = ColumnAggregator.toCaseInsensitiveRegex("MAT");

    assertEquals(".*[mM][aA][tT].*", regex);
    Pattern pattern = Pattern.compile(regex);
    assertTrue(pattern.matcher("MAT").matches());
    assertTrue(pattern.matcher("mat").matches());
    assertTrue(pattern.matcher("Mat").matches());
    assertTrue(pattern.matcher("MATNR").matches());
    assertTrue(pattern.matcher("some_mat_column").matches());
    assertFalse(pattern.matcher("MBA").matches());
  }

  @Test
  void toCaseInsensitiveRegex_mixedCase() {
    String regex = ColumnAggregator.toCaseInsensitiveRegex("MaTnR");

    Pattern pattern = Pattern.compile(regex);
    assertTrue(pattern.matcher("MATNR").matches());
    assertTrue(pattern.matcher("matnr").matches());
    assertTrue(pattern.matcher("MaTnR").matches());
    assertFalse(pattern.matcher("MATMR").matches());
  }

  @Test
  void toCaseInsensitiveRegex_withDigits() {
    String regex = ColumnAggregator.toCaseInsensitiveRegex("col1");

    Pattern pattern = Pattern.compile(regex);
    assertTrue(pattern.matcher("COL1").matches());
    assertTrue(pattern.matcher("col1").matches());
    assertTrue(pattern.matcher("my_col1_name").matches());
    assertFalse(pattern.matcher("col2").matches());
  }

  @Test
  void toCaseInsensitiveRegex_withUnderscore() {
    String regex = ColumnAggregator.toCaseInsensitiveRegex("col_name");

    Pattern pattern = Pattern.compile(regex);
    assertTrue(pattern.matcher("col_name").matches());
    assertTrue(pattern.matcher("COL_NAME").matches());
    assertTrue(pattern.matcher("my_col_name_here").matches());
  }

  @Test
  void toCaseInsensitiveRegex_escapesRegexSpecialChars() {
    String regex = ColumnAggregator.toCaseInsensitiveRegex("col.name");

    Pattern pattern = Pattern.compile(regex);
    assertTrue(pattern.matcher("col.name").matches());
    // Dot should be literal, not wildcard
    assertFalse(pattern.matcher("colXname").matches());
  }

  @Test
  void toCaseInsensitiveRegex_singleChar() {
    String regex = ColumnAggregator.toCaseInsensitiveRegex("a");

    assertEquals(".*[aA].*", regex);
    Pattern pattern = Pattern.compile(regex);
    assertTrue(pattern.matcher("A").matches());
    assertTrue(pattern.matcher("abc").matches());
    assertTrue(pattern.matcher("XAY").matches());
  }

  @Test
  void toCaseInsensitiveRegex_emptyString() {
    String regex = ColumnAggregator.toCaseInsensitiveRegex("");

    assertEquals(".*.*", regex);
    Pattern pattern = Pattern.compile(regex);
    assertTrue(pattern.matcher("anything").matches());
    assertTrue(pattern.matcher("").matches());
  }

  @Test
  void toCaseInsensitiveRegex_specialCharsAreEscaped() {
    String regex = ColumnAggregator.toCaseInsensitiveRegex("a+b*c?");

    Pattern pattern = Pattern.compile(regex);
    assertTrue(pattern.matcher("a+b*c?").matches());
    assertTrue(pattern.matcher("prefix_a+b*c?_suffix").matches());
    // Plus and star should be literal, not regex quantifiers
    assertFalse(pattern.matcher("abbbbc").matches());
  }

  // ---- Row-level (post-grouping) filter + pagination helpers (issue #26824) ----

  private static ColumnGridItem item(String name, MetadataStatus status, boolean hasVariations) {
    ColumnGridItem gi = new ColumnGridItem();
    gi.setColumnName(name);
    gi.setMetadataStatus(status);
    gi.setHasVariations(hasVariations);
    gi.setTotalOccurrences(1);
    ColumnMetadataGroup group = new ColumnMetadataGroup();
    if (status == MetadataStatus.COMPLETE || status == MetadataStatus.INCONSISTENT) {
      group.setDescription("desc");
      group.setTags(List.of(new TagLabel().withTagFQN("PII.Sensitive")));
    } else if (status == MetadataStatus.INCOMPLETE) {
      group.setDescription("desc");
    }
    gi.setGroups(new ArrayList<>(List.of(group)));
    return gi;
  }

  private static ColumnAggregationRequest request(String metadataStatus) {
    ColumnAggregationRequest r = new ColumnAggregationRequest();
    r.setMetadataStatus(metadataStatus);
    return r;
  }

  @Test
  void matchesRowFilters_metadataStatusMatchesAggregateStatus() {
    ColumnGridItem complete = item("a", MetadataStatus.COMPLETE, false);
    ColumnGridItem incomplete = item("b", MetadataStatus.INCOMPLETE, false);

    assertTrue(ColumnAggregator.matchesRowFilters(complete, request("COMPLETE")));
    assertFalse(ColumnAggregator.matchesRowFilters(incomplete, request("COMPLETE")));
    assertTrue(ColumnAggregator.matchesRowFilters(incomplete, request("INCOMPLETE")));
    // Case-insensitive
    assertTrue(ColumnAggregator.matchesRowFilters(complete, request("complete")));
  }

  @Test
  void matchesRowFilters_inconsistentIsAFirstClassStatus() {
    ColumnGridItem inconsistent = item("a", MetadataStatus.INCONSISTENT, true);
    ColumnGridItem complete = item("b", MetadataStatus.COMPLETE, false);

    // The reported bug: "COMPLETE" must NOT return inconsistent rows.
    assertFalse(ColumnAggregator.matchesRowFilters(inconsistent, request("COMPLETE")));
    assertTrue(ColumnAggregator.matchesRowFilters(inconsistent, request("INCONSISTENT")));
    assertFalse(ColumnAggregator.matchesRowFilters(complete, request("INCONSISTENT")));
  }

  @Test
  void matchesRowFilters_nullOrBlankStatusMatchesEverything() {
    ColumnGridItem complete = item("a", MetadataStatus.COMPLETE, false);
    assertTrue(ColumnAggregator.matchesRowFilters(complete, request(null)));
    assertTrue(ColumnAggregator.matchesRowFilters(complete, request("   ")));
  }

  @Test
  void matchesRowFilters_hasConflictsRequiresVariations() {
    ColumnAggregationRequest r = new ColumnAggregationRequest();
    r.setHasConflicts(true);
    assertTrue(ColumnAggregator.matchesRowFilters(item("a", MetadataStatus.INCONSISTENT, true), r));
    assertFalse(ColumnAggregator.matchesRowFilters(item("b", MetadataStatus.COMPLETE, false), r));
  }

  @Test
  void paginateFilteredItems_filtersAndComputesTotalsFromFilteredSet() {
    List<ColumnGridItem> all =
        new ArrayList<>(
            List.of(
                item("complete_1", MetadataStatus.COMPLETE, false),
                item("inconsistent_1", MetadataStatus.INCONSISTENT, true),
                item("complete_2", MetadataStatus.COMPLETE, false),
                item("missing_1", MetadataStatus.MISSING, false)));

    ColumnAggregationRequest r = request("COMPLETE");
    r.setSize(10);

    ColumnGridResponse resp = ColumnAggregator.paginateFilteredItems(all, r);

    // Only the two COMPLETE rows survive, and totals reflect the FILTERED set (not 4).
    assertEquals(2, resp.getTotalUniqueColumns());
    assertEquals(2, resp.getColumns().size());
    assertTrue(
        resp.getColumns().stream().allMatch(c -> c.getMetadataStatus() == MetadataStatus.COMPLETE));
    assertNull(resp.getCursor());
  }

  @Test
  void paginateFilteredItems_paginatesConsistentlyAcrossPages() {
    List<ColumnGridItem> all = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      all.add(item(String.format("col_%02d", i), MetadataStatus.COMPLETE, false));
    }

    ColumnAggregationRequest page1 = request("COMPLETE");
    page1.setSize(2);
    ColumnGridResponse r1 = ColumnAggregator.paginateFilteredItems(all, page1);

    assertEquals(5, r1.getTotalUniqueColumns());
    assertEquals(2, r1.getColumns().size());
    assertEquals("col_00", r1.getColumns().get(0).getColumnName());
    assertEquals("col_01", r1.getColumns().get(1).getColumnName());
    assertNotNull(r1.getCursor(), "more pages remain, so a cursor is returned");

    ColumnAggregationRequest page2 = request("COMPLETE");
    page2.setSize(2);
    page2.setCursor(r1.getCursor());
    ColumnGridResponse r2 = ColumnAggregator.paginateFilteredItems(all, page2);

    assertEquals(5, r2.getTotalUniqueColumns());
    assertEquals(2, r2.getColumns().size());
    assertEquals("col_02", r2.getColumns().get(0).getColumnName());
    assertEquals("col_03", r2.getColumns().get(1).getColumnName());
    assertNotNull(r2.getCursor());

    ColumnAggregationRequest page3 = request("COMPLETE");
    page3.setSize(2);
    page3.setCursor(r2.getCursor());
    ColumnGridResponse r3 = ColumnAggregator.paginateFilteredItems(all, page3);

    assertEquals(1, r3.getColumns().size(), "last page has the remaining single item");
    assertEquals("col_04", r3.getColumns().get(0).getColumnName());
    assertNull(r3.getCursor(), "cursor is null on the last page");
  }
}
