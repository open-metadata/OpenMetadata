package org.openmetadata.service.context.center;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Word-overlap similarity between two memories, matching the server-side duplicate probe's
 * semantics (question weighted over answer, Jaccard over 3+ character tokens) so "duplicate" means
 * the same thing at extraction time as it does on {@code POST /contextCenter/memories}.
 */
final class MemoryTextSimilarity {
  /** Same bar as {@code ContextMemoryResource.DUPLICATE_THRESHOLD}. */
  static final double DUPLICATE_THRESHOLD = 0.85;

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
