package org.openmetadata.service.context.center;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.MatchResult;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Word-overlap similarity used to preserve a source's pill identity when extraction rephrases it.
 */
final class MemoryTextSimilarity {
  /**
   * Bar for deciding that a freshly-derived pill is the same fact as a stored one, so it inherits
   * that pill's identity and retrieval telemetry instead of replacing it with a new row. Roughly
   * half the vocabulary overlapping (question-weighted) is enough to match a rephrased fact.
   */
  static final double IDENTITY_THRESHOLD = 0.5;

  /**
   * A citation in parentheses names where a value is written, not the value: "(section 3)",
   * "(Table 4)", "(§ 4.2)", "(pp. 3-5)". Outside parentheses a word like "page" may be the fact
   * itself ("50 results per page"), so only parenthesized citations are set aside.
   */
  private static final Pattern PARENTHESIZED = Pattern.compile("\\(([^()]*)\\)");

  private static final Pattern CITATION =
      Pattern.compile(
          "(?i)(?:\\b(?:sections?|sec\\.|pages?|pp?\\.|chapters?|clauses?|paragraphs?|appendix"
              + "|articles?|tables?|figures?|annex(?:es)?|schedules?|parts?)\\s*|§\\s*)"
              + "\\d+(?:\\.\\d+)*(?:\\s*(?:[-–&]|and)\\s*\\d+(?:\\.\\d+)*)*");

  /** Words a rewording adds or drops without asking anything else: "What's" is "What is". */
  private static final Set<String> FILLER =
      Set.of("a", "an", "the", "is", "are", "was", "were", "s", "do", "does", "did");

  /** Words that frame a question without naming what it asks about. */
  private static final Set<String> QUESTION_FRAME =
      Set.of("what", "which", "who", "whom", "whose", "how", "when", "where", "why");

  private static final Pattern NUMBERS =
      Pattern.compile(
          "(?:(?<![\\p{L}\\p{N}])[+\\-−])?"
              + "(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)");
  private static final double QUESTION_WEIGHT = 0.6;
  private static final double ANSWER_WEIGHT = 0.4;

  private MemoryTextSimilarity() {}

  /**
   * One answer replaces a number of the other: two values for one fact, not a rewording. An added
   * or dropped number, a year or an edition, is a rewording: "15%" and "15% (2025)" agree, "15%"
   * and "20%" do not, nor do "15% (2025)" and "20% (2025)". Grouping commas and leading zeros
   * aside ("1,500" is "1500"), numbers compare as written, and a parenthesized citation is no
   * value: "15% (section 3)" and "15% (section 4)" agree.
   */
  static boolean hasConflictingNumbers(String answerA, String answerB) {
    Set<String> a = numbers(answerA);
    Set<String> b = numbers(answerB);
    return !a.isEmpty() && !b.isEmpty() && !a.containsAll(b) && !b.containsAll(a);
  }

  /** Whether {@code text} states a number another value could replace. */
  static boolean hasNumbers(String text) {
    return !numbers(text).isEmpty();
  }

  private static Set<String> numbers(String text) {
    return text == null
        ? Set.of()
        : NUMBERS
            .matcher(withoutCitations(text))
            .results()
            .map(MatchResult::group)
            .map(MemoryTextSimilarity::byValue)
            .collect(Collectors.toSet());
  }

  /**
   * Drops grouping commas, leading zeros and a fraction of zeros ("1,500.00" is "1500"); any other
   * fraction stays as written, so "3.10" is not "3.1".
   */
  private static String byValue(String number) {
    BigDecimal value = new BigDecimal(number.replace(",", "").replace('−', '-'));
    return value.stripTrailingZeros().scale() <= 0
        ? value.setScale(0).toPlainString()
        : value.toPlainString();
  }

  static String withoutCitations(String text) {
    return text == null
        ? null
        : PARENTHESIZED
            .matcher(text)
            .replaceAll(
                group ->
                    Matcher.quoteReplacement(
                        "(" + CITATION.matcher(group.group(1)).replaceAll(" ") + ")"));
  }

  /**
   * One question in other words: every word counts, short ones too ("UK" is not "US", "Q3" is not
   * "Q4"), and in order, except filler a rewording adds or drops ("What is" and "What's" ask the
   * same).
   */
  static boolean sameQuestion(String questionA, String questionB) {
    return questionWords(questionA).equals(questionWords(questionB));
  }

  private static List<String> questionWords(String text) {
    return text == null
        ? List.of()
        : Arrays.stream(text.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+"))
            .filter(word -> !word.isEmpty() && !FILLER.contains(word))
            .toList();
  }

  /**
   * How far two questions ask about the same thing: the overlap {@link #weighted} scores, over the
   * words naming the topic, a plural folded ("window for refunds" is the "refund window", "discount
   * rate" not the "VAT rate"). 0 when either has no topic word it reads: Cyrillic, "What is Q3?".
   */
  static double questionSimilarity(String questionA, String questionB) {
    Set<String> topicA = topicWords(questionA);
    Set<String> topicB = topicWords(questionB);
    return topicA.isEmpty() || topicB.isEmpty() ? 0.0 : jaccard(topicA, topicB);
  }

  private static Set<String> topicWords(String question) {
    return tokenize(question).stream()
        .filter(word -> !FILLER.contains(word) && !QUESTION_FRAME.contains(word))
        .map(MemoryTextSimilarity::singular)
        .collect(Collectors.toSet());
  }

  /** "refunds" is "refund"; a word ending in "ss" ("process") is no plural. */
  private static String singular(String word) {
    return word.endsWith("s") && !word.endsWith("ss") ? word.substring(0, word.length() - 1) : word;
  }

  static double weighted(String questionA, String answerA, String questionB, String answerB) {
    return QUESTION_WEIGHT * jaccard(tokenize(questionA), tokenize(questionB))
        + ANSWER_WEIGHT * jaccard(tokenize(answerA), tokenize(answerB));
  }

  private static Set<String> tokenize(String text) {
    if (text == null || text.isBlank()) {
      return Set.of();
    }
    return Arrays.stream(text.toLowerCase(Locale.ROOT).split("\\W+"))
        .filter(token -> token.length() >= 3)
        .collect(Collectors.toSet());
  }

  private static double jaccard(Set<String> a, Set<String> b) {
    if (a.isEmpty() && b.isEmpty()) {
      return 1.0;
    }
    if (a.isEmpty() || b.isEmpty()) {
      return 0.0;
    }
    Set<String> intersection = new HashSet<>(a);
    intersection.retainAll(b);
    Set<String> union = new HashSet<>(a);
    union.addAll(b);
    return (double) intersection.size() / union.size();
  }
}
