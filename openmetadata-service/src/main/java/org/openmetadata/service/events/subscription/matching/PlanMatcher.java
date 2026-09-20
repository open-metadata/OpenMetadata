package org.openmetadata.service.events.subscription.matching;

import java.util.List;
import org.openmetadata.schema.type.ChangeEvent;

/**
 * Does this event belong to this alert? Three rules, each a consequence of what an event is about
 * rather than a branch of its own: a source admits an event when it is the wildcard, names the
 * subject's type or names the event's own type; filters judge the subject; and a trigger applies
 * only to change events of the type of the source it belongs to.
 */
public final class PlanMatcher {

  private static final String EVERYTHING = "all";

  private PlanMatcher() {}

  /** Told how each condition answered, for the count of what production has exercised. */
  @FunctionalInterface
  public interface Answers {
    void answered(String condition, boolean yes);
  }

  public static boolean matches(
      MatchingPlan plan, ChangeEvent event, ConditionEvaluator evaluator) {
    return matches(plan, event, evaluator, (condition, yes) -> {});
  }

  public static boolean matches(
      MatchingPlan plan, ChangeEvent event, ConditionEvaluator evaluator, Answers answers) {
    EventSubject subject = EventSubject.of(event);
    return admits(plan.sources(), subject)
        && allHold(plan.filters(), evaluator, answers)
        && triggersHold(plan, subject, evaluator, answers);
  }

  // Entity events match a source's name exactly, as they always have: an alert saved as "All" has
  // never fired, and ignoring case now would wake it as an alert on everything. Conversations
  // have always been routed without regard to case.
  private static boolean admits(List<String> sources, EventSubject subject) {
    boolean wildcard = sources.size() == 1 && EVERYTHING.equals(sources.getFirst());
    boolean named =
        subject.changeEvent()
            ? sources.contains(subject.ownType())
            : sources.stream()
                .anyMatch(
                    source ->
                        source.equalsIgnoreCase(subject.ownType())
                            || source.equalsIgnoreCase(subject.subjectType()));
    return wildcard || named;
  }

  // An event meets only the triggers of its own type. No such group means no match, which is also
  // why an alert with triggers never delivers a conversation: it is not a change event at all.
  private static boolean triggersHold(
      MatchingPlan plan, EventSubject subject, ConditionEvaluator evaluator, Answers answers) {
    boolean hold = true;
    if (plan.hasTriggers()) {
      List<MatchingPlan.Selection> ownGroup =
          subject.changeEvent() ? plan.triggersBySource().get(subject.subjectType()) : null;
      hold = ownGroup != null && allHold(ownGroup, evaluator, answers);
    }
    return hold;
  }

  // Every included condition true and every excluded one false.
  private static boolean allHold(
      List<MatchingPlan.Selection> selections, ConditionEvaluator evaluator, Answers answers) {
    boolean hold = true;
    for (int index = 0; hold && index < selections.size(); index++) {
      MatchingPlan.Selection selection = selections.get(index);
      boolean yes = evaluator.isTrue(selection.condition());
      answers.answered(selection.name(), yes);
      hold = yes == selection.include();
    }
    return hold;
  }
}
