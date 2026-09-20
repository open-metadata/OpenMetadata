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
  private static final char MASKED_PHRASE = 'x';

  private LuceneQuerySyntax() {}

  /**
   * Whether {@code query} can be handed to Lucene's classic parser. A {@code false} result means the
   * text is definitely unparseable, not merely unusual.
   */
  public static boolean isWellFormed(String query) {
    if (query == null || query.isBlank()) {
      return true;
    }
    String trimmed = query.trim();
    return hasBalancedDelimiters(trimmed)
        && hasOperandsForEveryOperator(
            withQuotedPhrasesMasked(withEscapedCharactersMasked(trimmed)));
  }

  /**
   * Replaces each {@code \x} pair with a plain character. An escaped character is literal, so it
   * must not be read as syntax or as a term boundary — {@code orders\ AND} is the single term
   * {@code orders AND}, not a dangling operator.
   */
  private static String withEscapedCharactersMasked(String query) {
    StringBuilder masked = new StringBuilder(query.length());
    for (int index = 0; index < query.length(); index++) {
      char current = query.charAt(index);
      if (current == '\\' && index + 1 < query.length()) {
        masked.append(MASKED_PHRASE);
        index++;
      } else {
        masked.append(current);
      }
    }
    return masked.toString();
  }

  /**
   * Replaces each quoted phrase with a plain term. Everything inside quotes is literal to Lucene —
   * {@code "10:30:00"} is a phrase, not three field separators — so the term rules below must not
   * see it. Masking to a term rather than deleting keeps {@code name:"foo bar"} looking like the
   * field lookup it is.
   */
  private static String withQuotedPhrasesMasked(String query) {
    StringBuilder masked = new StringBuilder(query.length());
    boolean insideQuotes = false;
    boolean escaped = false;
    for (int index = 0; index < query.length(); index++) {
      char current = query.charAt(index);
      boolean wasEscaped = escaped;
      escaped = !wasEscaped && current == '\\';
      if (!wasEscaped && current == '"') {
        insideQuotes = !insideQuotes;
        if (insideQuotes) {
          masked.append(MASKED_PHRASE);
        }
      } else if (!insideQuotes) {
        masked.append(current);
      }
    }
    return masked.toString();
  }

  /**
   * Parentheses nest, and quotes and regex slashes pair. Characters inside a quoted phrase are
   * literal, so only delimiters outside one are counted — an unpaired {@code /} opens a regex Lucene
   * never sees the end of, which is why {@code foo/bar} fails while {@code a/b/c} parses.
   */
  private static boolean hasBalancedDelimiters(String query) {
    int openParens = 0;
    int regexDelimiters = 0;
    boolean insideQuotes = false;
    boolean escaped = false;
    for (int index = 0; index < query.length(); index++) {
      char current = query.charAt(index);
      if (escaped) {
        escaped = false;
      } else if (current == '\\') {
        escaped = true;
      } else if (current == '"') {
        insideQuotes = !insideQuotes;
      } else if (insideQuotes) {
        continue;
      } else if (current == '/') {
        regexDelimiters++;
      } else if (current == '(') {
        openParens++;
      } else if (current == ')' && --openParens < 0) {
        return false;
      }
    }
    return openParens == 0 && !insideQuotes && regexDelimiters % 2 == 0;
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
