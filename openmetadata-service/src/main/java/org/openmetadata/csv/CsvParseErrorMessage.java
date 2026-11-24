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

import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Rewrites Commons CSV lexer errors into messages a CSV author can act on. The patterns match the
 * Commons CSV 1.12 wording; any other message is kept, minus its file-wide character offset.
 */
final class CsvParseErrorMessage {
  private static final Pattern CHARACTERS_AFTER_CLOSING_QUOTE =
      Pattern.compile("Invalid character between encapsulated token and delimiter at line: (\\d+)");
  private static final Pattern UNCLOSED_QUOTE =
      Pattern.compile("\\(startline (\\d+)\\) EOF reached before encapsulated token finished");
  private static final Pattern FILE_CHARACTER_OFFSET = Pattern.compile(",? position: \\d+");

  private CsvParseErrorMessage() {}

  static String describe(String parserMessage) {
    String rawMessage = Objects.requireNonNullElse(parserMessage, "unknown parser error");
    Matcher charactersAfterQuote = CHARACTERS_AFTER_CLOSING_QUOTE.matcher(rawMessage);
    Matcher unclosedQuote = UNCLOSED_QUOTE.matcher(rawMessage);
    String message = FILE_CHARACTER_OFFSET.matcher(rawMessage).replaceAll("");
    if (charactersAfterQuote.find()) {
      message =
          ("line %s has characters after the closing quote of a quoted value. A closing quote must"
                  + " be followed by a comma or the end of the line; to put a quote inside a value,"
                  + " write it twice (\"\").")
              .formatted(charactersAfterQuote.group(1));
    } else if (unclosedQuote.find()) {
      message =
          "line %s starts a quoted value that is never closed. Add the missing closing quote."
              .formatted(unclosedQuote.group(1));
    }
    return message;
  }
}
