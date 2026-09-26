/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertSame;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.service.events.subscription.AlertDefinitionPolicy.FromSelections;
import org.openmetadata.service.events.subscription.AlertDefinitionPolicy.WrittenByHand;

/** Which alerts have rules compiled from selections, and what a save keeps of each kind. */
class AlertDefinitionPolicyTest {

  private static final EventFilterRule WRITTEN =
      new EventFilterRule()
          .withName("writtenByHand")
          .withEffect(ArgumentsInput.Effect.INCLUDE)
          .withCondition("true");

  @BeforeAll
  static void loadCatalog() {
    EventsSubscriptionRegistry.initialize(AlertCatalog.load());
  }

  // The form stores empty selection lists, which say no more than no selections at all.
  @Test
  void rulesWithNoSelectionsBehindThemWereWrittenByHand() {
    assertInstanceOf(WrittenByHand.class, AlertDefinitionPolicy.ofNew(handWritten(null)));
    assertInstanceOf(WrittenByHand.class, AlertDefinitionPolicy.ofNew(handWritten(selections())));
    assertInstanceOf(
        WrittenByHand.class,
        AlertDefinitionPolicy.ofNew(fromTheForm(byOwner()).withAlertType(AlertType.CUSTOM)));
    assertInstanceOf(FromSelections.class, AlertDefinitionPolicy.ofNew(fromTheForm(byOwner())));
    assertInstanceOf(FromSelections.class, AlertDefinitionPolicy.ofNew(fromTheForm()));
  }

  @Test
  void anUpdateKeepsTheStoredKindUntilItBringsSelections() {
    EventSubscription handWritten = handWritten(null);
    EventSubscription compiled = compiled(byOwner());

    assertInstanceOf(
        WrittenByHand.class,
        AlertDefinitionPolicy.ofUpdate(handWritten, handWritten(selections())));
    assertInstanceOf(
        FromSelections.class, AlertDefinitionPolicy.ofUpdate(handWritten, fromTheForm(byOwner())));
    assertInstanceOf(FromSelections.class, AlertDefinitionPolicy.ofUpdate(compiled, fromTheForm()));
  }

  // The form sends the stored rules back with empty selections, on every save.
  @Test
  void formSavesKeepRulesWrittenByHand() {
    EventSubscription stored = handWritten(null);
    for (int save = 0; save < 2; save++) {
      EventSubscription fromTheForm = handWritten(selections());
      settle(stored, fromTheForm, false);
      assertEquals(List.of(WRITTEN), fromTheForm.getFilteringRules().getRules());
      stored = fromTheForm;
    }
  }

  @Test
  void selectionsMadeInTheFormReplaceRulesWrittenByHand() {
    EventSubscription converted = fromTheForm(byOwner());
    converted.getFilteringRules().setRules(new ArrayList<>(List.of(WRITTEN)));

    settle(handWritten(null), converted, false);

    assertEquals(
        "matchAnyOwnerName({'alice'})",
        converted.getFilteringRules().getRules().getFirst().getCondition());
  }

  @Test
  void clearingTheSelectionsOfACompiledAlertLeavesNoRules() {
    EventSubscription cleared = fromTheForm();

    settle(compiled(byOwner()), cleared, false);

    assertEquals(List.of(), cleared.getFilteringRules().getRules());
  }

  @Test
  void putWithoutSelectionsKeepsTheStoredOnes() {
    EventSubscription stored = compiled(byOwner());
    EventSubscription put = alert(null);

    settle(stored, put, true);

    assertSame(stored.getInput(), put.getInput());
    assertEquals(stored.getFilteringRules().getRules(), put.getFilteringRules().getRules());
  }

  @Test
  void putKeepsRulesWrittenByHandAndPatchWritesThem() {
    EventSubscription put = alert(null);
    settle(handWritten(null), put, true);
    assertEquals(List.of(WRITTEN), put.getFilteringRules().getRules());

    EventSubscription patch = handWritten(null);
    patch.getFilteringRules().setRules(new ArrayList<>());
    settle(handWritten(null), patch, false);
    assertEquals(List.of(), patch.getFilteringRules().getRules());
  }

  private static void settle(EventSubscription stored, EventSubscription updated, boolean isPut) {
    AlertDefinitionPolicy.ofUpdate(stored, updated).settle(stored, updated, isPut);
  }

  private static EventSubscription compiled(ArgumentsInput... filters) {
    EventSubscription alert = fromTheForm(filters);
    AlertDefinitionPolicy.ofNew(alert).prepareNew(alert);
    return alert;
  }

  private static EventSubscription handWritten(AlertFilteringInput input) {
    EventSubscription alert = alert(input);
    alert.getFilteringRules().setRules(new ArrayList<>(List.of(WRITTEN)));
    return alert;
  }

  private static EventSubscription fromTheForm(ArgumentsInput... filters) {
    return alert(selections(filters));
  }

  private static EventSubscription alert(AlertFilteringInput input) {
    return new EventSubscription()
        .withName("alert")
        .withAlertType(AlertType.NOTIFICATION)
        .withFilteringRules(new FilteringRules().withResources(List.of("table")))
        .withInput(input);
  }

  private static AlertFilteringInput selections(ArgumentsInput... filters) {
    return new AlertFilteringInput().withFilters(List.of(filters)).withActions(List.of());
  }

  private static ArgumentsInput byOwner() {
    return new ArgumentsInput()
        .withName("filterByOwnerName")
        .withEffect(ArgumentsInput.Effect.INCLUDE)
        .withArguments(
            List.of(new Argument().withName("ownerNameList").withInput(List.of("alice"))));
  }
}
