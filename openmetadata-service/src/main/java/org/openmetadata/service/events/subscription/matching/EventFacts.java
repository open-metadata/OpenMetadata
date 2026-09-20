package org.openmetadata.service.events.subscription.matching;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * What is known about one event, asked once and answered the same way to everyone who asks:
 * matching asks if the owner is on a list, the audience asks who the owners are, and the two must
 * never read different sources or treat a failed read differently.
 *
 * <p>Every lookup answers one of three things: found, absent when there is genuinely nothing, or
 * failed when the read itself went wrong. Found values and absences are kept for the life of the
 * event. A failure never is, so the next reader tries again, and it is never turned into an
 * answer: an empty result that hides a failed read is how an alert matches, notifies nobody and
 * reports success.
 */
public final class EventFacts {

  /** The answer of one lookup. */
  public record Fact<T>(Optional<T> value, RuntimeException failure) {

    public boolean failed() {
      return failure != null;
    }

    /** The value, or nothing when it is absent. Throws when the read failed. */
    public Optional<T> orThrow() {
      if (failed()) {
        throw failure;
      }
      return value;
    }
  }

  private final Map<String, Fact<?>> known = new HashMap<>();

  @SuppressWarnings("unchecked")
  public <T> Fact<T> lookup(String what, Supplier<T> read) {
    Fact<T> fact = (Fact<T>) known.get(what);
    if (fact == null) {
      fact = answerOf(read);
      if (!fact.failed()) {
        known.put(what, fact);
      }
    }
    return fact;
  }

  private static <T> Fact<T> answerOf(Supplier<T> read) {
    Fact<T> fact;
    try {
      fact = new Fact<>(Optional.ofNullable(read.get()), null);
    } catch (RuntimeException e) {
      fact = new Fact<>(Optional.empty(), e);
    }
    return fact;
  }
}
