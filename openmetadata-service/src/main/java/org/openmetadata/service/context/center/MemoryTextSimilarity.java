package org.openmetadata.service.context.center;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.MatchResult;
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

  /** A citation names where a value is written, not the value: "section 3", "§ 4.2", "pp. 3-5". */
  private static final Pattern CITATIONS =
      Pattern.compile(
          "(?i)(?:\\b(?:sections?|sec\\.|pages?|pp?\\.|chapters?|clauses?|paragraphs?|appendix)|§)"
              + "\\s*\\d+(?:\\.\\d+)*(?:\\s*[-–&]\\s*\\d+(?:\\.\\d+)*)*");

  private static final Pattern NUMBERS =
      Pattern.compile("\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?");
  private static final double QUESTION_WEIGHT = 0.6;
  private static final double ANSWER_WEIGHT = 0.4;

  private MemoryTextSimilarity() {}

  /**
   * One answer replaces a number of the other: two values for one fact, not a rewording. An added
   * or dropped number, a section, a year or an edition, is a rewording: "15%" and "15% (section
   * 3)" agree, "15%" and "20%" do not, nor do "15% (2025)" and "20% (2025)". Numbers compare by
   * value, so "1,500" and "1500" are one number, and a citation is no value: "section 3" and
   * "section 4" agree.
   */
  static boolean hasConflictingNumbers(String answerA, String answerB) {
    Set<String> a = numbers(answerA);
    Set<String> b = numbers(answerB);
    return !a.isEmpty() && !b.isEmpty() && !a.containsAll(b) && !b.containsAll(a);
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

  /** Drops grouping commas and leading zeros; trailing zeros stay, so "3.10" is not "3.1". */
  private static String byValue(String number) {
    return new BigDecimal(number.replace(",", "")).toPlainString();
  }

  static String withoutCitations(String text) {
    return text == null ? null : CITATIONS.matcher(text).replaceAll(" ");
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
