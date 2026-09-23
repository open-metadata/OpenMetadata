package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FilteringRules;

class AlertDefinitionTest {

  @Test
  void savingTheSameSelectionsAgainIsNotAChange() {
    EventSubscription stored = alert(List.of("table"), List.of(byOwner("alice", "bob")), null);
    EventSubscription asTheUiSendsIt =
        alert(List.of("table"), List.of(byOwner("bob", "alice")), List.of());
    asTheUiSendsIt.getInput().getFilters().getFirst().withEffect(ArgumentsInput.Effect.INCLUDE);

    assertFalse(AlertDefinition.isSameDefinition(stored, asTheUiSendsIt), "values are ordered");
    assertTrue(
        AlertDefinition.isSameDefinition(
            stored, alert(List.of("table", "table"), List.of(byOwner("alice", "bob")), List.of())),
        "an absent list of triggers is an empty one, and a source named twice is named once");
  }

  @Test
  void absentEffectIsIncludeAndTheJoiningWordIsNotPartOfIt() {
    ArgumentsInput plain = byOwner("alice");
    ArgumentsInput spelledOut =
        byOwner("alice")
            .withEffect(ArgumentsInput.Effect.INCLUDE)
            .withPrefixCondition(ArgumentsInput.PrefixCondition.OR);

    assertTrue(
        AlertDefinition.isSameDefinition(
            alert(List.of("table"), List.of(plain), null),
            alert(List.of("table"), List.of(spelledOut), null)));
  }

  @Test
  void anotherSourceFilterOrEffectIsAChange() {
    EventSubscription stored = alert(List.of("table"), List.of(byOwner("alice")), null);

    assertFalse(
        AlertDefinition.isSameDefinition(
            stored, alert(List.of("topic"), List.of(byOwner("alice")), null)));
    assertFalse(
        AlertDefinition.isSameDefinition(
            stored, alert(List.of("table"), List.of(byOwner("carol")), null)));
    assertFalse(
        AlertDefinition.isSameDefinition(
            stored,
            alert(
                List.of("table"),
                List.of(byOwner("alice").withEffect(ArgumentsInput.Effect.EXCLUDE)),
                null)));
  }

  // A source the catalog does not know cannot be compiled, so the alert keeps the text it has.
  @Test
  void definitionThatCannotBeCompiledKeepsItsWholeStoredText() {
    FilteringRules stored = new FilteringRules().withResources(List.of("thread", "task"));
    EventSubscription upgraded = alert(List.of("thread", "task"), List.of(), null);

    assertSame(stored, AlertDefinition.compileOrKeep(upgraded, stored));
  }

  private static EventSubscription alert(
      List<String> sources, List<ArgumentsInput> filters, List<ArgumentsInput> triggers) {
    return new EventSubscription()
        .withName("alert")
        .withAlertType(AlertType.NOTIFICATION)
        .withFilteringRules(new FilteringRules().withResources(sources))
        .withInput(new AlertFilteringInput().withFilters(filters).withActions(triggers));
  }

  private static ArgumentsInput byOwner(String... owners) {
    return new ArgumentsInput()
        .withName("filterByOwnerName")
        .withArguments(
            List.of(new Argument().withName("ownerNameList").withInput(List.of(owners))));
  }
}
