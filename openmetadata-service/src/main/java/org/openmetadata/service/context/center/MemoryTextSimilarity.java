package org.openmetadata.service.context.center;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
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

  private static final double QUESTION_WEIGHT = 0.6;
  private static final double ANSWER_WEIGHT = 0.4;

  private MemoryTextSimilarity() {}

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
