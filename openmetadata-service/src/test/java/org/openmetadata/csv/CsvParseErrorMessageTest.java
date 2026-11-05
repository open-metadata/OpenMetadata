/*
 *  Copyright 2026 Collate
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

package org.openmetadata.csv;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.StringReader;
import java.io.UncheckedIOException;
import org.apache.commons.csv.CSVFormat;
import org.junit.jupiter.api.Test;

class CsvParseErrorMessageTest {
  private static final String HEADER = "name,description\r\n";

  @Test
  void charactersAfterClosingQuoteNameTheLineAndTheFix() {
    assertEquals(
        "line 2 has characters after the closing quote of a quoted value. A closing quote must be"
            + " followed by a comma or the end of the line; to put a quote inside a value, write it"
            + " twice (\"\").",
        CsvParseErrorMessage.describe(parserMessageFor(HEADER + "\"term\"x,desc\r\n")));
  }

  @Test
  void unclosedQuoteNamesTheLineWhereTheValueStarts() {
    assertEquals(
        "line 3 starts a quoted value that is never closed. Add the missing closing quote.",
        CsvParseErrorMessage.describe(
            parserMessageFor(HEADER + "ok,fine\r\n\"term,desc\r\nnext,row\r\n")));
  }

  @Test
  void unrecognizedMessageKeepsItsTextWithoutTheFileOffset() {
    assertEquals(
        "Unexpected token at line: 4",
        CsvParseErrorMessage.describe("Unexpected token at line: 4, position: 512"));
    assertEquals("unknown parser error", CsvParseErrorMessage.describe(null));
  }

  // Parses with the real library so a Commons CSV upgrade that rewords its errors fails here.
  private static String parserMessageFor(String csv) {
    UncheckedIOException failure =
        assertThrows(
            UncheckedIOException.class,
            () -> CSVFormat.DEFAULT.parse(new StringReader(csv)).getRecords());
    return failure.getCause().getMessage();
  }
}
