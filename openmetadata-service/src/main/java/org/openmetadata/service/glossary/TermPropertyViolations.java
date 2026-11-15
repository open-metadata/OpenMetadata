package org.openmetadata.service.glossary;

import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.service.exception.CustomExceptionMessage;

/** The terms that break a rule, kept to a bounded sample plus a total so a message stays small. */
final class TermPropertyViolations {
  static final int SAMPLE_LIMIT = 20;
  private static final String CONFLICT_ERROR_TYPE = "GLOSSARY_TERM_PROPERTY_CONFLICT";

  private final List<String> sample = new ArrayList<>();
  private int total;

  void add(final String termFqn) {
    total++;
    if (sample.size() < SAMPLE_LIMIT) {
      sample.add(termFqn);
    }
  }

  boolean isEmpty() {
    return total == 0;
  }

  int total() {
    return total;
  }

  List<String> sample() {
    return List.copyOf(sample);
  }

  String describe() {
    final String names = String.join(", ", sample);
    return total > sample.size() ? "%s and %d more".formatted(names, total - sample.size()) : names;
  }

  void throwConflictIfAny(final String reason) {
    if (!isEmpty()) {
      throw conflict("%s: %s".formatted(reason, describe()));
    }
  }

  static CustomExceptionMessage conflict(final String message) {
    return new CustomExceptionMessage(Response.Status.CONFLICT, CONFLICT_ERROR_TYPE, message);
  }
}
