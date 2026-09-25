package org.openmetadata.service.search;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Structural well-formedness check for the Lucene expression that {@code /v1/search/query} accepts
 * in {@code q}.
 *
 * <p>{@code query_string} hands {@code q} to Lucene's classic parser, which rejects a malformed
 * expression with a {@code parse_exception}. That surfaces as {@code all shards failed} and the
 * caller gets nothing back — so a user who has typed {@code revenue (draft} but not yet the closing
 * paren, or pasted a bare {@code :}, sees a failed search rather than no results. Issue #27990.
 *
 * <p>The rules below were each confirmed against a live engine rather than derived from the grammar:
 * {@code foo~} parses (default edit distance) while {@code foo^} does not, and {@code a + b} parses
 * while a lone {@code +} does not. The check stays deliberately conservative, so a parseable
 * expression always keeps its Lucene meaning; text it rejects is searched as literal words instead,
 * which is what a partially typed query means anyway. A malformed form it misses still reaches
 * Lucene and fails, but is reported as a 400 rather than a 500 — see {@link SearchEngineErrors}.
 */
public final class LuceneQuerySyntax {

  private static final Pattern WHITESPACE = Pattern.compile("\\s+");

  /** A fuzziness, then a boost — both optional, both taking a number. */
  private static final Pattern MODIFIER_SUFFIX =
      Pattern.compile("(~\\d*(\\.\\d+)?)?(\\^\\d+(\\.\\d+)?)?");

  private static final List<String> INFIX_OPERATORS = List.of("AND", "OR", "NOT");
  private static final List<String> PREFIX_ONLY_OPERATORS = List.of("AND", "OR");
  private static final List<String> LONE_MODIFIERS = List.of("+", "-", "!", "~", "^", ":");
  private static final char MASKED_TERM = 'x';

  private LuceneQuerySyntax() {}

  /**
   * Whether {@code query} can be handed to Lucene's classic parser. A {@code false} result means the
   * text is definitely unparseable, not merely unusual.
   */
  public static boolean isWellFormed(String query) {
    if (query == null || query.isBlank()) {
      return true;
    }
    String masked = withLiteralSpansMasked(query.trim());
    return hasBalancedDelimiters(masked) && hasOperandsForEveryOperator(masked);
  }

  /**
   * Replaces every span whose contents Lucene reads literally with a plain term: an escaped
   * character, a quoted phrase, a regex between slashes, and a range between brackets.
   *
   * <p>The term rules below describe bare terms only, so they must not look inside these spans —
   * {@code "10:30:00"} is a phrase rather than three field separators, {@code /^orders/} a regex
   * rather than a boost missing its number, and {@code [2024-01-01T00:00:00 TO ...]} a range rather
   * than a repeated field separator. Masking to a term rather than deleting keeps {@code
   * name:"foo bar"} looking like the field lookup it is.
   *
   * <p>An unterminated span is left in place, so the balance check still sees the delimiter that
   * opened it.
   */
  private static String withLiteralSpansMasked(String query) {
    StringBuilder masked = new StringBuilder(query.length());
    int index = 0;
    while (index < query.length()) {
      int spanEnd = endOfLiteralSpan(query, index);
      if (spanEnd > index) {
        masked.append(MASKED_TERM);
        index = spanEnd;
      } else {
        masked.append(query.charAt(index));
        index++;
      }
    }
    return masked.toString();
  }

  /**
   * Index just past the literal span opening at {@code start}, or {@code start} when none opens
   * there or the span never closes. A range accepts either closer, since Lucene reads {@code [a TO
   * b}} as a half-open range rather than a mismatch.
   */
  private static int endOfLiteralSpan(String query, int start) {
    char opener = query.charAt(start);
    if (opener == '\\') {
      return start + 2 <= query.length() ? start + 2 : start;
    }
    String closers =
        switch (opener) {
          case '"' -> "\"";
          case '/' -> "/";
          case '[', '{' -> "]}";
          default -> "";
        };
    if (closers.isEmpty()) {
      return start;
    }
    for (int index = start + 1; index < query.length(); index++) {
      if (query.charAt(index) == '\\') {
        index++;
      } else if (closers.indexOf(query.charAt(index)) >= 0) {
        return index + 1;
      }
    }
    return start;
  }

  /**
   * Parentheses nest, and quotes and regex slashes pair. Every balanced pair has already been masked
   * away, so a {@code "} or {@code /} still present is one that never closed — which is why {@code
   * foo/bar} fails while {@code a/b/c} parses.
   */
  private static boolean hasBalancedDelimiters(String maskedQuery) {
    int openParens = 0;
    for (int index = 0; index < maskedQuery.length(); index++) {
      char current = maskedQuery.charAt(index);
      if (current == '"' || current == '/') {
        return false;
      }
      if (current == '(') {
        openParens++;
      } else if (current == ')' && --openParens < 0) {
        return false;
      }
    }
    return openParens == 0;
  }

  private static boolean hasOperandsForEveryOperator(String query) {
    String[] terms = WHITESPACE.split(query);
    if (hasDanglingBooleanOperator(terms) || isLoneModifier(terms)) {
      return false;
    }
    for (String term : terms) {
      if (hasMalformedFieldSeparator(term) || hasMalformedModifier(term)) {
        return false;
      }
    }
    return true;
  }

  /** {@code a AND} has nothing to combine, and {@code AND a} nothing to combine it with. */
  private static boolean hasDanglingBooleanOperator(String[] terms) {
    return INFIX_OPERATORS.contains(terms[terms.length - 1])
        || PREFIX_ONLY_OPERATORS.contains(terms[0]);
  }

  /** {@code a + b} parses, but a query that is only {@code +} has no term to apply it to. */
  private static boolean isLoneModifier(String[] terms) {
    return terms.length == 1 && LONE_MODIFIERS.contains(terms[0]);
  }

  /**
   * A {@code :} separates one field name from one value, so it needs text on both sides and cannot
   * repeat within a term — {@code :foo}, {@code a:} and {@code a:b:c} are all rejected by Lucene.
   */
  private static boolean hasMalformedFieldSeparator(String term) {
    if (term.indexOf(':') < 0) {
      return false;
    }
    String[] parts = term.split(":", -1);
    return parts.length > 2 || parts[0].isEmpty() || parts[1].isEmpty();
  }

  /**
   * A term may carry a fuzziness and then a boost. {@code ~} takes an optional edit distance and
   * {@code ^} a required number, so {@code foo~}, {@code foo^2} and {@code foo~^2} all parse while
   * {@code foo^}, {@code foo~~} and {@code a~b} do not.
   */
  private static boolean hasMalformedModifier(String term) {
    int firstModifier = indexOfFirstModifier(term);
    if (firstModifier < 0) {
      return false;
    }
    if (firstModifier == 0) {
      return true;
    }
    return !MODIFIER_SUFFIX.matcher(term.substring(firstModifier)).matches();
  }

  private static int indexOfFirstModifier(String term) {
    int fuzziness = term.indexOf('~');
    int boost = term.indexOf('^');
    if (fuzziness < 0) {
      return boost;
    }
    return boost < 0 ? fuzziness : Math.min(fuzziness, boost);
  }
}
