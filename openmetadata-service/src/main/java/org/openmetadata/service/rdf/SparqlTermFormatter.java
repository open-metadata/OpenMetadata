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

package org.openmetadata.service.rdf;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Renders one SPARQL 1.2 Query Results JSON term as display text.
 *
 * <p>Every other term type carries its text in {@code "value"}, but an RDF 1.2 triple term carries a
 * nested subject/predicate/object object there instead. Consumers that read {@code "value"} as a
 * string get an empty cell for one, so the nested form is rendered in N-Triples syntax. Nested terms
 * are written in full syntax (angle brackets, quotes, language and direction tags) because inside a
 * triple term the bare lexical form cannot be told apart from an IRI.
 */
public final class SparqlTermFormatter {
  private static final String TYPE = "type";
  private static final String VALUE = "value";
  private static final String DATATYPE = "datatype";
  private static final String LANGUAGE = "xml:lang";
  private static final String DIRECTION = "its:dir";
  private static final String SUBJECT = "subject";
  private static final String PREDICATE = "predicate";
  private static final String OBJECT = "object";
  private static final String TRIPLE = "triple";
  private static final String URI = "uri";
  private static final String BNODE = "bnode";

  private SparqlTermFormatter() {}

  /** Display text for a bound term: its lexical value, or RDF 1.2 syntax for a triple term. */
  public static String displayText(final JsonNode term) {
    return isTripleTerm(term) ? tripleSyntax(term.path(VALUE)) : term.path(VALUE).asText("");
  }

  public static boolean isTripleTerm(final JsonNode term) {
    return TRIPLE.equals(term.path(TYPE).asText(""));
  }

  private static String termSyntax(final JsonNode term) {
    return switch (term.path(TYPE).asText("")) {
      case URI -> "<" + term.path(VALUE).asText("") + ">";
      case BNODE -> "_:" + term.path(VALUE).asText("");
      case TRIPLE -> tripleSyntax(term.path(VALUE));
      default -> literalSyntax(term);
    };
  }

  private static String tripleSyntax(final JsonNode value) {
    return "<<( %s %s %s )>>"
        .formatted(
            termSyntax(value.path(SUBJECT)),
            termSyntax(value.path(PREDICATE)),
            termSyntax(value.path(OBJECT)));
  }

  private static String literalSyntax(final JsonNode term) {
    return "\"" + escape(term.path(VALUE).asText("")) + "\"" + literalSuffix(term);
  }

  private static String literalSuffix(final JsonNode term) {
    final String language = term.path(LANGUAGE).asText("");
    final String datatype = term.path(DATATYPE).asText("");
    final String suffix;
    if (!language.isEmpty()) {
      suffix = languageSuffix(language, term.path(DIRECTION).asText(""));
    } else if (!datatype.isEmpty()) {
      suffix = "^^<" + datatype + ">";
    } else {
      suffix = "";
    }
    return suffix;
  }

  private static String languageSuffix(final String language, final String direction) {
    return direction.isEmpty() ? "@" + language : "@" + language + "--" + direction;
  }

  private static String escape(final String lexical) {
    return lexical
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t");
  }
}
