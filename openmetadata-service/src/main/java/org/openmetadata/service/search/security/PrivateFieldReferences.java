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

package org.openmetadata.service.search.security;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Whether part of a search names a field only admins and bots read: a user's {@code email} or one
 * of its sub-fields, by name or by a field pattern that matches it. Only field names are read,
 * never values, so a filter on a column called "email" or on the tag PII.Email names none.
 */
final class PrivateFieldReferences {
  private static final String EMAIL = "email";
  private static final List<String> EMAIL_FIELDS = List.of(EMAIL, EMAIL + ".keyword");
  private static final String WILDCARD = "*";
  private static final Set<String> FIELD_PARAMETERS =
      Set.of("field", "fields", "default_field", "path");
  // Without fields these search the index's default field, which is every field.
  private static final Set<String> FULL_TEXT_QUERIES =
      Set.of("query_string", "simple_query_string", "multi_match", "more_like_this");
  private static final List<String> FIELDS_PARAMETERS = List.of("fields", "default_field");
  private static final String QUERY_STRING = "query_string";
  private static final String QUERY = "query";
  private static final String SCRIPT = "script";
  private static final String WRAPPER = "wrapper";
  // A repeated key or trailing content would be read one way here and another by the engine.
  private static final ObjectReader STRICT_JSON =
      new ObjectMapper()
          .reader()
          .with(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
          .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

  private PrivateFieldReferences() {}

  /** Whether a field name or field pattern, boosted or not ({@code email^2}), covers a private one. */
  static boolean isPrivateField(String fieldOrPattern) {
    if (nullOrEmpty(fieldOrPattern)) {
      return false;
    }
    String field = withoutBoost(fieldOrPattern).toLowerCase(Locale.ROOT);
    return field.equals(EMAIL)
        || field.startsWith(EMAIL + ".")
        || (field.contains(WILDCARD)
            && EMAIL_FIELDS.stream().anyMatch(name -> matchesPattern(field, name)));
  }

  /** Whether {@code name} matches {@code pattern}, where {@code *} stands for any characters. */
  static boolean matchesPattern(String pattern, String name) {
    if (!pattern.contains(WILDCARD)) {
      return pattern.equalsIgnoreCase(name);
    }
    String regex =
        Arrays.stream(pattern.split("\\*", -1))
            .map(Pattern::quote)
            .collect(Collectors.joining(".*"));
    return Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(name).matches();
  }

  private static String withoutBoost(String field) {
    int boost = field.indexOf('^');
    return (boost < 0 ? field : field.substring(0, boost)).trim();
  }

  /**
   * Whether a Lucene query string names a private field. Escapes Lucene would refuse count as
   * naming one, since the name they spell cannot be read.
   */
  static boolean inLuceneQuery(String query) {
    try {
      return luceneFieldNames(query).stream().anyMatch(PrivateFieldReferences::isPrivateField);
    } catch (IllegalArgumentException e) {
      return true;
    }
  }

  /** The fields a Lucene query string names, as {@link LuceneFieldNames} reads them. */
  static List<String> luceneFieldNames(String query) {
    return nullOrEmpty(query) ? List.of() : new LuceneFieldNames(query).read();
  }

  /**
   * Whether query DSL names a private field: as a field key, in a field parameter, in a {@code
   * query_string}'s query or in a wrapped query, or by searching every field. A script counts as
   * naming one, since it can build a field name at run time, and so does DSL that cannot be read
   * strictly.
   */
  static boolean inQueryDsl(String json) {
    if (nullOrEmpty(json) || json.isBlank()) {
      return false;
    }
    try {
      return inNode(STRICT_JSON.readTree(json));
    } catch (JsonProcessingException e) {
      return true;
    }
  }

  private static boolean inNode(JsonNode node) {
    boolean names = false;
    if (node.isObject()) {
      for (Map.Entry<String, JsonNode> entry : node.properties()) {
        names = names || inEntry(entry.getKey(), entry.getValue());
      }
    } else if (node.isArray()) {
      for (JsonNode element : node) {
        names = names || inNode(element);
      }
    }
    return names;
  }

  private static boolean inEntry(String key, JsonNode value) {
    return isPrivateField(key)
        || (FIELD_PARAMETERS.contains(key) && namesPrivateField(value))
        || (FULL_TEXT_QUERIES.contains(key) && searchesPrivateField(key, value))
        || SCRIPT.equals(key)
        || (WRAPPER.equals(key) && inWrappedQuery(value))
        || inNode(value);
  }

  private static boolean namesPrivateField(JsonNode value) {
    boolean names = value.isTextual() && isPrivateField(value.asText());
    if (value.isArray()) {
      for (JsonNode element : value) {
        names = names || namesPrivateField(element);
      }
    }
    return names;
  }

  private static boolean searchesPrivateField(String queryType, JsonNode body) {
    boolean everyField =
        body.isObject()
            && FIELDS_PARAMETERS.stream().allMatch(parameter -> nullOrEmpty(body.get(parameter)));
    boolean namedInQuery =
        QUERY_STRING.equals(queryType) && inLuceneQuery(body.path(QUERY).asText(null));
    return everyField || namedInQuery;
  }

  private static boolean inWrappedQuery(JsonNode wrapper) {
    String encoded = wrapper.path(QUERY).asText("");
    try {
      return inQueryDsl(new String(Base64.getDecoder().decode(encoded), StandardCharsets.UTF_8));
    } catch (IllegalArgumentException e) {
      return true;
    }
  }

  /**
   * Reads field names out of a query string the way Lucene's classic parser splits them: the term
   * before each colon outside a quoted phrase or a regular expression, whitespace allowed between
   * them, and the field an {@code _exists_} clause names. An escaped character belongs to its term;
   * a leading {@code +} or {@code -} is an operator and a later one part of the term. A name comes
   * out with its escapes resolved as Lucene resolves them, {@code \}{@code uXXXX} included.
   */
  private static final class LuceneFieldNames {
    private static final String EXISTS = "_exists_";
    private static final String TERM_ENDS = "()[]{}^~!";
    private static final String PREFIX_OPERATORS = "+-";
    private static final char ESCAPE = '\\';
    private static final int HEX_DIGITS = 4;
    private final String query;
    private final List<String> fields = new ArrayList<>();
    private final StringBuilder term = new StringBuilder();
    private String termBeforeSpace;
    private boolean existsFieldNext;
    private int position;

    private LuceneFieldNames(String query) {
      this.query = query;
    }

    private List<String> read() {
      for (position = 0; position < query.length(); position++) {
        read(query.charAt(position));
      }
      endTerm();
      return fields;
    }

    private void read(char character) {
      switch (character) {
        case ESCAPE -> appendEscaped();
        case ':' -> endField();
        case '"', '/' -> readQuoted(character);
        default -> readUnquoted(character);
      }
    }

    private void readUnquoted(char character) {
      if (Character.isWhitespace(character)) {
        endTerm();
      } else if (TERM_ENDS.indexOf(character) >= 0
          || (term.isEmpty() && PREFIX_OPERATORS.indexOf(character) >= 0)) {
        endTerm();
        termBeforeSpace = null;
      } else {
        term.append(character);
      }
    }

    // The escape stays in the term, so the name is resolved once, the way Lucene resolves it.
    private void appendEscaped() {
      term.append(ESCAPE);
      if (position + 1 < query.length()) {
        position++;
        term.append(query.charAt(position));
      }
    }

    private void endField() {
      String raw = term.isEmpty() ? termBeforeSpace : term.toString();
      endTerm();
      termBeforeSpace = null;
      String field = raw == null ? null : unescape(raw);
      if (field != null && !isMatchAll(field)) {
        fields.add(field);
        existsFieldNext = EXISTS.equals(field);
      }
    }

    private void endTerm() {
      if (!term.isEmpty()) {
        termBeforeSpace = term.toString();
        addExistsField(termBeforeSpace);
        term.setLength(0);
      }
    }

    private void addExistsField(String raw) {
      if (existsFieldNext) {
        fields.add(unescape(raw));
        existsFieldNext = false;
      }
    }

    private void readQuoted(char delimiter) {
      endTerm();
      termBeforeSpace = null;
      StringBuilder content = new StringBuilder();
      for (position++; position < query.length() && query.charAt(position) != delimiter; ) {
        if (query.charAt(position) == ESCAPE) {
          content.append(ESCAPE);
          position++;
        }
        if (position < query.length()) {
          content.append(query.charAt(position));
        }
        position++;
      }
      addExistsField(content.toString());
    }

    /**
     * Resolves escapes as Lucene's classic parser does ({@code QueryParserBase.discardEscapeChar}):
     * a backslash keeps the next character, and {@code \}{@code u} with four hex digits is that
     * UTF-16 unit. Escapes Lucene refuses, truncated or not hex, throw.
     */
    private static String unescape(String raw) {
      StringBuilder name = new StringBuilder(raw.length());
      for (int i = 0; i < raw.length(); i++) {
        char character = raw.charAt(i);
        if (character != ESCAPE) {
          name.append(character);
          continue;
        }
        if (i + 1 == raw.length()) {
          throw new IllegalArgumentException("A field name cannot end with an escape");
        }
        char escaped = raw.charAt(++i);
        if (escaped == 'u') {
          name.append(unicodeUnit(raw, i + 1));
          i += HEX_DIGITS;
        } else {
          name.append(escaped);
        }
      }
      return name.toString();
    }

    private static char unicodeUnit(String raw, int start) {
      if (start + HEX_DIGITS > raw.length()) {
        throw new IllegalArgumentException("Truncated unicode escape in a field name");
      }
      int unit = 0;
      for (int i = start; i < start + HEX_DIGITS; i++) {
        int digit = Character.digit(raw.charAt(i), 16);
        if (digit < 0) {
          throw new IllegalArgumentException("Invalid unicode escape in a field name");
        }
        unit = unit * 16 + digit;
      }
      return (char) unit;
    }

    // `*:*` matches every document, while `*:` before anything else searches every field.
    private boolean isMatchAll(String field) {
      int next = position + 1;
      while (next < query.length() && Character.isWhitespace(query.charAt(next))) {
        next++;
      }
      int after = next + 1;
      return WILDCARD.equals(field)
          && next < query.length()
          && query.charAt(next) == '*'
          && (after == query.length()
              || Character.isWhitespace(query.charAt(after))
              || query.charAt(after) == ')');
    }
  }
}
