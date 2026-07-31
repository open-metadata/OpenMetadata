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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

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
}
